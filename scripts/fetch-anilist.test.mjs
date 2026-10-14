import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {normalizeAniList,fetchAniList} from './fetch-anilist.mjs';
test('AniList title aliases, genres, origin, vote counts',()=>{
 const r=normalizeAniList({id:7,title:{romaji:'Mushi-Shi',english:'Mushishi',native:'蟲師'},synonyms:['Mushi Shi'],startDate:{year:2005},countryOfOrigin:'JP',genres:['Mystery'],stats:{scoreDistribution:[{amount:4},{amount:10}]},studios:{nodes:[{name:'Artland'}]}});
 assert.equal(r.title,'Mushishi');assert.equal(r.country,'Japan');assert.equal(r.ratingCount,14);assert.ok(r.aliases.includes('蟲師'));
});
test('AniList importer paginates and stops on last page',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'larper-anilist-'));try{
 const out=path.join(dir,'anime.jsonl');let calls=0;
 const request=async()=>{calls++;return {ok:true,json:async()=>({data:{Page:{media:[{id:calls,title:{english:'Test '+calls}}],pageInfo:{hasNextPage:calls<2}}}})}};
 const result=await fetchAniList({out,pages:5,request,wait:async()=>{},progress:()=>{}});
 assert.equal(result.imported,2);assert.equal(calls,2);assert.equal(fs.readFileSync(out,'utf8').trim().split('\n').length,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('AniList resumes from requested page without fetching old pages',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'larper-anilist-resume-'));
 try{
  const out=path.join(dir,'resume.jsonl'),seen=[];
  const request=async (_url,opts)=>{
   const page=JSON.parse(opts.body).variables.page;seen.push(page);
   return {ok:true,json:async()=>({data:{Page:{media:[{id:page,title:{english:'Entry '+page}}],pageInfo:{hasNextPage:true}}}})};
  };
  const result=await fetchAniList({out,pages:3,startPage:36,request,wait:async()=>{},progress:()=>{}});
  assert.deepEqual(seen,[36,37,38]);assert.equal(result.imported,3);assert.equal(result.pages,38);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
