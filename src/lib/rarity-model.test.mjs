import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rarityFromCounts,rarityFromRank,RARITY_TAGS,SCORE_TIERS} from './rarity-model.mjs';
test('rarer works score higher and all eight depth tags exist',()=>{
 const counts=[100000,50000,10000,1000,200,20,2,1];
 const scores=counts.map(n=>rarityFromCounts(n,counts));
 assert.equal(RARITY_TAGS.length,8);
 assert.equal(SCORE_TIERS.length,8);
 assert.ok(scores[0].points<scores.at(-1).points);
 assert.equal(scores[0].points,10);
});
test('unrated metadata does not earn maximum points',()=>{
 assert.equal(rarityFromRank(0,100,99).points,0);
 assert.equal(rarityFromRank(NaN,100,99).tier,-1);
});
