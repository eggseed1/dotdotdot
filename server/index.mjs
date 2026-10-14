import {searchTmdbMovies,exactTmdbMovies,enrichTmdbMovie,tmdbEnabled} from './tmdb-films.mjs';
import {searchTVMaze,exactTV} from './tvmaze-live.mjs';
/** Actual live guest 1v1 server; deliberately separate from the static GitHub Pages frontend.
 * Start via npm run server. Production: build first, then npm start. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { scoreRound, eloDelta } from './duel-rules.mjs';
import { createCatalogStore } from './catalog-store.mjs';
import {searchAniList,exactAniList,aniListScore} from './anilist-live.mjs';
import {searchWikidataGames,exactGameMatches,enrichWikidataGame} from './wikidata-games.mjs';
import {searchVNDB,exactVNDB,vnRarity} from './vndb-live.mjs';
import {searchWikidataFilms,enrichWikidataFilm,exactFilmMatches} from './wikidata-films.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const dailyEditorial=JSON.parse(fs.readFileSync(path.join(root,'src/data/daily-editorial.json'),'utf8'));
const editorialAnswers={...JSON.parse(fs.readFileSync(path.join(root,'src/data/editorial-answers.json'),'utf8')),...JSON.parse(fs.readFileSync(path.join(root,'src/data/thematic-answers.json'),'utf8'))};
const editorialAliases=JSON.parse(fs.readFileSync(path.join(root,'src/data/thematic-aliases-ko.json'),'utf8'));
const localizedAnswer=(id,title)=>({titleKo:editorialAliases[id]?.[title]?.[0]||'',aliases:editorialAliases[id]?.[title]||[]});
const editorialRarity=JSON.parse(fs.readFileSync(path.join(root,'src/data/thematic-rarity.json'),'utf8'));
const rarityTiers=new Map(editorialRarity.tiers.map((t,i)=>[t.key,{...t,tier:5-i}]));
const editorialScore=(id,title)=>{const previousKey=editorialRarity.overrides[id]?.[title]||editorialRarity.defaults.tier;const key=editorialRarity.aliases?.[previousKey]||previousKey;const t=rarityTiers.get(key)||rarityTiers.get('schooler');return {points:t.points,tier:t.tier,rarityCategory:t.key,rarityLabelKo:t.labelKo,rarityLabelEn:t.labelEn,rarityMethod:editorialRarity.method,rarityReviewed:Boolean(editorialRarity.overrides[id]?.[title])};};
const normEditorial=v=>String(v||'').normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
const editorialMatch=(id,raw)=>{const list=editorialAnswers[id]?.answers||[];const i=list.findIndex(title=>normEditorial(title)===normEditorial(raw)||(editorialAliases[id]?.[title]||[]).some(alias=>normEditorial(alias)===normEditorial(raw)));return i<0?null:{title:list[i],...localizedAnswer(id,list[i]),...editorialScore(id,list[i])};};
const lineupFor=date=>{const ids=dailyEditorial[date];return Array.isArray(ids)&&ids.length===7&&new Set(ids).size===7&&ids.every(id=>promptById.has(id))?ids:null;};
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const ratingsFile = path.join(dataDir, 'guest-ratings.json');
const matchesFile = path.join(dataDir,'match-results.json');
const catalogFile=process.env.CATALOG_DB||path.join(dataDir,'catalog.sqlite');
// Open the catalog even if it did not exist at startup; bulk imports can then become visible live.
const sourceCatalog=createCatalogStore(catalogFile);
const port = Number(process.env.PORT || 8787);
const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { lookupAnswer, promptById, rarity, selectPrompts, eligible, todayKey } = await vite.ssrLoadModule('/src/lib/engine.ts');
const clients = new Map();
const queues = new Map([['all', []]]);
const invitations = new Map();
const matches = new Map();
let ratings = {};
let completedMatches={};
try{completedMatches=JSON.parse(fs.readFileSync(matchesFile,'utf8'));}catch{}
try { ratings = JSON.parse(fs.readFileSync(ratingsFile, 'utf8')); } catch { /* first launch */ }
const persist = () => { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(ratingsFile, JSON.stringify(ratings, null, 2)); };
const persistMatches=()=>{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(matchesFile,JSON.stringify(completedMatches,null,2));};
const possible=(promptId,limit=6)=>{const imported=sourceCatalog?.possible(promptId,limit);if(imported?.length)return imported.map(w=>({title:w.title,creator:w.creator,year:w.year,ratingCount:w.ratingCount,source:w.source}));const prompt=promptById.get(promptId);if(!prompt)return [];return [...eligible(prompt)].sort((a,b)=>a.popularity-b.popularity).slice(0,limit).map(w=>({title:w.title,creator:w.creator,year:w.year,source:'curated-demo'}));};
const who = id => ratings[id] ?? { name: 'GUEST', rating: 1000, played: 0, wins: 0 };
const send = (ws, msg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
const sendTo = (id, msg) => send(clients.get(id)?.ws, msg);
const announce = (match, msg) => match.players.forEach(id => sendTo(id, msg));
const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const code = () => { let c; do { c = unique(); } while (invitations.has(c)); return c; };
const currentMatch = id => [...matches.values()].find(m => m.players.includes(id) && m.phase !== 'finished');
const publicPlayer = id => ({ id, name: who(id).name, rating: who(id).rating });
const removeFromQueues = id => { for (const q of queues.values()) { let i; while ((i = q.findIndex(e => e.id === id)) !== -1) q.splice(i, 1); } for (const [c,v] of invitations) if (v.host === id) invitations.delete(c); };
const cleanName = n => String(n || 'GUEST').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 18) || 'GUEST';

function sync(id) {
  const m = currentMatch(id);
  sendTo(id, {type:'hello',player:publicPlayer(id)});
  if (!m) return;
  const side=m.players.indexOf(id), opponent=m.players[1-side];
  sendTo(id, {type:'match', matchId:m.id, mode:m.mode, ranked:m.ranked, round:m.round,
    prompt:promptById.get(m.prompts[m.round])?.label, promptBadge:promptById.get(m.prompts[m.round])?.badge,
    kind:promptById.get(m.prompts[m.round])?.kind, phase:m.phase, deadline:m.deadline, nextAt:m.nextAt,
    score:m.scores[id], rivalScore:m.scores[opponent], opponent:publicPlayer(opponent),
    ownLocked:Boolean(m.answers[id]), rivalLocked:Boolean(m.answers[opponent]),
    roundResult:m.roundResult?.[id] ?? null, rivalResult:m.roundResult?.[opponent] ?? null });
}
function startMatch(a,b,mode,ranked){
  removeFromQueues(a);removeFromQueues(b);
  const id=unique() + unique();
  const prompts=selectPrompts(mode, `${todayKey()}-${id}`).map(p=>p.id);
  const m={id,mode,ranked,players:[a,b],prompts,round:0,phase:'play',deadline:Date.now()+25000,nextAt:null,
    scores:{[a]:0,[b]:0},answers:{},roundResult:null,history:[]};
  matches.set(id,m);sync(a);sync(b);
}
function finishRound(m){
  if(m.phase!=='play')return;
  const computed = scoreRound(m.players, m.answers, m.scores);
  m.scores = computed.scores;
  m.roundResult = computed.results;
  m.phase='reveal';m.nextAt=Date.now()+4500;
  m.history.push({promptId:m.prompts[m.round],players:m.players.map(id=>({name:who(id).name,...computed.results[id]}))});
  for(const id of m.players)sync(id);
}
function finishMatch(m){
  m.phase='finished';
  const [a,b]=m.players;let changes={[a]:0,[b]:0};
  const resultA=m.scores[a]===m.scores[b]?0.5:m.scores[a]>m.scores[b]?1:0;
  if(m.ranked){
    changes={[a]:eloDelta(who(a).rating, who(b).rating, who(a).played, resultA),
      [b]:eloDelta(who(b).rating,who(a).rating,who(b).played,1-resultA)};
    for(const [id,change] of Object.entries(changes)){
      const current=who(id);ratings[id]={...current,rating:Math.max(0,current.rating+change),played:current.played+1,wins:current.wins+Number((id===a?resultA:1-resultA)===1)};
    }
    persist();
  }
  const shareId=m.id;
  completedMatches[shareId]={date:todayKey(),mode:m.mode,ranked:m.ranked,rounds:m.history,
    scores:m.players.map(id=>({name:who(id).name,score:m.scores[id],rating:who(id).rating})),
    possible:m.prompts.map(p=>({promptId:p,answers:possible(p)}))};
  if(Object.keys(completedMatches).length>250){for(const id of Object.keys(completedMatches).slice(0,-250))delete completedMatches[id];}
  persistMatches();
  for(const id of m.players){
    const other=m.players.find(p=>p!==id);
    sendTo(id,{type:'finished',shareId,rounds:m.history,possible:completedMatches[shareId].possible,score:m.scores[id],rivalScore:m.scores[other],opponent:publicPlayer(other),ranked:m.ranked,
      result:m.scores[id]===m.scores[other]?'draw':m.scores[id]>m.scores[other]?'win':'loss',rating:who(id).rating,eloChange:changes[id]});
  }
  setTimeout(()=>matches.delete(m.id),60000).unref();
}
const tick=setInterval(()=>{
  for(const m of matches.values()){
    if(m.phase==='play' && (Date.now()>=m.deadline || m.players.every(id=>m.answers[id])))finishRound(m);
    else if(m.phase==='reveal' && Date.now()>=m.nextAt){
      if(m.round===6)finishMatch(m);
      else {m.round++;m.phase='play';m.answers={};m.roundResult=null;m.deadline=Date.now()+25000;m.nextAt=null;m.players.forEach(sync);}
    }
  }
},200);
tick.unref();

const mimetypes={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const origin=req.headers.origin||'';
  if(/^https:\/\/(eggseed1\.github\.io|dotdotdot-7yot\.onrender\.com)$/.test(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
  const parsedUrl=new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname=parsedUrl.pathname;
  if(pathname==='/api/suggest' && req.method==='GET'){
    const kind=parsedUrl.searchParams.get('kind'),q=(parsedUrl.searchParams.get('q')||'').slice(0,100);
    const allowed=new Set(['film','literature','anime','games','tv']);
    const local=allowed.has(kind)&&q.trim().length>=2&&kind==='literature'?sourceCatalog.suggest(kind,q,7):[];
    const respond=(more=[])=>{if(res.writableEnded)return;const found=[...local,...more],seen=new Set();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({suggestions:found.filter(w=>{const key=w.id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,7).map(w=>({id:w.id,kind:w.kind,title:w.title,titleKo:w.titleKo,creator:w.creator,year:w.year,source:w.source}))}));};
    if(kind==='film'&&q.trim().length>=2){Promise.allSettled([searchWikidataFilms(q,{limit:35}),searchTmdbMovies(q)]).then(results=>respond(results.flatMap(r=>r.status==='fulfilled'?r.value:[]))).catch(()=>respond());}
    else if(kind==='tv'&&q.trim().length>=2){searchTVMaze(q).then(respond).catch(()=>respond());}
    else if(kind==='anime'&&q.trim().length>=2){searchAniList(q).then(respond).catch(()=>respond());}
    else if(kind==='games'&&q.trim().length>=2){Promise.allSettled([searchVNDB(q),searchWikidataGames(q)]).then(results=>respond(results.flatMap(r=>r.status==='fulfilled'?r.value:[]))).catch(()=>respond());}
    else respond();
    return;
  }
  if(pathname==='/api/validate' && req.method==='POST'){
    let chunks='',bytes=0;
    req.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){req.destroy();return;}chunks+=chunk.toString('utf8');});
    req.on('end',async()=>{
      let request;try{request=JSON.parse(chunks);}catch{res.writeHead(400);res.end('{}');return;}
      const prompt=promptById.get(String(request.promptId||'')),raw=String(request.answer||'').slice(0,500);
      if(!prompt||prompt.kind==='music'||!sourceCatalog){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:'missing'}));return;}
      if(editorialAnswers[prompt.id]){
        let match=editorialMatch(prompt.id,raw);
        // Title-pattern prompts can safely accept additional already verified database entries.
        if(!match&&prompt.id==='f-title-number'){
          const work=sourceCatalog.lookup('film',raw).find(w=>w.verified&&/[0-9０-９]/u.test(w.title));
          if(work)match={title:work.title,...editorialScore(prompt.id,work.title)};
          // A small curated list must never reject an exact film title found in
          // public film databases. Confirm the result as a film before accepting.
          if(!match&&/[0-9０-９]/u.test(raw)){
            const found=await Promise.allSettled([searchWikidataFilms(raw,{limit:35}),searchTmdbMovies(raw)]);
            const candidates=[
              ...(found[0].status==='fulfilled'?exactFilmMatches(raw,found[0].value):[]),
              ...(found[1].status==='fulfilled'?exactTmdbMovies(raw,found[1].value):[])
            ];
            const confirmed=candidates.find(w=>w.verified&&/[0-9０-９]/u.test(w.title));
            if(confirmed)match={title:confirmed.title,...editorialScore(prompt.id,confirmed.title)};
          }
        }
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
        res.end(JSON.stringify(match?{status:'found',work:{id:'editorial:'+prompt.id+':'+normEditorial(match.title),kind:prompt.kind,title:match.title,titleKo:match.titleKo||''},points:match.points,tier:match.tier,provisional:true,rarityCategory:match.rarityCategory,rarityLabelKo:match.rarityLabelKo,rarityLabelEn:match.rarityLabelEn,rarityReviewed:match.rarityReviewed,rarityMethod:match.rarityMethod}:{status:'missing',reason:'not-in-curated-answer-set'}));
        return;
      }
      // The published per-question answer set is authoritative and fast.
      const prepared=sourceCatalog.promptLookup(prompt.id,prompt.kind,raw);
      const exactPrepared=prepared.filter(w=>[w.title,w.titleKo,...(Array.isArray(w.aliases)?w.aliases:[])].some(name=>name&&normEditorial(name)===normEditorial(raw)));
      if(exactPrepared.length){
        const w=exactPrepared[0];
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
        res.end(JSON.stringify({status:'found',work:{id:w.id,kind:w.kind,title:w.title,titleKo:w.titleKo,
          creator:w.creator,year:w.year,country:w.country},points:w.points,tier:w.tier,
          provisional:true,rarityMethod:'precomputed-prompt-ranking',unrated:!w.ratingCount}));
        return;
      }
      // Search imported records and external providers together. Never allow a sparse
      // Wikidata hit to hide a richly tagged TMDB, AniList, or imported match.
      let found=sourceCatalog.lookup(prompt.kind,raw);
      if(prompt.kind==='tv'){
        try{found.push(...exactTV(raw,await searchTVMaze(raw)));}catch{}
      }
      if(prompt.kind==='games'){
        const q=raw.split(/\s+[—–]\s+/u)[0];
        const responses=await Promise.allSettled([searchVNDB(q,{limit:30}),searchWikidataGames(q,{limit:25})]);
        if(responses[0].status==='fulfilled')found.push(...exactVNDB(raw,responses[0].value));
        if(responses[1].status==='fulfilled')found.push(...exactGameMatches(raw,responses[1].value));
      }
      if(prompt.kind==='anime'){
        try{found.push(...exactAniList(raw,await searchAniList(raw,{limit:25})));}catch{}
      }
      if(prompt.kind==='film'){
        const q=raw.split(/\s+[—–]\s+/u)[0];
        const responses=await Promise.allSettled([searchWikidataFilms(q,{limit:35}),searchTmdbMovies(q)]);
        if(responses[0].status==='fulfilled')found.push(...exactFilmMatches(raw,responses[0].value));
        if(responses[1].status==='fulfilled')found.push(...exactTmdbMovies(raw,responses[1].value));
      }
      found=await Promise.all(found.map(async w=>{
        try{
          if(w.source==='wikidata-games')return await enrichWikidataGame(w);
          if(w.source==='wikidata-live')return await enrichWikidataFilm(w);
          if(w.source==='tmdb-live')return await enrichTmdbMovie(w);
          return w;
        }catch{return {...w,metadataUnavailable:true};}
      }));
      found=[...new Map(found.map(w=>[w.id,w])).values()];
      found=found.map(w=>{
        const genres=new Set((w.genres||[]).map(x=>String(x).toLowerCase().trim()));
        const has=(...names)=>names.some(x=>genres.has(x));
        if(has('sci-fi','science-fiction','science fiction','sf'))genres.add('science fiction');
        if(has('role-playing','role playing','role-playing game','role playing game','jrpg','action rpg'))genres.add('rpg');
        if(has('psychological horror','psychological thriller'))genres.add('psychological');
        if(has('independent','indie game','independent game'))genres.add('indie');
        if(has('experimental film','experimental fiction'))genres.add('experimental');
        if(has('surreal','surrealist'))genres.add('surrealism');
        return {...w,genres:[...genres]};
      });
      const valid=found.filter(w=>prompt.match(w));
      const metadataMissing=found.length>0&&found.every(w=>w.metadataUnavailable);
      const chosen=[...valid].sort((a,b)=>Number(Boolean(b.ratingCount||b.popularity))-Number(Boolean(a.ratingCount||a.popularity)))[0];
      // Keep proven live matches in the persistent SQLite catalog, so repeated
      // searches do not rely solely on an upstream provider staying available.
      const sourceNames={'tmdb-live':'tmdb','wikidata-live':'wikidata','wikidata-games':'wikidata','vndb-live':'vndb','anilist-live':'anilist','tvmaze-live':'tvmaze'};
      for(const w of valid){
        const storedSource=sourceNames[w.source];
        const sourceId=String(w.id||'').split(':').slice(1).join(':');
        if(!storedSource||!sourceId||!w.verified||!w.title)continue;
        try{sourceCatalog.put({kind:w.kind,title:w.title,titleKo:w.titleKo,creator:w.creator,year:w.year,country:w.country,
          genres:w.genres,format:w.format||'',aliases:w.aliases,source:storedSource,sourceId,ratingCount:w.ratingCount,
          sourceUrl:w.sourceUrl,verified:true});}catch{/* Read-only data volume: live verification still works. */}
      }
      const response=metadataMissing?{status:'unverified',reason:'provider-metadata-unavailable'}:!found.length?{status:'missing',reason:'no-exact-match-in-available-sources'}:!valid.length?
        {status:found.some(w=>w.metadataUnavailable||!w.genres?.length||!w.year)?'unverified':'notEligible',reason:'no-candidate-matched-all-conditions',candidates:found.slice(0,3).map(w=>({title:w.title,year:w.year,country:w.country,genres:w.genres,format:w.format,source:w.source}))}:
        !chosen.verified?{status:'unverified',reason:'source-not-verified'}:(()=>{
        const w=chosen;
        const hasVotes=Number.isSafeInteger(w.ratingCount)&&w.ratingCount>=1;
        const counted=hasVotes?sourceCatalog.score(prompt.id,w.ratingCount):null;
        const score=w.source==='vndb-live'?vnRarity(w.ratingCount):w.source==='anilist-live'?aniListScore(w.popularity):counted&&counted.points>0?counted:{points:44,tier:5};
        return {status:'found',work:{id:w.id,kind:w.kind,title:w.title,titleKo:w.titleKo,creator:w.creator,year:w.year,country:w.country},
          points:score.points,tier:score.tier,provisional:true,unrated:w.source==='anilist-live'?!w.popularity:!hasVotes,rarityMethod:w.source==='vndb-live'?'vndb-votes-provisional':w.source==='anilist-live'?'anilist-popularity-provisional':hasVotes?'catalog-votes':'no-popularity-data',genreVotes:w.genreVotes||null};
      })();
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(response));
    });return;
  }
  if(pathname==='/api/leaderboard'){
    const players=Object.entries(ratings).filter(([,v])=>Number.isFinite(v.rating)&&v.played>0).map(([id,v])=>({id:id.slice(0,8),name:v.name,rating:v.rating,played:v.played,wins:v.wins||0})).sort((a,b)=>b.rating-a.rating).slice(0,100);
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({players,provisional:true}));return;
  }
  if(pathname==='/api/questions' && req.method==='GET'){
    const date=String(parsedUrl.searchParams.get('date')||todayKey());
    const ids=lineupFor(date);
    const coverage=new Map(sourceCatalog.promptCoverage().map(x=>[x.promptId,x]));
    const questions=(ids||[]).map(promptId=>({promptId,answers:editorialAnswers[promptId]?.answers?.length||coverage.get(promptId)?.answers||0}));
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({date,questions,ready:Boolean(ids),editorial:true,revision:'manual-daily-v1'}));
    return;
  }
  if(pathname==='/api/examples' && req.method==='GET'){
    const promptId=String(parsedUrl.searchParams.get('promptId')||'');
    const prompt=promptById.get(promptId);
    if(!prompt){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({examples:[]}));return;}
    if(editorialAnswers[promptId]){
      const curated=editorialAnswers[promptId].answers.map(title=>({title,...localizedAnswer(promptId,title),source:'editorial-candidate',...editorialScore(promptId,title)}));
      const discovered=promptId==='f-title-number'
        ?sourceCatalog.db.prepare("SELECT title FROM works WHERE kind='film' AND verified=1 ORDER BY title").all()
          .filter(w=>/[0-9０-９]/u.test(w.title)).map(w=>({title:w.title,source:'catalog-metadata',...editorialScore(promptId,w.title)}))
        :[];
      const examples=[...curated,...discovered].filter((w,i,a)=>a.findIndex(x=>normEditorial(x.title)===normEditorial(w.title))===i);
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
      res.end(JSON.stringify({examples,complete:false,curation:'ongoing'}));return;
    }
    const prepared=sourceCatalog.promptExamples(promptId,10000);
    const imported=prepared.length?prepared:sourceCatalog.possible(promptId,10000).filter(w=>w.kind===prompt.kind&&prompt.match(w));
    const curated=eligible(prompt);
    const combined=[...imported,...curated].filter((w,i,all)=>all.findIndex(x=>x.title===w.title&&x.year===w.year)===i);
    const examples=combined.map(w=>({title:w.title,titleKo:w.titleKo||'',creator:w.creator||'',year:w.year||0,
      source:w.source||'curated-demo',points:w.points??null,ratingCount:w.ratingCount??null}));
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({examples,complete:false}));
    return;
  }
  if(pathname==='/api/catalog/status'){const imported=sourceCatalog.stats();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({imported,records:imported.reduce((n,r)=>n+r.entries,0),liveSearch:{music:{provider:'MusicBrainz',enabled:false},film:{provider:'Wikidata',enabled:true,coverage:'live-search-not-exhaustive'},anime:{provider:'AniList',enabled:true,coverage:'live-search-not-exhaustive'},games:{providers:['VNDB','Wikidata'],enabled:true,coverage:'live-search-not-exhaustive'},literature:{provider:'imported-catalog',enabled:true,coverage:'local-only'}},catalogComplete:false,coverageVerified:false,promptCoverage:sourceCatalog.promptCoverage(),tmdbConfigured:tmdbEnabled,live:true}));return;}
  if(/^\/api\/matches\/[A-Za-z0-9]{12}$/.test(pathname)){const id=pathname.split('/').pop();const item=completedMatches[id];res.writeHead(item?200:404,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(item||{error:'not_found'}));return;}
  if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,players:clients.size,matches:matches.size}));return;}
  // Production bundle served by the same origin as the websocket endpoint.
  const normalized=path.posix.normalize(decodeURIComponent(pathname));
  const target=path.resolve(root,'dist','.'+normalized);
  if(!target.startsWith(path.resolve(root,'dist')+path.sep) && target!==path.resolve(root,'dist')){res.writeHead(403);res.end();return;}
  const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'dist','index.html');
  if(!fs.existsSync(file)){res.writeHead(503,{'content-type':'text/plain'});res.end('Build the frontend first: npm run build');return;}
  res.writeHead(200,{'content-type':mimetypes[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const wss=new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url||'/',`http://${req.headers.host}`).pathname!=='/ws'){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
});
wss.on('connection',ws=>{
  let id=null;
  ws.on('message',bytes=>{
    let msg;try{msg=JSON.parse(bytes.toString());}catch{return;}
    if(!msg||typeof msg.type!=='string')return;
    if(msg.type==='hello'){
      const candidate=String(msg.id||'');if(!/^[a-zA-Z0-9-]{20,64}$/.test(candidate)){send(ws,{type:'error',message:'Invalid guest identity'});return;}
      id=candidate;
      const prev=clients.get(id)?.ws;if(prev&&prev!==ws)prev.close();
      clients.set(id,{ws});
      const cur=who(id);ratings[id]={...cur,name:cleanName(msg.name||cur.name)};persist();sync(id);return;
    }
    if(!id || clients.get(id)?.ws!==ws)return;
    if(msg.type==='cancel'){removeFromQueues(id);send(ws,{type:'cancelled'});return;}
    if(currentMatch(id)){
      if(msg.type!=='guess')return;
      const m=currentMatch(id);if(m.phase!=='play'||m.answers[id]||Date.now()>m.deadline)return;
      const prompt=promptById.get(m.prompts[m.round]);
      const raw=String(msg.answer||'').trim().slice(0,160);
      const databaseMatches=sourceCatalog?sourceCatalog.lookup(prompt.kind,raw):[];
      const found=databaseMatches.length===1?{status:'found',work:databaseMatches[0]}:databaseMatches.length>1?{status:'ambiguous',works:databaseMatches}:lookupAnswer(raw,prompt.kind);
      if(found.status!=='found'){send(ws,{type:'invalid',reason:found.status});return;}
      if(!prompt.match(found.work)){send(ws,{type:'invalid',reason:'notEligible'});return;}
      const imported=Boolean(found.work.source);
      if(imported&&!found.work.verified){send(ws,{type:'invalid',reason:'unverified'});return;}
      const hasVotes=Number.isSafeInteger(found.work.ratingCount)&&found.work.ratingCount>=1;
      const result=imported?(hasVotes?sourceCatalog.score(prompt.id,found.work.ratingCount):{points:44,tier:5}):rarity(found.work,prompt);
      if(result.points===0){send(ws,{type:'invalid',reason:'unverified'});return;}
      m.answers[id]={workId:found.work.id,title:found.work.title,points:result.points,tier:result.tier};
      sync(id);sendTo(m.players.find(p=>p!==id),{type:'rival_locked'});return;
    }
    if(msg.type==='invite'){
      removeFromQueues(id);const mode='all';const inviteCode=code();
      invitations.set(inviteCode,{host:id,mode,created:Date.now()});send(ws,{type:'invited',code:inviteCode});return;
    }
    if(msg.type==='join'){
      const inviteCode=String(msg.code||'').toUpperCase().trim(),inv=invitations.get(inviteCode);
      if(!inv||inv.host===id||!clients.get(inv.host)){send(ws,{type:'error',message:'Invalid or expired room code'});return;}
      invitations.delete(inviteCode);startMatch(inv.host,id,inv.mode,false);return;
    }
    if(msg.type==='queue'){
      removeFromQueues(id);const mode='all';const queue=queues.get(mode);
      const contender=queue.find(item=>item.id!==id&&clients.has(item.id));
      if(contender)startMatch(contender.id,id,mode,true);
      else{queue.push({id,since:Date.now()});send(ws,{type:'queued',mode});}return;
    }
  });
  ws.on('close',()=>{if(!id||clients.get(id)?.ws!==ws)return;clients.delete(id);removeFromQueues(id);});
});
setInterval(()=>{for(const [c,inv] of invitations)if(Date.now()-inv.created>15*60*1000)invitations.delete(c);},60000).unref();
server.listen(port,()=>console.log(`DEEP CUT 1v1 live server ready on http://localhost:${port}`));
