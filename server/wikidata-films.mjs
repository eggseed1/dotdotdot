import {canonical} from '../src/lib/title-match.mjs';
const CACHE_MS=6*60*60*1000,cache=new Map();
const filmTypes=new Set(['Q11424','Q9325869','Q202866','Q24856','Q25110269']);
const genreNames={'Q157443':'romance','Q130232':'drama','Q859369':'comedy','Q200092':'horror','Q471839':'science fiction','Q157394':'fantasy'};
const countryNames={'Q884':'South Korea','Q17':'Japan','Q30':'United States','Q145':'United Kingdom','Q142':'France','Q183':'Germany','Q148':'China'};
const remember=(key,value)=>{if(cache.size>400)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+CACHE_MS});return value;};
async function wikidata(params){
 const url=new URL('https://www.wikidata.org/w/api.php');
 for(const [key,val] of Object.entries({action:'query',format:'json',origin:'*',...params}))url.searchParams.set(key,String(val));
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),8500);
 try{const response=await fetch(url,{signal:control.signal,headers:{'User-Agent':'larper101/0.4 (https://github.com/eggseed1/dotdotdot)'}});
 if(!response.ok)throw Error('Wikidata HTTP '+response.status);
 return response.json();}finally{clearTimeout(timer);}
}
const claims=(entity,key)=>(entity.claims?.[key]||[]).map(c=>c.mainsnak?.datavalue?.value).filter(Boolean);
const ids=(entity,key)=>claims(entity,key).map(c=>c.id).filter(Boolean);
const yearFrom=entity=>{const dates=[...claims(entity,'P577'),...claims(entity,'P571')];for(const d of dates){const y=Number(/^[+-]?(\\d{4})/.exec(d.time||'')?.[1]);if(y>=1880&&y<=2100)return y;}return undefined;};
const label=(entities,id)=>entities[id]?.labels?.en?.value||entities[id]?.labels?.ko?.value||'';
export async function searchWikidataFilms(query,{limit=9}={}){
 const raw=String(query||'').trim().slice(0,95);if(raw.length<2)return [];
 const key='film:'+canonical(raw),cached=cache.get(key);if(cached?.until>Date.now())return cached.value;
 const results=await wikidata({action:'wbsearchentities',search:raw,language:/[가-힣]/u.test(raw)?'ko':'en',uselang:'en',limit:Math.min(18,Math.max(limit,10))});
 const hits=(results.search||[]).filter(x=>/^Q\\d+$/.test(x.id));
 if(!hits.length)return remember(key,[]);
 const payload=await wikidata({action:'wbgetentities',ids:hits.map(x=>x.id).join('|'),props:'claims|labels',languages:'en|ko'});
 const entries=payload.entities||{};
 const films=hits.flatMap(hit=>{
  const e=entries[hit.id];if(!e||!ids(e,'P31').some(id=>filmTypes.has(id)))return [];
  return [{id:'wikidata:'+hit.id,kind:'film',source:'wikidata-live',title:e.labels?.en?.value||hit.label,titleKo:e.labels?.ko?.value||'',
   creator:'',year:yearFrom(e),country:countryNames[ids(e,'P495')[0]]||'',genres:ids(e,'P136').map(id=>genreNames[id]).filter(Boolean),
   genreIds:ids(e,'P136'),countryIds:ids(e,'P495'),verified:true,ratingCount:null,aliases:[hit.label],sourceUrl:'https://www.wikidata.org/wiki/'+hit.id}];
 });
 return remember(key,films);
}
export async function enrichWikidataFilm(work){
 if(!work?.id?.startsWith('wikidata:'))return work;
 const filmId=work.id.slice(9),key='details:'+filmId,cached=cache.get(key);if(cached?.until>Date.now())return {...work,...cached.value};
 const data=await wikidata({action:'wbgetentities',ids:filmId,props:'claims|labels',languages:'en|ko'});
 const e=data.entities?.[filmId];if(!e)throw Error('Missing Wikidata film');
 const allIds=[...ids(e,'P136'),...ids(e,'P495'),...ids(e,'P57')].slice(0,40);
 const labels=allIds.length?(await wikidata({action:'wbgetentities',ids:[...new Set(allIds)].join('|'),props:'labels',languages:'en|ko'})).entities||{}:{};
 const genres=ids(e,'P136').map(id=>genreNames[id]||label(labels,id).toLowerCase()).filter(Boolean);
 const country=countryNames[ids(e,'P495')[0]]||label(labels,ids(e,'P495')[0])||'';
 const creator=ids(e,'P57').map(id=>label(labels,id)).filter(Boolean).join(', ');
 const fields={genres,country,creator,genreEvidence:ids(e,'P136').length>0};
 remember(key,fields);return {...work,...fields};
}
export function exactFilmMatches(query,items){
 const key=canonical(String(query||''));return items.filter(w=>
 [w.title,w.titleKo,w.title+' — '+(w.creator||''),...(w.aliases||[])].some(n=>canonical(n)===key));
}
