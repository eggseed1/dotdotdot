export type RarityTag={en:string;ko:string;depth:string};
export declare const SCORE_TIERS: number[];
export declare const RARITY_TAGS: RarityTag[];
export declare function tierFromPercentile(percentile:number):number;
export type RarityResult={points:number;tier:number;percentile:number;reason:string;tag?:RarityTag};
export declare function rarityFromRank(answerCount:number,totalEligible:number,moreCommon:number,options?:{minimumEvidence?:number}):RarityResult;
export declare function rarityFromCounts(answerCount:number,eligibleCounts:number[],options?:{minimumEvidence?:number}):RarityResult;
