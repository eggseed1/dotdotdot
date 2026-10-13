/** Unicode-aware multilingual search. Phonetic matching suggests; never silently verifies. */
export function canonical(input=''){
 return String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
 .replace(/[’‘]/g,"'").replace(/&/g,'and').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
const initials=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const vowels=['a','e','ya','ye','o','e','yo','ye','o','wa','we','we','yo','u','wo','we','wi','yu','','i','i'];
const finals=['','g','k','ks','n','nj','nh','d','l','lg','lm','lb','ls','lt','lp','lh','m','b','bs','s','ss','ng','j','ch','k','t','p','h'];
/** Approximate Korean loanword sound key; intentionally NOT an authoritative translation. */
export function hangulSound(value=''){
 let result='';
 for(const char of String(value).normalize('NFC')){
  const code=char.charCodeAt(0)-0xAC00;
  if(code>=0&&code<11172){
   const onset=Math.floor(code/588),medial=Math.floor((code%588)/28),coda=code%28;
   result+=initials[onset]+vowels[medial]+finals[coda];
  }else result+=char;
 }
 return soundKey(result);
}
export function soundKey(value=''){
 return canonical(value).replace(/ph/g,'p').replace(/th/g,'t').replace(/sh/g,'s').replace(/ch/g,'j')
 .replace(/v/g,'b').replace(/f/g,'p').replace(/w/g,'u').replace(/y/g,'i').replace(/r/g,'l')
 .replace(/eo/g,'o').replace(/eu/g,'').replace(/ou/g,'u').replace(/ee/g,'i')
 .replace(/(.)\1+/g,'$1').replace(/[^a-z0-9]/g,'');
}
export function phoneticKeys(value=''){
 const key=canonical(value);
 const result=new Set([key]);
 if(/[가-힣]/.test(value))result.add(hangulSound(value));
 else if(/[a-z]/i.test(value))result.add(soundKey(value));
 return [...result].filter(Boolean);
}
export function namesFor(work){
 const titles=[work.title,work.titleKo,...(work.aliases||[])].filter(Boolean);
 const creators=[work.creator,work.creatorKo].filter(Boolean);
 return [...new Set([...titles,...titles.flatMap(t=>creators.flatMap(c=>[`${t} ${c}`,`${c} ${t}`]))].map(canonical).filter(Boolean))];
}
export function indexNamesFor(work){
 const names=namesFor(work);
 return [...new Set(names.flatMap(name=>phoneticKeys(name)))];
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
 if(query.length>=3){const max=query.length<=4?1:query.length<=8?2:Math.max(3,Math.floor(query.length*.23));
  if(Math.abs(name.length-query.length)<=max){const d=editDistance(query,name,max);if(d<=max)return 48+d*6;}
 }
 return Infinity;
}
export function suggestWorks(raw,works,limit=7){
 const keys=phoneticKeys(raw);if(canonical(raw).length<2)return [];
 return works.map(work=>({work,rank:Math.min(...keys.flatMap(q=>indexNamesFor(work).map(n=>nameRank(q,n))))}))
 .filter(x=>Number.isFinite(x.rank)).sort((a,b)=>a.rank-b.rank||a.work.title.localeCompare(b.work.title))
 .slice(0,limit).map(x=>x.work);
}
export function exactWorks(raw,works){
 const query=canonical(raw);if(query.length<2)return [];
 return works.filter(w=>namesFor(w).includes(query));
}
