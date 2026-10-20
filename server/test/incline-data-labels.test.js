import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Core from '../../web/instant-scene.js';
import Incline from '../../web/incline-diagram.js';
const bank=JSON.parse(await readFile(new URL('../eval/tutor-diagram-bank.json',import.meta.url),'utf8'));
const data=()=>bank.find(r=>r.id==='data-output-in-picture').q;
test('output annotation wording draws while actual picture dependencies remain rejected',()=>{
  for(const row of bank.filter(r=>r.id.startsWith('data-')))assert.equal(Incline.createScene(row.q).mode,row.expect==='draw'?'instant':'explanation',row.id);
  for(const phrase of ['请在图中标注质量和倾角','在图中标明质量和倾角','图中注明质量和倾角'])assert.equal(Incline.createScene(data().replace('并在图中标出题目给定的质量和倾角',phrase)).mode,'instant',phrase);
  for(const phrase of ['见图','图中的物块','图中标注的质量','在图中标出了质量'])assert.equal(Incline.createScene(data().replace('并在图中标出题目给定的质量和倾角',phrase)).mode,'explanation',phrase);
});
test('given numeric labels have exact source quotes, retained units and no force calculations',()=>{
  const result=Incline.createScene(data());assert.equal(result.mode,'instant');
  assert.deepEqual(result.annotations.map(a=>[a.kind,a.value,a.unit]),[['mass',2,'kg'],['angle',30,'°']]);
  for(const a of result.annotations){assert(data().includes(a.quote));assert(result.scene.labels.some(l=>l.text===a.text));}
  assert.match(result.annotations[0].text,/2 kg/);assert.match(result.annotations[1].text,/30°.*题给/);
  assert.deepEqual(result.scene.calculations,[]);assert.equal(result.annotations.some(a=>/force|gravity/.test(a.kind)),false);
  assert.deepEqual(result.scene.objects,Incline.createScene(bank[0].q).scene.objects);
});
test('missing data creates no invented numeric label, repeated equivalent data is deduplicated',()=>{
  assert.deepEqual(Incline.createScene(bank[0].q).annotations,[]);
  assert.deepEqual(Incline.createScene(bank.find(r=>r.id==='data-mass-only').q).annotations.map(a=>a.kind),['mass']);
  assert.deepEqual(Incline.createScene(bank.find(r=>r.id==='data-angle-only').q).annotations.map(a=>a.kind),['angle']);
  assert.equal(Incline.createScene(bank.find(r=>r.id==='data-equivalent-repeat').q).annotations.length,2);
  const chinese=Incline.createScene(bank.find(r=>r.id==='data-unit-chinese').q);
  assert.deepEqual(chinese.annotations.map(a=>a.unit),['克','度']);
});
test('strict validation rejects mass or angle labels not supported by original evidence',()=>{
  const original=Incline.createScene(data());assert.equal(original.mode,'instant');
  for(const [target,text]of [['body','m = 3 kg'],['surface','θ = 45°（题给）'],['body','m = 3000 克']]){
    const scene=structuredClone(original.scene);scene.labels.push({target,text});assert.equal(Core.validateDiagram(scene,data()).ok,false,text);
  }
  assert.equal(Core.validateDiagram(original.scene,data()).ok,true);
});
