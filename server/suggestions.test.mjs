import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogStore} from './catalog-store.mjs';
test('indexed autocomplete resolves bilingual titles, creator names and typo corrections',()=>{
 const s=createCatalogStore(':memory:');
 s.put({kind:'film',title:'Chungking Express',titleKo:'중경삼림',creator:'Wong Kar-wai',year:1994,country:'Hong Kong',genres:['romance'],aliases:['Chung Hing sam lam'],source:'wikidata',sourceId:'Q1',ratingCount:15000,verified:true});
 s.put({kind:'film',title:'The Quiet Film',titleKo:'조용한 영화',creator:'Director',year:1995,country:'South Korea',genres:['romance'],aliases:[],source:'wikidata',sourceId:'Q2',ratingCount:20,verified:true});
 assert.equal(s.suggest('film','중경')[0].title,'Chungking Express');
 assert.equal(s.suggest('film','Chungking Expres')[0].titleKo,'중경삼림');
 assert.equal(s.suggest('film','Chung Hing sam')[0].id,'wikidata:Q1');
 assert.equal(s.lookup('film','중경삼림 — Wong Kar-wai')[0].title,'Chungking Express');
 assert.equal(s.lookup('film','Chungking Expres').length,0);
 assert.ok(s.score('f-90s',20).points>s.score('f-90s',15000).points);
 s.close();
});
