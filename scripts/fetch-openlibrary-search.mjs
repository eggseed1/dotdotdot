#!/usr/bin/env node
/** Free, conservative Open Library Search API importer (no bulk dump, no API key).
 * Imports only supplied metadata; does not invent country, genre, or rarity votes.
 * API courtesy: 1.2s between requests and capped batches.
 */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const pages=Number(opt('--pages','5')),start=Number(opt('--start-page','0'));
if(!Number.isSafeInteger(pages)||pages<1||pages>30||!Number.isSafeInteger(start)||start<0)throw Error('Invalid pagination');
const out=path.resolve(opt('--out','data/openlibrary-search.jsonl'));
const subjects=['experimental fiction','postmodern fiction','japanese literature','korean literature','science fiction','literary fiction','horror fiction','novels'];
const normalize=d=>{
 const id=String(d.key||'').replace(/^\/works\//,'');
 if(!/^OL\d+W$/.test(id)||!d.title)return null;
 const subjects=(d.subject||[]).filter(x=>typeof x==='string').map(x=>x.toLowerCase());
 const genre=new Set(subjects.slice(0,15));
 if(subjects.some(x=>x.includes('postmodern')))genre.add('postmodernism');
 if(subjects.some(x=>x.includes('experimental')))genre.add('experimental');
 const year=Number(d.first_publish_year)||null;
 return {kind:'literature',sourceId:id,title:d.title,creator:(d.author_name||[])[0]||'',year,country:'',genres:[...genre],aliases:(d.alternative_title||[]).slice(0,12),ratingCount:null,verified:true,sourceUrl:'https://openlibrary.org/works/'+id};
};
fs.mkdirSync(path.dirname(out),{recursive:true});
const works=new Map();
for(let page=start;page<start+pages;page++){
 const subject=subjects[page%subjects.length],offset=Math.floor(page/subjects.length)*100;
 const url=new URL('https://openlibrary.org/search.json');
 url.searchParams.set('subject',subject);url.searchParams.set('limit','100');url.searchParams.set('offset',String(offset));
 url.searchParams.set('fields','key,title,first_publish_year,author_name,subject,alternative_title');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'larper101 metadata importer (https://github.com/eggseed1/dotdotdot)','Accept':'application/json'}});
  if(response.status===429||response.status>=500)throw Error('Open Library temporarily unavailable: '+response.status);
  if(!response.ok)throw Error('Open Library HTTP '+response.status);
  const data=await response.json();for(const d of data.docs||[]){const w=normalize(d);if(w)works.set(w.sourceId,w);}
 }finally{clearTimeout(timer);}
 console.error('Open Library page '+page+': '+works.size+' works');
 await new Promise(resolve=>setTimeout(resolve,1200));
}
fs.writeFileSync(out,[...works.values()].map(w=>JSON.stringify(w)).join('\n')+'\n');
console.log(JSON.stringify({written:works.size,nextPage:start+pages,out}));
