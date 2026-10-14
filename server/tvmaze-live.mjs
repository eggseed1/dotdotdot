const cache=new Map(),TTL=21600000;
export async function searchTVMaze(q){
 const raw=String(q||'').trim().slice(0,95);if(raw.length<2)return [];
 const key=raw.toLowerCase(),hit=cache.get(key);if(hit?.until>Date.now())return hit.items;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{const url='https://api.tvmaze.com/search/shows?q='+encodeURIComponent(raw);
 const res=await fetch(url,{signal:ctrl.signal,headers:{'accept':'application/json'}});if(!res.ok)throw Error('TVMaze HTTP '+res.status);
 const data=await res.json();
 const items=data.filter(x=>x.show?.id).map(({show:x})=>({
 id:'tvmaze:'+x.id,kind:'tv',source:'tvmaze-live',title:x.name,titleKo:'',creator:'',
 year:Number(String(x.premiered||'').slice(0,4))||0,country:x.network?.country?.name||x.webChannel?.country?.name||'',
 genres:(x.genres||[]).map(g=>g.toLowerCase()),aliases:[],format:'TV',ratingCount:null,verified:true,
 sourceUrl:x.url
 }));
 if(cache.size>400)cache.delete(cache.keys().next().value);cache.set(key,{items,until:Date.now()+TTL});return items;
 }finally{clearTimeout(timer);}
}
export function exactTV(raw,items){
 const normalize=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
 return items.filter(w=>normalize(w.title)===normalize(raw));
}