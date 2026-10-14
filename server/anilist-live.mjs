const cache=new Map(),TTL=6*60*60*1000;
const GQL=`query($search:String,$perPage:Int){Page(perPage:$perPage){media(search:$search,type:ANIME){id title{romaji english native}startDate{year}seasonYear format genres tags{name rank}popularity favourites countryOfOrigin isAdult}}}`;
function normalize(m){
 const genres=[...(m.genres||[]).map(x=>x.toLowerCase()==='sci-fi'?'science fiction':x.toLowerCase()),...(m.tags||[]).filter(x=>x.rank>=55).map(x=>x.name.toLowerCase())];
 return {id:'anilist:'+m.id,kind:'anime',title:m.title?.english||m.title?.romaji||m.title?.native,
  titleKo:'',creator:'',format:m.format||'',year:m.startDate?.year||m.seasonYear||0,country:m.countryOfOrigin==='JP'?'Japan':m.countryOfOrigin==='KR'?'South Korea':'',
  genres:[...new Set(genres)],aliases:[m.title?.romaji,m.title?.english,m.title?.native].filter(Boolean),
  source:'anilist-live',verified:true,ratingCount:null,popularity:Number(m.popularity)||null,
  favourites:Number(m.favourites)||null,sourceUrl:'https://anilist.co/anime/'+m.id};
}
export async function searchAniList(q,{limit=12}={}){
 const query=String(q||'').trim().slice(0,90);if(query.length<2)return [];
 const key=query.toLowerCase(),entry=cache.get(key);if(entry&&entry.until>Date.now())return entry.items;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const res=await fetch('https://graphql.anilist.co',{method:'POST',signal:controller.signal,
   headers:{'content-type':'application/json','accept':'application/json'},
   body:JSON.stringify({query:GQL,variables:{search:query,perPage:Math.min(25,Math.max(10,limit))}})});
  if(!res.ok)throw Error('AniList API HTTP '+res.status);
  const data=await res.json();if(data.errors?.length)throw Error('AniList API error');
  const items=(data.data?.Page?.media||[]).filter(m=>!m.isAdult).map(normalize).filter(w=>w.title);
  if(cache.size>400)cache.delete(cache.keys().next().value);
  cache.set(key,{until:Date.now()+TTL,items});return items;
 }finally{clearTimeout(timer);}
}
export function exactAniList(raw,items){
 const norm=x=>String(x||'').toLowerCase().normalize('NFKC').replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
 const key=norm(raw);
 return items.filter(w=>[w.title,...w.aliases].some(v=>norm(v)===key));
}
export function aniListScore(popularity){
 if(!Number.isFinite(popularity)||popularity<=0)return {points:44,tier:5,unrated:true};
 const p=Math.max(10,Math.min(90,Math.round(92-12*Math.log10(popularity))));
 return {points:p,tier:p>=76?8:p>=65?7:p>=55?6:p>=45?5:p>=35?4:3,unrated:false};
}
