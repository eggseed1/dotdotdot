#!/usr/bin/env node
/** Streams the OFFICIAL monthly Open Library WORKS dump; never crawls HTML. */
import fs from 'node:fs';
import path from 'node:path';
import {createGunzip} from 'node:zlib';
import readline from 'node:readline';
import {createCatalogStore} from '../server/catalog-store.mjs';
const args=process.argv.slice(2),flag=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const file=flag('--file'),limit=Math.min(Math.max(Number(flag('--limit')||100000),1),5000000);
if(!file){console.error('Usage: node scripts/import-openlibrary-dump.mjs --file works.txt.gz [--limit 100000] [--db data/catalog.sqlite]');process.exit(1);}
const store=createCatalogStore(flag('--db')||path.resolve('data/catalog.sqlite'));
const stream=fs.createReadStream(file),input=file.endsWith('.gz')?stream.pipe(createGunzip()):stream;
let seen=0,imported=0,skipped=0;
store.begin();
try{
 for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
  if(imported>=limit)break;seen++;
  try{
   const cols=line.split('\t');if(cols.length<5)continue;
   const doc=JSON.parse(cols.slice(4).join('\t'));
   if(!String(cols[0]).includes('type/work')||!doc.title||!doc.key)continue;
   const year=String(doc.first_publish_date||'').match(/\b(1[5-9]\d\d|20\d\d)\b/);
   store.put({source:'openlibrary',sourceId:doc.key.replace('/works/',''),kind:'literature',title:doc.title,
    year:year?Number(year[0]):null,creator:'',country:'',genres:(doc.subjects||[]).filter(s=>typeof s==='string').slice(0,12),
    aliases:[],ratingCount:null,verified:true,sourceUrl:`https://openlibrary.org${doc.key}`});
   imported++;if(imported%3000===0){store.commit();store.begin();console.error('Imported books',imported);}
  }catch(e){skipped++;if(skipped<=3)console.error('Skipping malformed row',e.message);}
 }
 store.commit();console.log(JSON.stringify({seen,imported,skipped,source:'openlibrary',scoringReady:false}));
}catch(e){store.rollback();console.error(e);process.exitCode=1;}finally{stream.destroy();store.close();}
