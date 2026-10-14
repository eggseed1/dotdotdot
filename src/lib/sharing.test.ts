import {describe,expect,it} from 'vitest';
import {decodeShare,encodeShare,sampleAnswers} from './sharing';
import {newGame} from './engine';
describe('shareable result pages',()=>{
  it('round trips a valid seven-prompt result',()=>{
    const s=newGame('all','2026-10-14',false);
    s.state='finished'; s.results=s.prompts.map(promptId=>({promptId,rawAnswer:'',points:0,tier:-1}));
    const value=decodeShare(encodeShare(s));
    expect(value?.session.prompts).toEqual(s.prompts);
    expect(value?.score).toBe(0);
  });
  it('rejects junk links',()=>expect(decodeShare('not-a-share')).toBeNull());
  it('provides example valid answers',()=>expect(sampleAnswers('f-90s').length).toBeGreaterThan(0));
});
