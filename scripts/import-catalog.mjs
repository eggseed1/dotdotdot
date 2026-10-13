#!/usr/bin/env node
/** Offline import only: no site scraping or credential bypass.
 * Usage: node scripts/import-catalog.mjs --file ./licensed.jsonl --source musicbrainz
 * Proprietary provider files require --authorized; public datasets still require checking their own license.
 */
import {createReadStream} from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {createCatalogStore} from '../server/catalog-store.mjs';
const args=process.argv.slice(2);const opt=(k)=>args[args.indexOf(k)+1];
const filename=opt('--file'),source=opt('--source');
if(!filename||!source){console.error('Usage: npm run import:catalog -- --file PATH.jsonl --source musicbrainz|openlibrary|imdb|... [--authorized] [--db data/catalog.sqlite]');process.exit(1);}
const restricted=new Set(['rym','letterboxd','backloggd','spotify','imdb','myanimelist','igdb','tmdb']);
if(restricted.has(source)&&!args.includes('--authorized')){console.error(`Source ${source} requires a permitted/authorized dataset and explicit --authorized flag; nothing imported.`);process.exit(1);}
const dbPath=opt('--db')||path.resolve('data/catalog.sqlite');
const store=createCatalogStore(dbPath);
const stream=readline.createInterface({input:createReadStream(filename),crlfDelay:Infinity});
let header=null,rows=0,failed=0;
const parseCsv=line=>{const cells=[];let token='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){token+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){cells.push(token);token='';}else token+=c;}cells.push(token);return cells;};
const parseList=s=>Array.isArray(s)?s:String(s||'').split(/[|;]/).map(x=>x.trim()).filter(Boolean);
store.begin();
try{
 for await(const line of stream){if(!line.trim())continue;
  let row;
  try{if(filename.endsWith('.jsonl')||filename.endsWith('.ndjson'))row=JSON.parse(line);
    else{const columns=filename.endsWith('.tsv')?line.split('\t'):parseCsv(line);if(!header){header=columns;continue;}row=Object.fromEntries(header.map((k,i)=>[k,columns[i]]));}
    const w={kind:row.kind,title:row.title,titleKo:row.titleKo||row.title_ko,creator:row.creator,year:row.year?Number(row.year):null,country:row.country,genres:parseList(row.genres),aliases:parseList(row.aliases),source,sourceId:String(row.sourceId||row.source_id||row.id||''),ratingCount:row.ratingCount===undefined&&row.rating_count===undefined?null:Number(row.ratingCount??row.rating_count),verified:row.verified===true||row.verified==='true'||row.verified===1||row.verified==='1',sourceUrl:row.sourceUrl||row.source_url};
    store.put(w);rows++;
  }catch(e){failed++;if(failed<=5)console.error('Skipped invalid record:',String(e.message||e));}
  if((rows+failed)%1000===0){store.commit();store.begin();}
 }
 store.commit();console.log(JSON.stringify({imported:rows,skipped:failed,db:dbPath,stats:store.stats()},null,2));
}catch(error){store.rollback();console.error(error);process.exitCode=1;}finally{store.close();}
