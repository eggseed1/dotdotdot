import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {canonical} from '../src/lib/title-match.mjs';

const argv=process.argv.slice(2);
const arg=(name,otherwise)=>{const i=argv.indexOf(name);return i<0?otherwise:argv[i+1];};
const dbFile=arg('--db','data/catalog.sqlite');
const outputDir=path.resolve(arg('--out','public/catalog-shards'));
const partSize=Number(arg('--shard-size','1200'));
if(!Number.isSafeInteger(partSize)||partSize<50||partSize>20000)throw Error('shard size must be between 50 and 20,000');
if(!fs.existsSync(dbFile))throw Error('Missing database: '+dbFile+'. Import authorized full datasets before building full shards.');
fs.mkdirSync(outputDir,{recursive:true});
const db=new DatabaseSync(dbFile,{readOnly:true});
const prefix=(value)=>Array.from(canonical(value).replaceAll(' ','' )).slice(0,2).join('');
const toItem=(r)=>({id:r.id,kind:r.kind,title:r.title,titleKo:r.title_ko||undefined,creator:r.creator||'',year:r.year||undefined,country:r.country||undefined,genres:JSON.parse(r.genres||'[]'),aliases:JSON.parse(r.aliases||'[]'),source:r.source,voteCount:r.rating_count??undefined,verified:Boolean(r.verified)});
const prefixes=db.prepare('SELECT DISTINCT substr(replace(alias_norm,\' \',\'\'),1,2) AS prefix FROM work_aliases WHERE length(alias_norm)>=2 ORDER BY prefix').all().map(x=>x.prefix).filter(Boolean);
const stmt=db.prepare("SELECT DISTINCT w.* FROM work_aliases a JOIN works w ON w.id=a.work_id WHERE substr(replace(a.alias_norm,' ',''),1,2)=? ORDER BY w.id");
const manifests={},index=[];
for(const key of prefixes){
 const rows=stmt.all(key);if(!rows.length)continue;
 const name=createHash('sha256').update(key).digest('hex').slice(0,16),files=[];
 for(let at=0;at<rows.length;at+=partSize){
  const part=rows.slice(at,at+partSize).map(toItem);
  const filename=`${name}-${at/partSize}.json`;
  fs.writeFileSync(path.join(outputDir,filename),JSON.stringify(part));
  files.push(filename);
 }
 manifests[key]={files,count:rows.length};index.push([key,rows.length]);
}
const total=db.prepare('SELECT COUNT(*) AS n FROM works').get().n;
const manifest={version:1,updated:new Date().toISOString(),total,shardSize:partSize,entryCount:index.reduce((n,x)=>n+x[1],0),prefixes:manifests,source:'imported',note:'Metadata without audience counts is not a validated rarity estimate.'};
fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest));
db.close();
console.log(JSON.stringify({total,prefixes:index.length,outputDir,generatedFiles:index.reduce((n,x)=>n+Math.ceil(x[1]/partSize),0)},null,2));
