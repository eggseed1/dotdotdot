import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const KINDS=new Set(['music','film','literature','anime','games']);
const SOURCES=new Set(['musicbrainz','rym','spotify','letterboxd','imdb','tmdb','openlibrary','myanimelist','anilist','backloggd','igdb','custom']);

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
  CREATE TABLE IF NOT EXISTS source_attribution (source TEXT PRIMARY KEY, terms TEXT, attribution TEXT, permitted_at TEXT);
  `);
  const insert=db.prepare(`INSERT INTO works(id,kind,title,title_ko,creator,year,country,genres,aliases,source,source_id,rating_count,verified,source_url)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,title_ko=excluded.title_ko,
  creator=excluded.creator,year=excluded.year,country=excluded.country,genres=excluded.genres,aliases=excluded.aliases,
  rating_count=excluded.rating_count,verified=excluded.verified,source_url=excluded.source_url,updated_at=CURRENT_TIMESTAMP`);
  const clearGenres=db.prepare('DELETE FROM work_genres WHERE work_id=?');
  const genreInsert=db.prepare('INSERT OR IGNORE INTO work_genres(work_id,genre) VALUES(?,?)');
  function put(w){
    if(!KINDS.has(w.kind)||!SOURCES.has(w.source)||!w.title||!w.sourceId)throw Error('Missing required kind/source/title/sourceId');
    const genres=[...new Set((w.genres||[]).map(s=>String(s).trim().toLowerCase()).filter(Boolean))];
    const aliases=(w.aliases||[]).filter(Boolean);
    const id=`${w.source}:${w.sourceId}`;
    insert.run(id,w.kind,w.title,w.titleKo||null,w.creator||null,w.year??null,w.country||null,JSON.stringify(genres),JSON.stringify(aliases),w.source,w.sourceId,w.ratingCount??null,Number(Boolean(w.verified)),w.sourceUrl||null);
    clearGenres.run(id);for(const genre of genres)genreInsert.run(id,genre);
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
    const normalized=title.trim().toLowerCase();
    // SQL narrows matches; final aliases, transliterations and ambiguous names are handled by caller.
    const candidates=db.prepare(`SELECT * FROM works WHERE kind=? AND (title COLLATE NOCASE=? OR title_ko=? OR aliases LIKE ?) LIMIT 60`).all(kind,title.trim(),title.trim(),`%${title.trim().slice(0,80)}%`);
    return candidates.map(hydrate).filter(w=>[w.title,w.titleKo,...w.aliases].some(x=>x?.toLowerCase()===normalized));
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
  function possible(promptId,limit=12){const pool=eligible(promptId);if(!pool.length)return [];
    return pool.sort((a,b)=>a.ratingCount-b.ratingCount).slice(0,limit);
  }
  return {db,put,begin,commit,rollback,stats,lookup,eligible,possible,close:()=>db.close()};
}
function hydrate(row){return {id:row.id,kind:row.kind,title:row.title,titleKo:row.title_ko,creator:row.creator,year:row.year,country:row.country,genres:JSON.parse(row.genres||'[]'),aliases:JSON.parse(row.aliases||'[]'),source:row.source,sourceId:row.source_id,ratingCount:row.rating_count,verified:Boolean(row.verified),sourceUrl:row.source_url};}
