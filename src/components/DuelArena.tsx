import { useTitleAutocomplete, TitleSuggestions } from './TitleAutocomplete';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Copy, Flame, Gamepad2, LockKeyhole, Swords, Wifi, WifiOff, X } from 'lucide-react';
import { Hellscape } from './Hellscape';
import type { I18n, Kind, Lang, Mode } from '../lib/types';
import {promptById} from '../lib/engine';
import {sampleAnswers} from '../lib/sharing';

interface Rival { id: string; name: string; rating: number }
interface Reveal { title: string; points: number; tier: number; jinx: boolean; skipped: boolean }
interface Match {
  matchId: string; mode: Mode; ranked: boolean; round: number; kind: Kind; prompt: I18n; promptBadge: I18n;
  phase: 'play' | 'reveal' | 'finished'; deadline: number; nextAt: number | null;
  score: number; rivalScore: number; opponent: Rival; ownLocked: boolean; rivalLocked: boolean;
  roundResult: Reveal | null; rivalResult: Reveal | null;
}
interface Finish { shareId:string; rounds:Array<{promptId:string;players:Array<{title:string;points:number;workId?:string;name:string}>}>;possible:Array<{promptId:string;answers:Array<{title:string;creator:string;year:number;ratingCount:number}>}>;result: 'win' | 'loss' | 'draw'; score: number; rivalScore: number; rating: number; eloChange: number; ranked: boolean; opponent: Rival }
const translations = {
 en:{headline:'DUEL IN THE UNDERWORLD',sub:'Same seven prompts. Two devils. The most obscure mind sinks the furthest.',ranked:'RANKED MATCH',rankedSub:'Find another player online · provisional Elo',friend:'PRIVATE ROOM',friendSub:'Invite someone with a six-character code',mode:'SELECT THE ARENA',music:'MUSIC ONLY',all:'ALL MEDIA',invite:'CREATE INVITE',queue:'FIND RANKED MATCH',join:'JOIN A ROOM',code:'ROOM CODE',enterCode:'ENTER CODE',joinNow:'JOIN DUEL',copy:'COPY CODE',copied:'COPIED',waiting:'WAITING FOR YOUR RIVAL',matchmaking:'SEARCHING FOR AN OPPONENT',cancel:'CANCEL',connected:'SERVER CONNECTED',offline:'LIVE SERVER OFFLINE',serverHint:'Live multiplayer needs the Node server. Run npm run build and npm start, then open the server address in two browsers.',reconnect:'RECONNECT',nickname:'YOUR DISPLAY NAME',saveName:'UPDATE NAME',round:'ROUND',versus:'VS',answer:'YOUR ANSWER',placeholder:'Type a title...',lock:'LOCK IN',locked:'ANSWER LOCKED',opponentLocked:'YOUR RIVAL HAS LOCKED IN',timesUp:'ROUND ENDING',reveal:'ROUND REVEAL',jinx:'JINX! SAME ANSWER — HALF POINTS',miss:'NO ANSWER',next:'NEXT ROUND STARTS AUTOMATICALLY',win:'YOU DESCENDED DEEPER!',loss:'YOUR RIVAL WENT DEEPER',draw:'TIED AT THE GATES',rating:'NEW RATING',playAgain:'BACK TO DUEL LOBBY',back:'BACK HOME',unsupported:'Your answer is not in the limited demo catalog.',wrong:'This work does not fit the prompt.',ambiguous:'Ambiguous title: add creator.',disclaimer:'Multiplayer is a real server-hosted guest beta. Scores use curated demo weights, not RYM/Backloggd popularity. Guest ratings are not cheat-proof.'},
 ko:{headline:'지옥 끝장 꺼드럭 대결',sub:'같은 일곱 문제, 두 마리 악마. 더 마이너한 작품을 아는 쪽이 더 깊이 내려간다.',ranked:'1대1 랭크전',rankedSub:'온라인 상대 찾기 · 임시 Elo 점수',friend:'친구와 대결',friendSub:'6자리 초대 코드로 친구 불러오기',mode:'대결 분야 선택',music:'음악만',all:'종합 교양',invite:'초대 코드 만들기',queue:'랭크전 상대 찾기',join:'방에 입장하기',code:'초대 코드',enterCode:'코드 입력',joinNow:'대결 참가',copy:'코드 복사',copied:'복사 완료',waiting:'친구를 기다리는 중',matchmaking:'상대 찾는 중',cancel:'취소',connected:'서버 연결됨',offline:'멀티플레이 서버 연결 안 됨',serverHint:'1대1 대전은 Node 서버가 필요합니다. npm run build, npm start 명령을 실행한 뒤 서버 주소를 두 브라우저에서 열어주세요.',reconnect:'다시 연결',nickname:'닉네임',saveName:'닉네임 변경',round:'문제',versus:'대',answer:'내 답변',placeholder:'작품 제목 입력...',lock:'답변 확정',locked:'답변 완료',opponentLocked:'상대가 답을 확정했습니다',timesUp:'라운드 종료 중',reveal:'결과 공개',jinx:'중복 답변! 점수 반토막',miss:'정답 없음',next:'다음 라운드 자동 시작',win:'내가 더 깊이 내려왔다!',loss:'상대가 더 깊이 내려갔다',draw:'무승부!',rating:'새 레이팅',playAgain:'대결 메뉴로',back:'홈으로',unsupported:'현재 샘플 데이터에 없는 작품입니다.',wrong:'이 조건에 맞지 않는 작품입니다.',ambiguous:'동명 작품입니다. 창작자를 추가하세요.',disclaimer:'이 온라인 대결은 게스트 베타입니다. 점수는 실제 RYM/Backloggd가 아닌 샘플 데이터를 사용하며, 게스트 레이팅은 부정행위에 취약합니다.'}
};
const getIdentity = () => {
  try{const existing=localStorage.getItem('deepcut:duel:identity');if(existing)return existing;
    const generated=crypto.randomUUID();localStorage.setItem('deepcut:duel:identity',generated);return generated;
  }catch{return crypto.randomUUID();}
};
export function apiBase(){return location.port==='5173'?`${location.protocol}//${location.hostname}:8787`:location.origin;}
function socketURL(){
  const configured=import.meta.env.VITE_DUEL_URL as string | undefined;
  if(configured)return configured;
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  // Vite dev serves at 5173 and the 1v1 API runs on 8787.
  const host=location.port==='5173'?`${location.hostname}:8787`:location.host;
  return `${protocol}//${host}/ws`;
}
export function DuelArena({lang,onBack}:{lang:Lang;onBack:()=>void}){
  const t=translations[lang];
  const [connected,setConnected]=useState(false);
  const [ladder,setLadder]=useState<Array<{name:string;rating:number;played:number;wins:number}>>([]);
  const [player,setPlayer]=useState<Rival|null>(null);
  const [name,setName]=useState(()=>{try{return localStorage.getItem('deepcut:duel:name') || 'GUEST';}catch{return 'GUEST';}});
  const [mode,setMode]=useState<Mode>('all');
  const [waiting,setWaiting]=useState<'ranked'|'friend'|null>(null);
  const [invite,setInvite]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [match,setMatch]=useState<Match|null>(null);
  const [finished,setFinished]=useState<Finish|null>(null);
  const [input,setInput]=useState('');
  const [warning,setWarning]=useState('');
  const [copied,setCopied]=useState(false);
  const [clock,setClock]=useState(Date.now());
  const wsRef=useRef<WebSocket|null>(null);
  const clientId=useRef(getIdentity());
  const inputRef=useRef<HTMLInputElement>(null);
  const nameRef=useRef(name);nameRef.current=name;
  const send=(payload:object)=>{if(wsRef.current?.readyState===WebSocket.OPEN)wsRef.current.send(JSON.stringify(payload));};
  const connect=()=>{
    wsRef.current?.close();
    const ws=new WebSocket(socketURL());wsRef.current=ws;
    ws.onopen=()=>{setConnected(true);ws.send(JSON.stringify({type:'hello',id:clientId.current,name:nameRef.current}));};
    ws.onclose=()=>{if(wsRef.current===ws){setConnected(false);setWarning('');}};
    ws.onerror=()=>{setConnected(false);};
    ws.onmessage=event=>{
      let m: Record<string,unknown>;try{m=JSON.parse(event.data);}catch{return;}
      switch(m.type){
        case 'hello':setPlayer(m.player as Rival);break;
        case 'invited':setWaiting('friend');setInvite(String(m.code));setWarning('');break;
        case 'queued':setWaiting('ranked');setWarning('');break;
        case 'cancelled':setWaiting(null);setInvite('');break;
        case 'match':setMatch(m as unknown as Match);setWaiting(null);setFinished(null);setWarning('');break;
        case 'rival_locked':setMatch(prev=>prev?{...prev,rivalLocked:true}:prev);break;
        case 'invalid':setWarning(m.reason==='notEligible'?t.wrong:m.reason==='ambiguous'?t.ambiguous:t.unsupported);break;
        case 'error':setWarning(String(m.message));break;
        case 'finished':setFinished(m as unknown as Finish);setMatch(null);break;
      }
    };
  };
  useEffect(()=>{connect();fetch(`${apiBase()}/api/leaderboard`).then(r=>r.ok?r.json():null).then(data=>setLadder(data?.players||[])).catch(()=>{});const interval=window.setInterval(()=>setClock(Date.now()),125);return()=>{window.clearInterval(interval);wsRef.current?.close();};},[]);
  useEffect(()=>{if(match?.phase==='play' && !match.ownLocked)inputRef.current?.focus();},[match?.round,match?.phase]);
  const autocomplete=useTitleAutocomplete(input,match?.kind||'any',lang,match?.phase==='play'&&!match.ownLocked);
  const remaining=match?Math.max(0,Math.ceil((match.deadline-clock)/1000)):0;
  const begin=(ranked:boolean)=>{setWarning('');setFinished(null);setWaiting(ranked?'ranked':'friend');send({type:ranked?'queue':'invite',mode});};
  const cancel=()=>{send({type:'cancel'});setWaiting(null);setInvite('');};
  const submit=(e:FormEvent)=>{e.preventDefault();if(!match||match.phase!=='play'||match.ownLocked||!input.trim())return;send({type:'guess',answer:input.trim()});setWarning('');};
  useEffect(()=>{setInput('');setWarning('');},[match?.round]);
  const updateName=()=>{const cleaned=name.trim().slice(0,18)||'GUEST';setName(cleaned);try{localStorage.setItem('deepcut:duel:name',cleaned);}catch{}send({type:'hello',id:clientId.current,name:cleaned});};
  return <main className="duel-main">
    <button className="small-link duel-back" onClick={onBack}><ArrowLeft size={15}/>{t.back}</button>
    {!finished && !match && <><div className="duel-head"><span className="duel-eyebrow">⚔ PVP / HELL ARENA</span><h1>{t.headline}</h1><p>{t.sub}</p></div>
      <div className="duel-lobby-grid"><Hellscape lang={lang} score={950/10} opponentScore={410/10}/>
        <section className="duel-lobby-panel"><div className={`duel-server-status ${connected?'online':'offline'}`}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>} {connected?t.connected:t.offline}</div>
          {!connected?<><p className="duel-help">{t.serverHint}</p><button className="action-button" onClick={connect}>{t.reconnect}<ArrowRight size={15}/></button></>:
          waiting?<div className="duel-wait"><Flame size={38}/><h2>{waiting==='ranked'?t.matchmaking:t.waiting}</h2>{invite&&<><small>{t.code}</small><strong className="duel-invite-code">{invite}</strong><button onClick={()=>{navigator.clipboard?.writeText(invite).then(()=>setCopied(true));}} className="duel-copy"><Copy size={15}/>{copied?t.copied:t.copy}</button></>}<div className="duel-waiting-animation">● ● ●</div><button className="secondary-button" onClick={cancel}>{t.cancel}<X size={15}/></button></div>:
          <><div className="duel-avatar-chip"><img src="/favicon.svg" alt=""/><div><small>{t.nickname} · ELO {player?.rating ?? 1000}</small><div className="duel-profile-name"><input value={name} onChange={e=>setName(e.target.value)} maxLength={18}/><button onClick={updateName}>{t.saveName}</button></div></div></div>
            <p className="duel-control-label">{t.mode}</p><div className="duel-mode-tabs"><button className={mode==='all'?'selected':''} onClick={()=>setMode('all')}>{t.all}</button></div>
            <button className="duel-action ranked-action" onClick={()=>begin(true)}><span><Swords size={23}/><strong>{t.ranked}</strong><small>{t.rankedSub}</small></span><ArrowRight/></button>
            <button className="duel-action friend-action" onClick={()=>begin(false)}><span><LockKeyhole size={23}/><strong>{t.friend}</strong><small>{t.friendSub}</small></span><ArrowRight/></button>
            <div className="duel-join-box"><label htmlFor="join-code">{t.join}</label><div><input id="join-code" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder={t.enterCode}/><button onClick={()=>send({type:'join',code:joinCode})}>{t.joinNow}</button></div></div>
          </>}
          {warning && <p role="alert" className="duel-warning">{warning}</p>}
        </section>
      </div><section className="duel-ladder"><h2>{lang==='ko'?'지옥 랭크 · Elo':'HELL LADDER · ELO'}</h2><p>{lang==='ko'?'랭크전 결과에 따라 변동 · 게스트 베타':'Ranked matches change your rating · guest beta'}</p>{ladder.length?ladder.slice(0,10).map((entry,i)=><div key={i} className="duel-ladder-row"><span>#{i+1}</span><strong>{entry.name}</strong><b>{entry.rating}</b><small>{entry.played} {lang==='ko'?'전':'matches'}</small></div>):<p>{lang==='ko'?'아직 랭크 기록이 없습니다.':'No ranked matches yet.'}</p>}</section></>}
    {match && <div className="duel-match">
      <div className="duel-match-top"><span>{match.ranked?t.ranked:t.friend} · {match.mode==='music'?t.music:t.all}</span><strong>{t.round} {match.round+1}/7</strong><span>{match.phase==='play'?remaining+'s':t.reveal}</span></div>
      <div className="duel-scoreboard"><div><small>YOU · {player?.name}</small><b>{match.score} <em>PTS</em></b></div><strong>{t.versus}</strong><div className="rival-side"><small>{match.opponent.name}</small><b>{match.rivalScore} <em>PTS</em></b></div></div>
      <div className="duel-stage-grid"><Hellscape score={match.score} opponentScore={match.rivalScore} opponentName={match.opponent.name} lang={lang} compact/>
        <div className="duel-question-panel"><div className="duel-question-category">{match.kind?.toUpperCase()} / {match.promptBadge?.[lang]}</div><h2>{match.prompt?.[lang]}</h2>
        {match.phase==='play'?<>
          <form onSubmit={submit}><label htmlFor="duel-answer">{t.answer}</label><div className="title-suggest-wrap"><input id="duel-answer" ref={inputRef} value={input} disabled={match.ownLocked} onChange={e=>{setInput(e.target.value);setWarning('');}} placeholder={t.placeholder} autoComplete="off" spellCheck={false} onKeyDown={e=>autocomplete.onKeyDown(e,setInput)}/><TitleSuggestions {...autocomplete} lang={lang} onSelect={item=>autocomplete.select(item,setInput)}/></div><button className="action-button" type="submit" disabled={match.ownLocked||!input.trim()}>{match.ownLocked?t.locked:t.lock}<ArrowRight size={15}/></button></form>
          <div className="duel-timer-track"><div style={{width:`${remaining/25*100}%`}}/></div>
          <div className="duel-lock-row"><span>{match.ownLocked?'✓ ': '○ '}YOU</span><span>{match.rivalLocked?'✓ ': '○ '}{match.opponent.name}</span></div>
          {match.rivalLocked && <p className="duel-rival-locked">{t.opponentLocked}</p>}
          {warning&&<p role="alert" className="duel-warning">{warning}</p>}
        </>:<div className="duel-reveal"><p>{t.reveal}</p><div><span>{match.roundResult?.title || t.miss}</span><b>+{match.roundResult?.points ?? 0}</b></div><div><span>{match.rivalResult?.title || t.miss}</span><b>+{match.rivalResult?.points ?? 0}</b></div>{match.roundResult?.jinx&&<strong className="duel-jinx">{t.jinx}</strong>}<small>{t.next} · {Math.max(0,Math.ceil(((match.nextAt||clock)-clock)/1000))}s</small></div>}
        </div></div>
    </div>}
    {finished&&<section className="duel-finish"><div className="duel-finish-icon">{finished.result==='win'?'♛':finished.result==='draw'?'◆':'✖'}</div><h1>{finished.result==='win'?t.win:finished.result==='loss'?t.loss:t.draw}</h1><Hellscape score={finished.score} opponentScore={finished.rivalScore} opponentName={finished.opponent.name} lang={lang} compact/><div className="duel-finish-results"><strong>{finished.score} : {finished.rivalScore}</strong><span>{t.rating}: {finished.rating} ({finished.eloChange>=0?'+':''}{finished.eloChange})</span></div><button className="action-button" onClick={()=>{navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?match=${finished.shareId}`).then(()=>setCopied(true)).catch(()=>{});}}><Copy size={15}/>{copied?(lang==='ko'?'복사 완료':'LINK COPIED'):(lang==='ko'?'대결 결과 링크 복사':'SHARE MATCH RESULTS')}</button>
      <div className="duel-round-archive"><h2>{lang==='ko'?'일곱 문제 · 결과와 다른 정답':'7 ROUNDS · PICKS & POSSIBLE ANSWERS'}</h2>{finished.rounds?.map((r,i)=><details key={i}><summary>{String(i+1).padStart(2,'0')} / {promptById.get(r.promptId)?.label[lang]}</summary><div>{r.players?.map((ans,j)=><p key={j}><b>{ans.name}</b> · {ans.title||'—'} <strong>+{ans.points}</strong></p>)}<small>{lang==='ko'?'가능한 다른 정답':'Other valid answers (demo / imported)'}</small>{(finished.possible?.[i]?.answers?.length?finished.possible[i].answers:sampleAnswers(r.promptId).map(w=>({title:w.title,creator:w.creator,year:w.year,ratingCount:0}))).slice(0,6).map((w,j)=><p key={j}>{w.title} · {w.creator}</p>)}</div></details>)}</div>
      <button className="secondary-button" onClick={()=>{setFinished(null);setMatch(null);setWarning('');}}>{t.playAgain}<ArrowRight size={15}/></button></section>}
    <p className="duel-disclaimer"><Gamepad2 size={13}/>{t.disclaimer}</p>
  </main>;
}
