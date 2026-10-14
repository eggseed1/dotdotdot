import type {ReactNode} from 'react';
import {devilArt} from '../data/art';
import type {Lang} from '../lib/types';
import {rarityRank} from '../lib/rarity-ranks.mjs';

/** Original neon-city journey: a camera-follow road scene, no fantasy/hell elements. */
export function Hellscape({score=0,opponentScore,lang,compact=false,opponentName,previewDepth=0,children}:{score?:number;opponentScore?:number;lang:Lang;compact?:boolean;opponentName?:string;previewDepth?:number;children?:ReactNode}){
 const distance=Math.max(0,Math.min(7000,score*10));
 const moving=Math.max(0,Math.min(7000,distance+previewDepth));
 const rank=rarityRank(score>0?score/7:10);
 const lights=Array.from({length:40},(_,i)=>({x:(i*73+17)%100,y:(i*47+13)%42,size:i%4===0?3:1}));
 return <div className={`hellscape cityscape-scene ${compact?'hellscape--compact':''}`} role={children?'group':'img'} aria-label={lang==='ko'?`도시를 ${distance}미터 이동했습니다`:`Travelled ${distance} meters through the city`}>
  <div className="neon-sky" aria-hidden="true"><div className="neon-moon"/>{lights.map((l,i)=><i className="neon-star" key={i} style={{left:`${l.x}%`,top:`${l.y}%`,width:l.size,height:l.size}}/>)}</div>
  <div className="neon-hills" aria-hidden="true"/>
  <div className="neon-skyline skyline-back" aria-hidden="true" style={{transform:`translateX(-${moving*.016%80}px)`}}>{Array.from({length:19},(_,i)=><i key={i} style={{height:`${28+(i*47)%51}%`}}/>)}</div>
  <div className="neon-skyline skyline-front" aria-hidden="true" style={{transform:`translateX(-${moving*.039%130}px)`}}>{Array.from({length:17},(_,i)=><i key={i} style={{height:`${38+(i*29)%53}%`}}/>)}</div>
  <div className="neon-sidewalk" aria-hidden="true"/><div className="neon-road" aria-hidden="true"><div className="neon-road-stripes" style={{backgroundPositionX:`-${moving*.35}px`}}/></div>
  <div className="neon-player" aria-hidden="true"><div className="neon-travel-car"><span className="car-roof"/><span className="car-window"/><span className="car-driver"/><img className="neon-devil-rider" src={devilArt} alt=""/><span className="car-body"/><span className="car-light"/><span className="car-wheel wheel-left"/><span className="car-wheel wheel-right"/></div></div>
  <div className="city-distance-readout"><small>{lang==='ko'?'이동 거리':'DISTANCE'}</small><b>{distance.toLocaleString()}m</b><span>{rank[lang]} · {rank.division}</span></div>
  {opponentScore!==undefined&&<div className="hell-versus"><span>YOU · {distance}m</span><span>{opponentName||'RIVAL'} · {Math.max(0,opponentScore*10)}m</span></div>}
  {children}
 </div>;
}
