import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogStore} from '../server/catalog-store.mjs';
test('IMDb bulk import joins votes and indexes Korean titles',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'larper-imdb-'));
 try{
  const basics=path.join(dir,'basics.tsv'),ratings=path.join(dir,'ratings.tsv'),akas=path.join(dir,'akas.tsv'),db=path.join(dir,'catalog.sqlite');
  fs.writeFileSync(basics,'tconst\ttitleType\tprimaryTitle\toriginalTitle\tisAdult\tstartYear\tendYear\truntimeMinutes\tgenres\n'+
   'tt0000001\tmovie\tChungking Express\tChung Hing sam lam\t0\t1994\t\\N\t102\tDrama,Romance\n'+
   'tt0000002\tmovie\tAn Obscure Film\tAn Obscure Film\t0\t1996\t\\N\t90\tDrama\n'+
   'tt0000003\tshort\tA Short\tA Short\t0\t1996\t\\N\t10\tDrama\n');
  fs.writeFileSync(ratings,'tconst\taverageRating\tnumVotes\ntt0000001\t8.0\t10000\ntt0000002\t7.0\t15\n');
  fs.writeFileSync(akas,'titleId\tordering\ttitle\tregion\tlanguage\ttypes\tattributes\tisOriginalTitle\n'+
   'tt0000001\t1\t중경삼림\tKR\tko\t\\N\t\\N\t0\n');
  const run=spawnSync(process.execPath,['scripts/import-imdb-dump.mjs','--basics',basics,'--ratings',ratings,'--akas',akas,'--db',db,'--acknowledge-imdb-terms'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const store=createCatalogStore(db);
  assert.equal(store.stats().find(x=>x.source==='imdb').entries,2);
  assert.equal(store.lookup('film','중경삼림')[0].title,'Chungking Express');
  assert.equal(store.suggest('film','중경')[0].titleKo,'중경삼림');
  assert.equal(store.lookup('film','Chung Hing sam lam')[0].ratingCount,10000);
  assert.ok(store.score('f-90s',15).points>store.score('f-90s',10000).points);
  store.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
