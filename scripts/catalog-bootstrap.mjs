#!/usr/bin/env node
/** Run permitted catalog imports against the same persistent SQLite path as the server.
 * Example: npm run catalog:bootstrap -- --anime-pages 20
 * Optional TMDB requires TMDB_READ_TOKEN and compliance with its API terms.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createCatalogStore} from '../server/catalog-store.mjs';
const argv=process.argv.slice(2);
const opt=(flag,defaultValue)=>{const at=argv.indexOf(flag);return at<0?defaultValue:argv[at+1];};
const count=(flag,fallback,max)=>{const value=Number(opt(flag,String(fallback)));if(!Number.isSafeInteger(value)||value<0||value>max)throw Error('Invalid '+flag);return value;};
const animePages=count('--anime-pages',20,1000);
const animeStartOption=opt('--anime-start-page','auto');
const animeStartPage=animeStartOption==='auto'?null:count('--anime-start-page',1,100000);
const movieFrom=count('--movie-from',1990,2100),movieTo=count('--movie-to',2026,2100);
const includeMovies=argv.includes('--movies');
const db=path.resolve(opt('--db',process.env.CATALOG_DB||'data/catalog.sqlite'));
if(includeMovies&&(!process.env.TMDB_READ_TOKEN||movieTo<movieFrom))throw Error('TMDB_READ_TOKEN and valid movie year range required');
const outDir=fs.mkdtempSync(path.join(os.tmpdir(),'larper-catalog-'));
const run=(file,args)=>{console.error('RUN',file,...args);const p=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env:process.env});if(p.error)throw p.error;if(p.status!==0)throw Error(file+' failed with status '+p.status);};
try{
 if(animePages){
  const initialized=createCatalogStore(db);initialized.close();
  const state=new DatabaseSync(db);
  state.exec('CREATE TABLE IF NOT EXISTS catalog_sync_state (source TEXT PRIMARY KEY, next_page INTEGER NOT NULL)');
  const saved=state.prepare('SELECT next_page FROM catalog_sync_state WHERE source=?').get('anilist');
  const count=Number(state.prepare("SELECT COUNT(*) AS n FROM works WHERE source='anilist'").get().n);
  const start=animeStartPage??Number(saved?.next_page||Math.floor(count/50)+1);
  state.close();
  const file=path.join(outDir,'anime.jsonl');
  run('scripts/fetch-anilist.mjs',['--pages',String(animePages),'--start-page',String(start),'--out',file]);
  run('scripts/import-catalog.mjs',['--file',file,'--source','anilist','--db',db]);
  const updated=new DatabaseSync(db);
  updated.prepare('INSERT INTO catalog_sync_state(source,next_page) VALUES (?,?) ON CONFLICT(source) DO UPDATE SET next_page=excluded.next_page').run('anilist',start+animePages);
  updated.close();
  console.log('AniList next page '+(start+animePages));
 }
 if(includeMovies){const file=path.join(outDir,'movies.jsonl');run('scripts/fetch-tmdb.mjs',['--from',String(movieFrom),'--to',String(movieTo),'--out',file]);run('scripts/import-catalog.mjs',['--file',file,'--source','tmdb','--authorized','--db',db]);}
 run('scripts/catalog-audit.mjs',['--db',db]);
}finally{fs.rmSync(outDir,{recursive:true,force:true});}
