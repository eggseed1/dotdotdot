/** Rank identity from evidence-based 10..100 rarity points.
 * These are presentation ranks, not multiplayer Elo.
 */
export const RARITY_RANKS=[
 {min:95,en:'ABYSS SOVEREIGN',ko:'심연의 군주',symbol:'♛'},
 {min:89,en:'ARCHDEMON',ko:'대악마',symbol:'✹'},
 {min:81,en:'VOID WALKER',ko:'허공의 방랑자',symbol:'◆'},
 {min:72,en:'CRYPT KEEPER',ko:'납골당의 수호자',symbol:'♜'},
 {min:63,en:'RELIC HUNTER',ko:'유물 사냥꾼',symbol:'✦'},
 {min:54,en:'UNDERWORLD SAGE',ko:'지하세계의 현자',symbol:'✥'},
 {min:45,en:'CULT ADEPT',ko:'컬트 신도',symbol:'✧'},
 {min:36,en:'CATACOMB SCOUT',ko:'지하묘지 탐험가',symbol:'◇'},
 {min:27,en:'EMBER SEEKER',ko:'잿불 탐색자',symbol:'♢'},
 {min:19,en:'DUNGEON TOURIST',ko:'던전 관광객',symbol:'◈'},
 {min:10,en:'SURFACE DWELLER',ko:'지상 거주자',symbol:'·'}
];
export function rarityRank(points){
 if(!Number.isFinite(points)||points<=0)return {...RARITY_RANKS.at(-1),division:'—',minimum:10};
 const p=Math.max(10,Math.min(100,points));
 const i=RARITY_RANKS.findIndex(x=>p>=x.min),base=RARITY_RANKS[i];
 const top=i===0?101:RARITY_RANKS[i-1].min;
 const part=(p-base.min)/(top-base.min);
 const division=i===0?'I':part>=2/3?'I':part>=1/3?'II':'III';
 return {...base,division,minimum:base.min};
}
