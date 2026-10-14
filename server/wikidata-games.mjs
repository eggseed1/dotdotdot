import {canonical} from '../src/lib/title-match.mjs';
const cache=new Map();
async function query(params){
 const url=new URL('https://www.wikidata.org/w/api.php');
 for(const [key,val] of Object.entries({format:'json',...params}))url.searchParams.set(key,String(val));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{const res=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'larper101/0.4 (https://github.com/eggseed1/dotdotdot)'}});
 if(!res.ok)throw Error('Wikidata '+res.status);return res.json();}finally{clearTimeout(timer);}
}
const ids=(e,p)=>(e.claims?.[p]||[]).map(x=>x.mainsnak?.datavalue?.value?.id).filter(Boolean);
const year=e=>{const dt=e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time||'';return Number(/^[+-]?(\\d{4})/.exec(dt)?.[1])||0;};
export async function searchWikidataGames(raw,{limit=12}={}){
 const term=String(raw||'').trim().slice(0,95);
 if(term.length<2)return [];
 const key=canonical(term),cached=cache.get(key);
 if(cached&&cached.until>Date.now())return cached.items;
 const result=await query({action:'wbsearchentities',language:/[가-힣]/u.test(term)?'ko':'en',search:term,limit:Math.min(25,Math.max(12,limit))});
 const hits=(result.search||[]).filter(x=>/^Q\\d+$/.test(x.id));
 if(!hits.length)return [];
 const data=await query({action:'wbgetentities',ids:hits.map(x=>x.id).join('|'),props:'claims|labels',languages:'en|ko'});
 const matches=hits.flatMap(x=>{
  const e=data.entities?.[x.id];if(!e||!ids(e,'P31').some(id=>id==='Q7889'))return [];
  return [{id:'wikidata:'+x.id,kind:'games',source:'wikidata-games',title:e.labels?.en?.value||x.label,
  titleKo:e.labels?.ko?.value||'',creator:'',year:year(e),country:'',
  genres:[],genreIds:ids(e,'P136'),developerIds:ids(e,'P178'),
  aliases:[x.label],verified:true,ratingCount:null,sourceUrl:'https://www.wikidata.org/wiki/'+x.id}];
 });
 cache.set(key,{items:matches,until:Date.now()+21600000});if(cache.size>350)cache.delete(cache.keys().next().value);
 return matches;
}
export function exactGameMatches(raw,items){
 const key=canonical(raw);return items.filter(x=>[x.title,x.titleKo,...x.aliases].some(s=>canonical(s)===key));
}
export async function enrichWikidataGame(game){
 if(game.source!=='wikidata-games')return game;
 const idsToFetch=[...game.genreIds,...game.developerIds];
 if(!idsToFetch.length)return game;
 const data=await query({action:'wbgetentities',ids:[...new Set(idsToFetch)].slice(0,35).join('|'),props:'labels|claims',languages:'en'});
 const labels=id=>data.entities?.[id]?.labels?.en?.value?.toLowerCase()||'';
 const genres=game.genreIds.map(id=>labels(id)).flatMap(x=>x.includes('role-playing')||x==='rpg'?['rpg']:x.includes('psychological')?['psychological']:x.includes('surreal')?['surrealism']:[x]).filter(Boolean);
 const countries=game.developerIds.flatMap(id=>ids(data.entities?.[id]||{},'P17'));
 const country=countries.includes('Q17')?'Japan':countries.includes('Q30')?'United States':countries.includes('Q884')?'South Korea':'';
 return {...game,genres,country};
}
