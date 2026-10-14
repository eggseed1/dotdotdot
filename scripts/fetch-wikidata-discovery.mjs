#!/usr/bin/env node
/** Conservative free Wikidata entity-search discovery for movies and video games.
 * Searches thematic seed phrases; validates instance-of and never fabricates genre votes.
 */
import fs from 'node:fs';
import path from 'node:path';
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const kind=opt('--kind','film'),offset=Number(opt('--offset','0')),out=path.resolve(opt('--out','data/wikidata-discovery.jsonl'));
if(!['film','games'].includes(kind)||!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid kind/offset');
const seeds=kind==='film'?['experimental film','avant-garde film','independent film','horror film','science fiction film','Japanese film','Korean film','silent film','animation film','surrealist film','documentary film','art film']:['indie game','role-playing video game','psychological horror game','Japanese video game','visual novel','adventure video game','experimental video game','surreal video game'];
const query=seeds[offset%seeds.length];
const get=async params=>{
 const u=new URL('https://www.wikidata.org/w/api.php');
 for(const [k,v] of Object.entries({action:'query',format:'json',...params}))u.searchParams.set(k,String(v));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch(u,{signal:controller.signal,headers:{'User-Agent':'larper101/0.5 (https://github.com/eggseed1/dotdotdot)'}});
 if(!response.ok)throw Error('Wikidata HTTP '+response.status);return response.json();}finally{clearTimeout(timer);}
};
const hits=await get({action:'wbsearchentities',language:'en',search:query,limit:50});
const ids=(hits.search||[]).map(x=>x.id).filter(x=>/^Q\d+$/.test(x));
const entities=ids.length?await get({action:'wbgetentities',ids:ids.join('|'),props:'claims|labels|aliases',languages:'en|ko'}):{entities:{}};
const claimIds=(e,p)=>(e.claims?.[p]||[]).map(x=>x.mainsnak?.datavalue?.value?.id).filter(Boolean);
const year=e=>{const t=e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time||'';return Number(/^\+?(\d{4})/.exec(t)?.[1])||null;};
const works=[];
for(const id of ids){
 const e=entities.entities?.[id];if(!e)continue;
 const instance=claimIds(e,'P31');
 if(kind==='film'&&!instance.some(x=>['Q11424','Q9325869','Q202866','Q24856'].includes(x)))continue;
 if(kind==='games'&&!instance.includes('Q7889'))continue;
 const title=e.labels?.en?.value||e.labels?.ko?.value;if(!title)continue;
 const countryIds=claimIds(e,'P495');
 const country=countryIds.includes('Q17')?'Japan':countryIds.includes('Q884')?'South Korea':'';
 const genreIds=claimIds(e,'P136'),genres=[];
 const known={'Q471839':'science fiction','Q200092':'horror','Q130232':'drama','Q157443':'romance','Q157394':'fantasy'};
 for(const g of genreIds)if(known[g])genres.push(known[g]);
 const aliases=[...(e.aliases?.en||[]),...(e.aliases?.ko||[])].map(x=>x.value).slice(0,25);
 works.push({kind,sourceId:id,title,titleKo:e.labels?.ko?.value||'',creator:'',year:year(e),country,genres,aliases,ratingCount:null,verified:true,sourceUrl:'https://www.wikidata.org/wiki/'+id});
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,works.map(w=>JSON.stringify(w)).join('\n')+'\n');
console.log(JSON.stringify({kind,seed:query,works:works.length,out}));
