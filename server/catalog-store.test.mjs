import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogStore} from './catalog-store.mjs';
import {rarityFromCounts} from '../src/lib/rarity-model.mjs';
test('authorized normalized imports can validate genre, dates, country, and popularity',()=>{
 const s=createCatalogStore(':memory:');
 s.put({kind:'music',title:'Loveless',creator:'MBV',year:1991,country:'Ireland',genres:['shoegaze'],source:'musicbrainz',sourceId:'mbv',ratingCount:30000,verified:true});
 s.put({kind:'music',title:'Rare Vinyl',creator:'Example',year:1992,country:'Japan',genres:['shoegaze'],source:'musicbrainz',sourceId:'rare',ratingCount:60,verified:true});
 s.put({kind:'music',title:'Unverified',creator:'Example',year:1991,country:'Japan',genres:['shoegaze'],source:'musicbrainz',sourceId:'unverified',ratingCount:0,verified:false});
 assert.equal(s.eligible('m-shoegaze').length,2);
 assert.equal(s.eligible('m-japan').length,1);
 assert.equal(s.eligible('m-90s').length,2);
 assert.equal(s.lookup('music','Rare Vinyl').length,1);
 assert.equal(s.stats()[0].entries,3);
 assert.equal(rarityFromCounts(60,[60,30000],{minimumEvidence:1}).points,100);
 assert.equal(rarityFromCounts(0,[0,30000],{minimumEvidence:1}).points,0);
 s.close();
});
