import type { GameSession, Mode, RoundResult } from './types';
import { promptById, rarity, selectedWork, selectPrompts, eligible } from './engine';

/** Portable and reversible share codes. Public pages are marked UNVERIFIED until server-backed. */
export type SharedResults = { version:1; date:string; mode:Mode; entries:Array<{prompt:string;work?:string}>; };
export function encodeShare(session:GameSession):string {
  const data:SharedResults={version:1,date:session.date,mode:session.mode,entries:session.results.map(r=>({prompt:r.promptId,...(r.workId?{work:r.workId}:{})}))};
  const bytes=new TextEncoder().encode(JSON.stringify(data));
  let binary=''; for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeShare(code:string): {session:GameSession;score:number}|null {
  if(!/^[a-zA-Z0-9_-]{10,2800}$/.test(code))return null;
  try{
    const data=JSON.parse(atob(code.replace(/-/g,'+').replace(/_/g,'/'))) as SharedResults;
    if(data.version!==1 || !/^20\d\d-\d\d-\d\d$/.test(data.date) || !['music','all'].includes(data.mode) || !Array.isArray(data.entries) || data.entries.length!==7)return null;
    const expected=selectPrompts(data.mode,data.date).map(p=>p.id);
    if(new Set(expected).size!==7 || data.entries.some((e,i)=>!e||e.prompt!==expected[i] || (e.work!==undefined && (typeof e.work!=='string'||e.work.length>80))))return null;
    const results:RoundResult[]=data.entries.map(e=>{
      const w=selectedWork(e.work);const p=promptById.get(e.prompt);
      if(!w||!p||w.kind!==p.kind||!p.match(w))return {promptId:e.prompt,rawAnswer:'',points:0,tier:-1};
      const r=rarity(w,p);return {promptId:e.prompt,workId:w.id,rawAnswer:w.title,points:r.points,tier:r.tier};
    });
    return {session:{id:'public-share',date:data.date,mode:data.mode,ranked:false,prompts:expected,index:6,roundStartedAt:0,state:'finished',results},score:results.reduce((sum,r)=>sum+r.points,0)};
  }catch{return null;}
}
export function sampleAnswers(promptId:string,limit=6){
  const p=promptById.get(promptId);if(!p)return [];
  return [...eligible(p)].sort((a,b)=>rarity(b,p).points-rarity(a,p).points || a.title.localeCompare(b.title)).slice(0,limit)
   .map(w=>({...w,points:rarity(w,p).points}));
}

