import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMB,exactLiveMatches,votedGenres,provisionalRarity} from './musicbrainz-live.mjs';
test('MusicBrainz release group yields trustworthy catalog identity',()=>{
 const work=normalizeMB({id:'11111111-1111-1111-1111-111111111111',title:'An Obscure Album','artist-credit':[{artist:{name:'Niche Band'}}],'first-release-date':'1993-05-19'});
 assert.equal(work.title,'An Obscure Album');
 assert.equal(work.creator,'Niche Band');assert.equal(work.year,1993);
 assert.equal(work.ratingCount,null);
});
test('live album selections validate with creator suffix',()=>{
 const item=normalizeMB({id:'22222222-2222-2222-2222-222222222222',title:'An Obscure Album','artist-credit':[{artist:{name:'Niche Band'}}]});
 assert.equal(exactLiveMatches('An Obscure Album — Niche Band',[item]).length,1);
 assert.equal(exactLiveMatches('Another Album',[item]).length,0);
});

test('genre votes preserve specific genres and normalize common variants',()=>{
 const result=votedGenres([{name:'Shoegaze',count:8},{name:'Post Rock',count:3}],[{name:'jazz',count:1},{name:'shoegaze',count:7}]);
 assert.deepEqual(result.genres,['shoegaze','post-rock']);
 assert.equal(result.genreVotes.shoegaze,8);
});
test('unknown listening popularity never receives maximum rarity',()=>{
 assert.equal(provisionalRarity(null).points,44);
 assert.equal(provisionalRarity(null).unrated,true);
 assert.ok(provisionalRarity(2).points>provisionalRarity(200).points);
 assert.equal(provisionalRarity(2).unrated,false);
});
