#!/usr/bin/env node
/** Restore the public, versioned catalog snapshot before the server opens SQLite.
 * Never replace a nonempty local DB; the live service may have accumulated records.
 * Downloads are capped and the SQLite header is checked before atomic rename.
 */
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const dbFile=path.resolve(process.env.CATALOG_DB||path.join(process.env.DATA_DIR||'data','catalog.sqlite'));
const url=process.env.CATALOG_SNAPSHOT_URL||'https://github.com/eggseed1/dotdotdot/releases/download/catalog-latest/catalog.sqlite';
const temp=dbFile+'.download-'+process.pid;
const MAX_BYTES=250*1024*1024;
const currentCount=()=>{
 if(!fs.existsSync(dbFile))return 0;
 try{const db=new DatabaseSync(dbFile,{readOnly:true});const n=Number(db.prepare('SELECT COUNT(*) AS n FROM works').get()?.n||0);db.close();return n;}catch{return -1;}
};
if(currentCount()>0){console.log('Using existing local catalog snapshot');process.exit(0);}
if(currentCount()<0){console.error('Existing SQLite file invalid or unreadable; refusing overwrite');process.exit(0);}
try{
 fs.mkdirSync(path.dirname(dbFile),{recursive:true});
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),25000);
 let response;
 try{response=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'larper101-catalog-bootstrap'}});}
 finally{clearTimeout(timer);}
 if(!response.ok||!response.body)throw Error('HTTP '+response.status);
 const size=Number(response.headers.get('content-length')||0);
 if(size>MAX_BYTES)throw Error('Snapshot exceeds size limit');
 const file=fs.openSync(temp,'wx');
 let total=0;
 try{for await(const chunk of response.body){
   total+=chunk.length;
   if(total>MAX_BYTES)throw Error('Snapshot exceeds size limit');
   fs.writeSync(file,chunk);
 }}finally{fs.closeSync(file);}
 if(total<4096)throw Error('Snapshot suspiciously small');
 const fd=fs.openSync(temp,'r');const magic=Buffer.alloc(16);fs.readSync(fd,magic,0,16,0);fs.closeSync(fd);
 if(magic.toString('ascii')!=='SQLite format 3\u0000')throw Error('Snapshot does not have SQLite header');
 const check=new DatabaseSync(temp,{readOnly:true});
 try{const ok=check.prepare('PRAGMA quick_check').get();const n=Number(check.prepare('SELECT COUNT(*) AS n FROM works').get().n);if(ok.quick_check!=='ok'||n<1)throw Error('Snapshot integrity/row-count check failed');}
 finally{check.close();}
 if(currentCount()===0){fs.renameSync(temp,dbFile);console.log('Restored public catalog to '+dbFile);}
}catch(error){console.error('Snapshot unavailable, keeping built-in fallback: '+error.message);}
finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
