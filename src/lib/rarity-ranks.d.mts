export type RarityRank={min:number;en:string;ko:string;symbol:string;division:'I'|'II'|'III'|'—';minimum:number};
export declare const RARITY_RANKS: Array<Omit<RarityRank,'division'|'minimum'>>;
export declare function rarityRank(points:number):RarityRank;
