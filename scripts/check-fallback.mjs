import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/<div id="root">/);
assert.match(html,/id="boot-status"/);
assert.match(html,/src="\/src\/main\.tsx"/);
assert.match(html,/<noscript>/);
console.log('Static Pages boot shell and React entry point OK');
