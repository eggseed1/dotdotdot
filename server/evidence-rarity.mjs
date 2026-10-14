/** Approximate cross-provider obscurity with explicit low-evidence shrinkage.
 * NOT a measured RYM percentile: source populations differ.
 */
export function evidenceRarity(count,{typical=1000,ceiling=100000,minimum=3}={}){
 if(!Number.isSafeInteger(count)||count<=0)return {points:44,tier:5,unrated:true,confidence:0};
 const x=Math.log1p(count),mid=Math.log1p(typical),span=Math.max(0.1,Math.log1p(ceiling)-mid);
 // Logistic on a log audience scale: bounded scores without explosive bonuses for 1 vote.
 const fraction=1/(1+Math.exp((x-mid)*2/span));
 const confidence=Math.min(1,Math.max(0,Math.log1p(count)/Math.log1p(minimum*12)));
 const points=Math.round(44+((10+80*fraction)-44)*confidence);
 const bounded=Math.max(10,Math.min(90,points));
 const tier=bounded>=88?0:bounded>=75?1:bounded>=60?2:bounded>=44?3:bounded>=27?4:bounded>=18?5:6;
 return {points:bounded,tier,unrated:false,confidence,model:'log-audience-provisional'};
}
