#!/usr/bin/env node
/** Import an unpacked official MusicBrainz mbdump snapshot into the larper101 catalog.
 * Core dump is CC0. Genre votes and ratings require separate authorization.
 * Source: https://musicbrainz.org/doc/MusicBrainz_Database/Download
 * Usage: node scripts/import-musicbrainz-core.mjs --dump-dir /path/to/mbdump --db data/catalog.sqlite
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { createCatalogStore } from '../server/catalog-store.mjs';

const argv=process.argv.slice(2);
const opt=(key,def)=>{const at=argv.indexOf(key);return at<0?def:argv[at+1];};
const required=['artist','artist_credit','artist_credit_name','area','iso_3166_1','release_group','release_group_primary_type','release','release_country','release_unknown_country'];
const nullify=x=>x==='\\N'||x===undefined?null:x;
// PostgreSQL COPY text escapes. Never split on decoded tabs.
export function decodeCopy(x){if(x==='\\N')return null;return x.replace(/\\([\\tnrbfvo\\])/g,(_,c)=>({t:'\t',n:'\n',r:'\r',b:'\b',f:'\f',v:'\v',o:'o','\\':'\\'}[c]??c));}
const asNum=x=>{const n=Number(nullify(x));return x==='\\N'||x==null||!Number.isFinite(n)?null:n;};
export async function importMusicBrainz({dumpDir,dbPath,stagePath,limit=Infinity,derivedDir=null,allowSupplementary=false,progress=()=>{}}){
  if(!dumpDir)throw Error('Provide --dump-dir pointing to extracted mbdump folder.');
  for(const file of required)if(!fs.existsSync(path.join(dumpDir,file)))throw Error(`Missing MusicBrainz core table: ${file}`);
  if(derivedDir&&!allowSupplementary)throw Error('Supplementary genres/ratings require explicit --allow-noncommercial and compliance with CC BY-NC-SA 3.0, or a commercial license.');
  const temp=stagePath||`${dbPath}.musicbrainz-stage.sqlite`;
  fs.mkdirSync(path.dirname(temp),{recursive:true});
  const stage=new DatabaseSync(temp);const store=createCatalogStore(dbPath);
  const artistsDb=new DatabaseSync(dbPath);
  artistsDb.exec("CREATE TABLE IF NOT EXISTS music_artists (mbid TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT,aliases TEXT NOT NULL DEFAULT '[]',source TEXT NOT NULL DEFAULT 'musicbrainz'); CREATE INDEX IF NOT EXISTS music_artists_name ON music_artists(name COLLATE NOCASE);");
  stage.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS mb_area(id INTEGER PRIMARY KEY,name TEXT,is_country INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS mb_artist(id INTEGER PRIMARY KEY,gid TEXT,name TEXT,area INTEGER);
    CREATE TABLE IF NOT EXISTS mb_credit(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE IF NOT EXISTS mb_credit_artist(credit INTEGER,artist INTEGER,position INTEGER);
    CREATE TABLE IF NOT EXISTS mb_type(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE IF NOT EXISTS mb_group(id INTEGER PRIMARY KEY,gid TEXT,name TEXT,credit INTEGER,type INTEGER,year INTEGER);
    CREATE TABLE IF NOT EXISTS mb_release(id INTEGER PRIMARY KEY,rg INTEGER);
    CREATE TABLE IF NOT EXISTS mb_alias(rg INTEGER,name TEXT,locale TEXT);
    CREATE TABLE IF NOT EXISTS mb_artist_alias(artist INTEGER,name TEXT,locale TEXT);
    CREATE TABLE IF NOT EXISTS mb_genre_name(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE IF NOT EXISTS mb_tag(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE IF NOT EXISTS mb_group_tag(rg INTEGER,tag INTEGER,votes INTEGER);
    CREATE TABLE IF NOT EXISTS mb_meta(rg INTEGER PRIMARY KEY,rating_count INTEGER);
    CREATE TABLE IF NOT EXISTS mb_processed(rg INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS music_artists(mbid TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT,aliases TEXT NOT NULL DEFAULT '[]',source TEXT NOT NULL DEFAULT 'musicbrainz');
  `);
  const batches=[
    ['area','INSERT OR REPLACE INTO mb_area(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[2])]],
    ['iso_3166_1','UPDATE mb_area SET is_country=1 WHERE id=?',r=>[asNum(r[0])]],
    ['artist','INSERT OR REPLACE INTO mb_artist(id,gid,name,area) VALUES(?,?,?,?)',r=>[asNum(r[0]),r[1],decodeCopy(r[2]),asNum(r[11])]],
    ['artist_credit','INSERT OR REPLACE INTO mb_credit(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[1])]],
    ['artist_credit_name','INSERT INTO mb_credit_artist(credit,artist,position) VALUES(?,?,?)',r=>[asNum(r[0]),asNum(r[2]),asNum(r[1])]],
    ['release_group_primary_type','INSERT OR REPLACE INTO mb_type(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[1])]],
    ['release_group','INSERT OR REPLACE INTO mb_group(id,gid,name,credit,type) VALUES(?,?,?,?,?)',r=>[asNum(r[0]),r[1],decodeCopy(r[2]),asNum(r[3]),asNum(r[4])]],
    ['release','INSERT OR REPLACE INTO mb_release(id,rg) VALUES(?,?)',r=>[asNum(r[0]),asNum(r[4])]],
    ['release_country','UPDATE mb_group SET year=CASE WHEN year IS NULL OR year>? THEN ? ELSE year END WHERE id=(SELECT rg FROM mb_release WHERE id=?)',r=>{const y=asNum(r[2]);return y&&y>=1850&&y<=2100?[y,y,asNum(r[0])]:null;}],
    ['release_unknown_country','UPDATE mb_group SET year=CASE WHEN year IS NULL OR year>? THEN ? ELSE year END WHERE id=(SELECT rg FROM mb_release WHERE id=?)',r=>{const y=asNum(r[1]);return y&&y>=1850&&y<=2100?[y,y,asNum(r[0])]:null;}],
    ['release_group_alias','INSERT INTO mb_alias(rg,name,locale) VALUES(?,?,?)',r=>[asNum(r[1]),decodeCopy(r[2]),nullify(r[3])]],
    ['artist_alias','INSERT INTO mb_artist_alias(artist,name,locale) VALUES(?,?,?)',r=>[asNum(r[1]),decodeCopy(r[2]),nullify(r[3])]]
  ];
  async function load(dir,file,sql,transform,optional=false){
    const filename=path.join(dir,file);if(!fs.existsSync(filename)){if(optional)return 0;throw Error(`Missing ${filename}`);}
    const insert=stage.prepare(sql);let n=0;stage.exec('BEGIN');
    try{for await(const line of readline.createInterface({input:fs.createReadStream(filename),crlfDelay:Infinity})){
      if(!line)continue;const values=transform(line.split('\t'));if(!values||values.some((v,i)=>i===0&&v===null))continue;
      insert.run(...values);n++;
      if(n%10000===0){stage.exec('COMMIT');stage.exec('BEGIN');}
    }stage.exec('COMMIT');}catch(e){stage.exec('ROLLBACK');throw new Error(`${file}: ${e.message}`);}
    progress(`${file}: ${n.toLocaleString()}`);return n;
  }
  try{
    for(const [name,sql,transform] of batches){
      if(name==='release_group_alias'||name==='artist_alias')await load(dumpDir,name,sql,transform,true);
      else await load(dumpDir,name,sql,transform);
      if(name==='release')stage.exec('CREATE INDEX IF NOT EXISTS mb_release_rg ON mb_release(rg)');
    }
    if(derivedDir){
      await load(derivedDir,'genre','INSERT OR REPLACE INTO mb_genre_name(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[2])],true);
      // Genre table is part of the CC0 core dump; genre *associations* are supplementary.
      await load(derivedDir,'tag','INSERT OR REPLACE INTO mb_tag(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[1])],true);
      await load(derivedDir,'release_group_tag','INSERT INTO mb_group_tag(rg,tag,votes) VALUES(?,?,?)',r=>[asNum(r[0]),asNum(r[1]),asNum(r[2])],true);
      await load(derivedDir,'release_group_meta','INSERT OR REPLACE INTO mb_meta(rg,rating_count) VALUES(?,?)',r=>[asNum(r[0]),asNum(r[6])],true);
    }
    await load(dumpDir,'genre','INSERT OR REPLACE INTO mb_genre_name(id,name) VALUES(?,?)',r=>[asNum(r[0]),decodeCopy(r[2])],true);
    stage.exec(`CREATE INDEX IF NOT EXISTS mb_alias_rg ON mb_alias(rg);
      CREATE INDEX IF NOT EXISTS mb_artist_alias_id ON mb_artist_alias(artist);
      CREATE INDEX IF NOT EXISTS mb_credit_artist_id ON mb_credit_artist(credit,position);
      CREATE INDEX IF NOT EXISTS mb_group_tag_rg ON mb_group_tag(rg);`);
    const artistRows=stage.prepare(`SELECT a.gid,a.name,ar.name country,a.id FROM mb_artist a
      LEFT JOIN mb_area ar ON a.area=ar.id AND ar.is_country=1 ORDER BY a.id LIMIT ? OFFSET ?`);
    const artistAliases=stage.prepare('SELECT name FROM mb_artist_alias WHERE artist=? LIMIT 80');
    const artistInsert=artistsDb.prepare('INSERT OR REPLACE INTO music_artists(mbid,name,country,aliases) VALUES(?,?,?,?)');
    let artistCount=0;
    for(let offset=0;;offset+=1000){const rows=artistRows.all(1000,offset);if(!rows.length)break;
      artistsDb.exec('BEGIN');try{for(const a of rows){artistInsert.run(a.gid,a.name,a.country||null,JSON.stringify(artistAliases.all(a.id).map(x=>x.name)));artistCount++;}artistsDb.exec('COMMIT');}catch(e){artistsDb.exec('ROLLBACK');throw e;}
    }
    const page=stage.prepare(`SELECT g.id,g.gid,g.name,g.year,c.name creator,ar.name country,a.id artist_id
      FROM mb_group g JOIN mb_type t ON t.id=g.type AND lower(t.name) IN ('album','ep')
      JOIN mb_credit c ON c.id=g.credit
      LEFT JOIN mb_credit_artist ac ON ac.credit=g.credit AND ac.position=0
      LEFT JOIN mb_artist a ON a.id=ac.artist
      LEFT JOIN mb_area ar ON ar.id=a.area AND ar.is_country=1
      LEFT JOIN mb_processed done ON done.rg=g.id
      WHERE g.id>? AND done.rg IS NULL ORDER BY g.id LIMIT 500`);
    const aliases=stage.prepare('SELECT name,locale FROM mb_alias WHERE rg=? LIMIT 80');
    const tags=stage.prepare(`SELECT t.name,gt.votes FROM mb_group_tag gt JOIN mb_tag t ON t.id=gt.tag
      JOIN mb_genre_name gn ON lower(gn.name)=lower(t.name) WHERE gt.rg=? AND gt.votes>0 ORDER BY gt.votes DESC LIMIT 16`);
    const meta=stage.prepare('SELECT rating_count FROM mb_meta WHERE rg=?');
    const mark=stage.prepare('INSERT OR IGNORE INTO mb_processed(rg) VALUES(?)');
    let cursor=0,albums=0;
    while(albums<limit){const rows=page.all(cursor);if(!rows.length)break;
      store.begin();stage.exec('BEGIN');
      try{for(const row of rows){cursor=row.id;
        const names=aliases.all(row.id),english=names.find(a=>a.locale==='en'),korean=names.find(a=>a.locale==='ko');
        const votes=meta.get(row.id)?.rating_count;
        store.put({source:'musicbrainz',sourceId:row.gid,kind:'music',title:english?.name||row.name,titleKo:korean?.name||'',
          creator:row.creator,year:row.year,country:row.country||'',genres:tags.all(row.id).map(t=>t.name),
          aliases:[row.name,...names.map(a=>a.name)],ratingCount:Number.isInteger(votes)&&votes>0?votes:null,
          verified:true,sourceUrl:`https://musicbrainz.org/release-group/${row.gid}`});
        mark.run(row.id);albums++;if(albums>=limit)break;
      }store.commit();stage.exec('COMMIT');}catch(e){store.rollback();stage.exec('ROLLBACK');throw e;}
      if(albums%10000<500)progress(`Albums indexed: ${albums.toLocaleString()}`);
    }
    return {artists:artistCount,albums,scoringReady:Boolean(derivedDir),source:'musicbrainz',db:dbPath};
  }finally{store.close();stage.close();artistsDb.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPathSafe(import.meta.url)){
  const dumpDir=opt('--dump-dir'),dbPath=path.resolve(opt('--db','data/catalog.sqlite')),
    derivedDir=opt('--derived-dir'),allowSupplementary=argv.includes('--allow-noncommercial');
  try{const result=await importMusicBrainz({dumpDir,dbPath,derivedDir,allowSupplementary,limit:Number(opt('--limit','Infinity')),progress:console.error});console.log(JSON.stringify(result,null,2));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
function fileURLToPathSafe(u){return new URL(u).pathname;}
