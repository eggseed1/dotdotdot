import dailyEditorial from '../data/daily-editorial.json';
import { byId, catalog } from '../data/catalog';
import { rarityFromRank, RARITY_TAGS, SCORE_TIERS } from './rarity-model.mjs';
import type { GameSession, Kind, Mode, Prompt, RoundResult, Work } from './types';

export const ROUND_SECONDS = 25;
export const ROUNDS = 7;
export const SCORE_LEVELS = SCORE_TIERS;

export const kindNames: Record<Exclude<Kind,'any'>, {en:string;ko:string}> = {
  music: {en:'MUSIC',ko:'음악'}, film:{en:'FILM',ko:'영화'},
  literature:{en:'LITERATURE',ko:'문학'}, anime:{en:'ANIME',ko:'애니'},
  games:{en:'GAMES',ko:'게임'}, tv:{en:'TELEVISION',ko:'드라마'},
};

export const promptPool: Prompt[] = [
  {id:'tv-90s-drama',kind:'tv',badge:{en:'TV · ERA · GENRE',ko:'방송 · 시대 · 장르'},label:{en:'Name a drama TV series that premiered in the 1990s.',ko:'1990년대 첫 방영한 드라마 TV 시리즈를 대보세요.'},match:w=>w.year>=1990&&w.year<=1999&&w.genres.includes('drama')},
  {id:'tv-2000s-scifi',kind:'tv',badge:{en:'TV · ERA · GENRE',ko:'방송 · 시대 · 장르'},label:{en:'Name a science-fiction TV series that premiered in the 2000s.',ko:'2000년대 첫 방영한 SF TV 시리즈를 대보세요.'},match:w=>w.year>=2000&&w.year<=2009&&(w.genres.includes('science-fiction')||w.genres.includes('science fiction'))},
  {id:'tv-2010s-crime',kind:'tv',badge:{en:'TV · ERA · GENRE',ko:'방송 · 시대 · 장르'},label:{en:'Name a crime TV series that premiered in the 2010s.',ko:'2010년대 첫 방영한 범죄 TV 시리즈를 대보세요.'},match:w=>w.year>=2010&&w.year<=2019&&w.genres.includes('crime')},

  {id:'f-korean-2000s-drama',kind:'film',badge:{en:'COUNTRY · DECADE · GENRE',ko:'국가 · 시대 · 장르'},label:{en:'Name a South Korean drama film released between 2000 and 2009.',ko:'2000년부터 2009년 사이 개봉한 한국 드라마 영화를 대보세요.'},match:w=>w.country==='South Korea'&&w.year>=2000&&w.year<=2009&&w.genres.includes('drama')},
  {id:'f-japan-90s-horror',kind:'film',badge:{en:'COUNTRY · DECADE · GENRE',ko:'국가 · 시대 · 장르'},label:{en:'Name a Japanese horror film released in the 1990s.',ko:'1990년대 개봉한 일본 공포 영화를 대보세요.'},match:w=>w.country==='Japan'&&w.year>=1990&&w.year<=1999&&w.genres.includes('horror')},
  {id:'f-70s-sci-fi',kind:'film',badge:{en:'DECADE · GENRE',ko:'시대 · 장르'},label:{en:'Name a science-fiction film released in the 1970s.',ko:'1970년대 개봉한 SF 영화를 대보세요.'},match:w=>w.year>=1970&&w.year<=1979&&w.genres.includes('science fiction')},
  {id:'a-90s-sci-fi-tv',kind:'anime',badge:{en:'DECADE · GENRE · FORMAT',ko:'시대 · 장르 · 형식'},label:{en:'Name a 1990s TV anime tagged as science fiction.',ko:'1990년대 방영한 SF 장르 TV 애니메이션을 대보세요.'},match:w=>w.year>=1990&&w.year<=1999&&w.genres.includes('science fiction')&&w.format==='TV'},
  {id:'a-2000s-movie-fantasy',kind:'anime',badge:{en:'DECADE · GENRE · FORMAT',ko:'시대 · 장르 · 형식'},label:{en:'Name a fantasy anime film released from 2000 to 2009.',ko:'2000년대 개봉한 판타지 애니메이션 영화를 대보세요.'},match:w=>w.year>=2000&&w.year<=2009&&w.genres.includes('fantasy')&&w.format==='MOVIE'},
  {id:'a-2010s-mystery-tv',kind:'anime',badge:{en:'DECADE · GENRE · FORMAT',ko:'시대 · 장르 · 형식'},label:{en:'Name a mystery TV anime that began airing in the 2010s.',ko:'2010년대 방영을 시작한 미스터리 TV 애니메이션을 대보세요.'},match:w=>w.year>=2010&&w.year<=2019&&w.genres.includes('mystery')&&w.format==='TV'},
  {id:'a-2000s-psych-tv',kind:'anime',badge:{en:'DECADE · TAG · FORMAT',ko:'시대 · 태그 · 형식'},label:{en:'Name a 2000s TV anime with a strong psychological tag.',ko:'2000년대 방영한 심리물 태그의 TV 애니메이션을 대보세요.'},match:w=>w.year>=2000&&w.year<=2009&&w.genres.includes('psychological')&&w.format==='TV'},
  {id:'g-2010s-psych',kind:'games',badge:{en:'DECADE · THEME',ko:'시대 · 테마'},label:{en:'Name a psychological or surreal video game released from 2010 to 2019.',ko:'2010년대 출시된 심리적이거나 초현실적인 비디오 게임을 대보세요.'},match:w=>w.year>=2010&&w.year<=2019&&(w.genres.includes('psychological')||w.genres.includes('surrealism'))},
  {id:'g-2010s-indie-rpg',kind:'games',badge:{en:'DECADE · GENRE · STYLE',ko:'시대 · 장르 · 성격'},label:{en:'Name an indie RPG released between 2010 and 2019.',ko:'2010년부터 2019년 사이 나온 인디 RPG 게임을 대보세요.'},match:w=>w.year>=2010&&w.year<=2019&&w.genres.includes('rpg')&&w.genres.includes('indie')},
  {id:'g-2000s-japan-rpg',kind:'games',badge:{en:'COUNTRY · DECADE · GENRE',ko:'국가 · 시대 · 장르'},label:{en:'Name a Japanese-developed RPG released in the 2000s.',ko:'2000년대에 출시된 일본 개발 RPG를 대보세요.'},match:w=>w.country==='Japan'&&w.year>=2000&&w.year<=2009&&w.genres.includes('rpg')},
  {id:'f-korean-2000s',kind:'film',badge:{en:'COUNTRY + DECADE',ko:'국가 + 시대'},label:{en:'Name a South Korean film from the 2000s.',ko:'2000년대 한국 영화 하나를 대보세요.'},match:w=>w.country==='South Korea'&&w.year>=2000&&w.year<=2009},
  {id:'f-japan-90s',kind:'film',badge:{en:'COUNTRY + DECADE',ko:'국가 + 시대'},label:{en:'Name a Japanese film released during the 1990s.',ko:'1990년대 일본 영화 하나를 대보세요.'},match:w=>w.country==='Japan'&&w.year>=1990&&w.year<=1999},
  {id:'a-2000s-sci-fi',kind:'anime',badge:{en:'GENRE + DECADE',ko:'장르 + 시대'},label:{en:'Name a science-fiction anime from the 2000s.',ko:'2000년대 SF 애니메이션 하나를 대보세요.'},match:w=>w.year>=2000&&w.year<=2009&&(w.genres.includes('sci-fi')||w.genres.includes('science fiction'))},
  {id:'a-90s-drama',kind:'anime',badge:{en:'GENRE + DECADE',ko:'장르 + 시대'},label:{en:'Name a drama anime released in the 1990s.',ko:'1990년대 드라마 애니메이션 하나를 대보세요.'},match:w=>w.year>=1990&&w.year<=1999&&w.genres.includes('drama')},
  {id:'g-2010s-rpg',kind:'games',badge:{en:'GENRE + DECADE',ko:'장르 + 시대'},label:{en:'Name an RPG game from the 2010s.',ko:'2010년대 RPG 게임 하나를 대보세요.'},match:w=>w.year>=2010&&w.year<=2019&&w.genres.includes('rpg')},
  {id:'f-korean',kind:'film',badge:{en:'COUNTRY',ko:'국가'},label:{en:'Name a South Korean film.',ko:'한국 영화를 하나 대보세요.'},match:w=>w.country==='South Korea'},
  {id:'f-90s',kind:'film',badge:{en:'DECADE',ko:'시대'},label:{en:'Name a film from the 1990s.',ko:'90년대 영화를 하나 대보세요.'},match:w=>w.year>=1990&&w.year<=1999},
  {id:'f-japanese',kind:'film',badge:{en:'COUNTRY',ko:'국가'},label:{en:'Name a Japanese film.',ko:'일본 영화를 하나 대보세요.'},match:w=>w.country==='Japan'},
  {id:'f-70s',kind:'film',badge:{en:'DECADE',ko:'시대'},label:{en:'Name a film from the 1970s.',ko:'70년대 영화를 하나 대보세요.'},match:w=>w.year>=1970&&w.year<=1979},
  {id:'f-romance',kind:'film',badge:{en:'GENRE',ko:'장르'},label:{en:'Name a romance film.',ko:'로맨스 영화를 하나 대보세요.'},match:w=>w.genres.includes('romance')},
  {id:'l-japanese',kind:'literature',badge:{en:'COUNTRY',ko:'국가'},label:{en:'Name a novel by a Japanese author.',ko:'일본 작가의 소설을 하나 대보세요.'},match:w=>w.country==='Japan'},
  {id:'l-1900s',kind:'literature',badge:{en:'CENTURY',ko:'세기'},label:{en:'Name a book published in the 20th century.',ko:'20세기에 출간된 책을 하나 대보세요.'},match:w=>w.year>=1901&&w.year<=2000},
  {id:'l-experimental',kind:'literature',badge:{en:'GENRE',ko:'장르'},label:{en:'Name an experimental or postmodern novel.',ko:'실험적이거나 포스트모던한 소설을 하나 대보세요.'},match:w=>w.genres.includes('experimental')||w.genres.includes('postmodernism')},
  {id:'l-asia',kind:'literature',badge:{en:'REGION',ko:'지역'},label:{en:'Name a book by an author from Japan or South Korea.',ko:'한국 또는 일본 작가의 책을 하나 대보세요.'},match:w=>['Japan','South Korea'].includes(w.country)},
  {id:'a-90s',kind:'anime',badge:{en:'DECADE',ko:'시대'},label:{en:'Name an anime released in the 1990s.',ko:'90년대 애니메이션을 하나 대보세요.'},match:w=>w.year>=1990&&w.year<=1999},
  {id:'a-2000s',kind:'anime',badge:{en:'DECADE',ko:'시대'},label:{en:'Name an anime from the 2000s.',ko:'2000년대 애니메이션을 하나 대보세요.'},match:w=>w.year>=2000&&w.year<=2009},
  {id:'a-psych',kind:'anime',badge:{en:'GENRE',ko:'장르'},label:{en:'Name a psychological anime.',ko:'심리물 애니메이션을 하나 대보세요.'},match:w=>w.genres.includes('psychological')},
  {id:'a-sci-fi',kind:'anime',badge:{en:'GENRE',ko:'장르'},label:{en:'Name a science-fiction anime.',ko:'SF 애니메이션을 하나 대보세요.'},match:w=>w.genres.includes('science fiction')||w.genres.includes('cyberpunk')},
  {id:'g-japan',kind:'games',badge:{en:'COUNTRY',ko:'국가'},label:{en:'Name a video game developed in Japan.',ko:'일본에서 개발된 게임을 하나 대보세요.'},match:w=>w.country==='Japan'},
  {id:'g-2010s',kind:'games',badge:{en:'DECADE',ko:'시대'},label:{en:'Name a game released in the 2010s.',ko:'2010년대에 발매된 게임을 하나 대보세요.'},match:w=>w.year>=2010&&w.year<=2019},
  {id:'g-rpg',kind:'games',badge:{en:'GENRE',ko:'장르'},label:{en:'Name an RPG video game.',ko:'RPG 게임을 하나 대보세요.'},match:w=>w.genres.includes('rpg')},
  {id:'g-psych',kind:'games',badge:{en:'GENRE',ko:'장르'},label:{en:'Name a psychological or surreal video game.',ko:'심리적이거나 초현실적인 게임을 하나 대보세요.'},match:w=>w.genres.includes('psychological')||w.genres.includes('surrealism')},
];

export const promptById = new Map(promptPool.map(p=>[p.id,p]));

export function eligible(prompt:Prompt):Work[] {
  return catalog.filter(w=>(prompt.kind==='any'||w.kind===prompt.kind)&&prompt.match(w));
}
export function selectPrompts(_mode:Mode,date:string):Prompt[] {
  const schedule=dailyEditorial as Record<string,unknown>;
  const ids=schedule[date];
  if(!Array.isArray(ids)||ids.length!==7||new Set(ids).size!==7||!ids.every(id=>typeof id==='string'&&promptById.has(id)))return [];
  return ids.map(id=>promptById.get(id as string)!);
}

/** Unicode-aware canonicalization; Hangul is preserved. */
export function normalize(input:string):string {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
    .replace(/[’‘]/g,"'").replace(/&/g,'and').replace(/♯/g,'#')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function distance(a:string,b:string):number {
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let before=prev[0];prev[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,before+(a[i-1]===b[j-1]?0:1));before=old;
    }
  }
  return prev[b.length];
}
export type Lookup = {status:'found';work:Work}|{status:'ambiguous';works:Work[]}|{status:'missing'};
export function lookupAnswer(raw:string, kind:Kind, fromCatalog:Work[]=catalog):Lookup {
  const query=normalize(raw);
  if(query.length<2)return {status:'missing'};
  const candidates=fromCatalog.filter(w=>kind==='any'||w.kind===kind);
  const matches = candidates.filter(w=>{
    const fullNames=[w.title+' '+w.creator,w.creator+' '+w.title,w.titleKo? w.titleKo+' '+w.creator:''].filter(Boolean);
    const titleNames=[w.title,w.titleKo,...(w.aliases||[])].filter((x):x is string=>Boolean(x));
    return titleNames.some(name=>normalize(name)===query)||fullNames.some(name=>normalize(name)===query)||
      // Only tolerate tiny typos on long titles, avoiding a misleading guess for short titles.
      (query.length>=9&&titleNames.some(name=>{const n=normalize(name);return Math.abs(n.length-query.length)<=1&&distance(query,n)<=1;}));
  });
  if(matches.length===1)return {status:'found',work:matches[0]};
  if(matches.length>1)return {status:'ambiguous',works:matches};
  return {status:'missing'};
}

export function rarity(work:Work,prompt:Prompt):{points:number;tier:number;percentile:number} {
  const matching=eligible(prompt);
  // Never mix imported verified vote counts with hand-entered demo weights.
  const withCounts=matching.filter(w=>Number.isSafeInteger(w.voteCount)&&Number(w.voteCount)>=1);
  const verified=Number.isSafeInteger(work.voteCount)&&Number(work.voteCount)>=1&&withCounts.length>=3;
  const pool=verified?withCounts:matching.filter(w=>w.voteCount===undefined);
  const measure=(w:Work)=>verified?Number(w.voteCount):w.popularity;
  const rank=rarityFromRank(measure(work),pool.length,pool.filter(w=>measure(w)>measure(work)).length);
  return {points:rank.points,tier:rank.tier,percentile:rank.percentile};
}
export const tierLabels=RARITY_TAGS.map(t=>({en:t.en,ko:t.ko}));

export function todayKey(date=new Date()):string {return date.toLocaleDateString('en-CA',{timeZone:'America/New_York'});}
export function newGame(mode:Mode,date=todayKey(),ranked=true):GameSession {
  return {id:`${mode}-${date}-${ranked?'daily':Date.now()}`,date,mode,ranked,prompts:selectPrompts(mode,date).map(p=>p.id),index:0,roundStartedAt:Date.now(),state:'play',results:[]};
}
export function totalScore(results:RoundResult[]):number{return results.reduce((sum,r)=>sum+r.points,0);}
export function selectedWork(id?:string){return id?byId.get(id):undefined;}
