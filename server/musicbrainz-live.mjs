import {canonical} from '../src/lib/title-match.mjs';
// Rate-limited upstream MusicBrainz search. No site scraping, no mass harvesting.
const cache=new Map(),MAX=900,TTL=1000*60*60*8;
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
 const q=String(input||'').trim().slice(0,100);
 if(q.length<2||q.length>100)return [];
 const key=canonical(q);
 const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.items;
 if(cache.size>MAX)cache.delete(cache.keys().next().value);
 const items=await enqueue(async()=>{
  const url=new URL('https://musicbrainz.org/ws/2/release-group/');
  url.searchParams.set('query',`releasegroup:"${q.replace(/["\\]/g,' ').trim()}"`);
  url.searchParams.set('fmt','json');url.searchParams.set('limit',String(Math.min(25,Math.max(7,limit))));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':`larper101/0.3 (contact: ${process.env.CATALOG_CONTACT_EMAIL||'https://github.com/eggseed1/dotdotdot'})`,'Accept':'application/json'}});
   if(!response.ok)throw Error('MusicBrainz unavailable: '+response.status);
   const data=await response.json();return (data['release-groups']||[]).map(normalizeMB).filter(Boolean);
  }finally{clearTimeout(timeout);}
 });
 cache.set(key,{expires:Date.now()+TTL,items});return items;
}
export function exactLiveMatches(raw,items){
 const key=canonical(raw);
 return items.filter(w=>canonical(w.title)===key||canonical(w.title+' '+w.creator)===key||canonical(w.creator+' '+w.title)===key);
}
