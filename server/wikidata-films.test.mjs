import test from 'node:test';
import assert from 'node:assert/strict';
import {exactFilmMatches} from './wikidata-films.mjs';
test('film lookup matches English and Korean titles',()=>{
 const works=[{id:'wikidata:Q1',title:'Parasite',titleKo:'기생충',creator:'Bong Joon-ho',aliases:[]}];
 assert.equal(exactFilmMatches('Parasite',works).length,1);
 assert.equal(exactFilmMatches('기생충',works).length,1);
 assert.equal(exactFilmMatches('Unrelated',works).length,0);
});
