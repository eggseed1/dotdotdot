/** Unicode-aware multilingual title search. Fuzzy results are suggestions, not automatically accepted answers. */
export function canonical(input='') {
 return String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
 .replace(/[’‘]/g,"'").replace(/&/g,'and').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
export function namesFor(work){
 const titles=[work.title,work.titleKo,...(work.aliases||[])].filter(Boolean);
 const creators=[work.creator,work.creatorKo].filter(Boolean);
 return [...new Set([...titles,...titles.flatMap(t=>creators.flatMap(c=>[`${t} ${c}`,`${c} ${t}`]))].map(canonical).filter(Boolean))];
}
export function editDistance(a,b,max=3){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];let min=i;
  for(let j=1;j<=b.length;j++){const x=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));row.push(x);min=Math.min(min,x);}
  if(min>max)return max+1;prev=row;
 }
 return prev[b.length];
}
export function nameRank(query,name){
 if(name===query)return 0;
 if(name.startsWith(query))return 10+(name.length-query.length)*0.06;
 if(name.split(' ').some(w=>w.startsWith(query)))return 25;
 if(name.includes(query))return 38;
 if(query.length>=3){const max=query.length<=4?1:query.length<=8?2:3;
  if(Math.abs(name.length-query.length)<=max){const d=editDistance(query,name,max);if(d<=max)return 48+d*6;}
 }
 return Infinity;
}
export function suggestWorks(raw,works,limit=7){
 const query=canonical(raw);if(query.length<2)return [];
 return works.map(work=>({work,rank:Math.min(...namesFor(work).map(n=>nameRank(query,n)))}))
 .filter(x=>Number.isFinite(x.rank)).sort((a,b)=>a.rank-b.rank||a.work.title.localeCompare(b.work.title))
 .slice(0,limit).map(x=>x.work);
}
export function exactWorks(raw,works){
 const query=canonical(raw);if(query.length<2)return [];
 return works.filter(w=>namesFor(w).includes(query));
}
