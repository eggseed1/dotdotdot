import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeIGDB} from './fetch-igdb.mjs';
test('IGDB imports alternate names, genre and developer without inventing country',()=>{
 const g=normalizeIGDB({id:7,name:'Test Game',slug:'test-game',genres:[{name:'Role-playing (RPG)'}],rating_count:10,alternative_names:[{name:'테스트 게임'}],involved_companies:[{developer:true,company:{name:'Studio'}}],first_release_date:946684800});
 assert.equal(g.creator,'Studio');assert.equal(g.year,2000);assert.equal(g.ratingCount,10);assert.deepEqual(g.aliases,['테스트 게임']);assert.equal(g.country,'');
});
