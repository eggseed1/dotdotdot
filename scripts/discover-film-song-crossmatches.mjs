#!/usr/bin/env node
/** Cross-reference film titles against actual MusicBrainz song works.
 * Discover matches only: identical titles are not proof of any intended song/film relation.
 * Uses MusicBrainz public API respectfully (<=1 request/sec); never auto-accept.
 */
import fs from 'node:fs';import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),arg=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const dbPath=path.resolve(arg('--db',process.env.CATALOG_DB||'data/catalog.sqlite'));
const offset=Number(arg('--offset','0')),limit=Number(arg('--limit','45'));
if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>90)throw Error('invalid film window');
const db=new DatabaseSync(dbPath,{readOnly:true});const list=db.prepare("SELECT DISTINCT title,id FROM works WHERE kind='film' AND verified=1 AND length(title)>=3 ORDER BY id LIMIT ? OFFSET ?").all(limit,offset);db.close();
const out=path.resolve(arg('--out','data/song-film-candidates.jsonl')),sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(path.dirname(out),{recursive:true});const rows=[];
for(const film of list){
 const url=new URL('https://musicbrainz.org/ws/2/work/');
 url.searchParams.set('query','work:"'+film.title.replace(/["\\]/g,' ').slice(0,100)+'" AND type:song');
 url.searchParams.set('fmt','json');url.searchParams.set('limit','10');
 let ok=false;
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'dotdotdot/0.9 (https://github.com/eggseed1/dotdotdot; metadata research)','Accept':'application/json'}});
   if(!response.ok)throw Error('MusicBrainz HTTP '+response.status);
   const json=await response.json();
   const norm=s=>String(s).normalize('NFKC').toLocaleLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
   for(const work of json.works||[]){
    if(norm(work.title)===norm(film.title)&&work.type==='Song'){
     rows.push({promptId:'f-title-song',title:film.title,filmId:film.id,musicbrainzId:work.id,
       sources:[{provider:'catalog',id:film.id},{provider:'musicbrainz',url:'https://musicbrainz.org/work/'+work.id}],
       status:'cross-source-candidate'});
     ok=true;break;
    }
   }
  }finally{clearTimeout(timer);}
 }catch(e){console.error(film.title+': '+e.message);}
 console.error('Checked '+film.title+(ok?' MATCH':''));
 await sleep(1150);
}
fs.writeFileSync(out,rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''));
console.log(JSON.stringify({checked:list.length,candidates:rows.length,out}));
