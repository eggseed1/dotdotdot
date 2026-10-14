#!/usr/bin/env node
/** Index existing movie metadata into prompt-specific review queues.
 * Never auto-accept content claims from titles, genres or a search hit.
 * Builds large, deduplicated candidate lists without requiring extra API calls.
 */
import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),arg=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const file=path.resolve(arg('--db',process.env.CATALOG_DB||'data/catalog.sqlite'));
const out=path.resolve(arg('--out','data/prompt-discovery.jsonl'));
const db=new DatabaseSync(file,{readOnly:true});
const rows=db.prepare("SELECT id,title,title_ko,year,source,source_url,genres FROM works WHERE kind='film' AND verified=1").iterate();
const seen=new Set(),entries=[];let scanned=0;
for(const w of rows){
 scanned++;
 const prompts=[];
 if(/[0-9０-９]/u.test(w.title))prompts.push('f-title-number');
 const genres=JSON.parse(w.genres||'[]').map(s=>String(s).toLowerCase());
 if(genres.some(g=>/science fiction|fantasy|romance|horror/.test(g)))prompts.push('f-nonhuman-romance','f-after-death-protagonist');
 for(const promptId of prompts){
  const key=promptId+':'+w.id;if(seen.has(key))continue;seen.add(key);
  entries.push({promptId,title:w.title,titleKo:w.title_ko||'',year:w.year,source:w.source,sourceUrl:w.source_url,
   status:promptId==='f-title-number'?'metadata-eligible':'requires-human-review',reason:promptId==='f-title-number'?'Numeric title':'Genre only: plot criteria NOT confirmed'});
 }
}
db.close();fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,entries.map(x=>JSON.stringify(x)).join('\n')+(entries.length?'\n':''));
console.log(JSON.stringify({scanned,candidates:entries.length,byPrompt:Object.fromEntries([...new Set(entries.map(x=>x.promptId))].map(k=>[k,entries.filter(x=>x.promptId===k).length])),out}));
