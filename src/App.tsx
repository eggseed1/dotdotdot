import {rarityRank} from './lib/rarity-ranks.mjs';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Clipboard, Clock3, Info, RotateCcw, SkipForward, X } from 'lucide-react';
import { catalog } from './data/catalog';

import { Hellscape } from './components/Hellscape';
import { AnswerDirectory } from './components/AnswerDirectory';
import thematicAliases from './data/thematic-aliases-ko.json';
import thematicAnswers from './data/thematic-answers.json';
import thematicRarity from './data/thematic-rarity.json';
import { DuelArena } from './components/DuelArena';
import { PublicMatchPage } from './components/PublicMatchPage';
import { devilArt } from './data/art';
import { Swords } from 'lucide-react';
import { newGame, promptById, ROUND_SECONDS, ROUNDS, todayKey, totalScore } from './lib/engine';
import { encodeShare, decodeShare, sampleAnswers } from './lib/sharing';
import type { GameSession, Lang, Mode, RoundResult } from './lib/types';

// Defend against stale servers returning the first catalog item instead of the submitted title.
const normalizeAnswer=(s:string)=>s.normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').trim();
type TypoSuggestion={typed:string;title:string;display:string};
const editDistanceWithinTwo=(a:string,b:string)=>{
 const x=Array.from(a),y=Array.from(b);
 if(Math.abs(x.length-y.length)>2)return 3;
 let prev=Array.from({length:y.length+1},(_,j)=>j);
 for(let i=1;i<=x.length;i++){
  const row=[i];
  for(let j=1;j<=y.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1));
  prev=row;
 }
 return prev[y.length];
};
const suggestSmallTypo=(promptId:string,raw:string):TypoSuggestion|null=>{
 const typed=normalizeAnswer(raw);
 if(Array.from(typed).length<5)return null;
 const list=(thematicAnswers as Record<string,{answers?:string[]}>)[promptId]?.answers||[];
 const aliases=(thematicAliases as Record<string,unknown>)[promptId] as Record<string,string[]>|undefined;
 let best:{title:string;display:string;distance:number}|null=null;
 for(const title of list){
  const forms=[title,...(aliases?.[title]||[])];
  for(const form of forms){
   const normalized=normalizeAnswer(form);
   if(!normalized||Math.abs(Array.from(normalized).length-Array.from(typed).length)>2)continue;
   const distance=editDistanceWithinTwo(typed,normalized);
   if(distance<1||distance>2)continue;
   if(!best||distance<best.distance){best={title,display:aliases?.[title]?.find(a=>/[가-힣]/.test(a))||title,distance};}
  }
 }
 return best?{typed:raw.trim(),title:best.title,display:best.display}:null;
};
const exactCuratedAnswer=(promptId:string,input:string)=>{
 const list=(thematicAnswers as Record<string,{answers?:string[]}>)[promptId]?.answers||[];
 const aliases=(thematicAliases as Record<string,unknown>)[promptId] as Record<string,string[]>|undefined;
 const wanted=normalizeAnswer(input);
 if(!wanted)return null;
 const matches=list.filter(title=>[title,...(aliases?.[title]||[])].some(a=>normalizeAnswer(a)===wanted));
 if(matches.length!==1)return null;
 const title=matches[0];
 const override=(thematicRarity.overrides as Record<string,Record<string,string>>)[promptId]?.[title]||thematicRarity.defaults.tier;
 const tierKey=(thematicRarity.aliases as Record<string,string>)[override]||override;
 const idx=thematicRarity.tiers.findIndex(t=>t.key===tierKey);
 const tier=idx<0?2:idx;
 return {title,titleKo:aliases?.[title]?.find(a=>/[가-힣]/.test(a))||'',points:thematicRarity.tiers[tier].points,tier:5-tier};
};
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
  const [lang,setLang]=useState<Lang>(()=>getSaved<Lang>('deepcut:lang:ko-default-v2')==='en'?'en':'ko');
  const [session,setSession]=useState<GameSession|null>(()=>{
    const param=new URLSearchParams(window.location.search).get('r');
    if(param){const shared=decodeShare(param);if(shared)return shared.session;}
    const saved=getSaved<GameSession>('deepcut:session:exact-answer-v4');
    return saved?.date===todayKey()&&saved?.prompts?.length===ROUNDS&&saved?.mode==='all'&&saved.prompts.every(id=>!id.startsWith('m-'))?saved:null;
  });
  const [duelOpen,setDuelOpen]=useState(false);
  const [publicMatch,setPublicMatch]=useState(()=>new URLSearchParams(window.location.search).get('match'));
  const [publicShare,setPublicShare]=useState(()=>{try{return new URLSearchParams(window.location.search).get('r');}catch{return null;}});
  const publicResults=publicShare?decodeShare(publicShare):null;
  const [answer,setAnswer]=useState('');
  const [feedback,setFeedback]=useState('');
  const [typoSuggestion,setTypoSuggestion]=useState<TypoSuggestion|null>(null);
  const [timeLeft,setTimeLeft]=useState(ROUND_SECONDS);
  const [infoOpen,setInfoOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const [serverExamples,setServerExamples]=useState<Record<string,Array<{title:string;titleKo?:string;creator?:string;year?:number;source?:string;points?:number;rarityCategory?:string;rarityLabelKo?:string;rarityLabelEn?:string;rarityReviewed?:boolean}>>>({});
  const inputRef=useRef<HTMLInputElement>(null);
  const t=strings[lang];
  const date=todayKey();
  const activePrompt=useMemo(()=>session?promptById.get(session.prompts[session.index]):undefined,[session]);
  const activeResult=session?.state==='reveal'?session.results[session.index]:undefined;
  // Live validation titles take precedence: bundled demo IDs must NEVER override a user's answer.
  const activeWork=activeResult?.title ? {
    id:activeResult.workId||'',title:activeResult.title,titleKo:activeResult.titleKo,creator:activeResult.creator||'',
    year:activeResult.year||0,country:activeResult.country||'',genres:[] as string[]
  } : activeResult?.rawAnswer ? {id:'',title:activeResult.rawAnswer,titleKo:'',creator:'',year:0,country:'',genres:[] as string[]} : undefined;
  const activeScore=session?totalScore(session.results):0;
  const modeLabel=(_mode:Mode)=>t.all;

  useEffect(()=>setSaved('deepcut:lang:ko-default-v2',lang),[lang]);
  useEffect(()=>{if(session&&!publicShare){setSaved('deepcut:session:exact-answer-v5',session);if(session.state==='finished'&&session.ranked)setSaved(gameKey(session.mode,session.date),{score:totalScore(session.results),results:session.results});}},[session,publicShare]);
  useEffect(()=>{if(!session||session.state!=='play')return;
    const tick=()=>{
      const remaining=Math.max(0,ROUND_SECONDS-(Date.now()-session.roundStartedAt)/1000);
      setTimeLeft(remaining);
      if(remaining<=0){setSession(s=>s&&s.state==='play'?{...s,state:'reveal',results:[...s.results,{promptId:s.prompts[s.index],rawAnswer:'',points:0,tier:-1,timedOut:true}]}:s);}
    };
    tick();const id=window.setInterval(tick,100);return ()=>clearInterval(id);
  },[session?.id,session?.index,session?.state,session?.roundStartedAt]);
  useEffect(()=>{if(session?.state==='play')inputRef.current?.focus();},[session?.index,session?.state]);
  useEffect(()=>{
    if(session?.state!=='finished')return;
    const ids=[...new Set(session.prompts)];
    const controller=new AbortController();
    const api=location.hostname==='eggseed1.github.io'?'https://dotdotdot-7yot.onrender.com':location.port==='5173'?location.protocol+'//'+location.hostname+':8787':location.origin;
    Promise.all(ids.map(async id=>{
      try{
        const response=await fetch(api+'/api/examples?promptId='+encodeURIComponent(id),{signal:controller.signal});
        if(!response.ok)return [id,[]] as const;
        const body=await response.json() as {examples?:Array<{title:string;titleKo?:string;creator?:string;year?:number;source?:string;points?:number;rarityCategory?:string;rarityLabelKo?:string;rarityLabelEn?:string;rarityReviewed?:boolean}>};
        return [id,body.examples||[]] as const;
      }catch{return [id,[]] as const;}
    })).then(rows=>{if(!controller.signal.aborted)setServerExamples(Object.fromEntries(rows));});
    return ()=>controller.abort();
  },[session?.state,session?.id]);


  const start=async(mode:Mode,practice=false)=>{
    mode='all';
    setPublicShare(null);window.history.replaceState(null,'',window.location.pathname);
    const finished=getSaved<{score:number}>(gameKey(mode,date));
    const existing=getSaved<GameSession>('deepcut:session:exact-answer-v5');
    if(!practice&&!finished&&existing?.date===date&&existing?.mode===mode&&existing.state!=='finished'&&existing.prompts.every(id=>!id.startsWith('m-'))){
      setSession(existing);setAnswer('');setFeedback('');setCopied(false);return;
    }
    const api=location.hostname==='eggseed1.github.io'?'https://dotdotdot-7yot.onrender.com':location.port==='5173'?location.protocol+'//'+location.hostname+':8787':location.origin;
    let selected:string[];
    try{
      const response=await fetch(api+'/api/questions?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(11000)});
      if(!response.ok)throw Error('question service not ready');
      const body=await response.json() as {questions?:Array<{promptId:string;answers:number}>;ready?:boolean};
      selected=(body.questions||[]).map(x=>x.promptId);
      if(!body.ready||selected.length!==7||new Set(selected).size!==7||selected.some(id=>!promptById.has(id)))throw Error('no editorial lineup');
    }catch{
      setFeedback(lang==='ko'?'오늘의 7문제가 아직 출제되지 않았거나 서버 연결에 실패했어.':'Today’s seven editorial questions are not published or the server is unavailable.');
      return;
    }
    const game=newGame(mode,date,practice||Boolean(finished)?false:true);
    game.prompts=selected;
    setSession(game);setAnswer('');setFeedback('');setCopied(false);setTimeLeft(ROUND_SECONDS);
  };
  const lock=(result:RoundResult)=>{
    setSession(s=>s&&s.state==='play'?{...s,state:'reveal',results:[...s.results,result]}:s);
    setFeedback('');
  };
  const submittingRef=useRef(false);
  // Daily games use a SINGLE authoritative local answer list. No live fuzzy search,
  // no server-side first-result substitution, no autocomplete selection on Enter.
  const submit=(event?:FormEvent)=>{
    event?.preventDefault();
    if(!session||session.state!=='play'||!activePrompt||submittingRef.current)return;
    if(Date.now()-session.roundStartedAt>=ROUND_SECONDS*1000)return;
    const typed=answer.trim();
    if(!typed){setFeedback(t.empty);return;}
    const exact=exactCuratedAnswer(activePrompt.id,typed);
    const pending=typoSuggestion?.typed===typed?typoSuggestion:null;
    if(!exact&&!pending){
      const correction=suggestSmallTypo(activePrompt.id,typed);
      if(correction){setTypoSuggestion(correction);setFeedback('');return;}
    }
    const resolved=exact||(pending?exactCuratedAnswer(activePrompt.id,pending.title):null);
    if(resolved){
      submittingRef.current=true;
      setTypoSuggestion(null);
      lock({promptId:activePrompt.id,workId:'editorial:'+activePrompt.id+':'+normalizeAnswer(resolved.title),title:resolved.title,titleKo:resolved.titleKo,rawAnswer:typed,points:resolved.points,tier:resolved.tier});
      return;
    }
    setTypoSuggestion(null);
    setFeedback(lang==='ko'?`“${typed}”은 정답이 아닙니다.`:`“${typed}” is not a correct answer.`);
  };
  const next=()=>{
    submittingRef.current=false;
    if(!session||session.state!=='reveal')return;
    setAnswer('');setTypoSuggestion(null);setFeedback('');setTimeLeft(ROUND_SECONDS);
    setSession(s=>s?{...s,index:s.index+1>=ROUNDS?s.index:s.index+1,state:s.index+1>=ROUNDS?'finished':'play',roundStartedAt:Date.now()}:s);
  };
  const home=()=>{submittingRef.current=false;setTypoSuggestion(null);setSession(null);setDuelOpen(false);setPublicMatch(null);setPublicShare(null);window.history.replaceState(null,'',window.location.pathname);setAnswer('');setFeedback('');};
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
              <div className="krillion-hud-round"><div className="krillion-round-pips">{Array.from({length:ROUNDS},(_,i)=><span key={i} className={i===0?'active':''}/>)}</div></div>
              <div className="krillion-hud-score"><small>{lang==='ko'?'점수':'SCORE'}</small><strong>0</strong></div>
            </div>
            <div className="cinematic-stage-top home-stage-title">
              
              <h1>{lang==='ko'?'꺼드럭 대마왕':'larper101'}</h1>
              
              
            </div>
            <div className="hell-answer-ui cinematic-answer-ui home-start-dock">
              <div className="home-start-actions">
                
                <button className="pixel-landing-start" onClick={()=>start('all')}>{lang==='ko'?'지옥으로 입장':'ENTER THE UNDERWORLD'} <ArrowRight size={20}/></button>
                <button className="pixel-landing-duel" onClick={()=>setDuelOpen(true)}><Swords size={16}/>{lang==='ko'?'1대1':'DUEL'}</button>
              </div>
              
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
        <div className="result-recap">{session.results.map((r,i)=>{const work=r.title?{title:r.title,titleKo:r.titleKo}:r.rawAnswer?{title:r.rawAnswer,titleKo:''}:undefined;const p=promptById.get(r.promptId);const localExamples=sampleAnswers(r.promptId,10000);const examples: Array<{title:string;titleKo?:string;creator?:string;year?:number;points?:number;rarityCategory?:string;rarityLabelKo?:string;rarityLabelEn?:string;rarityReviewed?:boolean}> = serverExamples[r.promptId]?.length?serverExamples[r.promptId]:localExamples;return <details className="recap-expand" key={i}><summary className="recap-row"><span className="recap-n">{String(i+1).padStart(2,'0')}</span><span className="recap-work"><strong>{work?(lang==='ko'&&work.titleKo?work.titleKo:work.title):(r.title||t.noAnswer)}</strong><small>{p?.label[lang]}</small></span><b>+{r.points}</b><span className="recap-chevron">▾</span></summary><div className="recap-detail"><p>{p?.label[lang]}</p><p className="recap-reason">{r.rawAnswer?(lang==='ko'?'제출한 답: ':'Submitted: ')+r.rawAnswer:(lang==='ko'?(r.timedOut?'시간 종료로 제출하지 못했어.':'답을 제출하지 않았어.'):'No answer submitted.')}</p><h3>{lang==='ko'?'전체 정답 목록':'ALL KNOWN ANSWERS'}</h3><AnswerDirectory answers={examples} lang={lang}/></div></details>;})}</div>
        <div className="result-actions"><button className="action-button" onClick={share}><Clipboard size={16}/>{copied?t.copied:t.copy}</button><button className="secondary-button" onClick={()=>start(session.mode,true)}><RotateCcw size={16}/>{t.playAgain}</button><button className="text-button" onClick={home}>{t.back} →</button></div>
        <p className="warning-note">{t.local}</p>
      </section>:<section className="question-shell krillion-game-screen">
        <div className="cinematic-play-stage"><button type="button" className="scene-back-button" onClick={home} aria-label={lang==='ko'?'홈으로':'Back to home'}><ArrowLeft size={16}/><span>{lang==='ko'?'나가기':'EXIT'}</span></button><Hellscape lang={lang} score={activeScore} previewDepth={session.state==='play'?Math.min(680,answer.trim().length*27):0} recentPoints={session.state==='reveal'?(activeResult?.points||0):0}>
          <div className="krillion-hud"><div className="krillion-hud-block"><small>{lang==='ko'?'깊이':'DEPTH'}</small><strong>{(activeScore*10).toLocaleString()}m</strong></div><div className="krillion-hud-round"><div className="krillion-round-pips">{Array.from({length:ROUNDS},(_,i)=><span key={i} className={i<=session.index?'active':''}/>)}</div><small>{lang==='ko'?`문제 ${session.index+1} / ${ROUNDS}`:`ROUND ${session.index+1} / ${ROUNDS}`}</small></div><div className="krillion-hud-score"><small>{lang==='ko'?'점수':'SCORE'}</small><strong>{activeScore}</strong></div></div>
          <div className="cinematic-stage-top"><div className="cinematic-stage-count">{lang==='ko'?`문제 ${session.index+1} / ${ROUNDS}`:`ROUND ${session.index+1} / ${ROUNDS}`}</div><h1>{activePrompt?.label[lang]}</h1></div>
          {session.state==='play'&&<div className="hell-answer-ui cinematic-answer-ui"><div className="answer-card">
            <div className="timer-rail"><div style={{width:percent((timeLeft/ROUND_SECONDS)*100)}}/></div>
            <form onSubmit={submit}><div className={`timer ${timeLeft<=7?'urgent':''}`}><Clock3 size={15}/><span>{Math.ceil(timeLeft).toString().padStart(2,'0')}</span></div><div className="title-suggest-wrap"><input ref={inputRef} id="answer" type="text" spellCheck={false} autoComplete="off" placeholder={t.placeholder} value={answer} onChange={event=>{setAnswer(event.target.value);setTypoSuggestion(null);setFeedback('');}} onKeyDown={e=>{if(e.key==='Enter'&&(e.nativeEvent.isComposing||e.repeat))e.preventDefault();}}/></div><button className="action-button submit-button" type="submit" disabled={!answer.trim()}>{t.submit}<ArrowRight size={17}/></button></form>
            {typoSuggestion&&<div className="typo-confirm" role="status"><span>{lang==='ko'?'혹시 이걸 말씀하셨나요?':'DID YOU MEAN THIS?'}</span><strong>{typoSuggestion.display}</strong><small>{typoSuggestion.title!==typoSuggestion.display?typoSuggestion.title:''}</small><button type="button" onClick={()=>{void submit();}}>{lang==='ko'?'Enter 한 번 더 · 이 답으로 제출':'PRESS ENTER AGAIN TO CONFIRM'} ↵</button></div>}
            {feedback&&<p className="answer-feedback" role="alert">! {feedback}</p>}
            <button className="skip-button" onClick={()=>lock({promptId:activePrompt?.id||'',rawAnswer:'',points:0,tier:-1})}>{t.skip} <SkipForward size={14}/></button>
          </div></div>}
        {session.state==='play'?<></>:<div className="reveal-panel reveal-panel--inside-hell">
          {activeWork?<><div className="reveal-status good"><Check size={16}/>{t.accepted}</div><p className="reveal-work-label">{lang==='ko'?`내가 입력한 답: ${activeResult?.rawAnswer||''}`:`YOU TYPED: ${activeResult?.rawAnswer||''}`}</p><h2>{lang==='ko'&&activeWork.titleKo?activeWork.titleKo:activeWork.title}</h2><p className="reveal-creator">{activeWork.creator} <span>·</span> {activeWork.year} <span>·</span> {activeWork.country}</p><p className="genre-line">{activeWork.genres.slice(0,3).join(' · ')}</p><div className={`points-won points-won--tier-${activeResult?.points||0}`}><span className="rarity-label">{activeResult?`${activeResult.points>=100?(lang==="ko"?"이걸 안다고?":"WHAT EVEN"):activeResult.points>=85?(lang==="ko"?"진짜 마이너":"DEEP CUT"):activeResult.points>=60?(lang==="ko"?"꽤 마이너":"OBSCURE"):activeResult.points>=30?(lang==="ko"?"좀 아는 편":"NICHE"):activeResult.points>=15?(lang==="ko"?"흔한 답":"COMMON"):(lang==="ko"?"너무 쉬움":"OBVIOUS")} · ${rarityRank(activeResult.points)[lang]}`:''}</span><strong>+{activeResult?.points}</strong><span>{t.points}</span></div></>:<><div className="reveal-status missing"><X size={16}/>{activeResult?.timedOut?t.noMore:t.skipped}</div><h2 className="miss-title">{t.noAnswer}</h2><div className="points-won empty-points"><strong>+0</strong><span>{t.points}</span></div></>}
          <button className="action-button next-button" onClick={next}>{session.index===ROUNDS-1?t.seeResults:t.next}<ArrowRight size={17}/></button>
          
        </div>}
        </Hellscape></div>
      </section>}
    </main>}
    <footer className="site-footer"><span>© 2026 larper101 <span className="footer-dot">✦</span> {lang==='ko'?'꺼드럭대마왕':'THE CULTURE SNOB OLYMPICS'}</span><span><button onClick={()=>setInfoOpen(true)}>{t.about}</button> <span className="footer-dash">/</span> {t.demo}</span></footer>
    {infoOpen&&<div className="modal-backdrop" onClick={()=>setInfoOpen(false)} role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setInfoOpen(false)} aria-label={t.close}><X size={20}/></button><div className="modal-pixel"><Pixel pattern={pixelRecord}/></div><p className="eyebrow">larper101 // PREVIEW BUILD</p><h2 id="modal-heading">{t.infoTitle}</h2><p>{t.infoBody}</p><p className="source-stats">{catalog.length} {lang==='ko'?'개 샘플 항목':'HAND-CURATED DEMO ENTRIES'} · 5 {lang==='ko'?'개 분야':'MEDIUMS'}</p><button className="action-button" onClick={()=>setInfoOpen(false)}>{t.close}<ArrowRight size={16}/></button></div></div>}
  </div>;
}
