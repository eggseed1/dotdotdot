import {test} from 'node:test';
import assert from 'node:assert/strict';
import {suggestWorks,exactWorks} from './title-match.mjs';
const works=[
 {id:'f01',title:'Chungking Express',titleKo:'중경삼림',creator:'Wong Kar-wai',aliases:['Chung Hing sam lam']},
 {id:'m01',title:'Loveless',creator:'My Bloody Valentine'},
 {id:'a01',title:'Neon Genesis Evangelion',titleKo:'신세기 에반게리온',aliases:['Evangelion','에반게리온']}
];
test('Korean and English titles point to the same work',()=>{
 assert.equal(suggestWorks('중경',works)[0].id,'f01');
 assert.equal(suggestWorks('Chungking',works)[0].id,'f01');
 assert.equal(suggestWorks('에반게리온',works)[0].id,'a01');
 assert.equal(exactWorks('중경삼림',works)[0].id,'f01');
 assert.equal(exactWorks('My Bloody Valentine - Loveless',works)[0].id,'m01');
});
test('typos suggest but do not auto-validate',()=>{
 assert.equal(suggestWorks('Chungking Expres',works)[0].id,'f01');
 assert.equal(exactWorks('Chungking Expres',works).length,0);
});
