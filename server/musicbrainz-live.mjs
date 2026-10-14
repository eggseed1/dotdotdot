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
 const items=await enqueue(async()=>{
  const url=new URL('https://musicbrainz.org/ws/2/release-group/');
  const term=q.replace(/["\\\\]/g,' ').replace(/[^\\p{L}\\p{N} -]/gu,' ').trim();
  const lucene=term.includes(' ')?`releasegroup:"${term}"`:`releasegroup:${term}*`;
  url.searchParams.set('query',lucene);
  url.searchParams.set('fmt','json');url.searchParams.set('limit',String(Math.min(50,Math.max(15,limit))));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':`larper101/0.3 (contact: ${process.env.CATALOG_CONTACT_EMAIL||'https://github.com/eggseed1/dotdotdot'})`,'Accept':'application/json'}});
   if(!response.ok)throw Error('MusicBrainz unavailable: '+response.status);
   const data=await response.json();return (data['release-groups']||[]).map(normalizeMB).filter(Boolean);
  }finally{clearTimeout(timeout);}
 });
 cache.set(key,{expires:Date.now()+TTL,items});return items;
}
async function mbGet(route){return enqueue(async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{const res=await fetch('https://musicbrainz.org/ws/2/'+route,{signal:controller.signal,headers:{'User-Agent':`larper101/0.3 (contact: ${process.env.CATALOG_CONTACT_EMAIL||'https://github.com/eggseed1/dotdotdot'})`,'Accept':'application/json'}});
 if(!res.ok)throw Error('MusicBrainz details unavailable: '+res.status);
 return res.json();
 }finally{clearTimeout(timer);}
});}
const countryNames={'JP':'Japan','BR':'Brazil','GB':'United Kingdom','US':'United States','KR':'South Korea'};
export async function enrichMusicBrainz(work){
 if(!work?.id?.startsWith('musicbrainz:'))return work;
 const id=work.id.slice('musicbrainz:'.length),existing=detailsCache.get(id);
 if(existing&&existing.expires>Date.now())return {...work,...existing.fields};
 const result=await mbGet('release-group/'+encodeURIComponent(id)+'?inc=genres+artist-credits&fmt=json');
 const genres=(result.genres||[]).filter(g=>g.count>0).map(g=>g.name.toLowerCase());
 const artistId=result['artist-credit']?.find(a=>a.artist)?.artist?.id;
 let country='';
 if(artistId){try{const artist=await mbGet('artist/'+encodeURIComponent(artistId)+'?fmt=json');
 country=countryNames[artist.country]||artist.area?.name||'';}catch{}}
 const fields={genres,country};
 detailsCache.set(id,{fields,expires:Date.now()+TTL});
 if(detailsCache.size>MAX)detailsCache.delete(detailsCache.keys().next().value);
 return {...work,...fields};
}
export function exactLiveMatches(raw,items){
 const key=canonical(raw);
 return items.filter(w=>canonical(w.title)===key||canonical(w.title+' '+w.creator)===key||canonical(w.title+' — '+w.creator)===key||canonical(w.creator+' '+w.title)===key);
}
