import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceRarity} from './evidence-rarity.mjs';
test('missing evidence is neutral and never maximally rare',()=>{
 const x=evidenceRarity(null);assert.equal(x.points,44);assert.equal(x.unrated,true);
});
test('greater audience always reduces rarity and points stay bounded',()=>{
 for(const config of [{typical:18000,ceiling:1200000},{typical:600,ceiling:15000}]){
  const a=evidenceRarity(3,config),b=evidenceRarity(300,config),c=evidenceRarity(30000,config);
  assert.ok(a.points>=b.points&&b.points>=c.points,`${a.points}/${b.points}/${c.points}`);
  assert.ok([a,b,c].every(v=>v.points>=10&&v.points<=90&&v.tier>=0&&v.tier<=7));
 }
});
