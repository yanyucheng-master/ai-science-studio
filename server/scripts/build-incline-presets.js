// Static bundle generation only; no network or AI. The JSON is the reviewed source of truth.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import Core from '../../web/instant-scene.js';
const source=new URL('../../web/incline-presets.json',import.meta.url),target=new URL('../../web/incline-presets.js',import.meta.url);
const data=JSON.parse(await readFile(source,'utf8'));
assert.equal(data.version,1);assert.equal(data.presets.length,4);assert.equal(new Set(data.presets.map(p=>p.q)).size,4);
for(const p of data.presets){
  assert.deepEqual(Object.keys(p).sort(),['conditions','id','q']);
  assert.match(p.id,/^[a-z][a-z0-9_-]{0,63}$/);
  const local=Core.inspectIncline(p.q);assert(local.ok);assert.deepEqual(p.conditions,local.conditions);
}
const code=`/* Generated from incline-presets.json by server/scripts/build-incline-presets.js. */\n(() => {\n  'use strict';\n  const data = ${JSON.stringify(data,null,2)};\n  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n  freeze(data);\n  if (typeof window !== 'undefined') window.MasterLabInclinePresets = data;\n  if (typeof module !== 'undefined' && module.exports) module.exports = data;\n})();\n`;
if(process.argv.includes('--check'))assert.equal((await readFile(target,'utf8')).replace(/\r\n/g,'\n'),code,'Preset bundle must be rebuilt from the JSON');
else await writeFile(target,code.replace(/\n/g,(await readFile(source,'utf8')).includes('\r\n')?'\r\n':'\n'));
console.log(`Reviewed ${data.presets.length} condition presets: ${fileURLToPath(target)}`);
