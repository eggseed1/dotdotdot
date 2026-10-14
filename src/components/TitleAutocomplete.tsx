import {useEffect,useState,type KeyboardEvent} from 'react';
import {suggestWorks} from '../lib/title-match.mjs';
import {catalog} from '../data/catalog';
import type {Kind,Lang} from '../lib/types';
type Item={id:string;kind:string;title:string;titleKo?:string;creator?:string;year?:number;source?:string};
const apiOrigin=()=>location.hostname==='eggseed1.github.io'?'https://dotdotdot-7yot.onrender.com':location.port==='5173'?`${location.protocol}//${location.hostname}:8787`:location.origin;
export function useTitleAutocomplete(value:string,kind:Kind,lang:Lang,enabled=true){
 const [items,setItems]=useState<Item[]>([]);
 const [active,setActive]=useState(0),[open,setOpen]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  const query=value.trim();
  setItems([]);setActive(0);setOpen(false);
  if(!enabled||query.length<2)return;
  const timer=window.setTimeout(async()=>{
   const local=kind==='literature'?suggestWorks(query,catalog.filter(w=>w.kind===kind),3) as Item[]:[];
   try{
    const res=await fetch(`${apiOrigin()}/api/suggest?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query.slice(0,90))}`);
    const data=res.ok?await res.json():null;
    const joined=[...(data?.suggestions||[]),...local] as Item[];
    const seen=new Set<string>();
    const results=joined.filter(w=>{const k=`${w.title.toLowerCase()}|${(w.creator||'').toLowerCase()}`;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,3);
    if(!cancelled){setItems(results);setOpen(results.length>0);}
   }catch{if(!cancelled){setItems(local);setOpen(local.length>0);}}
  },220);
  return ()=>{cancelled=true;window.clearTimeout(timer);};
 },[value,kind,enabled]);
 const display=(item:Item)=>`${lang==='ko'&&item.titleKo?item.titleKo:item.title}${item.creator?' — '+item.creator:''}`;
 const select=(item:Item,onChange:(s:string)=>void)=>{onChange(display(item));setOpen(false);};
 const onKeyDown=(event:KeyboardEvent<HTMLInputElement>)=>{
  if(event.key==='Escape'){setOpen(false);return;}
  // Never replace a typed answer with an autocomplete suggestion on Enter.
  // Enter is handled ONLY by the enclosing form, submitting the exact typed text.
  // Suggestions can still be explicitly clicked/tapped.
  if(event.key==='Enter'){setOpen(false);return;}
 };

 return {items,open,active,loading:false,onKeyDown,select,close:()=>setOpen(false)};
}
export function TitleSuggestions({items,open,active,lang,onSelect}:{items:Item[];open:boolean;active:number;lang:Lang;onSelect:(item:Item)=>void}){
 if(!open||items.length===0)return null;
 return <div className="title-suggestions" role="listbox" aria-label={lang==='ko'?'비슷한 작품 제목':'Similar work titles'}>
  <div className="suggest-hint">{lang==='ko'?'한국어 / 영어 모두 검색 · 작품을 선택해 주세요':'TAP A SUGGESTION TO USE IT · ENTER SUBMITS YOUR TEXT'}</div>
  {items.map((item,i)=><button key={item.id} type="button" role="option" aria-selected={i===active} className={`suggest-option ${i===active?'suggest-active':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(item)}>
   <span className="suggest-main"><strong>{lang==='ko'&&item.titleKo?item.titleKo:item.title}</strong><small>{lang==='ko'?item.title:item.titleKo||''}</small></span>
   <span className="suggest-meta">{item.creator||''}{item.year?' · '+item.year:''}</span>
  </button>)}
  <div className="suggest-footer">{lang==='ko'?'항목을 누르면 선택 · Enter는 입력한 답 제출':'TAP TO SELECT · ENTER SUBMITS YOUR TEXT'}</div>
 </div>;
}
