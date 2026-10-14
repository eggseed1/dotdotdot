/** Deterministic duel round scoring and guest Elo updates. */
export function scoreRound(players,answers,scores){
  const [a,b]=players;
  const first=answers[a]??null,second=answers[b]??null;
  const same=Boolean(first&&second&&first.workId&&first.workId===second.workId);
  const results={};
  for(const id of players){
    const answer=answers[id]??null;
    const points=answer?(same?0:Math.max(0,Math.round(Number(answer.points)||0))):0;
    results[id]={...(answer||{}),points,jinx:same,skipped:!answer};
  }
  return {scores:Object.fromEntries(players.map(id=>[id,(Number(scores[id])||0)+results[id].points])),results};
}
export function eloDelta(self,opponent,played,outcome){
  const expected=1/(1+10**((Number(opponent)-Number(self))/400));
  const k=Number(played)<10?48:24;
  return Math.round(k*(Math.max(0,Math.min(1,Number(outcome)))-expected));
}
