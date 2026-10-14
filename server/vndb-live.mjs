import {evidenceRarity} from './evidence-rarity.mjs';
import {canonical} from '../src/lib/title-match.mjs';
const cache=new Map(),TTL=6*60*60*1000;
function yearOf(value){const year=Number(String(value||'').slice(0,4));return year>=1980&&year<=2100?year:0;}
export function normalizeVN(v){
 if(!v?.id||!v?.title)return null;
 const names=[v.title,v.alttitle,...(v.aliases||[]),...(v.titles||[]).flatMap(t=>[t.title,t.latin])].filter(Boolean);
 const country=v.olang==='ja'?'Japan':v.olang==='ko'?'South Korea':'';
 return {id:'vndb:'+v.id,kind:'games',source:'vndb-live',title:v.title,titleKo:'',creator:(v.developers||[]).map(d=>d.name).filter(Boolean).join(', '),
 year:yearOf(v.released),country,genres:['visual novel'],aliases:[...new Set(names)],verified:true,
 ratingCount:Number.isSafeInteger(v.votecount)?v.votecount:null,sourceUrl:'https://vndb.org/'+v.id};
}
export async function searchVNDB(input,{limit=15}={}){
 const q=String(input||'').trim().slice(0,100);if(q.length<2)return [];
 const key=canonical(q),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.items;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('https://api.vndb.org/kana/vn',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({filters:['search','=',q],fields:'id,title,alttitle,aliases,titles.title,titles.latin,olang,released,votecount,developers.name',
    sort:'searchrank',results:Math.min(40,Math.max(15,limit))})});
  if(!response.ok)throw Error('VNDB HTTP '+response.status);
  const data=await response.json();const items=(data.results||[]).map(normalizeVN).filter(Boolean);
  if(cache.size>450)cache.delete(cache.keys().next().value);
  cache.set(key,{until:Date.now()+TTL,items});return items;
 }finally{clearTimeout(timer);}
}
export function exactVNDB(raw,items){
 const key=canonical(raw);
 return items.filter(w=>[w.title,...w.aliases,w.title+' — '+w.creator].some(n=>canonical(n)===key));
}
export function vnRarity(count){return evidenceRarity(count,{typical:600,ceiling:15000,minimum:4});}
