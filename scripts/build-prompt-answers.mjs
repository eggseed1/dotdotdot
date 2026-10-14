#!/usr/bin/env node
/** Freeze verified answers for every editorial prompt before publishing a catalog.
 * Uses exactly the same prompt.match predicates as the game.
 */
import path from 'node:path';
import {createServer} from 'vite';
import {createCatalogStore} from '../server/catalog-store.mjs';
const args=process.argv.slice(2),at=args.indexOf('--db');
const file=path.resolve(at<0?(process.env.CATALOG_DB||'data/catalog.sqlite'):args[at+1]);
const catalog=createCatalogStore(file);
const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {promptPool}=await vite.ssrLoadModule('/src/lib/engine.ts');
 catalog.db.exec(`CREATE TABLE IF NOT EXISTS prompt_answers(
    prompt_id TEXT NOT NULL,work_id TEXT NOT NULL,points INTEGER NOT NULL,tier INTEGER NOT NULL,
    PRIMARY KEY(prompt_id,work_id));
   CREATE INDEX IF NOT EXISTS prompt_answer_work ON prompt_answers(work_id,prompt_id);
   CREATE TABLE IF NOT EXISTS prompt_coverage(prompt_id TEXT PRIMARY KEY,answer_count INTEGER NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
 const add=catalog.db.prepare('INSERT OR REPLACE INTO prompt_answers(prompt_id,work_id,points,tier) VALUES(?,?,?,?)');
 const coverage=catalog.db.prepare('INSERT OR REPLACE INTO prompt_coverage(prompt_id,answer_count,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)');
 catalog.db.exec('BEGIN');
 try{
  catalog.db.exec('DELETE FROM prompt_answers; DELETE FROM prompt_coverage;');
  for(const prompt of promptPool){
   const stmt=catalog.db.prepare('SELECT * FROM works WHERE kind=? AND verified=1');
   const works=stmt.all(prompt.kind).map(w=>({
     id:w.id,kind:w.kind,year:w.year,country:w.country,genres:JSON.parse(w.genres||'[]'),format:w.format||'',ratingCount:w.rating_count,title:w.title
   })).filter(w=>prompt.match(w));
   const ranked=[...works].filter(w=>Number.isInteger(w.ratingCount)&&w.ratingCount>0).sort((a,b)=>b.ratingCount-a.ratingCount);
   const ranks=new Map(ranked.map((w,i)=>[w.id,i]));
   for(const w of works){
    // Precomputed provisional rarity; no vote data means neutral points, never fabricated popularity.
    const rank=ranks.get(w.id);
    const points=rank===undefined?44:Math.max(10,Math.min(100,Math.round(10+90*(ranked.length-rank)/Math.max(1,ranked.length))));
    const tier=Math.max(1,Math.min(7,Math.ceil(points/15)));
    add.run(prompt.id,w.id,points,tier);
   }
   coverage.run(prompt.id,works.length);
   console.log(prompt.id+': '+works.length+' accepted answers');
  }
  catalog.db.exec('COMMIT');
 }catch(e){catalog.db.exec('ROLLBACK');throw e;}
}finally{await vite.close();catalog.close();}
