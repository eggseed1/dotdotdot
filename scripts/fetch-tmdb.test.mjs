import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTMDB} from './fetch-tmdb.mjs';
test('TMDB maps genres, Korean title and real vote counts, but never invents country',()=>{
 const result=normalizeTMDB({id:42,title:'Test Film',original_title:'Film Original',release_date:'1997-10-01',genre_ids:[18],vote_count:65},{18:'Drama'},{title:'한국 영화'});
 assert.equal(result.titleKo,'한국 영화');assert.equal(result.year,1997);assert.deepEqual(result.genres,['Drama']);assert.equal(result.ratingCount,65);assert.equal(result.country,'');
});
