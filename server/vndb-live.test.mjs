import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVN,exactVNDB,vnRarity} from './vndb-live.mjs';
test('Sakura no Uta visual novel is eligible for a 2010s game round',()=>{
 const game=normalizeVN({id:'v123',title:'Sakura no Uta',alttitle:'サクラノ詩',aliases:['Sakura no Uta: Haru no Yuki'],olang:'ja',released:'2015-10-23',votecount:900,developers:[{name:'Makura'}]});
 assert.equal(game.year,2015);
 assert.equal(game.kind,'games');
 assert.equal(game.country,'Japan');
 assert.equal(game.genres.includes('visual novel'),true);
 assert.equal(exactVNDB('Sakura no Uta',[game]).length,1);
 assert.equal(exactVNDB('サクラノ詩',[game]).length,1);
});
test('missing VNDB vote evidence gives neutral score',()=>{
 assert.equal(vnRarity(null).points,44);
 assert.ok(vnRarity(10).points>vnRarity(1000).points);
});
