import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/id="fallback-home"/);
assert.match(html,/id="fb-start"/);
assert.match(html,/public\/devil\.png/);
assert.match(html,/public\/hell\.png/);
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m=>m[1]).filter(Boolean);
assert.ok(inline.length>0,'Missing no-build fallback');
for(const code of inline)new vm.Script(code,{filename:'index.html inline fallback'});
console.log('Static Pages fallback HTML and JavaScript syntax OK');
