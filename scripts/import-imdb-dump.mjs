#!/usr/bin/env node
/** Bulk importer for official IMDb TSV dumps. No scraping. IMDb dataset licensing applies. */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {createGunzip} from 'node:zlib';
import {createCatalogStore} from '../server/catalog-store.mjs';
import {canonical} from '../src/lib/title-match.mjs';
const args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
const basics=opt('--basics'),ratings=opt('--ratings'),akas=opt('--akas');
if(!basics||!ratings||!args.includes('--acknowledge-imdb-terms')){
 console.error('Provide --basics, --ratings and --acknowledge-imdb-terms after verifying your IMDb data rights. Optional: --akas, --db, --limit.');
 process.exit(1);
}
const limit=opt('--limit')?Number(opt('--limit')):Infinity;
if(!(limit>0))throw Error('--limit must be positive');
const store=createCatalogStore(path.resolve(opt('--db')||'data/catalog.sqlite'));
const db=store.db;
const stats={ratings:0,films:0,aliases:0,korean:0};
async function* tsv(file){
 const raw=fs.createReadStream(file),input=file.endsWith('.gz')?raw.pipe(createGunzip()):raw;
 const reader=readline.createInterface({input,crlfDelay:Infinity});
 let header;
 try{
  for await(const line of reader){
   if(!header){header=line.split('\t');continue;}
   const cols=line.split('\t');if(cols.length!==header.length)continue;
   yield Object.fromEntries(header.map((key,i)=>[key,cols[i]==='\\N'?'':cols[i]]));
  }
 }finally{reader.close();input.destroy();raw.destroy();}
}
function checkpoint(n){if(n%5000===0){store.commit();store.begin();console.error('Imported',JSON.stringify(stats));}}
try{
 db.exec('CREATE TABLE IF NOT EXISTS imdb_import_ratings (id TEXT PRIMARY KEY, votes INTEGER NOT NULL)');
 const insertRating=db.prepare('INSERT OR REPLACE INTO imdb_import_ratings(id,votes) VALUES(?,?)');
 store.begin();
 for await(const r of tsv(ratings)){
  const n=Number(r.numVotes);if(!r.tconst||!Number.isSafeInteger(n)||n<0)continue;
  insertRating.run(r.tconst,n);stats.ratings++;checkpoint(stats.ratings);
 }
 store.commit();
 const ratingFor=db.prepare('SELECT votes FROM imdb_import_ratings WHERE id=?');
 store.begin();
 for await(const r of tsv(basics)){
  if(r.titleType!=='movie'||r.isAdult==='1'||!r.tconst||!r.primaryTitle)continue;
  const year=Number(r.startYear);
  store.put({kind:'film',source:'imdb',sourceId:r.tconst,title:r.primaryTitle,
   year:Number.isInteger(year)&&year>1800&&year<2200?year:null,
   genres:(r.genres||'').split(',').filter(Boolean).map(x=>x.toLowerCase()),
   aliases:r.originalTitle&&r.originalTitle!==r.primaryTitle?[r.originalTitle]:[],
   ratingCount:ratingFor.get(r.tconst)?.votes??null,verified:true,
   sourceUrl:'https://www.imdb.com/title/'+r.tconst+'/'});
  stats.films++;checkpoint(stats.films);
  if(stats.films>=limit)break;
 }
 store.commit();
 if(akas){
  const exists=db.prepare('SELECT title_ko FROM works WHERE id=?');
  const aliasInsert=db.prepare('INSERT OR IGNORE INTO work_aliases(work_id,alias_norm) VALUES(?,?)');
  const gramInsert=db.prepare('INSERT OR IGNORE INTO work_grams(work_id,gram) VALUES(?,?)');
  const updateKo=db.prepare(`UPDATE works SET title_ko=? WHERE id=? AND (title_ko IS NULL OR title_ko='')`);
  store.begin();
  for await(const r of tsv(akas)){
   if(!r.titleId||!r.title)continue;
   const id='imdb:'+r.titleId;if(!exists.get(id))continue;
   const key=canonical(r.title);if(!key)continue;
   if(aliasInsert.run(id,key).changes){
    const letters=key.replaceAll(' ','');const grams=new Set();
    for(let i=0;i+3<=letters.length&&i<80;i++)grams.add(letters.slice(i,i+3));
    for(const gram of grams)gramInsert.run(id,gram);
    stats.aliases++;
   }
   if(r.region==='KR'||r.language==='ko')stats.korean+=updateKo.run(r.title,id).changes;
   if((stats.aliases+stats.korean)%5000===0&&stats.aliases+stats.korean>0){store.commit();store.begin();}
  }
  store.commit();
 }
 db.exec('DROP TABLE IF EXISTS imdb_import_ratings');
 console.log(JSON.stringify({status:'complete',...stats,catalog:store.stats()},null,2));
}catch(error){try{store.rollback();}catch{}console.error(error);process.exitCode=1;}
finally{store.close();}
