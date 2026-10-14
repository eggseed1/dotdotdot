#!/usr/bin/env node
/** Deep, question-first AniList discovery. Each query corresponds to an authored question.
 * The API is a discovery source, not proof of every theme; the publisher rechecks prompt.match.
 */
import fs from 'node:fs';
import path from 'node:path';
const groups=[
 {id:'a-ova-90s',start:1990,end:1999,format:'OVA'},
 {id:'a-movie-2000s-fantasy',start:2000,end:2009,format:'MOVIE',genre:'Fantasy'},
 {id:'a-scifi-tv-1995-1999',start:1995,end:1999,format:'TV',genre:'Sci-Fi'},
 {id:'a-fantasy-movie-2000-2006',start:2000,end:2006,format:'MOVIE',genre:'Fantasy'},
 {id:'a-90s-sci-fi-tv',start:1990,end:1999,format:'TV',genre:'Sci-Fi'},
 {id:'a-2000s-movie-fantasy',start:2000,end:2009,format:'MOVIE',genre:'Fantasy'},
 {id:'a-2010s-mystery-tv',start:2010,end:2019,format:'TV',genre:'Mystery'},
 {id:'a-2000s-psych-tv',start:2000,end:2009,format:'TV',tag:'Psychological'},
 {id:'a-2000s-sci-fi',start:2000,end:2009,genre:'Sci-Fi'},
 {id:'a-90s-drama',start:1990,end:1999,genre:'Drama'}
];
const args=process.argv.slice(2),arg=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1];};
const pages=Math.max(1,Math.min(12,Number(arg('--pages','5')))),out=path.resolve(arg('--out','data/anilist-deep.jsonl'));
const query=`query($page:Int!,$start:FuzzyDateInt,$end:FuzzyDateInt,$format:MediaFormat,$genre:String,$tag:String){Page(page:$page,perPage:50){pageInfo{hasNextPage} media(type:ANIME,startDate_greater:$start,startDate_lesser:$end,format:$format,genre:$genre,tag:$tag,sort:ID){id title{english romaji native} synonyms startDate{year} format countryOfOrigin genres tags{name rank} studios(isMain:true){nodes{name}} popularity siteUrl isAdult}}}`;
const results=new Map();
for(const group of groups){
 let count=0;
 for(let page=1;page<=pages;page++){
  const variables={page,start:group.start*10000+101,end:group.end*10000+1231,format:group.format||undefined,genre:group.genre||undefined,tag:group.tag||undefined};
  let json;
  for(let attempt=0;attempt<5;attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{
    const response=await fetch('https://graphql.anilist.co',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})});
    if(response.status===429||response.status>=500){await new Promise(r=>setTimeout(r,1800*2**attempt));continue;}
    if(!response.ok)throw Error('AniList HTTP '+response.status);
    json=await response.json();if(json.errors?.length)throw Error(json.errors[0].message);break;
   }finally{clearTimeout(timer);}
  }
  if(!json)throw Error('AniList retries exhausted for '+group.id);
  const media=json.data?.Page?.media||[];
  for(const m of media){
   if(m.isAdult||!m.id||!(m.title?.english||m.title?.romaji||m.title?.native))continue;
   const genres=[...(m.genres||[]),...(m.tags||[]).filter(t=>t.rank>=65).map(t=>t.name)].map(g=>g.toLowerCase()==='sci-fi'?'science fiction':g.toLowerCase());
   const title=m.title.english||m.title.romaji||m.title.native;
   const record={kind:'anime',sourceId:String(m.id),title,creator:m.studios?.nodes?.[0]?.name||'',year:m.startDate?.year||null,country:m.countryOfOrigin==='JP'?'Japan':'',format:m.format||'',genres:[...new Set(genres)],aliases:[m.title.english,m.title.romaji,m.title.native,...(m.synonyms||[])].filter(Boolean),ratingCount:m.popularity||null,verified:true,sourceUrl:m.siteUrl||'https://anilist.co/anime/'+m.id};
   results.set(record.sourceId,record);count++;
  }
  if(!json.data?.Page?.pageInfo?.hasNextPage||media.length===0)break;
  await new Promise(r=>setTimeout(r,1300));
 }
 console.error(group.id+': '+count+' discovered candidates');
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,[...results.values()].map(w=>JSON.stringify(w)).join('\n')+'\n');
console.log(JSON.stringify({works:results.size,out,questions:groups.length}));
