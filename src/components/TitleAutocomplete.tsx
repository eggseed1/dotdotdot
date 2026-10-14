import {useEffect,useState,type KeyboardEvent} from 'react';
import {suggestWorks} from '../lib/title-match.mjs';
import {catalog} from '../data/catalog';
import type {Kind,Lang} from '../lib/types';
type Item={id:string;kind:string;title:string;titleKo?:string;creator?:string;year?:number;source?:string};
const apiOrigin=()=>location.hostname==='eggseed1.github.io'?'https://dotdotdot-7yot.onrender.com':location.port==='5173'?`${location.protocol}//${location.hostname}:8787`:location.origin;
export function useTitleAutocomplete(value:string,kind:Kind,lang:Lang,enabled=true){
 const [items,setItems]=useState<Item[]>([]);
 const [active,setActive]=useState(0),[open,setOpen]=useState(false);
 const [queried,setQueried]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{setItems([]);setOpen(false);setQueried('');setActive(0);},[value,kind,enabled]);
 const display=(item:Item)=>`${lang==='ko'&&item.titleKo?item.titleKo:item.title}${item.creator?' — '+item.creator:''}`;
 const select=(item:Item,onChange:(s:string)=>void)=>{onChange(display(item));setOpen(false);};
 const request=async()=>{
  const query=value.trim();if(!enabled||query.length<2)return;
  setQueried(query);setLoading(true);setOpen(true);setItems([]);
  const local=suggestWorks(query,catalog.filter(w=>w.kind===kind),3) as Item[];
  try{
   const res=await fetch(`${apiOrigin()}/api/suggest?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query.slice(0,90))}`);
   const data=res.ok?await res.json():null;
   const joined=[...(data?.suggestions||[]),...local] as Item[];
   const seen=new Set();
   setItems(joined.filter(w=>{const k=`${w.title.toLowerCase()}|${(w.creator||'').toLowerCase()}`;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,3));
  }catch{setItems(local);}finally{setLoading(false);}
 };
 const onKeyDown=(event:KeyboardEvent<HTMLInputElement>,onChange:(v:string)=>void,onConfirm?:(v:string)=>void)=>{
  if(event.key==='Escape'){setOpen(false);return;}
  if(event.key==='ArrowDown'&&open&&items.length){event.preventDefault();setActive(i=>(i+1)%items.length);return;}
  if(event.key==='ArrowUp'&&open&&items.length){event.preventDefault();setActive(i=>(i+items.length-1)%items.length);return;}
  if(event.key!=='Enter'||event.nativeEvent.isComposing)return;
  event.preventDefault();
  if(!open||queried!==value.trim()){void request();return;}
  if(loading)return;
  const item=items[active];
  if(item){const chosen=display(item);onChange(chosen);setOpen(false);onConfirm?.(chosen);}
  else {setOpen(false);onConfirm?.(value);}
 };
 return {items,open,active,loading,onKeyDown,select,close:()=>setOpen(false)};
}
export function TitleSuggestions({items,open,active,lang,onSelect}:{items:Item[];open:boolean;active:number;lang:Lang;onSelect:(item:Item)=>void}){
 if(!open||items.length===0)return null;
 return <div className="title-suggestions" role="listbox" aria-label={lang==='ko'?'비슷한 작품 제목':'Similar work titles'}>
  <div className="suggest-hint">{lang==='ko'?'한국어 / 영어 모두 검색 · 작품을 선택해 주세요':'PRESS ENTER AGAIN TO CONFIRM · MAX 3 MATCHES'}</div>
  {items.map((item,i)=><button key={item.id} type="button" role="option" aria-selected={i===active} className={`suggest-option ${i===active?'suggest-active':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(item)}>
   <span className="suggest-main"><strong>{lang==='ko'&&item.titleKo?item.titleKo:item.title}</strong><small>{lang==='ko'?item.title:item.titleKo||''}</small></span>
   <span className="suggest-meta">{item.creator||''}{item.year?' · '+item.year:''}</span>
  </button>)}
  <div className="suggest-footer">{lang==='ko'?'↑↓ 이동 · Enter 선택':'↑↓ SELECT · ENTER TO CONFIRM'}</div>
 </div>;
}
