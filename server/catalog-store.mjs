import {canonical,indexNamesFor,phoneticKeys,suggestWorks,exactWorks} from '../src/lib/title-match.mjs';
import {rarityFromRank} from '../src/lib/rarity-model.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const grams=word=>{const v=canonical(word).replaceAll(' ','');if(v.length<3)return [];return [...new Set(Array.from({length:v.length-2},(_,i)=>v.slice(i,i+3)))].slice(0,80);};
const KINDS=new Set(['music','film','literature','anime','games']);
const SOURCES=new Set(['musicbrainz','wikidata','lastfm','bandcamp','rym','spotify','letterboxd','imdb','tmdb','openlibrary','myanimelist','anilist','backloggd','igdb','custom']);

export function createCatalogStore(dbPath){
  if(dbPath!==':memory:')fs.mkdirSync(path.dirname(dbPath),{recursive:true});
  const db=new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, title_ko TEXT,
    creator TEXT, year INTEGER, country TEXT, genres TEXT NOT NULL DEFAULT '[]',
    aliases TEXT NOT NULL DEFAULT '[]', source TEXT NOT NULL, source_id TEXT NOT NULL,
    rating_count INTEGER, verified INTEGER NOT NULL DEFAULT 0, source_url TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source,source_id)
  );
  CREATE INDEX IF NOT EXISTS works_kind ON works(kind);
  CREATE INDEX IF NOT EXISTS works_title ON works(kind,title COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS works_source ON works(source);
  CREATE TABLE IF NOT EXISTS work_genres (work_id TEXT, genre TEXT, PRIMARY KEY(work_id,genre));
  CREATE INDEX IF NOT EXISTS genre_lookup ON work_genres(genre,work_id);
  CREATE TABLE IF NOT EXISTS work_aliases (work_id TEXT NOT NULL,alias_norm TEXT NOT NULL COLLATE NOCASE,PRIMARY KEY(work_id,alias_norm));
  CREATE INDEX IF NOT EXISTS title_alias_lookup ON work_aliases(alias_norm,work_id);
  CREATE TABLE IF NOT EXISTS work_grams (work_id TEXT NOT NULL,gram TEXT NOT NULL,PRIMARY KEY(work_id,gram));
  CREATE INDEX IF NOT EXISTS gram_lookup ON work_grams(gram,work_id);
  CREATE TABLE IF NOT EXISTS source_attribution (source TEXT PRIMARY KEY, terms TEXT, attribution TEXT, permitted_at TEXT);
  `);
  const insert=db.prepare(`INSERT INTO works(id,kind,title,title_ko,creator,year,country,genres,aliases,source,source_id,rating_count,verified,source_url)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,title_ko=excluded.title_ko,
  creator=excluded.creator,year=excluded.year,country=excluded.country,genres=excluded.genres,aliases=excluded.aliases,
  rating_count=excluded.rating_count,verified=excluded.verified,source_url=excluded.source_url,updated_at=CURRENT_TIMESTAMP`);
  const clearGenres=db.prepare('DELETE FROM work_genres WHERE work_id=?');
  const clearAliases=db.prepare('DELETE FROM work_aliases WHERE work_id=?');
  const aliasInsert=db.prepare('INSERT OR IGNORE INTO work_aliases(work_id,alias_norm) VALUES(?,?)');
  const clearGrams=db.prepare('DELETE FROM work_grams WHERE work_id=?');
  const gramInsert=db.prepare('INSERT OR IGNORE INTO work_grams(work_id,gram) VALUES(?,?)');
  function indexAliases(id,work){for(const alias of indexNamesFor(work)){aliasInsert.run(id,alias);for(const gram of grams(alias))gramInsert.run(id,gram);}}
  const genreInsert=db.prepare('INSERT OR IGNORE INTO work_genres(work_id,genre) VALUES(?,?)');
  function put(w){
    if(!KINDS.has(w.kind)||!SOURCES.has(w.source)||!w.title||!w.sourceId)throw Error('Missing required kind/source/title/sourceId');
    const genres=[...new Set((w.genres||[]).map(s=>String(s).trim().toLowerCase()).filter(Boolean))];
    const aliases=(w.aliases||[]).filter(Boolean);
    const id=`${w.source}:${w.sourceId}`;
    insert.run(id,w.kind,w.title,w.titleKo||null,w.creator||null,w.year??null,w.country||null,JSON.stringify(genres),JSON.stringify(aliases),w.source,w.sourceId,w.ratingCount??null,Number(Boolean(w.verified)),w.sourceUrl||null);
    clearGenres.run(id);for(const genre of genres)genreInsert.run(id,genre);
    clearAliases.run(id);clearGrams.run(id);indexAliases(id,{...w,aliases});
    return id;
  }
  function begin(){db.exec('BEGIN TRANSACTION');}
  function commit(){db.exec('COMMIT');}
  function rollback(){db.exec('ROLLBACK');}
  function stats(){
    return db.prepare('SELECT kind,source,COUNT(*) AS entries,COUNT(rating_count) AS rated FROM works GROUP BY kind,source ORDER BY kind,source').all();
  }
  function lookup(kind,title){
    if(!KINDS.has(kind)||typeof title!=='string'||title.trim().length<2)return [];
    const key=canonical(title.slice(0,200));
    const rows=db.prepare(`SELECT DISTINCT w.* FROM work_aliases a JOIN works w ON w.id=a.work_id
      WHERE w.kind=? AND a.alias_norm=? LIMIT 20`).all(kind,key);
    const seen=new Set();
    return exactWorks(title,rows.map(hydrate)).sort((a,b)=>(b.ratingCount??-1)-(a.ratingCount??-1)).filter(w=>{
      const identity=[w.kind,canonical(w.title),canonical(w.creator||''),w.year||''].join(':');
      if(seen.has(identity))return false;seen.add(identity);return true;
    });
  }
  function suggest(kind,query,limit=7){
    if(!KINDS.has(kind)||typeof query!=='string'||query.trim().length<2)return [];
    const keys=phoneticKeys(query.slice(0,100)).map(k=>k.replace(/[\\%_]/g,'')).filter(Boolean);
    const candidates=[],ids=new Set();
    const add=rows=>{for(const row of rows){if(!ids.has(row.id)){ids.add(row.id);candidates.push(hydrate(row));}}};
    const prefix=db.prepare(`SELECT DISTINCT w.* FROM work_aliases a JOIN works w ON w.id=a.work_id WHERE w.kind=? AND a.alias_norm LIKE ? LIMIT 90`);
    const contains=db.prepare(`SELECT DISTINCT w.* FROM work_aliases a JOIN works w ON w.id=a.work_id WHERE w.kind=? AND a.alias_norm LIKE ? LIMIT 90`);
    for(const key of keys){
      add(prefix.all(kind,key+'%'));
      if(candidates.length<limit)add(contains.all(kind,'%'+key+'%'));
      if(candidates.length<limit&&key.length>=3){
        const parts=grams(key);
        if(parts.length){
          const matches=db.prepare(`SELECT w.* FROM work_grams g JOIN works w ON w.id=g.work_id WHERE w.kind=?
            AND g.gram IN (${parts.map(()=>'?').join(',')}) GROUP BY w.id ORDER BY COUNT(*) DESC LIMIT 120`).all(kind,...parts);
          add(matches);
        }
      }
    }
    return suggestWorks(query,candidates,limit);
  }
  function wherePrompt(id){
    const kind=id[0]==='m'?'music':id[0]==='f'?'film':id[0]==='l'?'literature':id[0]==='a'?'anime':'games';
    const genres={'m-shoegaze':['shoegaze'],'m-postrock':['post-rock'],'m-jazz':['jazz'],'m-electronic':['electronic'],'m-krautrock':['krautrock'],'m-experimental':['experimental'],'f-romance':['romance'],'l-experimental':['experimental','postmodernism'],'a-psych':['psychological'],'a-sci-fi':['science fiction','cyberpunk'],'g-rpg':['rpg'],'g-psych':['psychological','surrealism']};
    const years={'m-90s':[1990,1999],'m-70s':[1970,1979],'m-jazz':[0,1969],'m-electronic':[1990,1999],'f-90s':[1990,1999],'f-70s':[1970,1979],'l-1900s':[1901,2000],'a-90s':[1990,1999],'a-2000s':[2000,2009],'g-2010s':[2010,2019]};
    const countries={'m-japan':['Japan'],'m-brazil':['Brazil'],'m-uk':['United Kingdom'],'f-korean':['South Korea'],'f-japanese':['Japan'],'l-japanese':['Japan'],'l-asia':['Japan','South Korea'],'g-japan':['Japan']};
    if(!/^[mflag]-[a-z0-9-]+$/.test(id))return null;
    let sql='kind=?',params=[kind];
    if(years[id]){sql+=' AND year BETWEEN ? AND ?';params.push(...years[id]);}
    if(countries[id]){sql+=` AND country IN (${countries[id].map(()=>'?').join(',')})`;params.push(...countries[id]);}
    if(genres[id]){sql+=` AND EXISTS(SELECT 1 FROM work_genres g WHERE g.work_id=works.id AND g.genre IN (${genres[id].map(()=>'?').join(',')}))`;params.push(...genres[id]);}
    return {sql,params};
  }
  function eligible(promptId,limit=25000){
    const filter=wherePrompt(promptId);if(!filter)return [];
    return db.prepare(`SELECT * FROM works WHERE ${filter.sql} AND verified=1 AND rating_count IS NOT NULL AND rating_count >= 1 ORDER BY rating_count DESC LIMIT ?`).all(...filter.params,limit).map(hydrate);
  }
  function score(promptId,count){
    const filter=wherePrompt(promptId);if(!filter)return {points:0,tier:-1,percentile:0};
    const row=db.prepare(`SELECT COUNT(*) AS n,SUM(CASE WHEN rating_count>? THEN 1 ELSE 0 END) AS greater
      FROM works WHERE ${filter.sql} AND verified=1 AND rating_count>=1`).get(count,...filter.params);
    return rarityFromRank(count,Number(row.n),Number(row.greater||0));
  }
  function possible(promptId,limit=12){const pool=eligible(promptId);if(!pool.length)return [];
    return pool.sort((a,b)=>a.ratingCount-b.ratingCount).slice(0,limit);
  }
  if((db.prepare('SELECT COUNT(*) n FROM work_aliases').get().n===0 || db.prepare('SELECT COUNT(*) n FROM work_grams').get().n===0)
      && db.prepare('SELECT COUNT(*) n FROM works').get().n>0){
    const rows=db.prepare('SELECT * FROM works').iterate();
    db.exec('BEGIN TRANSACTION');try{for(const row of rows)indexAliases(row.id,hydrate(row));db.exec('COMMIT');}
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {db,put,begin,commit,rollback,stats,lookup,suggest,eligible,score,possible,close:()=>db.close()};
}
function hydrate(row){return {id:row.id,kind:row.kind,title:row.title,titleKo:row.title_ko,creator:row.creator,year:row.year,country:row.country,genres:JSON.parse(row.genres||'[]'),aliases:JSON.parse(row.aliases||'[]'),source:row.source,sourceId:row.source_id,ratingCount:row.rating_count,verified:Boolean(row.verified),sourceUrl:row.source_url};}
