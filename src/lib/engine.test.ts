import { describe,it,expect } from 'vitest';
import { eligible,lookupAnswer,normalize,promptById,rarity,selectPrompts } from './engine';

describe('daily engine',()=>{
  it('always returns seven stable prompts in each mode',()=>{
    for(const mode of ['music','all'] as const){
      const a=selectPrompts(mode,'2026-10-13');
      expect(a).toHaveLength(7);
      expect(a.map(p=>p.id)).toEqual(selectPrompts(mode,'2026-10-13').map(p=>p.id));
      expect(new Set(a.map(p=>p.id)).size).toBe(7);
      expect(a.every(p=>p.kind!=='music')).toBe(true);
    }
  });
  it('all media features film anime games and books without music',()=>{
    const kinds=selectPrompts('all','2026-10-13').map(p=>p.kind);
    expect(kinds.filter(x=>x==='music')).toHaveLength(0);
    expect(kinds.filter(x=>x==='film')).toHaveLength(2);
    expect(new Set(kinds).size).toBe(4);
  });
  it('matches accented names, Korean titles and album/artist pairs',()=>{
    expect(lookupAnswer('Ágætis byrjun','music')).toMatchObject({status:'found',work:{id:'m25'}});
    expect(lookupAnswer('중경삼림','film')).toMatchObject({status:'found',work:{id:'f01'}});
    expect(lookupAnswer('Loveless - My Bloody Valentine','music')).toMatchObject({status:'found',work:{id:'m01'}});
    expect(normalize('Beyoncé')).toBe('beyonce');
  });
  it('does not accept a wrong-kind response',()=>{
    expect(lookupAnswer('Loveless','anime').status).toBe('missing');
  });
  it('award greater rarity to less popular eligible works',()=>{
    const p=promptById.get('f-korean')!;
    const works=[...eligible(p)].sort((a,b)=>b.popularity-a.popularity);
    const common=works[0]!;
    const obscure=works[works.length-1]!;
    expect(rarity(obscure,p).points).toBeGreaterThan(rarity(common,p).points);
  });
});
