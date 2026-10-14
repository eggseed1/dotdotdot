import { devilArt, hellBackdrop } from '../data/art';
import type { Lang } from '../lib/types';
import {rarityRank} from '../lib/rarity-ranks.mjs';

const layers = [
  { at: 0, en: 'THE GATES', ko: '지옥문' },
  { at: 700, en: 'EMBER FALLS', ko: '잿불 폭포' },
  { at: 1700, en: 'THE CRYPTS', ko: '납골당' },
  { at: 3200, en: 'BONE WASTES', ko: '뼈의 황무지' },
  { at: 5000, en: 'THE ABYSS', ko: '심연' },
  { at: 6500, en: 'INFERNAL THRONE', ko: '마왕의 왕좌' },
];
export function Hellscape({ score = 0, opponentScore, lang, compact = false, opponentName }: { score?: number; opponentScore?: number; lang: Lang; compact?: boolean; opponentName?: string }) {
  const depth = Math.max(0, Math.min(7000, score * 10));
  const rank=rarityRank(score>0?score/7:10);
  const opposingDepth = Math.max(0, Math.min(7000, (opponentScore ?? 0) * 10));
  const phase = Math.min(5, layers.filter(l => depth >= l.at).length - 1);
  const current = layers[phase];
  const cameraY = 90 - depth * 0.18;
  const landmarks = layers.map((layer,i)=>({ ...layer, color:['#a75a43','#bd6b43','#775469','#7b454b','#49315c','#d08b49'][i] }));
  return <div className={`hellscape ${compact ? 'hellscape--compact' : ''} infernal-phase-${phase}`} role="img" aria-label={lang === 'ko' ? `악마가 지옥 ${depth}미터까지 내려왔습니다` : `Devil has descended ${depth} meters into hell`}>
    <div className="hell-backdrop" style={{ backgroundImage: `url(${hellBackdrop})`, transform: `translate3d(0,${Math.min(0, -depth / 95)}px,0) scale(1.22)` }} />
    <div className="hell-pixel-sky" />
    <div className="hell-world" style={{transform:`translate3d(0,${cameraY}px,0)`}}>
      {landmarks.map((layer,i)=><div className="hell-world-layer" key={layer.at} style={{top:`${layer.at*.18}px`,borderColor:layer.color}}><span className="hell-world-depth">▼ {layer.at.toLocaleString()}m</span><strong>{layer[lang]}</strong><div className={`hell-world-feature feature-${i}`}><i/><i/><i/></div></div>)}
      {Array.from({length:26},(_,i)=><div className="hell-world-ember" key={i} style={{top:`${80+i*49}px`,left:`${6+(i*37)%85}%`,animationDelay:`-${(i%7)*.41}s`}}/>)}
    </div>
    <div className="hell-particle hell-particle-a">✦</div><div className="hell-particle hell-particle-b">✧</div><div className="hell-particle hell-particle-c">+</div>
    <div className="hell-headline"><span>▼ {lang === 'ko' ? '지옥 탐험 중' : 'DESCENDING INTO HELL'}</span><strong>{current[lang]}</strong><small className="hell-rank-label">{rank.symbol} {rank[lang]} · {rank.division}</small></div>
    <div className="hell-character-zone">
      <div className="hell-character-halo" />
      <img className="hell-character" src={devilArt} draggable="false" alt={lang === 'ko' ? '빨간 픽셀 악마' : 'Red pixel devil adventurer'} />
      <div className="hell-character-shadow" />
    </div>
    <div className="hell-depth"><small>{lang === 'ko' ? '현재 심도' : 'CURRENT DEPTH'}</small><b>{depth.toLocaleString()}<em>m</em></b></div>
    <div className="hell-route">
      <div className="hell-route-track"><div className="hell-route-fill" style={{ height: `${depth / 7000 * 100}%` }} />
        <div className="hell-route-marker" style={{ top: `${Math.max(1, Math.min(96, depth / 7000 * 100))}%` }}>▼</div>
        {opponentScore !== undefined && <div className="hell-route-marker hell-route-rival" style={{ top: `${Math.max(1, Math.min(96, opposingDepth / 7000 * 100))}%` }}>◆</div>}
      </div>
      <div className="hell-route-label"><span>0m</span><span>7000m</span></div>
    </div>
    {opponentScore !== undefined && <div className="hell-versus"><span>YOU · {depth}m</span><span>{opponentName || 'RIVAL'} · {opposingDepth}m</span></div>}
    <div className="hell-bottom-copy">{lang === 'ko' ? '희귀할수록 더 깊이 내려갑니다' : 'THE RARER YOUR ANSWER, THE DEEPER YOU FALL'}</div>
  </div>;
}
