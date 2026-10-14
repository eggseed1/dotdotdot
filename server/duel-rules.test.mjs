import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRound,eloDelta} from './duel-rules.mjs';
test('duel scores distinct titles and keeps empty answers',()=>{
 const r=scoreRound(['a','b'],{a:{workId:'x',points:75}}, {a:100,b:30});
 assert.equal(r.scores.a,175);assert.equal(r.scores.b,30);
 assert.equal(r.results.a.points,75);assert.equal(r.results.b.points,0);
});
test('matching answers cancel both scores',()=>{
 const r=scoreRound(['a','b'],{a:{workId:'same',points:96},b:{workId:'same',points:44}}, {a:0,b:0});
 assert.equal(r.scores.a,0);assert.equal(r.scores.b,0);
 assert.equal(r.results.a.jinx,true);
});
test('guest Elo is symmetric',()=>{
 assert.equal(eloDelta(1000,1000,0,1),24);
 assert.equal(eloDelta(1000,1000,0,0),-24);
 assert.equal(eloDelta(1000,1000,10,.5),0);
});
