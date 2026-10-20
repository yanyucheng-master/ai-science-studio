import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import Core from '../../web/instant-scene.js';
import Incline from '../../web/incline-diagram.js';
const data=JSON.parse(await readFile(new URL('../../web/incline-presets.json',import.meta.url),'utf8'));
const source=await readFile(new URL('../../web/incline-diagram.js',import.meta.url),'utf8');
const bank=JSON.parse(await readFile(new URL('../eval/tutor-diagram-bank.json',import.meta.url),'utf8'));
function browser({search='',enabled,presets=structuredClone(data)}={}){
  const window={MasterLabInstantScene:Core,MasterLabInclinePresets:presets,location:{search},MASTER_LAB_DIAGRAM_ENABLED:enabled};
  vm.runInNewContext(source,{window,URLSearchParams});return window.MasterLabInclineDiagram;
}
test('the browser preset bundle matches the four reviewed JSON records',async()=>{
  assert.equal(data.version,1);assert.equal(data.presets.length,4);
  assert.equal(new Set(data.presets.map(p=>p.q)).size,4);
  const sandbox={window:{}};vm.runInNewContext(await readFile(new URL('../../web/incline-presets.js',import.meta.url),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.MasterLabInclinePresets)),data);
  assert(Object.isFrozen(sandbox.window.MasterLabInclinePresets.presets[0].conditions));
  for(const p of data.presets){assert.deepEqual(p.conditions,Core.inspectIncline(p.q).conditions);assert.deepEqual(Object.keys(p).sort(),['conditions','id','q']);}
  assert.doesNotMatch(JSON.stringify(data),/"(?:objects|labels|svg|points|from|to)"/);
});
for(const p of data.presets)test('preset uses the ordinary derivation and renderer input: '+p.id,()=>{
  const result=Incline.createCompetitionScene(p.q);
  assert.equal(result.mode,'instant');assert.equal(result.presetId,p.id);
  assert.deepEqual(result.scene,Incline.createScene(p.q).scene);
  assert.deepEqual(result.conditions,p.conditions);assert.equal(Incline.canDraw(p.q),true);
});
test('exact matching never promotes an edited question to a reviewed preset',()=>{
  const p=data.presets[0];
  for(const q of [p.q+' ',p.q.replace('，','、'),p.q.replace('粗糙','光滑'),p.q.replace('不受其他外力','受到拉力')])assert.equal(Incline.findPreset(q).id,undefined);
  assert.equal(Incline.createCompetitionScene(p.q.replace('粗糙','光滑')).mode,'explanation');
  const nonPreset=bank.find(r=>r.id==='numbers-remain-schematic').q;
  const result=Incline.createCompetitionScene(nonPreset);assert.equal(result.mode,'instant');assert.equal(result.presetId,undefined);
  assert.deepEqual(result.scene,Incline.createScene(nonPreset).scene);
});
test('corrupted preset conditions and optional AI disagreement fail closed',()=>{
  const changed=structuredClone(data);changed.presets[0].conditions.rises='left';
  assert.equal(browser({presets:changed}).createCompetitionScene(data.presets[0].q).mode,'explanation');
  const extra=structuredClone(data);extra.presets[0].conditions.objects=[];
  assert.equal(browser({presets:extra}).createCompetitionScene(data.presets[0].q).mode,'explanation');
  assert.equal(Incline.createCompetitionScene(data.presets[0].q,{aiConditions:{...data.presets[0].conditions,rises:'left'}}).mode,'explanation');
  assert.equal(browser({presets:null}).createCompetitionScene(data.presets[0].q).mode,'explanation');
});
test('URL and config switches disable all diagram sources without changing the pure force model',()=>{
  const q=data.presets[0].q,other=bank.find(r=>r.id==='numbers-remain-schematic').q;
  for(const options of [{search:'?diagram=0'},{search:'?diagram=1&diagram=0'},{enabled:false},{enabled:false,search:'?diagram=1'}]){
    const api=browser(options);assert.equal(api.enabled(),false);
    for(const question of [q,other]){assert.equal(api.createCompetitionScene(question).code,'DIAGRAM_DISABLED');assert.equal(api.canDraw(question),false);}
    assert.equal(api.createScene(q).mode,'instant','turning off display must retain the saved force model');
  }
  assert.equal(browser({search:'?diagram=1'}).enabled(),true);assert.equal(browser().enabled(),true);
});
