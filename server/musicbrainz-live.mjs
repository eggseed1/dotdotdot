import {canonical} from '../src/lib/title-match.mjs';
// Rate-limited upstream MusicBrainz search. No site scraping, no mass harvesting.
const cache=new Map(),detailsCache=new Map(),MAX=900,TTL=1000*60*60*8;
let pending=Promise.resolve(),last=0;
function enqueue(job){const run=pending.then(async()=>{const wait=Math.max(0,1150-(Date.now()-last));if(wait)await new Promise(r=>setTimeout(r,wait));last=Date.now();return job();});pending=run.catch(()=>{});return run;}
export function normalizeMB(item){
 const title=String(item.title||'').trim(),id=item.id;
 if(!title||!id)return null;
 const artist=(item['artist-credit']||[]).filter(x=>x.artist).map(x=>x.artist.name).join(', ');
 const year=Number(String(item['first-release-date']||'').slice(0,4))||undefined;
 return {id:'musicbrainz:'+id,kind:'music',source:'musicbrainz-live',title,creator:artist,year,
  country:'',genres:[],aliases:[],verified:true,ratingCount:null,sourceUrl:'https://musicbrainz.org/release-group/'+id};
}
export async function searchMusicBrainz(input,{limit=12}={}){
 const q=String(input||'').split(/\\s+[—–]\\s+/u)[0].trim().slice(0,100);
 if(q.length<2||q.length>100)return [];
 const key=canonical(q);
 const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.items;
 if(cache.size>MAX)cache.delete(cache.keys().next().value);
 const fetchPage=async(lucene)=>enqueue(async()=>{
  const url=new URL('https://musicbrainz.org/ws/2/release-group/');
  url.searchParams.set('query',lucene);
  url.searchParams.set('fmt','json');
  url.searchParams.set('limit',String(Math.min(50,Math.max(20,limit))));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{
    'User-Agent':`larper101/0.4 (contact: ${process.env.CATALOG_CONTACT_EMAIL||'https://github.com/eggseed1/dotdotdot'})`,
    'Accept':'application/json'
   }});
   if(!response.ok)throw Error('MusicBrainz HTTP '+response.status);
   const data=await response.json();
   return (data['release-groups']||[]).map(normalizeMB).filter(Boolean);
  }finally{clearTimeout(timeout);}
 });
 const phrase=q.replace(/["\\\\]/g,' ').replace(/[^\\p{L}\\p{N} '-]/gu,' ').trim();
 if(!phrase)return [];
 const terms=phrase.split(/\\s+/).filter(Boolean);
 const primary=terms.length>1?
   'releasegroup:('+terms.map((t,i)=>i===terms.length-1?`${t}*`:t).join(' AND ')+')':
   'releasegroup:'+terms[0]+'*';
 let items=await fetchPage(primary);
 if(items.length<3&&terms.length>1){
   const more=await fetchPage('releasegroup:"'+phrase+'"');
   const seen=new Set(items.map(x=>x.id));
   for(const item of more)if(!seen.has(item.id)){items.push(item);seen.add(item.id);}
 }
 // Exact and prefix title matches first, with stable results across query types.
 const norm=canonical(phrase);
 const rank=w=>{
  const title=canonical(w.title);
  if(title===norm)return 0;
  if(title.startsWith(norm))return 1;
  if(title.includes(norm))return 2;
  return 3;
 };
 items.sort((a,b)=>rank(a)-rank(b)||a.title.localeCompare(b.title));

 cache.set(key,{expires:Date.now()+TTL,items});return items;
}
async function mbGet(route){return enqueue(async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{const res=await fetch('https://musicbrainz.org/ws/2/'+route,{signal:controller.signal,headers:{'User-Agent':`larper101/0.3 (contact: ${process.env.CATALOG_CONTACT_EMAIL||'https://github.com/eggseed1/dotdotdot'})`,'Accept':'application/json'}});
 if(!res.ok)throw Error('MusicBrainz details unavailable: '+res.status);
 return res.json();
 }finally{clearTimeout(timer);}
});}
const genreAlias=new Map([
 ['post rock','post-rock'],['postrock','post-rock'],['space rock','space rock'],
 ['experimental rock','experimental'],['avant-garde','experimental'],
 ['avant garde','experimental'],['electronica','electronic'],
 ['electronic music','electronic'],['jazz fusion','jazz'],['free jazz','jazz'],
 ['avant-garde jazz','jazz'],['ambient electronic','electronic'],
 ['kraut rock','krautrock']
]);
export function votedGenres(genres=[],tags=[]){
 const weighted=new Map();
 for(const item of [...genres,...tags]){
  const name=String(item.name||'').toLowerCase().trim();
  const votes=Number(item.count);
  if(!name||!Number.isFinite(votes)||votes<=0)continue;
  const normalized=genreAlias.get(name)||name;
  weighted.set(normalized,Math.max(weighted.get(normalized)||0,votes));
 }
 const evidence=[...weighted].sort((a,b)=>b[1]-a[1]);
 const strong=evidence.filter(([,count])=>count>=2).map(([name])=>name);
 return {genres:strong,genreVotes:Object.fromEntries(evidence.slice(0,30)),hasGenreEvidence:evidence.length>0};
}
export function provisionalRarity(voteCount){
 // MusicBrainz ratings are sparse; this is NOT a population percentile.
 if(!Number.isSafeInteger(voteCount)||voteCount<=0)return {points:44,tier:5,unrated:true};
 const points=Math.round(Math.max(12,Math.min(85,74-12*Math.log10(1+voteCount))));
 return {points,tier:points>=70?7:points>=58?6:points>=45?5:points>=30?4:3,unrated:false};
}
const countryNames={'JP':'Japan','BR':'Brazil','GB':'United Kingdom','US':'United States','KR':'South Korea'};
export async function enrichMusicBrainz(work){
 if(!work?.id?.startsWith('musicbrainz:'))return work;
 const id=work.id.slice('musicbrainz:'.length),existing=detailsCache.get(id);
 if(existing&&existing.expires>Date.now())return {...work,...existing.fields};
 const result=await mbGet('release-group/'+encodeURIComponent(id)+'?inc=genres+tags+ratings+artist-credits&fmt=json');
 const genreData=votedGenres(result.genres,result.tags);
 const artistId=result['artist-credit']?.find(a=>a.artist)?.artist?.id;
 let country='';
 if(artistId){try{const artist=await mbGet('artist/'+encodeURIComponent(artistId)+'?fmt=json');
 country=countryNames[artist.country]||artist.area?.name||'';}catch{}}
 const voteCount=Number(result.rating?.['votes-count']||0);
 const fields={...genreData,country,ratingCount:Number.isSafeInteger(voteCount)&&voteCount>0?voteCount:null,ratingSource:'musicbrainz-release-group'};
 detailsCache.set(id,{fields,expires:Date.now()+TTL});
 if(detailsCache.size>MAX)detailsCache.delete(detailsCache.keys().next().value);
 return {...work,...fields};
}
export function exactLiveMatches(raw,items){
 const key=canonical(raw);
 return items.filter(w=>canonical(w.title)===key||canonical(w.title+' '+w.creator)===key||canonical(w.title+' — '+w.creator)===key||canonical(w.creator+' '+w.title)===key);
}
