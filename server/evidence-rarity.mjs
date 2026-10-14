/** Approximate cross-provider obscurity with explicit low-evidence shrinkage.
 * NOT a measured RYM percentile: source populations differ.
 */
export function evidenceRarity(count,{typical=1000,ceiling=100000,minimum=3}={}){
 if(!Number.isSafeInteger(count)||count<=0)return {points:44,tier:5,unrated:true,confidence:0};
 // A small source-specific pseudo-audience prevents one-vote entries
 // being rewarded as maximally obscure, while guaranteeing monotonicity.
 const adjusted=count+Math.max(1,typical*0.04);
 const mid=Math.log1p(typical),span=Math.max(0.1,Math.log1p(ceiling)-mid);
 const fraction=1/(1+Math.exp((Math.log1p(adjusted)-mid)*2/span));
 const bounded=Math.max(10,Math.min(90,Math.round(10+80*fraction)));
 const confidence=Math.min(1,Math.log1p(count)/Math.log1p(minimum*12));
 const tier=bounded>=88?0:bounded>=75?1:bounded>=60?2:bounded>=44?3:bounded>=27?4:bounded>=18?5:6;
 return {points:bounded,tier,unrated:false,confidence,model:'log-audience-provisional'};
}
