import test from 'node:test';
import assert from 'node:assert/strict';
import {rarityRank,RARITY_RANKS} from './rarity-ranks.mjs';
test('rarity ranks are ordered and cover 10-100 points',()=>{
 assert.equal(RARITY_RANKS.length,11);
 for(let p=10;p<=100;p++){const r=rarityRank(p);assert.ok(r.en);assert.ok(['I','II','III'].includes(r.division));}
 assert.equal(rarityRank(100).en,'ABYSS SOVEREIGN');
 assert.equal(rarityRank(10).en,'SURFACE DWELLER');
});
