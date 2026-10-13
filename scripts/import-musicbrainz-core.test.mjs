import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { importMusicBrainz,decodeCopy } from './import-musicbrainz-core.mjs';
import { createCatalogStore } from '../server/catalog-store.mjs';

test('MusicBrainz COPY escaping preserves literal names',()=>{
  assert.equal(decodeCopy('A\\tB'),'A\tB');assert.equal(decodeCopy('\\N'),null);
});
test('official core snapshot joins artist country, release year and Korean aliases',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'larper-mb-'));
 try{
  const dump=path.join(root,'mbdump');fs.mkdirSync(dump);
  const tables={
    area:'1\tarea-guid\tSouth Korea\t1',
    iso_3166_1:'1\tKR',
    artist:'1\tartist-guid\tTest Artist\tTest Artist\t\\N\t\\N\t\\N\t\\N\t\\N\t\\N\t1\t1',
    artist_credit:'1\tTest Artist\t1',
    artist_credit_name:'1\t0\t1\tTest Artist\t',
    release_group_primary_type:'1\tAlbum',
    release_group:'1\talbum-guid\tOriginal Title\t1\t1',
    release:'1\trelease-guid\tOriginal Title\t1\t1',
    release_country:'1\t1\t1996\t6\t4',
    release_unknown_country:'',
    release_group_alias:'1\t1\t한국어 제목\tko',
    artist_alias:'1\t1\t테스트 아티스트\tko',
    genre:'1\tgenre-guid\tShoegaze'
  };
  for(const [name,contents] of Object.entries(tables))fs.writeFileSync(path.join(dump,name),contents+'\n');
  const dbPath=path.join(root,'catalog.sqlite');
  const out=await importMusicBrainz({dumpDir:dump,dbPath,progress:()=>{}});
  assert.equal(out.albums,1);assert.equal(out.artists,1);assert.equal(out.scoringReady,false);
  const store=createCatalogStore(dbPath);
  const works=store.lookup('music','한국어 제목');assert.equal(works.length,1);
  assert.equal(works[0].year,1996);assert.equal(works[0].country,'South Korea');
  assert.equal(works[0].ratingCount,null);
  store.close();
  const db=new DatabaseSync(dbPath,{readOnly:true});
  assert.deepEqual(JSON.parse(db.prepare('SELECT aliases FROM music_artists WHERE mbid=?').get('artist-guid').aliases),['테스트 아티스트']);
  db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
