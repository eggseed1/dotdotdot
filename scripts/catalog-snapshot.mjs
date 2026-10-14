#!/usr/bin/env node
/** Ensure the published SQLite file is self-contained (no WAL sidecar required). */
import path from 'node:path';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const args=process.argv.slice(2),i=args.indexOf('--db');
const file=path.resolve(i<0?(process.env.CATALOG_DB||'data/catalog.sqlite'):args[i+1]);
if(!fs.existsSync(file))throw Error('Missing catalog at '+file);
const db=new DatabaseSync(file);
try{
 const integrity=db.prepare('PRAGMA quick_check').get();
 if(integrity.quick_check!=='ok')throw Error('SQLite integrity check failed');
 const n=Number(db.prepare('SELECT COUNT(*) AS n FROM works').get().n);
 if(n<1)throw Error('Refusing to publish empty catalog');
 db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
 db.exec('PRAGMA journal_mode=DELETE');
 console.log(JSON.stringify({snapshot:file,works:n,ready:true}));
}finally{db.close();}
