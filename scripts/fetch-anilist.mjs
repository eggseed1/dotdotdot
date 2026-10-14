#!/usr/bin/env node
/** Paginated AniList GraphQL anime metadata importer. Observe AniList API terms and rate limits.
 * Creates JSONL for scripts/import-catalog.mjs; no HTML scraping or auth bypass.
 * Usage: node scripts/fetch-anilist.mjs --out data/anilist.jsonl --pages 100
 */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),opt=(name,def)=>{const i=args.indexOf(name);return i<0?def:args[i+1];};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const query=`query ($page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage){pageInfo{hasNextPage} media(type:ANIME,sort:ID){id title{romaji english native} synonyms startDate{year} format countryOfOrigin genres studios(isMain:true){nodes{name}} stats{scoreDistribution{amount}} siteUrl}}}`;
export function normalizeAniList(media){
 const title=media.title?.english||media.title?.romaji||media.title?.native;
 if(!media.id||!title)return null;
 const count=media.stats?.scoreDistribution?.reduce((sum,x)=>sum+Math.max(0,Number(x.amount)||0),0)||null;
 return {kind:'anime',sourceId:String(media.id),title,titleKo:/[가-힣]/.test(media.title?.native||'')?media.title.native:undefined,
  creator:media.studios?.nodes?.[0]?.name||'',year:media.startDate?.year||null,
  country:({JP:'Japan',KR:'South Korea',CN:'China',TW:'Taiwan'})[media.countryOfOrigin]||'',format:media.format||'',
  genres:media.genres||[],aliases:[media.title?.romaji,media.title?.english,media.title?.native,...(media.synonyms||[])].filter(Boolean),
  ratingCount:count,verified:true,sourceUrl:media.siteUrl||`https://anilist.co/anime/${media.id}`};
}
export async function fetchAniList({out,pages=100,startPage=1,request=fetch,wait=delay,progress=console.error}){
 if(!Number.isSafeInteger(startPage)||startPage<1||!Number.isSafeInteger(pages)||pages<1||pages>1000)throw Error('Invalid AniList page range');
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});const stream=fs.createWriteStream(out);
 let imported=0,done=0;
 try{for(let page=startPage;page<startPage+pages;page++){
   let json;
   for(let attempt=0;attempt<5;attempt++){
    const response=await request('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:{page,perPage:50}})});
    if(response.status===429||response.status>=500){await wait(Math.min(60000,Math.pow(2,attempt)*2500));continue;}
    if(!response.ok)throw Error(`AniList HTTP ${response.status}`);
    json=await response.json();if(json.errors?.length)throw Error(`AniList GraphQL error: ${json.errors[0].message}`);break;
   }
   if(!json)throw Error('AniList retry limit reached');
   const items=json.data?.Page?.media||[];
   for(const item of items){const record=normalizeAniList(item);if(record){stream.write(JSON.stringify(record)+'\n');imported++;}}
   done=page;progress(`AniList pages ${done}, anime ${imported}`);
   if(!json.data?.Page?.pageInfo?.hasNextPage||!items.length)break;
   await wait(1600);
  }}finally{await new Promise(resolve=>stream.end(resolve));}
 return {imported,pages:done,out,source:'anilist'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const out=opt('--out','data/anilist.jsonl'),pages=Number(opt('--pages','100')),startPage=Number(opt('--start-page','1'));
 try{console.log(JSON.stringify(await fetchAniList({out,pages,startPage})));}catch(e){console.error(e.message);process.exitCode=1;}
}
