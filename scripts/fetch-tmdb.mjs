#!/usr/bin/env node
/** Authorized TMDB movie catalog discovery, partitioned by original release year.
 * Requires TMDB_READ_TOKEN and compliance with TMDB API attribution/usage terms.
 * Writes normalized JSONL. Country is intentionally blank until independently verified.
 */
import fs from 'node:fs';import path from 'node:path';
const argv=process.argv.slice(2),opt=(k,d)=>{const i=argv.indexOf(k);return i<0?d:argv[i+1];};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export function normalizeTMDB(m,genres,korean){
 if(!m.id||!m.title)return null;
 return {kind:'film',sourceId:String(m.id),title:m.title,titleKo:korean?.title&&korean.title!==m.title?korean.title:undefined,
  creator:'',year:Number((m.release_date||'').slice(0,4))||null,country:'',
  genres:(m.genre_ids||[]).map(id=>genres[id]).filter(Boolean),aliases:[m.original_title,korean?.title].filter(Boolean),
  ratingCount:Number.isInteger(m.vote_count)&&m.vote_count>0?m.vote_count:null,
  verified:true,sourceUrl:`https://www.themoviedb.org/movie/${m.id}`};
}
export async function fetchTMDB({token,out,from=1900,to=new Date().getUTCFullYear(),request=fetch,wait=pause,progress=console.error,maxPagesPerYear=500}){
 if(!token)throw Error('TMDB_READ_TOKEN is required.');
 const get=async(path,params={})=>{
  const url=new URL('https://api.themoviedb.org/3'+path);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  for(let attempt=0;attempt<5;attempt++){
   const response=await request(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
   if(response.status===429||response.status>=500){await wait(Math.min(60000,1500*2**attempt));continue;}
   if(!response.ok)throw Error(`TMDB ${response.status}: ${path}`);
   return response.json();
  }throw Error('TMDB retry limit reached');
 };
 const genresResponse=await get('/genre/movie/list',{language:'en-US'});
 const genres=Object.fromEntries((genresResponse.genres||[]).map(g=>[g.id,g.name]));
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});const output=fs.createWriteStream(out);
 let written=0,years=0;
 try{for(let year=from;year<=to;year++){
   const first=await get('/discover/movie',{primary_release_year:year,sort_by:'primary_release_date.asc',page:1,include_adult:false,language:'en-US'});
   const count=Math.min(first.total_pages||0,maxPagesPerYear,500);
   if((first.total_pages||0)>500)progress(`WARNING ${year}: >500 pages; this year needs finer date partitioning for full coverage.`);
   for(let page=1;page<=count;page++){
    const en=page===1?first:await get('/discover/movie',{primary_release_year:year,sort_by:'primary_release_date.asc',page,include_adult:false,language:'en-US'});
    const ko=await get('/discover/movie',{primary_release_year:year,sort_by:'primary_release_date.asc',page,include_adult:false,language:'ko-KR'});
    const byId=new Map((ko.results||[]).map(m=>[m.id,m]));
    for(const m of en.results||[]){const item=normalizeTMDB(m,genres,byId.get(m.id));if(item){output.write(JSON.stringify(item)+'\n');written++;}}
    await wait(280);
   }years++;progress(`TMDB ${year}: ${written} total films`);
  }}finally{await new Promise(r=>output.end(r));}
 return {written,years,out,source:'tmdb',incompleteYearsRequirePartition:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){
 try{console.log(JSON.stringify(await fetchTMDB({token:process.env.TMDB_READ_TOKEN,out:opt('--out','data/tmdb.jsonl'),from:Number(opt('--from','1900')),to:Number(opt('--to',String(new Date().getUTCFullYear())))})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
