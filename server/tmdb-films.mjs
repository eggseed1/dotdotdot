const token=process.env.TMDB_READ_ACCESS_TOKEN||'';
const cache=new Map(),TTL=21600000;
export const tmdbEnabled=Boolean(token);
async function tmdb(path,params={}){
 const url=new URL('https://api.themoviedb.org/3'+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
 try{const res=await fetch(url,{signal:controller.signal,headers:{accept:'application/json',Authorization:'Bearer '+token}});
 if(!res.ok)throw Error('TMDB HTTP '+res.status);return res.json();}finally{clearTimeout(timer);}
}
export function normalizeTmdbMovie(movie){
 if(!movie?.id||!movie?.title)return null;
 const year=Number(String(movie.release_date||'').slice(0,4))||0;
 return {id:'tmdb:'+movie.id,kind:'film',source:'tmdb-live',title:movie.title,
 titleKo:'',creator:'',year,country:'',genres:[],genreIds:movie.genre_ids||[],
 aliases:[movie.original_title].filter(Boolean),ratingCount:Number(movie.vote_count)||null,
 verified:true,sourceUrl:'https://www.themoviedb.org/movie/'+movie.id};
}
export async function searchTmdbMovies(q,{limit=30}={}){
 if(!token)return [];
 const raw=String(q||'').trim().slice(0,95);if(raw.length<2)return [];
 const key=raw.toLowerCase(),hit=cache.get(key);if(hit?.expires>Date.now())return hit.items;
 const data=await tmdb('/search/movie',{query:raw,include_adult:false,page:1});
 const items=(data.results||[]).map(normalizeTmdbMovie).filter(Boolean).slice(0,limit);
 if(cache.size>500)cache.delete(cache.keys().next().value);
 cache.set(key,{expires:Date.now()+TTL,items});return items;
}
export async function enrichTmdbMovie(work){
 if(work.source!=='tmdb-live')return work;
 const detail=await tmdb('/movie/'+work.id.slice(5));
 const country=detail.production_countries?.[0]?.name||'';
 const genres=(detail.genres||[]).map(x=>x.name.toLowerCase());
 return {...work,genres,country,ratingCount:Number(detail.vote_count)||null,
 year:Number(String(detail.release_date||'').slice(0,4))||work.year};
}
export function exactTmdbMovies(raw,items){
 const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
 const key=norm(raw);return items.filter(x=>[x.title,...x.aliases].some(t=>norm(t)===key));
}
