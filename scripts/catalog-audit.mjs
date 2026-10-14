#!/usr/bin/env node
import path from 'node:path';
import {createCatalogStore} from '../server/catalog-store.mjs';
const argv=process.argv.slice(2),pos=argv.indexOf('--db');
const dbPath=path.resolve(pos>=0?argv[pos+1]:(process.env.CATALOG_DB||'data/catalog.sqlite'));
const store=createCatalogStore(dbPath);
try{
 const summaries=store.stats();
 const total=summaries.reduce((n,r)=>n+r.entries,0);
 const distribution=store.db.prepare("SELECT kind,COUNT(*) total,SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) verified,SUM(CASE WHEN length(genres)>2 THEN 1 ELSE 0 END) tagged,SUM(CASE WHEN format IS NOT NULL AND format!='' THEN 1 ELSE 0 END) formatted FROM works GROUP BY kind ORDER BY kind").all();
 console.log(JSON.stringify({db:dbPath,total,distribution,sources:summaries,warning:total===0?'Database empty: import a dataset on your persistent volume.':null},null,2));
}finally{store.close();}
