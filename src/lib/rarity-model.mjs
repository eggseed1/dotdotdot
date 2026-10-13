/** Stable rarity scoring. Higher verified user-count means more familiar.
 * Scores are calculated relative to eligible works for a specific prompt, not across media.
 * In imported catalogs a minimum evidence threshold prevents metadata-only shells farming 100s.
 */
export const SCORE_TIERS=[100,85,65,40,20,10];
export function rarityFromCounts(answerCount,eligibleCounts,{minimumEvidence=1}={}){
  if(!Number.isSafeInteger(answerCount)||answerCount<minimumEvidence || !Array.isArray(eligibleCounts))return {points:0,tier:-1,percentile:0,reason:'insufficient_evidence'};
  const pool=eligibleCounts.filter(n=>Number.isFinite(n)&&n>=minimumEvidence);
  if(!pool.length)return {points:0,tier:-1,percentile:0,reason:'empty_pool'};
  const moreCommon=pool.filter(n=>n>answerCount).length;
  const percentile=pool.length===1?0:moreCommon/(pool.length-1);
  const tier=percentile>=.94?0:percentile>=.79?1:percentile>=.57?2:percentile>=.33?3:percentile>=.12?4:5;
  return {points:SCORE_TIERS[tier],tier,percentile,reason:'ok'};
}
