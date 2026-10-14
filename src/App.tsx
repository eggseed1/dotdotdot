import {rarityRank} from './lib/rarity-ranks.mjs';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Clipboard, Clock3, Info, RotateCcw, SkipForward, X } from 'lucide-react';
import { catalog } from './data/catalog';

import { Hellscape } from './components/Hellscape';
import { DuelArena } from './components/DuelArena';
import { useTitleAutocomplete, TitleSuggestions } from './components/TitleAutocomplete';
import { PublicMatchPage } from './components/PublicMatchPage';
import { devilArt } from './data/art';
import { Swords } from 'lucide-react';
import { kindNames, lookupAnswer, newGame, promptById, rarity, ROUND_SECONDS, ROUNDS, selectedWork, todayKey, totalScore } from './lib/engine';
import { encodeShare, decodeShare } from './lib/sharing';
import type { GameSession, Kind, Lang, Mode, RoundResult } from './lib/types';

const pixelRecord = [
  '......xxxx......','....xxxxxxxx....','...xxvvvvvvxx...','..xxvvxxxxvvxx..','.xxvvxxxxxxvvxx.','.xvvxxvvvvxxvvx.','xxvvxvvvvvvxvvxx',
  'xvvxvvvvvvvvxvvx','xvvxvvvggvvvxvvx','xxvvxvggggvxvvxx','.xvvxxvggvxxvvx.','.xxvvxxxxxxvvxx.','..xxvvxxxxvvxx..',
  '...xxvvvvvvxx...','....xxxxxxxx....','......xxxx......'
];
const colors: Record<string,string>={g:'#fbd46d',x:'#302340',s:'#ffd5a3',w:'#f8f5ee',d:'#302340',p:'#aa8ce7',v:'#5a4c83'};
function Pixel({pattern,className='',label}:{pattern:string[];className?:string;label?:string}){
  const width=Math.max(...pattern.map(row=>row.length));
  return <div aria-label={label} role="img" className={`pixel-art ${className}`} style={{gridTemplateColumns:`repeat(${width}, 1fr)`}}>
    {pattern.flatMap((row,y)=>row.padEnd(width,'.').split('').map((letter,x)=><i key={`${y}-${x}`} style={{background:colors[letter]||'transparent'}}/>))}
  </div>;
}
const strings={
  en:{topLine:'THE CULTURE SNOB OLYMPICS',daily:'DAILY EDITION',heroTop:'',heroTitle:'larper101.',heroSub:'Name the most obscure valid answer. Movies, books, anime and games. Every rare answer sends your little devil deeper into hell.',select:'CHOOSE YOUR OBSESSION',music:'MUSIC ONLY',all:'ALL MEDIA',musicDesc:'For record collectors, RYM addicts & certified music nerds.',allDesc:'Film + literature + anime + video games. Your entire brain, tested.',play:'PLAY DAILY',practice:'PRACTICE AGAIN',rounds:'7 ROUNDS',duration:'25 SEC EACH',rarity:'RARITY = POINTS',homeTip:'No multiple choice. No hints. Just the stuff living in your head.',edition:'DAILY DROP',demo:'PLAYABLE PROTOTYPE',sample:'Curated sample database — not a complete catalog or live scraped RYM / Backloggd data.',how:'HOW TO PLAY',howTitle:'OBSCURITY IS THE OBJECTIVE.',how1:'See a category prompt.',how2:'Type one work that fits it.',how3:'Rarer answers earn higher points.',how4:'Earn up to 700 points in 7 rounds.',from:'FROM THE ARCHIVES',loading:'LOADING NEXT QUESTION',question:'QUESTION',of:'OF',yourAnswer:'YOUR ANSWER',placeholder:'Type a title here...',submit:'LOCK IN ANSWER',skip:'SKIP ROUND',timer:'TIME LEFT',invalid:'That title is not in this limited demo catalog. Try another title.',notEligible:'Found it! But this work doesn’t match the category. Try another.',ambiguous:'Several works share this title; an eligible match will be used.',empty:'Type a title to submit.',noMore:'TIME’S UP!',skipped:'ROUND SKIPPED',accepted:'VALID ANSWER',reveal:'REVEAL',points:'POINTS',next:'NEXT ROUND',seeResults:'SEE RESULTS',yourPick:'YOUR PICK',genre:'GENRES',completed:'DAY COMPLETE',resultTitle:'CULTURE LEVEL: MEASURED.',yourScore:'YOUR SCORE',maxScore:'OUT OF 700',copy:'COPY SHARE LINK',copied:'COPIED!',back:'BACK TO HOME',playAgain:'PLAY UNRANKED',best:'YOUR LOCAL BEST',unranked:'PRACTICE RUN',todayDone:'DAILY COMPLETED',again:'PLAY AGAIN',noAnswer:'NO ANSWER',unknown:'NOT VERIFIED',scoreNote:'Demo scores are provisional. Actual vote-count rarity requires imported, authorized catalogs.',local:'Shared results can be viewed by anyone with your link, but remain unverified without a server-backed attempt.',lang:'LANGUAGE',about:'ABOUT THIS BUILD',close:'CLOSE',infoTitle:'THIS IS A REAL, LIMITED DEMO.',infoBody:'This first version is playable, with local daily attempts, a 25-second timer, bilingual prompts, answer validation, and rarity tiers. It currently validates only titles in its small curated sample catalog. It does not scrape RYM, Letterboxd, AniList, or Backloggd, and its rarity weights are illustrative. A licensed or permitted full metadata pipeline, server-side attempts, and a real leaderboard are planned for production.',tabs:['RECORDS','FILMS','BOOKS','ANIME','GAMES']},
  ko:{topLine:'아는 척 끝판왕',daily:'오늘의 문제',heroTop:'',heroTitle:'꺼드럭대마왕.',heroSub:'조건에 맞는 작품 하나. 남들이 모를수록 더 깊이 내려간다.',select:'분야 선택',music:'음악만',all:'영화 · 애니 · 게임 · 책',musicDesc:'음악 덕후, 음반 수집가, RYM 상주자를 위한 모드.',allDesc:'영화부터 게임까지, 아는 만큼 내려간다.',play:'오늘의 게임 시작',practice:'연습 모드 시작',rounds:'총 7문제',duration:'문제당 25초',rarity:'희귀할수록 고득점',homeTip:'힌트 없이, 아는 작품 하나만.',edition:'오늘의 퀴즈',demo:'플레이 가능한 프로토타입',sample:'직접 선별한 소규모 샘플 데이터입니다. RYM / Backloggd 전체 DB나 실시간 수집 데이터가 아닙니다.',how:'게임 방법',howTitle:'아는 사람이 적을수록 점수가 높다.',how1:'제시된 조건을 확인한다.',how2:'조건에 맞는 작품을 입력한다.',how3:'덜 유명할수록 점수가 높다.',how4:'7문제, 최대 700점에 도전한다.',from:'서브컬처 도서관',loading:'다음 문제 불러오는 중',question:'문제',of:'/',yourAnswer:'답',placeholder:'작품 제목을 써봐',submit:'제출',skip:'넘어가기',timer:'남은 시간',invalid:'작품을 못 찾았어. 제목을 다시 확인해 줘.',notEligible:'작품은 찾았지만 이번 조건과 맞지 않습니다.',ambiguous:'동명 작품 중 조건에 맞는 작품을 자동으로 선택합니다.',empty:'작품 제목을 입력하세요.',noMore:'시간 종료!',skipped:'넘어감',accepted:'정답!',reveal:'결과',points:'점',next:'다음 문제',seeResults:'결과 보기',yourPick:'제출한 작품',genre:'장르',completed:'오늘의 게임 완료',resultTitle:'당신의 꺼드럭력은?',yourScore:'최종 점수',maxScore:'700점 만점',copy:'공유 링크 복사',copied:'복사 완료!',back:'처음으로',playAgain:'연습 모드로 다시',best:'내 최고 기록',unranked:'연습 게임',todayDone:'오늘 게임 완료',again:'다시 하기',noAnswer:'응답 없음',unknown:'미확인',scoreNote:'희귀도는 외부 데이터 기준의 추정치야.',local:'결과 링크를 공유할 수 있습니다. 단, 서버 검증 전까지는 비공식 기록입니다.',lang:'언어',about:'게임 소개',close:'닫기',infoTitle:'계속 업데이트 중이야.',infoBody:'이 버전에서는 날짜별 게임, 25초 타이머, 한영 전환, 정답 판정, 희귀도 점수를 체험할 수 있습니다. 작은 수작업 샘플 목록에 있는 작품만 정답으로 처리됩니다. RYM, Letterboxd, AniList, Backloggd 데이터를 무단 수집하지 않으며, 희귀도 점수도 예시입니다. 정식 버전에는 허가된 메타데이터, 서버 검증, 실제 순위표를 붙일 예정입니다.',tabs:['음악','영화','문학','애니','게임']}
} as const;

const getSaved=<T,>(key:string):T|undefined=>{try{const value=localStorage.getItem(key);return value?JSON.parse(value) as T:undefined;}catch{return undefined;}};
const setSaved=(key:string,value:unknown)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/*storage is optional*/}};
function stamp(date:string){return date.split('-').join(' / ');}
function gameKey(mode:Mode,date:string){return `deepcut:completed:${mode}:${date}`;}
function percent(n:number){return `${Math.max(0,Math.min(100,n))}%`;}

export default function App(){
  const [lang,setLang]=useState<Lang>(()=>getSaved<Lang>('deepcut:lang')==='en'?'en':'ko');
  const [session,setSession]=useState<GameSession|null>(()=>{
    const param=new URLSearchParams(window.location.search).get('r');
    if(param){const shared=decodeShare(param);if(shared)return shared.session;}
    const saved=getSaved<GameSession>('deepcut:session');
    return saved?.date===todayKey()&&saved?.prompts?.length===ROUNDS&&saved?.mode==='all'&&saved.prompts.every(id=>!id.startsWith('m-'))?saved:null;
  });
  const [duelOpen,setDuelOpen]=useState(false);
  const [publicMatch,setPublicMatch]=useState(()=>new URLSearchParams(window.location.search).get('match'));
  const [publicShare,setPublicShare]=useState(()=>{try{return new URLSearchParams(window.location.search).get('r');}catch{return null;}});
  const publicResults=publicShare?decodeShare(publicShare):null;
  const [answer,setAnswer]=useState('');
  const [feedback,setFeedback]=useState('');
  const [timeLeft,setTimeLeft]=useState(ROUND_SECONDS);
  const [infoOpen,setInfoOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const t=strings[lang];
  const date=todayKey();
  const activePrompt=useMemo(()=>session?promptById.get(session.prompts[session.index]):undefined,[session]);
  const autocomplete=useTitleAutocomplete(answer,activePrompt?.kind||'any',lang,session?.state==='play');
  const activeResult=session?.state==='reveal'?session.results[session.index]:undefined;
  const activeWork=selectedWork(activeResult?.workId) || (activeResult?.title ? {
    id:activeResult.workId||'',title:activeResult.title,titleKo:activeResult.titleKo,creator:activeResult.creator||'',
    year:activeResult.year||0,country:activeResult.country||'',genres:[] as string[]
  } : undefined);
  const activeScore=session?totalScore(session.results):0;
  const modeLabel=(_mode:Mode)=>t.all;

  useEffect(()=>setSaved('deepcut:lang',lang),[lang]);
  useEffect(()=>{if(session&&!publicShare){setSaved('deepcut:session',session);if(session.state==='finished'&&session.ranked)setSaved(gameKey(session.mode,session.date),{score:totalScore(session.results),results:session.results});}},[session,publicShare]);
  useEffect(()=>{if(!session||session.state!=='play')return;
    const tick=()=>{
      const remaining=Math.max(0,ROUND_SECONDS-(Date.now()-session.roundStartedAt)/1000);
      setTimeLeft(remaining);
      if(remaining<=0){setSession(s=>s&&s.state==='play'?{...s,state:'reveal',results:[...s.results,{promptId:s.prompts[s.index],rawAnswer:'',points:0,tier:-1,timedOut:true}]}:s);}
    };
    tick();const id=window.setInterval(tick,100);return ()=>clearInterval(id);
  },[session?.id,session?.index,session?.state,session?.roundStartedAt]);
  useEffect(()=>{if(session?.state==='play')inputRef.current?.focus();},[session?.index,session?.state]);

  const start=(mode:Mode,practice=false)=>{
    mode='all';
    setPublicShare(null);window.history.replaceState(null,'',window.location.pathname);
    const finished=getSaved<{score:number}>(gameKey(mode,date));
    const existing=getSaved<GameSession>('deepcut:session');
    if(!practice&&!finished&&existing?.date===date&&existing?.mode===mode&&existing.state!=='finished'&&existing.prompts.every(id=>!id.startsWith('m-'))){
      setSession(existing);setAnswer('');setFeedback('');setCopied(false);return;
    }
    const game=newGame(mode,date,practice||Boolean(finished)?false:true);
    setSession(game);setAnswer('');setFeedback('');setCopied(false);setTimeLeft(ROUND_SECONDS);
  };
  const lock=(result:RoundResult)=>{
    setSession(s=>s&&s.state==='play'?{...s,state:'reveal',results:[...s.results,result]}:s);
    setFeedback('');
  };
  const submit=async(event?:FormEvent,override?:string)=>{
    const entry=override??answer;
    event?.preventDefault();
    if(!session||session.state!=='play'||!activePrompt)return;
    if(Date.now()-session.roundStartedAt>=ROUND_SECONDS*1000)return;
    if(!entry.trim()){setFeedback(t.empty);return;}
    // Never let the tiny bundled demo override the live film/anime/game catalog.
    const serverKind=activePrompt.kind!=='literature';
    if(serverKind){
      try{
        const api=location.hostname==='eggseed1.github.io'?'https://dotdotdot-7yot.onrender.com':location.port==='5173'?`${location.protocol}//${location.hostname}:8787`:location.origin;
        const response=await fetch(`${api}/api/validate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({promptId:activePrompt.id,answer:entry.trim()})});
        if(!response.ok)throw Error('Live validation unavailable');
        const data=await response.json() as {status:string;work?:{id:string;title:string;titleKo?:string;creator:string;year:number;country?:string};points?:number;tier?:number};
        if(data.status==='found'&&data.work&&Number.isFinite(data.points)&&Number.isFinite(data.tier)){
          if(Date.now()-session.roundStartedAt>=ROUND_SECONDS*1000)return;
          lock({promptId:activePrompt.id,workId:data.work.id,title:data.work.title,titleKo:data.work.titleKo,creator:data.work.creator,year:data.work.year,country:data.work.country,rawAnswer:entry.trim(),points:data.points!,tier:data.tier!});return;
        }
        if(data.status==='ambiguous'){setFeedback(t.invalid);return;}
        if(data.status==='notEligible'){setFeedback(t.notEligible);return;}
        if(data.status==='unverified'){setFeedback(lang==='ko'?'데이터가 부족해 조건을 확인할 수 없습니다.':'Source metadata is incomplete. This answer cannot be verified.');return;}
        setFeedback(t.invalid);return;
      }catch{
        setFeedback(lang==='ko'?'검증 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.':'Live answer verification is unavailable. Try again shortly.');
        return;
      }
    }
    const found=lookupAnswer(entry,activePrompt.kind);
    if(found.status==='ambiguous'){const chosen=found.works.find(w=>activePrompt.match(w))||found.works[0];if(!activePrompt.match(chosen)){setFeedback(t.notEligible);return;}const pts=rarity(chosen,activePrompt);lock({promptId:activePrompt.id,workId:chosen.id,title:chosen.title,creator:chosen.creator,rawAnswer:entry.trim(),points:pts.points,tier:pts.tier});return;}
    if(found.status==='missing'){setFeedback(t.invalid);return;}
    if(!activePrompt.match(found.work)){setFeedback(t.notEligible);return;}
    const points=rarity(found.work,activePrompt);
    lock({promptId:activePrompt.id,workId:found.work.id,rawAnswer:entry.trim(),points:points.points,tier:points.tier});
  };
  const next=()=>{
    if(!session||session.state!=='reveal')return;
    setAnswer('');setFeedback('');setTimeLeft(ROUND_SECONDS);
    setSession(s=>s?{...s,index:s.index+1>=ROUNDS?s.index:s.index+1,state:s.index+1>=ROUNDS?'finished':'play',roundStartedAt:Date.now()}:s);
  };
  const home=()=>{setSession(null);setDuelOpen(false);setPublicMatch(null);setPublicShare(null);window.history.replaceState(null,'',window.location.pathname);setAnswer('');setFeedback('');};
  const share=async()=>{
    if(!session||session.state!=='finished')return;
    const code=encodeShare(session);
    const url=`${window.location.origin}${window.location.pathname}?r=${code}`;
    try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setCopied(false);}
  };
  const switchLang=(newLang:Lang)=>{setLang(newLang);setFeedback('');setCopied(false);};

  return <div lang={lang} className={`app-shell ${!session&&!publicMatch&&!duelOpen?'is-integrated-home':''}`}>
    <div className="scanline" aria-hidden="true"/>
    <header className="site-header">
      <button className="brand-lockup" onClick={home} title={lang==='ko'?'처음으로':'Home'}>
        <span className="brand-mark"><img src={devilArt} alt=""/></span>
        <span className={`brand-name ${lang==='ko'?'brand-ko':''}`}>{lang==='ko'?'꺼드럭대마왕':'larper101'}<span className="brand-period">.</span></span>
      </button>
      <div className="header-right">
        <span className="header-mini">{t.topLine}</span>
        <span className="header-divider"/>
        <div className="lang-toggle" aria-label={t.lang}>
          <button className={lang==='en'?'active':''} onClick={()=>switchLang('en')}>EN</button>
          <span>/</span>
          <button className={lang==='ko'?'active':''} onClick={()=>switchLang('ko')}>한국어</button>
        </div>
        <button className="info-button" onClick={()=>setInfoOpen(true)} aria-label={t.about}><Info size={17}/></button>
      </div>
    </header>
    {publicMatch?<PublicMatchPage matchId={publicMatch} lang={lang} onBack={home}/>:duelOpen ? <DuelArena lang={lang} onBack={()=>setDuelOpen(false)}/> : !session? <main className="game-main integrated-home-main">
      <section className="question-shell krillion-game-screen integrated-home">
        <div className="cinematic-play-stage">
          <Hellscape lang={lang} score={0} previewDepth={0}>
            <div className="krillion-hud home-hud">
              <div className="krillion-hud-block"><small>{lang==='ko'?'깊이':'DEPTH'}</small><strong>0m</strong></div>
              <div className="krillion-hud-round"><div className="krillion-round-pips">{Array.from({length:ROUNDS},(_,i)=><span key={i} className={i===0?'active':''}/>)}</div><small>{lang==='ko'?'7개의 관문':'7 SCENES'}</small></div>
              <div className="krillion-hud-score"><small>{lang==='ko'?'점수':'SCORE'}</small><strong>0</strong></div>
            </div>
            <div className="cinematic-stage-top home-stage-title">
              <div className="cinematic-stage-count">{lang==='ko'?'지옥에서 가장 잘난 척하는 법':'THE OBSCURITY GAME'}</div>
              <h1>{lang==='ko'?'꺼드럭 대마왕':'larper101'}</h1>
              <p>▶ {lang==='ko'?'남들 모르는 작품을 대고 더 깊이 내려가라':'NAME THE OBSCURE. DESCEND DEEPER.'} ◀</p>
              <div className="home-category-choice"><button type="button" disabled aria-disabled="true">{lang==='ko'?'음악 · 준비 중':'MUSIC · SOON'}</button><span>{lang==='ko'?'영화 · 애니 · 게임 · 문학':'FILM · ANIME · GAMES · BOOKS'}</span></div>
            </div>
            <div className="hell-answer-ui cinematic-answer-ui home-start-dock">
              <div className="home-start-actions">
                <span className="home-start-dial">07<small>{lang==='ko'?'문제':'ROUNDS'}</small></span>
                <button className="pixel-landing-start" onClick={()=>start('all')}>{lang==='ko'?'지옥으로 입장':'ENTER THE UNDERWORLD'} <ArrowRight size={20}/></button>
                <button className="pixel-landing-duel" onClick={()=>setDuelOpen(true)}><Swords size={16}/>{lang==='ko'?'1대1':'DUEL'}</button>
              </div>
              <p className="home-start-footnote">{lang==='ko'?'7문제 · 25초 · 더 희귀할수록 더 깊이':'7 ROUNDS · 25 SECONDS · DEEPER IS BETTER'}</p>
            </div>
          </Hellscape>
        </div>
      </section>
    </main>:<main className="game-main">
      <div className="game-topbar"><button className="small-link" onClick={home}><ArrowLeft size={15}/> {t.back}</button><div className="game-title-plate"><span className="mini-diamond">◆</span>{modeLabel(session.mode)}<span className="game-slash">/</span>{session.ranked?t.daily:t.unranked}</div><span className="date-tag">{stamp(session.date)}</span></div>
      {session.state==='finished'?<section className="results-panel">
        <div className="result-stars">✦ <span>✳</span> ✦</div><p className="eyebrow centered">{t.completed}</p><h1>{t.resultTitle}</h1>
        <div className="final-score"><strong>{activeScore}</strong><span>/ 700</span></div><p className="score-caption">{t.yourScore} · {modeLabel(session.mode)}</p>{publicResults&&<p className="share-flag">{lang==='ko'?'공유된 결과 · 서버 미검증':'SHARED RESULTS · NOT SERVER VERIFIED'}</p>}
        <Hellscape lang={lang} score={activeScore} compact/>
        <div className="result-recap">{session.results.map((r,i)=>{const work=selectedWork(r.workId);const p=promptById.get(r.promptId);return <div className="recap-row" key={i}><span className="recap-n">0{i+1}</span><span className="recap-work">{work?(lang==='ko'&&work.titleKo?work.titleKo:work.title):(r.title?(lang==='ko'&&r.titleKo?r.titleKo:r.title):t.noAnswer)}<small>{p?.badge[lang]} · {work?.creator||r.creator||'—'}</small></span><b className={r.points>=65?'high-score':''}>+{r.points}</b></div>;})}</div>
        <div className="result-actions"><button className="action-button" onClick={share}><Clipboard size={16}/>{copied?t.copied:t.copy}</button><button className="secondary-button" onClick={()=>start(session.mode,true)}><RotateCcw size={16}/>{t.playAgain}</button><button className="text-button" onClick={home}>{t.back} →</button></div>
        <p className="warning-note">{t.local}</p>
      </section>:<section className="question-shell krillion-game-screen">
        <div className="cinematic-play-stage"><button type="button" className="scene-back-button" onClick={home} aria-label={lang==='ko'?'홈으로':'Back to home'}><ArrowLeft size={16}/><span>{lang==='ko'?'나가기':'EXIT'}</span></button><Hellscape lang={lang} score={activeScore} previewDepth={session.state==='play'?Math.min(680,answer.trim().length*27):0}>
          <div className="krillion-hud"><div className="krillion-hud-block"><small>DEPTH</small><strong>{(activeScore*10).toLocaleString()}m</strong></div><div className="krillion-hud-round"><div className="krillion-round-pips">{Array.from({length:ROUNDS},(_,i)=><span key={i} className={i<=session.index?'active':''}/>)}</div><small>SCENE {session.index+1} OF {ROUNDS}</small></div><div className="krillion-hud-score"><small>SCORE</small><strong>{activeScore}</strong></div></div>
          <div className="cinematic-stage-top"><div className="cinematic-stage-count">SCENE {session.index+1} / {ROUNDS}</div><div className="cinematic-stage-kind">{activePrompt?kindNames[activePrompt.kind as Exclude<Kind,'any'>]?.[lang]:''} / {activePrompt?.badge[lang]}</div><h1>{activePrompt?.label[lang]}</h1><p>{lang==='ko'?'아는 사람이 적을수록 더 깊이':'RARER ANSWERS DESCEND DEEPER'}</p></div>
          {session.state==='play'&&<div className="hell-answer-ui cinematic-answer-ui"><div className="answer-card">
            <div className="timer-rail"><div style={{width:percent((timeLeft/ROUND_SECONDS)*100)}}/></div>
            <form onSubmit={submit}><div className={`timer ${timeLeft<=7?'urgent':''}`}><Clock3 size={15}/><span>{Math.ceil(timeLeft).toString().padStart(2,'0')}</span></div><div className="title-suggest-wrap"><input ref={inputRef} id="answer" type="text" spellCheck="false" autoComplete="off" placeholder={t.placeholder} value={answer} onChange={event=>{setAnswer(event.target.value);if(feedback)setFeedback('');}} onKeyDown={e=>autocomplete.onKeyDown(e,setAnswer,selected=>{void submit(undefined,selected);})}/><TitleSuggestions {...autocomplete} lang={lang} onSelect={item=>autocomplete.select(item,setAnswer)}/></div><button className="action-button submit-button" type="submit" disabled={!answer.trim()}>{t.submit}<ArrowRight size={17}/></button></form>
            {feedback&&<p className="answer-feedback" role="alert">! {feedback}</p>}
            <button className="skip-button" onClick={()=>lock({promptId:activePrompt?.id||'',rawAnswer:'',points:0,tier:-1})}>{t.skip} <SkipForward size={14}/></button>
          </div></div>}
        </Hellscape></div>
        {session.state==='play'?<></>:<div className="reveal-panel">
          {activeWork?<><div className="reveal-status good"><Check size={16}/>{t.accepted}</div><p className="reveal-work-label">{t.yourPick}</p><h2>{lang==='ko'&&activeWork.titleKo?activeWork.titleKo:activeWork.title}</h2><p className="reveal-creator">{activeWork.creator} <span>·</span> {activeWork.year} <span>·</span> {activeWork.country}</p><p className="genre-line">{activeWork.genres.slice(0,3).join(' · ')}</p><div className="points-won"><span className="rarity-label">{activeResult?`${rarityRank(activeResult.points)[lang]} · ${rarityRank(activeResult.points).division}`:''}</span><strong>+{activeResult?.points}</strong><span>{t.points}</span></div></>:<><div className="reveal-status missing"><X size={16}/>{activeResult?.timedOut?t.noMore:t.skipped}</div><h2 className="miss-title">{t.noAnswer}</h2><div className="points-won empty-points"><strong>+0</strong><span>{t.points}</span></div></>}
          <button className="action-button next-button" onClick={next}>{session.index===ROUNDS-1?t.seeResults:t.next}<ArrowRight size={17}/></button>
          
        </div>}
      </section>}
    </main>}
    <footer className="site-footer"><span>© 2026 larper101 <span className="footer-dot">✦</span> {lang==='ko'?'꺼드럭대마왕':'THE CULTURE SNOB OLYMPICS'}</span><span><button onClick={()=>setInfoOpen(true)}>{t.about}</button> <span className="footer-dash">/</span> {t.demo}</span></footer>
    {infoOpen&&<div className="modal-backdrop" onClick={()=>setInfoOpen(false)} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setInfoOpen(false)} aria-label={t.close}><X size={20}/></button><div className="modal-pixel"><Pixel pattern={pixelRecord}/></div><p className="eyebrow">larper101 // PREVIEW BUILD</p><h2 id="modal-heading">{t.infoTitle}</h2><p>{t.infoBody}</p><p className="source-stats">{catalog.length} {lang==='ko'?'개 샘플 항목':'HAND-CURATED DEMO ENTRIES'} · 5 {lang==='ko'?'개 분야':'MEDIUMS'}</p><button className="action-button" onClick={()=>setInfoOpen(false)}>{t.close}<ArrowRight size={16}/></button></div></div>}
  </div>;
}
