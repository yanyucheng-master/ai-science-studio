import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','chemistry-extra.js','chemistry-experiments.js'])vm.runInNewContext(await readFile(new URL(`../../web/${file}`,import.meta.url),'utf8'),box,{filename:file});
const ca=box.MASTER_LAB_TEMPLATES.caco3Hcl;
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const model=(a,b,excess='')=>ca.model(a,b,ca.fixedWithDefaults({excess}));
const parse=q=>ca.parseQuestion(q,{gradeLevel:'junior'});

test('CaCO3: independent classroom examples and both limiting directions',()=>{
 for(const [a,b,excess,gas,leftCa,leftHcl,limiting] of [[10,0,'hcl',4.4,0,null,'caco3'],[10,7.3,'',4.4,0,0,'both'],[10,3.65,'',2.2,5,0,'hcl'],[5,7.3,'',2.2,0,3.65,'caco3'],[0,7.3,'caco3',4.4,null,0,'hcl']]){
  const m=model(a,b,excess);near(m.co2Mass,gas);assert.equal(m.limiting,limiting);
  leftCa===null?assert.equal(m.remainingCa,null):near(m.remainingCa,leftCa);
  leftHcl===null?assert.equal(m.remainingHcl,null):near(m.remainingHcl,leftHcl);
 }
});
test('CaCO3: mass/element stoichiometry, nonnegative remainder and scaling',()=>{
 // Independently balanced classroom masses: 100 + 73 = 111 + 18 + 44.
 assert.equal(100+73,111+18+44);
 for(const a of [.1,.5,2,5,10,25])for(const b of [.1,.73,3.65,7.3,18.25]){
  const m=model(a,b), doubled=model(a*2,b*2);
  near(m.consumedCa+m.remainingCa,a);near(m.consumedHcl+m.remainingHcl,b);
  near(m.consumedCa+m.consumedHcl,m.co2Mass+m.co2Mass/44*129);
  near(doubled.co2Mass,m.co2Mass*2);near(doubled.remainingCa,m.remainingCa*2);near(doubled.remainingHcl,m.remainingHcl*2);
  assert.ok(m.remainingCa>=0&&m.remainingHcl>=0);
  assert.ok(Math.min(m.remainingCa,m.remainingHcl)<1e-9);
 }
});
test('CaCO3: exact endpoints and illegal numeric inputs are never clamped',()=>{
 for(const [a,b] of [[.1,.1],[50,36.5]])assert.ok(Number.isFinite(model(a,b).co2Mass));
 for(const [a,b,e] of [[0,7.3,''],[-1,7.3,''],[50.001,7.3,''],[10,36.501,''],[10,Infinity,''],[NaN,7.3,''],[10,7.3,'hcl'],[0,7.3,'other']])assert.throws(()=>model(a,b,e),{name:'RangeError'});
});
test('CaCO3: strict parser consumes labelled quantities and explicit excess',()=>{
 const cases=[
  ['10g纯碳酸钙与足量稀盐酸充分反应，求生成CO₂的质量。',10,0,'hcl'],
  ['碳酸钙质量为10g，与含HCl溶质7.3g的稀盐酸充分反应，求生成二氧化碳的质量、限量反应物。',10,7.3,''],
  ['0.01kg碳酸钙与含HCl溶质3650mg的稀盐酸反应，求生成二氧化碳的质量和剩余碳酸钙的质量。',10,3.65,''],
  ['足量碳酸钙与含氯化氢溶质7.3克的稀盐酸充分反应，求二氧化碳的质量。',0,7.3,'caco3'],
  ['碳酸钙质量为1.2345g，与含HCl溶质3.65g的稀盐酸反应，求二氧化碳的质量。',1.2345,3.65,'']
 ];
 for(const [q,a,b,excess]of cases){const p=parse(q);assert.equal(p.ok,true,`${q}: ${p.message}`);near(p.p1,a);near(p.p2,b);assert.equal(p.fixed.excess,excess);assert.equal(p.fixed.level,'junior');}
});
test('CaCO3: missing, contradictory, excess unknowns and unsupported asks reject',()=>{
 const bad=[
  '10g碳酸钙与7.3g盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与稀盐酸反应，求二氧化碳的质量。',
  '10碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与足量稀盐酸反应，求剩余HCl溶质的质量。',
  '足量碳酸钙与含HCl溶质7.3g的稀盐酸反应，求剩余碳酸钙的质量。',
  '足量碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '足量10g碳酸钙与含HCl溶质7.3g的稀盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与含HCl溶质3.65g的稀盐酸恰好反应，求二氧化碳的质量。',
  '10g碳酸钙与10g碳酸钙和足量稀盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与足量稀盐酸反应5s，求二氧化碳的质量。',
  '10g碳酸钙与足量稀盐酸反应，求二氧化碳的体积。',
  '10g碳酸钙与足量稀盐酸反应，求二氧化碳的质量和水的质量。',
  '10g碳酸钙与足量稀盐酸在催化剂作用下反应，求二氧化碳的质量。',
  '10g纯度90%的碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与100g10%盐酸反应，求二氧化碳的质量。',
  '50001mg碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '0g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '-1g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '1.23456g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '10g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。另有未知条件z=3。'
 ];
 for(const q of bad)assert.equal(parse(q).ok,false,q);
});
test('CaCO3: generated question roundtrip retains conditions, asks and grade',()=>{
 for(const level of ['junior','senior'])for(const [a,b,excess]of [[10,7.3,''],[10,0,'hcl'],[0,7.3,'caco3']]){
  const fixed=ca.fixedWithDefaults({level,levelLocked:true,excess});const q=ca.question(a,b,fixed),p=ca.parseQuestion(q,{gradeLevel:level==='junior'?'senior':'junior'});
  assert.equal(p.ok,true,`${q}: ${p.message}`);near(p.p1,a);near(p.p2,b);assert.deepEqual(JSON.parse(JSON.stringify(p.fixed)),JSON.parse(JSON.stringify(fixed)));
  const content=ca.content(a,b,fixed);assert.ok(!JSON.stringify(content.steps).includes('物理量'));assert.ok(content.params[excess==='caco3'?0:1].locked===true||!excess);
 }
});
test('CaCO3: animation is a mass-consistent presentation, excess remains unknown',()=>{
 const m=model(10,3.65),start=ca.frame(m,0),half=ca.frame(m,.51),end=ca.frame(m,1);
 near(start.co2Mass,0);near(start.remainingCa,10);near(half.co2Mass,1.1);near(half.remainingCa,7.5);near(end.co2Mass,2.2);near(end.remainingCa,5);
 assert.equal(ca.frame(model(10,0,'hcl'),1).remainingHcl,null);
});
