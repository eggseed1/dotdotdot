import {useEffect,useState} from 'react';
import {Hellscape} from './Hellscape';
import {promptById} from '../lib/engine';
import {apiBase} from './DuelArena';
import type {Lang} from '../lib/types';
type Result={date:string;mode:string;ranked:boolean;scores:Array<{name:string;score:number;rating:number}>;rounds:Array<{promptId:string;players:Array<{name:string;title:string;points:number}>}>;possible:Array<{promptId:string;answers:Array<{title:string;creator:string}>}>};
export function PublicMatchPage({matchId,lang,onBack}:{matchId:string;lang:Lang;onBack:()=>void}){
 const [result,setResult]=useState<Result|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{fetch(`${apiBase()}/api/matches/${matchId}`).then(r=>{if(!r.ok)throw Error('missing');return r.json()}).then(setResult).catch(()=>setError(true));},[matchId]);
 return <main className="shared-duel-page"><button className="small-link" onClick={onBack}>← {lang==='ko'?'처음으로':'BACK TO GAME'}</button><p className="eyebrow">LARPER101 · {lang==='ko'?'1대1 결과':'1V1 MATCH RESULTS'}</p><h1>{lang==='ko'?'지옥 대결 기록':'THE DESCENT REPORT'}</h1>
 {!result?<p>{error?(lang==='ko'?'대결 결과를 찾지 못했습니다. 공유 링크는 라이브 서버에서만 열립니다.':'Match not found. A running live server is required to view ranked match records.'):(lang==='ko'?'불러오는 중':'Loading match...')}</p>:<><div className="shared-duel-scores">{result.scores.map((s,i)=><div key={i}><h2>{s.name}</h2><Hellscape score={s.score} lang={lang} compact/><strong>{s.score} / 700</strong><small>ELO {s.rating}</small></div>)}</div><div className="answers-archive"><div className="answers-archive-heading"><h2>{lang==='ko'?'문제별 답변 및 예시 정답':'ROUND-BY-ROUND ANSWERS'}</h2><p>{lang==='ko'?'라운드가 끝난 후에만 공개되는 답변입니다.':'Answers revealed after the match ends.'}</p></div>{result.rounds.map((r,i)=><details key={i} className="answers-archive-round"><summary><strong>{String(i+1).padStart(2,'0')}</strong><span>{promptById.get(r.promptId)?.label[lang]}</span><span>▾</span></summary><div className="answers-archive-grid">{r.players.map((p,j)=><div key={j} className="possible-answer"><div><strong>{p.name}: {p.title||'—'}</strong></div><b>+{p.points}</b></div>)}{result.possible[i]?.answers.map((a,j)=><div className="possible-answer" key={j}><strong>{a.title} · {a.creator}</strong></div>)}</div></details>)}</div></>}
 </main>;
}
