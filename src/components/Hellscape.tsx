import type {ReactNode,CSSProperties} from 'react';
import {devilArt} from '../data/art';
import infernalCity from '../assets/infernal-city.svg';
import type {Lang} from '../lib/types';
import {rarityRank} from '../lib/rarity-ranks.mjs';

const zones=[
 {at:0,en:'THE GATES',ko:'지옥문',tone:'#a14c37'},
 {at:850,en:'EMBER FALLS',ko:'잿불 폭포',tone:'#c55c33'},
 {at:1850,en:'CRYPT OF BONES',ko:'백골의 지하묘지',tone:'#8b4661'},
 {at:3050,en:'THE FORGOTTEN',ko:'망각의 땅',tone:'#5b3d73'},
 {at:4450,en:'ABYSSAL RIFT',ko:'심연의 균열',tone:'#4e365e'},
 {at:5650,en:'DEMON CITADEL',ko:'마왕성',tone:'#933645'},
 {at:6650,en:'THE INFERNAL CORE',ko:'지옥의 핵',tone:'#ed8b4f'}
];
export function Hellscape({score=0,opponentScore,lang,compact=false,opponentName,previewDepth=0,children}:{score?:number;opponentScore?:number;lang:Lang;compact?:boolean;opponentName?:string;previewDepth?:number;children?:ReactNode}){
 const depth=Math.max(0,Math.min(7000,score*10));
 const travel=Math.max(0,Math.min(7000,depth+previewDepth));
 const rank=rarityRank(score>0?score/7:10);
 const zone=zones.reduce((a,b)=>travel>=b.at?b:a,zones[0]);
 const skyStars=Array.from({length:45},(_,i)=>({x:(i*67+13)%100,y:(i*37+19)%78}));
 const sparks=Array.from({length:32},(_,i)=>({x:(i*47+9)%97,y:(i*61+7)%97,d:(i%8)*-.37}));
 return <div className={`hellscape infernal-game-scene ${compact?'hellscape--compact':''}`} role={children?'group':'img'} aria-label={lang==='ko'?`악마가 지옥 ${depth}미터에 있습니다`:`Devil descended ${depth} meters into hell`}>
   <div className="infernal-sky" aria-hidden="true" style={{'--pixel-scene':`url(${infernalCity})`,backgroundPosition:`center ${50+Math.min(25,travel*.004)}%`}}>
     <div className="infernal-moon"/>
     {skyStars.map((v,i)=><i key={i} className="infernal-star" style={{left:`${v.x}%`,top:`${v.y}%`}}/>)}
     <div className="infernal-mountains far"/><div className="infernal-mountains near"/>
     <div className="infernal-ash-haze"/>
     <div className="infernal-bone-arch"><i/><i/><i/><i/><i/><i/><i/></div>
     <div className="infernal-gallows gallows-left"><i/><i/><i/></div>
     <div className="infernal-gallows gallows-right"><i/><i/><i/></div>
     <div className="infernal-citadel"><div className="citadel-tower tower-left"><i/><i/><i/></div><div className="citadel-tower tower-main"><i/><i/><i/></div><div className="citadel-tower tower-right"><i/><i/><i/></div><div className="citadel-gate"/><div className="citadel-bridge"/></div>
     <div className="infernal-lava-river"><i/><i/><i/><i/><i/><i/><i/><i/></div>
     <div className="infernal-lava-falls left"><i/><i/><i/></div><div className="infernal-lava-falls right"><i/><i/><i/></div>
     <div className="infernal-skeleton-tree left"><i/><i/><i/></div><div className="infernal-skeleton-tree right"><i/><i/><i/></div>
   </div>
   <div className="infernal-world" style={{transform:`translate3d(0,${100-travel*.135}px,0)`}} aria-hidden="true">
     {zones.map((z,i)=><div key={z.at} className={`infernal-zone zone-${i}`} style={{top:`${z.at*.135}px`,'--zone-tone':z.tone} as CSSProperties}>
       <div className="infernal-zone-sign"><b>{z.at.toLocaleString()}m</b><span>{z[lang]}</span></div>
       <div className="infernal-ruins"><i/><i/><i/><i/><i/><i/><i/></div>
       <div className="infernal-stalactites"><i/><i/><i/><i/><i/></div>
     </div>)}
   </div>
   <div className="infernal-depth-wash" style={{opacity:Math.min(.75,travel/8500)}} aria-hidden="true"/>
   <div className="infernal-sparks" aria-hidden="true">{sparks.map((p,i)=><i key={i} style={{left:`${p.x}%`,top:`${p.y}%`,animationDelay:`${p.d}s`}}/>)}</div>
   <div className="infernal-cliff left"/><div className="infernal-cliff right"/>
   <div className="infernal-black-spires left"><i/><i/><i/><i/></div>
   <div className="infernal-black-spires right"><i/><i/><i/><i/></div>
   <div className="infernal-devil" aria-hidden="true"><div className="infernal-devil-glow"/><img src={devilArt} alt=""/><span className="infernal-devil-trail"/></div>
   <div className="infernal-depth-meter"><small>{lang==='ko'?'현재 심도':'DEPTH'}</small><strong>{depth.toLocaleString()}m</strong><span>{zone[lang]} · {rank[lang]}</span></div>
   {opponentScore!==undefined&&<div className="hell-versus"><span>YOU · {depth}m</span><span>{opponentName||'RIVAL'} · {Math.max(0,opponentScore*10)}m</span></div>}
   {children}
 </div>;
}
