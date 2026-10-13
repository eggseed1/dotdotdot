import type {GameSession,Mode,RoundResult} from './types';
import {promptById,rarity,selectedWork,selectPrompts,eligible} from './engine';
/** Public share URLs are self-contained but NOT server-signed; UI marks them unverified. */
type Entry={prompt:string;work?:string;title?:string;titleKo?:string;creator?:string;year?:number;points?:number;tier?:number};
export type SharedResults={version:1|2;date:string;mode:Mode;entries:Entry[]};
export function encodeShare(session:GameSession):string{
 const data:SharedResults={version:2,date:session.date,mode:session.mode,entries:session.results.map(r=>({
  prompt:r.promptId,...(r.workId?{work:r.workId}:{}),
  ...(r.title?{title:r.title,titleKo:r.titleKo,creator:r.creator,year:r.year,points:r.points,tier:r.tier}:{})
 }))};
 const bytes=new TextEncoder().encode(JSON.stringify(data));let binary='';
 for(const b of bytes)binary+=String.fromCharCode(b);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeShare(code:string):{session:GameSession;score:number}|null{
 if(!/^[a-zA-Z0-9_-]{10,6000}$/.test(code))return null;
 try{
  const data=JSON.parse(atob(code.replace(/-/g,'+').replace(/_/g,'/'))) as SharedResults;
  if(![1,2].includes(data.version)||!/^20\d\d-\d\d-\d\d$/.test(data.date)||!['music','all'].includes(data.mode)
    ||!Array.isArray(data.entries)||data.entries.length!==7)return null;
  const expected=selectPrompts(data.mode,data.date).map(p=>p.id);
  if(new Set(expected).size!==7||data.entries.some((e,i)=>!e||e.prompt!==expected[i]||(e.work!==undefined&&(typeof e.work!=='string'||e.work.length>100))))return null;
  const results:RoundResult[]=data.entries.map(e=>{
   const w=selectedWork(e.work),p=promptById.get(e.prompt);
   if(w&&p&&w.kind===p.kind&&p.match(w)){
    const r=rarity(w,p);return {promptId:e.prompt,workId:w.id,rawAnswer:w.title,points:r.points,tier:r.tier};
   }
   // Imported catalog metadata is displayable offline; score remains UNVERIFIED until signed server attempts exist.
   if(data.version===2&&typeof e.title==='string'&&e.title.length<=180&&typeof e.points==='number'
     &&Number.isInteger(e.points)&&e.points>=0&&e.points<=100&&typeof e.tier==='number'&&Number.isInteger(e.tier)&&e.tier>=0&&e.tier<=5){
    return {promptId:e.prompt,workId:e.work,title:e.title,titleKo:typeof e.titleKo==='string'?e.titleKo.slice(0,180):undefined,
      creator:typeof e.creator==='string'?e.creator.slice(0,180):undefined,year:typeof e.year==='number'?e.year:undefined,
      rawAnswer:e.title,points:e.points,tier:e.tier};
   }
   return {promptId:e.prompt,rawAnswer:'',points:0,tier:-1};
  });
  return {session:{id:'public-share',date:data.date,mode:data.mode,ranked:false,prompts:expected,index:6,roundStartedAt:0,state:'finished',results},score:results.reduce((n,r)=>n+r.points,0)};
 }catch{return null;}
}
export function sampleAnswers(promptId:string,limit=6){
 const p=promptById.get(promptId);if(!p)return [];
 return [...eligible(p)].sort((a,b)=>rarity(b,p).points-rarity(a,p).points||a.title.localeCompare(b.title)).slice(0,limit)
  .map(w=>({...w,points:rarity(w,p).points}));
}
