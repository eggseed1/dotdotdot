#!/usr/bin/env node
/** Authorized IGDB game metadata ingestion, ID-cursor pagination.
 * Requires IGDB_CLIENT_ID + IGDB_ACCESS_TOKEN from Twitch developer auth.
 * Use within IGDB API terms; this is not a Backloggd scraper.
 */
import fs from 'node:fs';import path from 'node:path';
const argv=process.argv.slice(2),opt=(k,d)=>{const i=argv.indexOf(k);return i<0?d:argv[i+1];};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export function normalizeIGDB(game){
 if(!game.id||!game.name)return null;
 return {kind:'games',sourceId:String(game.id),title:game.name,creator:game.involved_companies?.find(x=>x.developer)?.company?.name||'',
  year:game.first_release_date?new Date(game.first_release_date*1000).getUTCFullYear():null,country:'',
  genres:(game.genres||[]).map(g=>g.name).filter(Boolean),aliases:(game.alternative_names||[]).map(x=>x.name).filter(Boolean),
  ratingCount:Number.isInteger(game.rating_count)&&game.rating_count>0?game.rating_count:null,
  verified:true,sourceUrl:`https://www.igdb.com/games/${game.slug||game.id}`};
}
export async function fetchIGDB({clientId,token,out,request=fetch,wait=pause,maxPages=10000,progress=console.error}){
 if(!clientId||!token)throw Error('IGDB_CLIENT_ID and IGDB_ACCESS_TOKEN are required.');
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});const output=fs.createWriteStream(out);
 let lastId=0,written=0,pages=0;
 try{while(pages<maxPages){
   const body=`fields id,name,slug,first_release_date,genres.name,alternative_names.name,involved_companies.developer,involved_companies.company.name,rating_count; where id > ${lastId}; sort id asc; limit 500;`;
   let response;
   for(let attempt=0;attempt<5;attempt++){
    response=await request('https://api.igdb.com/v4/games',{method:'POST',headers:{'Client-ID':clientId,Authorization:`Bearer ${token}`,'Content-Type':'text/plain'},body});
    if(response.status===429||response.status>=500){await wait(Math.min(60000,2000*2**attempt));continue;}break;
   }
   if(!response?.ok)throw Error(`IGDB HTTP ${response?.status||'network error'}`);
   const games=await response.json();if(!Array.isArray(games)||!games.length)break;
   for(const game of games){lastId=Math.max(lastId,Number(game.id)||0);const item=normalizeIGDB(game);if(item){output.write(JSON.stringify(item)+'\n');written++;}}
   pages++;progress(`IGDB page ${pages}: ${written} games`);if(games.length<500)break;await wait(350);
  }}finally{await new Promise(r=>output.end(r));}
 return {source:'igdb',written,pages,lastId,out};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 try{console.log(JSON.stringify(await fetchIGDB({clientId:process.env.IGDB_CLIENT_ID,token:process.env.IGDB_ACCESS_TOKEN,out:opt('--out','data/igdb.jsonl'),maxPages:Number(opt('--pages','10000'))})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
