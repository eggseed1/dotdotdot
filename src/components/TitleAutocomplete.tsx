import {useEffect,useMemo,useState,type KeyboardEvent} from 'react';
import {catalog} from '../data/catalog';
import {suggestWorks} from '../lib/title-match.mjs';
import {staticCatalogMatches} from '../lib/static-catalog';
import type {Kind,Lang} from '../lib/types';

type Item={id:string;kind:string;title:string;titleKo?:string;creator?:string;year?:number;source?:string};
const apiOrigin=()=>location.port==='5173'?`${location.protocol}//${location.hostname}:8787`:location.origin;
export function useTitleAutocomplete(value:string,kind:Kind,lang:Lang,enabled=true){
 const [remote,setRemote]=useState<Item[]>([]);
 const [active,setActive]=useState(-1);
 const [open,setOpen]=useState(false);
 const local=useMemo(()=>{
  if(!enabled||value.trim().length<2)return [];
  return suggestWorks(value,catalog.filter(w=>kind==='any'||w.kind===kind),7) as Item[];
 },[enabled,value,kind]);
 useEffect(()=>{
  setActive(-1);
  if(!enabled||value.trim().length<2){setRemote([]);setOpen(false);return;}
  setRemote([]);setOpen(true);
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   staticCatalogMatches(value,kind,7).then(items=>{if(!controller.signal.aborted&&items.length)setRemote(items);}).catch(()=>{});
   fetch(`${apiOrigin()}/api/suggest?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(value.slice(0,90))}`,{signal:controller.signal})
    .then(res=>res.ok?res.json():null).then(data=>{if(data?.suggestions)setRemote(current=>{const merged=[...current,...data.suggestions];return merged.filter((w,i)=>merged.findIndex(x=>x.id===w.id)===i);});}).catch(()=>{});
  },180);
  return ()=>{window.clearTimeout(timer);controller.abort();};
 },[enabled,value,kind]);
 const items=useMemo(()=>{
  const out:Item[]=[],seen=new Set<string>();
  for(const w of [...local,...remote]){
   const key=`${w.kind}:${w.title.toLocaleLowerCase()}:${(w.creator||'').toLocaleLowerCase()}`;
   if(!seen.has(key)){out.push(w);seen.add(key);}
  }
  return out.slice(0,7);
 },[local,remote]);
 const select=(item:Item,onChange:(s:string)=>void)=>{
  onChange(`${lang==='ko'&&item.titleKo?item.titleKo:item.title}${item.creator?' — '+item.creator:''}`);
  setOpen(false);setActive(-1);
 };
 const onKeyDown=(event:KeyboardEvent<HTMLInputElement>,onChange:(v:string)=>void)=>{
  if(!open||!items.length)return;
  if(event.key==='ArrowDown'){event.preventDefault();setActive(x=>(x+1)%items.length);}
  if(event.key==='ArrowUp'){event.preventDefault();setActive(x=>x<=0?items.length-1:x-1);}
  if(event.key==='Escape'){event.preventDefault();setOpen(false);}
  if(event.key==='Enter'&&active>=0){event.preventDefault();select(items[active],onChange);}
 };
 return {items,open,active,onKeyDown,select,close:()=>setOpen(false)};
}
export function TitleSuggestions({items,open,active,lang,onSelect}:{items:Item[];open:boolean;active:number;lang:Lang;onSelect:(item:Item)=>void}){
 if(!open||items.length===0)return null;
 return <div className="title-suggestions" role="listbox" aria-label={lang==='ko'?'비슷한 작품 제목':'Similar work titles'}>
  <div className="suggest-hint">{lang==='ko'?'한국어 / 영어 모두 검색 · 작품을 선택해 주세요':'MATCHING TITLES · ENGLISH + 한국어'}</div>
  {items.map((item,i)=><button key={item.id} type="button" role="option" aria-selected={i===active} className={`suggest-option ${i===active?'suggest-active':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(item)}>
   <span className="suggest-main"><strong>{lang==='ko'&&item.titleKo?item.titleKo:item.title}</strong><small>{lang==='ko'?item.title:item.titleKo||''}</small></span>
   <span className="suggest-meta">{item.creator||''}{item.year?' · '+item.year:''}</span>
  </button>)}
  <div className="suggest-footer">{lang==='ko'?'↑↓ 이동 · Enter 선택':'↑↓ NAVIGATE · ENTER TO SELECT'}</div>
 </div>;
}
