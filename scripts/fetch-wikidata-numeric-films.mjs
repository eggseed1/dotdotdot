#!/usr/bin/env node
/** Expand numeric-title films from official Wikidata entity search without scraping pages.
 * Uses rotating terms, validates instance-of film, preserves original source IDs.
 * Search is discovery only; there is no claim this exhausts Wikidata.
 */
import fs from 'node:fs';
import path from 'node:path';
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1];};
const start=Number(arg('--start','0')),terms=Number(arg('--terms','15'));
if(!Number.isInteger(start)||start<0||!Number.isInteger(terms)||terms<1||terms>50)throw Error('Invalid term window');
const out=path.resolve(arg('--out','data/numeric-films.jsonl'));
const phrases=['1','2','3','4','5','6','7','8','9','10','11','12','13','20','21','24','28','30','36','40','50','60','70','80','90','99','100','101','200','300','400','500','1000','1917','1941','1968','1984','1999','2001','2012','2046','964','8½','2LDK','7:35','88:88'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(params){
 const url=new URL('https://www.wikidata.org/w/api.php');
 for(const [k,v] of Object.entries({action:'query',format:'json',...params}))url.searchParams.set(k,String(v));
 let error;
 for(let attempt=0;attempt<3;attempt++){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),20000);
  try{
   const res=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'dotdotdot-quiz/0.7 (https://github.com/eggseed1/dotdotdot)','Accept':'application/json'}});
   if(res.status===429||res.status>=500){await pause((attempt+1)*3500);continue;}
   if(!res.ok)throw Error('Wikidata HTTP '+res.status);return await res.json();
  }catch(e){error=e;if(attempt<2)await pause((attempt+1)*3000);}
  finally{clearTimeout(timer);}
 }
 throw error||Error('Wikidata unavailable');
}
const all=new Map();
for(let n=start;n<start+terms;n++){
 const term=phrases[n%phrases.length];
 try{
  const search=await api({action:'wbsearchentities',search:term,language:'en',limit:'50',type:'item'});
  const ids=(search.search||[]).map(e=>e.id).filter(id=>/^Q\d+$/.test(id));
  if(ids.length){
   const result=await api({action:'wbgetentities',ids:ids.join('|'),props:'claims|labels|aliases',languages:'en|ko'});
   for(const [id,e] of Object.entries(result.entities||{})){
    const instances=(e.claims?.P31||[]).map(c=>c.mainsnak?.datavalue?.value?.id);
    if(!instances.includes('Q11424'))continue;
    const title=e.labels?.en?.value||e.labels?.ko?.value;
    if(!title||!/[0-9０-９]/u.test(title))continue;
    const year=Number(/^\+?(\d{4})/.exec(e.claims?.P577?.[0]?.mainsnak?.datavalue?.value?.time||'')?.[1])||null;
    const aliases=[...(e.aliases?.en||[]),...(e.aliases?.ko||[])].map(a=>a.value);
    all.set(id,{kind:'film',sourceId:id,title,titleKo:e.labels?.ko?.value||'',year,creator:'',country:'',genres:[],aliases,verified:true,ratingCount:null,sourceUrl:'https://www.wikidata.org/wiki/'+id});
   }
  }
 }catch(err){console.error('Skipped term '+term+': '+err.message);}
 console.error('Wikidata numeric search '+term+': '+all.size+' unique films');
 await pause(1200);
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,[...all.values()].map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(JSON.stringify({out,terms,uniqueFilms:all.size}));
