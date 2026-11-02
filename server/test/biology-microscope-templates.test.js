import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const name of ['physics-extra.js','biology-microscope-core.js','biology-microscope-questions.js','biology-microscope.js'])vm.runInNewContext(await readFile(new URL('../../web/'+name,import.meta.url),'utf8'),box);
const t=box.MASTER_LAB_TEMPLATES.microscope,C=box.MasterLabMicroscope;
const questions={
 magnification:'光学显微镜，目镜为12.5倍，物镜为40倍，无额外放大镜组，求总放大倍数。',
 field:'光学显微镜，目镜为10倍，原物镜为10倍，新物镜为40倍，同一目镜且视场数不变，中间倍率不变，同一样本且分布均匀，原视野有50个细胞，求近似细胞数。',
 direction:'光学显微镜，物像为倒像，设向右、向上为正，玻片水平移位为2格，竖直移位为1格，求物像移动方向。'
};
test('all three modes pass the shared guard and retain independent answers',()=>{
 for(const [mode,q]of Object.entries(questions)){
  const p=t.parseQuestion(q);assert.equal(p.ok,true,p.message);assert.equal(p.fixed.mode,mode);
  const m=t.model(p.p1,p.p2,p.fixed);
  if(mode==='magnification')assert.equal(m.totalMagnification,500);
  if(mode==='field'){assert.equal(m.approximateCount,3.125);assert.match(m.conclusion,/≈ 3.125/);assert.equal(m.diameterText,'1 / 4');assert.equal(m.areaText,'1 / 16');assert.equal(m.totalMagnification,undefined);}
  if(mode==='direction'){assert.deepEqual({...m.image},{x:-2,y:-1,direction:'左下'});assert.match(m.contextParameters,/不计算实际/);}
  assert.equal(t.checkQuestion(q,p.p1,p.p2,p.fixed).ok,true);
 }
});
test('mode-specific controls preserve precision, domains and integer cell counts',()=>{
 for(const mode of Object.keys(questions)){
  const p=t.parseQuestion(questions[mode]),content=t.content(p.p1,p.p2,p.fixed),params=content.params;
  if(mode==='magnification'){assert.equal(params[0].max,40);assert.equal(params[1].max,100);assert.equal(params[0].step,.01);}
  if(mode==='field'){assert.equal(params[0].step,.01);assert.equal(params[1].step,1);assert.equal(params[1].min,0);assert.equal(params[1].max,2000);}
  if(mode==='direction'){assert.equal(params[0].min,-5);assert.equal(params[1].max,5);assert.equal(params[0].step,1);}
  assert.equal(params[0].value,p.p1);assert.equal(params[1].value,p.p2);
 }
});
test('preset, current comparison and grade round trips retain the same mode',()=>{
 for(const mode of Object.keys(questions))for(const level of ['junior','senior']){
  const sample=t.presetFor(level,mode),f={...sample.fixed,levelLocked:true},q=t.question(sample.p1,sample.p2,f),p=t.parseQuestion(q);
  assert.equal(p.ok,true,p.message);assert.equal(p.fixed.mode,mode);assert.equal(p.fixed.level,level);assert.equal(p.fixed.levelLocked,true);
 }
});
test('direction has a fixed centre, independent axis signs and no physical length claim',()=>{
 for(const [x,y,expected]of [[0,0,'不移动'],[1,0,'左'],[-1,0,'右'],[0,1,'下'],[0,-1,'上'],[-3,-4,'右上']]){
  const f=t.presetFor('junior','direction').fixed,p=t.parseQuestion(t.question(x,y,f));assert.equal(p.ok,true,p.message);
  assert.equal(t.model(x,y,f).image.direction,expected);assert.equal(C.invertedImageOffset(x,y).x,-x||0);
 }
});
test('invalid or mixed conditions cannot pass the shared planner guard',()=>{
 const q=questions.direction;
 for(const invalid of [q.replace('物像为倒像，',''),q.replace('设向右、向上为正，',''),q.replace('2格','2.5格'),q.replace('2格','6格'),q+'目镜为10倍。',q.replace('物像移动方向','物像实际距离'),questions.magnification+'原视野有100个细胞。',questions.field+'同时更换目镜。'])assert.equal(t.parseQuestion(invalid).ok,false,invalid);
 const p=t.parseQuestion(questions.field);assert.equal(t.checkQuestion(questions.field,p.p1,p.p2+1,p.fixed).ok,false);
});
