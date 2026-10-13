/**
 * Rarity is relative to eligible works for THIS prompt. The rarity percentile
 * is the fraction of eligible works with more audience votes than this answer.
 * Metadata-only works are searchable but not ranked until verified.
 * Tiers intentionally reserve "ABYSSAL" for the deepest 1% of a sizeable pool.
 */
export const SCORE_TIERS=[100,96,88,75,60,44,27,10];
export const RARITY_TAGS=[
 {en:'ABYSSAL',ko:'심연의 지배자',depth:'VII'},
 {en:'UNEARTHED',ko:'발굴된 유물',depth:'VI'},
 {en:'DEEP CUT',ko:'찐고인물',depth:'V'},
 {en:'UNDERGROUND',ko:'언더그라운드',depth:'IV'},
 {en:'CULT FAVORITE',ko:'컬트 취향',depth:'III'},
 {en:'DIGGING',ko:'음반 좀 파봄',depth:'II'},
 {en:'FAMILIAR',ko:'제법 유명함',depth:'I'},
 {en:'TOURIST',ko:'입문자',depth:'0'}
];
export function tierFromPercentile(p){
 if(p>=.99)return 0;
 if(p>=.95)return 1;
 if(p>=.83)return 2;
 if(p>=.65)return 3;
 if(p>=.43)return 4;
 if(p>=.23)return 5;
 if(p>=.08)return 6;
 return 7;
}
export function rarityFromRank(answerCount,totalEligible,moreCommon,{minimumEvidence=1}={}){
 if(!Number.isSafeInteger(answerCount)||answerCount<minimumEvidence||!Number.isSafeInteger(totalEligible)||totalEligible<1
   ||!Number.isSafeInteger(moreCommon)||moreCommon<0)return {points:0,tier:-1,percentile:0,reason:'insufficient_evidence'};
 const percentile=totalEligible===1?0:Math.max(0,Math.min(1,moreCommon/(totalEligible-1)));
 const tier=tierFromPercentile(percentile);
 return {points:SCORE_TIERS[tier],tier,percentile,reason:'ok',tag:RARITY_TAGS[tier]};
}
export function rarityFromCounts(answerCount,eligibleCounts,options={}){
 if(!Array.isArray(eligibleCounts))return {points:0,tier:-1,percentile:0,reason:'insufficient_evidence'};
 const min=options.minimumEvidence??1;
 const pool=eligibleCounts.filter(n=>Number.isSafeInteger(n)&&n>=min);
 return rarityFromRank(answerCount,pool.length,pool.filter(n=>n>answerCount).length,options);
}
