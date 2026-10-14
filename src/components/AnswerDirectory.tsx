import {useMemo,useState} from 'react';
type Answer={title:string;titleKo?:string;creator?:string;year?:number;points?:number|null;rarityCategory?:string;rarityLabelKo?:string;rarityLabelEn?:string;rarityReviewed?:boolean};
const tierLabel=(points:number,ko:boolean)=>points>=100?(ko?'이걸 안다고?':'WHAT EVEN'):points>=85?(ko?'진짜 마이너':'DEEP CUT'):points>=60?(ko?'꽤 마이너':'OBSCURE'):points>=30?(ko?'좀 아는 편':'NICHE'):points>=15?(ko?'흔한 답':'COMMON'):(ko?'너무 쉬움':'OBVIOUS');
export function AnswerDirectory({answers,lang,complete=false}:{answers:Answer[];lang:'ko'|'en';complete?:boolean}){
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<'rarity'|'name'>('rarity');
 const ko=lang==='ko';
 const visible=useMemo(()=>{
  const q=query.normalize('NFKC').toLocaleLowerCase().trim();
  return answers.filter(w=>!q||[w.title,w.titleKo,w.creator].some(t=>String(t||'').normalize('NFKC').toLocaleLowerCase().includes(q))).sort((a,b)=>sort==='rarity'?(Number(b.points??0)-Number(a.points??0))||a.title.localeCompare(b.title):a.title.localeCompare(b.title));
 },[answers,query,sort]);
 return <div className="answer-directory">
  <div className="answer-directory-head">
   <strong>{ko?'등록된 정답 목록':'KNOWN ANSWERS'} <span>{answers.length.toLocaleString()}{complete?'':ko?'개 · 수집 중':' · ongoing'}</span></strong>
   <span>{ko?'각 작품의 추정 희귀도':'Estimated rarity per answer'}</span>
  </div>
  <div className="answer-directory-controls">
   <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={ko?'작품명 검색 (한국어·원제)':'SEARCH ANSWERS'} aria-label={ko?'정답 검색':'Search answers'}/>
   <select value={sort} onChange={e=>setSort(e.target.value as 'rarity'|'name')} aria-label={ko?'정렬':'Sort'}>
    <option value="rarity">{ko?'점수 높은 순':'RARITY ↓'}</option>
    <option value="name">{ko?'제목순':'TITLE A-Z'}</option>
   </select>
  </div>
  <p className="answer-directory-count">{ko?`${visible.length.toLocaleString()}개 표시 중`:`${visible.length.toLocaleString()} SHOWING`}</p>
  <div className="recap-examples answer-directory-list">
   {visible.map((w,i)=><div className="recap-example answer-directory-item" key={w.title+'|'+String(w.year||'')+'|'+i}>
    <span className="answer-directory-title"><strong>{ko&&w.titleKo?w.titleKo:w.title}</strong>{ko&&w.titleKo&&w.title!==w.titleKo?<small>{w.title}</small>:null}</span>
    <span className={`answer-directory-tier answer-directory-tier--${Number(w.points)||0}`}>{typeof w.points==='number'?tierLabel(w.points,ko):(ko?'미분류':'UNRATED')}</span>
    <b>{typeof w.points==='number'?`+${w.points}`:'—'}</b>
   </div>)}
  </div>
  {!visible.length&&<p>{ko?'검색 결과가 없어.':'No matching titles.'}</p>}
  <small>{ko?'점수는 희귀도 추정치야. 모든 정답이 검증된 목록은 아니며, 등록되지 않은 정답도 있을 수 있어.':'Rarity scores are estimates. This is an incomplete candidate list.'}</small>
 </div>;
}
