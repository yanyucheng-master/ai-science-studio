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
test('CaCO3: outcome masses never become initial givens, including temporal synonyms',()=>{
 const rejected=[
  '10g纯碳酸钙与稀盐酸充分反应后，剩余HCl溶质质量为3.65g，求生成二氧化碳的质量。',
  '纯碳酸钙与足量稀盐酸充分反应后，剩余碳酸钙的质量为10g，求生成二氧化碳的质量。',
  ...['消耗','耗去','耗用','用去','用掉','反应掉','剩余','剩下','余下','残余','未参与反应的'].map(role=>`${role}5g纯碳酸钙，与足量稀盐酸反应，求生成二氧化碳的质量。`),
  '纯碳酸钙与足量稀盐酸反应结束，碳酸钙质量为5g，求二氧化碳的质量。',
  '10g纯碳酸钙与稀盐酸反应，HCl溶质质量为3.65g（剩余质量），求二氧化碳的质量。',
  '碳酸钙质量为5g，为消耗质量，与足量稀盐酸反应，求二氧化碳的质量。',
  '10g纯碳酸钙与稀盐酸反应，HCl溶质质量为3.65g，为反应后质量，求二氧化碳的质量。',
  '10g纯碳酸钙与稀盐酸反应，HCl溶质质量为3.65g（反应后），求二氧化碳的质量。'
 ];
 for(const q of rejected)assert.equal(parse(q).ok,false,q);
 for(const q of [
  '反应前，碳酸钙初始质量为10g，HCl溶质初始质量为3.65g，求生成二氧化碳的质量。',
  '初始投入10g纯碳酸钙，与足量稀盐酸充分反应，求消耗HCl溶质的质量。',
  '10g纯碳酸钙与含HCl溶质3.65g的稀盐酸充分反应后，求剩余碳酸钙的质量。'
 ])assert.equal(parse(q).ok,true,`${q}: ${parse(q).message}`);
});
test('CaCO3: every requested consumed/remainder result has a named answer and grade-specific calculation',()=>{
 for(const level of ['junior','senior'])for(const [given,asks,expected]of [
  ['10g纯碳酸钙与足量稀盐酸','消耗HCl溶质的质量',{consumedHcl:7.3}],
  ['足量纯碳酸钙与含HCl溶质3.65g的稀盐酸','消耗碳酸钙的质量',{consumedCa:5}],
  ['10g纯碳酸钙与含HCl溶质3.65g的稀盐酸','生成二氧化碳的质量、消耗碳酸钙的质量、消耗HCl溶质的质量、剩余碳酸钙的质量',{co2:2.2,consumedCa:5,consumedHcl:3.65,remainingCa:5}]
 ]){
  const p=ca.parseQuestion(`${given}充分反应，求${asks}。`,{gradeLevel:level});assert.equal(p.ok,true,p.message);
  const content=ca.content(p.p1,p.p2,p.fixed),m=content.model;
  assert.deepEqual(Array.from(m.answers,a=>a.key).sort(),Object.keys(expected).sort());
  for(const a of m.answers){near(a.value,expected[a.key]);assert.ok(m.readout.includes(a.label)&&m.conclusion.includes(a.label));assert.ok(content.steps[2][1].includes(a.label));}
  assert.match(content.steps[2][1],level==='junior'?/\d+\/\d+ ×/:/g\/mol × ξ/);
  if(Object.keys(expected).length===1)assert.doesNotMatch(m.readout,/生成 CO₂/);
  const roundtrip=ca.parseQuestion(ca.question(p.p1,p.p2,p.fixed),{gradeLevel:level});assert.equal(roundtrip.fixed.asks,p.fixed.asks);
 }
});
test('CaCO3: animation is a mass-consistent presentation, excess remains unknown',()=>{
 const m=model(10,3.65),start=ca.frame(m,0),half=ca.frame(m,.51),end=ca.frame(m,1);
 near(start.co2Mass,0);near(start.remainingCa,10);near(half.co2Mass,1.1);near(half.remainingCa,7.5);near(end.co2Mass,2.2);near(end.remainingCa,5);
 assert.equal(ca.frame(model(10,0,'hcl'),1).remainingHcl,null);
});

const solution=box.MASTER_LAB_TEMPLATES.naclSolution;
const solutionParse=q=>solution.parseQuestion(q,{gradeLevel:'junior'});
const solutionModel=(m,w)=>solution.model(m,w,solution.fixedWithDefaults());
test('NaCl: independent textbook examples including pure water',()=>{
 for(const [m,w,salt,water]of [[100,10,10,90],[50,6,3,47],[200,5,10,190],[100,0,0,100]]){
  const result=solutionModel(m,w);near(result.saltMass,salt);near(result.waterMass,water);near(result.mass,m);
 }
});
test('NaCl: conservation, scaling and fixed-total monotonicity',()=>{
 for(const mass of [20,50,100,250])for(const w of [0,.01,5,6,10,20]){
  const m=solutionModel(mass,w),twice=solutionModel(mass*2,w);
  near(m.saltMass+m.waterMass,mass);near(twice.saltMass,m.saltMass*2);near(twice.waterMass,m.waterMass*2);
  if(w<20){const next=solutionModel(mass,w+.001);assert.ok(next.saltMass>m.saltMass&&next.waterMass<m.waterMass);}
 }
 for(const [m,w]of [[20,0],[500,20]])assert.ok(Number.isFinite(solutionModel(m,w).saltMass));
 for(const [m,w]of [[0,10],[19.99,10],[500.01,10],[100,-.01],[100,20.01],[Infinity,10],[100,NaN]])assert.throws(()=>solutionModel(m,w),{name:'RangeError'});
});
test('NaCl: strict target-mass and mass-fraction parsing, units and Chinese percentages',()=>{
 for(const [q,m,w]of [
  ['配制100g10%的氯化钠溶液，求所需盐和水的质量。',100,10],
  ['20°C时，配制50g质量分数为6%的氯化钠溶液，求所需氯化钠的质量和水的质量。',50,6],
  ['氯化钠溶液总质量为0.2kg，质量分数为5%，求配制所需盐和水的质量。',200,5],
  ['配制100000mg质量分数为0%的氯化钠溶液，求所需水的质量和配制步骤。',100,0],
  ['配制100g质量分数为百分之十的氯化钠溶液，求所需盐和水的质量。',100,10],
  ['配制100g质量分数为百分之20的氯化钠溶液，求所需盐和水的质量。',100,20]
 ]){const p=solutionParse(q);assert.equal(p.ok,true,`${q}: ${p.message}`);near(p.p1,m);near(p.p2,w);}
});
test('NaCl: refuses water-as-total, missing values, extra conditions and unsupported asks',()=>{
 for(const q of [
  '向100g水加入10g盐，求配制氯化钠溶液的质量分数。',
  '配制100g水和10%的氯化钠溶液，求所需盐的质量。',
  '配制氯化钠溶液，水的质量为100g，质量分数为10%，求所需盐的质量。',
  '配制100g氯化钠溶液，求所需盐和水的质量。',
  '配制10%的氯化钠溶液，求所需盐和水的质量。',
  '配制100g质量分数为20.01%的氯化钠溶液，求盐和水的质量。',
  '配制500.01g质量分数为10%的氯化钠溶液，求盐和水的质量。',
  '配制100g质量分数为-1%的氯化钠溶液，求盐和水的质量。',
  '配制100g质量分数为10%的氯化钠溶液，温度为30°C，求盐和水的质量。',
  '配制100g质量分数为10%的氯化钠溶液，密度1.1g/mL，求水的质量。',
  '配制100g质量分数为10%的氯化钠溶液，求水的质量和溶液的体积。',
  '稀释20%氯化钠溶液配制100g10%溶液，求加水质量。',
  '配制100g质量分数为10%的饱和氯化钠溶液，求盐和水的质量。',
  '配制100g质量分数为10%的氯化钠溶液，质量分数为5%，求盐和水的质量。',
  '配制100g质量分数为10%的氯化钠溶液，求水的质量和颜色。',
  '配制100g质量分数为10%的氯化钠溶液，另有未知条件z=3，求水的质量。'
 ])assert.equal(solutionParse(q).ok,false,q);
});
test('NaCl: question/mode/grade roundtrips and distinct teaching methods',()=>{
 for(const level of ['junior','senior'])for(const [m,w]of [[100,10],[50,6],[200,5],[100,0],[20,.0001],[500,20]]){
  const fixed=solution.fixedWithDefaults({level,levelLocked:true}),q=solution.question(m,w,fixed),p=solution.parseQuestion(q,{gradeLevel:'senior'});
  assert.equal(p.ok,true,`${q}: ${p.message}`);near(p.p1,m);near(p.p2,w);assert.deepEqual(JSON.parse(JSON.stringify(p.fixed)),JSON.parse(JSON.stringify(fixed)));
  const c=solution.content(m,w,fixed);assert.ok(!JSON.stringify(c.steps).includes('物理量'));assert.ok(!c.model.conclusion.includes('mL'));
 }
});
test('NaCl: stage transfer conserves weighed materials and pure water has no salt',()=>{
 for(const w of [0,5,10,20]){const m=solutionModel(100,w);for(const p of [0,.1,.2,.35,.45,.5,.6,.75,.8,.9,1]){
  const f=solution.frame(m,p);near(f.saltOnScale+f.saltAdded,f.saltWeighed);near(f.waterInCup+f.waterAdded,f.waterWeighed);near(f.saltOnScale+f.waterInCup+f.mixtureMass,f.saltWeighed+f.waterWeighed);assert.ok(f.saltOnScale>=0&&f.waterInCup>=0&&f.mixtureMass<=100+1e-9);
  if(w===0){near(f.saltAdded,0);near(f.saltOnScale,0);assert.notEqual(f.step,0);}
 }near(solution.frame(m,1).mixtureMass,100);near(solution.frame(m,1).mixed,1);}
});
test('AI mapping cannot change chemical quantity roles, asks, or fixed modes',()=>{
 const p=solutionParse('配制100g质量分数为10%的氯化钠溶液，求水的质量。');assert.equal(p.ok,true);
 for(const q of ['配制氯化钠溶液，水的质量为100g，质量分数为10%，求水的质量。','配制100g质量分数为10%的氯化钠溶液，求盐的质量。'])assert.equal(solution.checkQuestion(q,p.p1,p.p2,p.fixed).ok,false,q);
 const c=parse('10g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。');assert.equal(c.ok,true);
 assert.equal(ca.checkQuestion('10g碳酸钙与稀盐酸反应，求二氧化碳的质量。',c.p1,c.p2,c.fixed).ok,false);
});
test('precision and strict boundaries also apply to restored comparison parameters',()=>{
 for(const q of ['0.0999999999g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。','50.0000000001g碳酸钙与足量稀盐酸反应，求二氧化碳的质量。'])assert.equal(parse(q).ok,false,q);
 assert.equal(solutionParse('配制500.0000000001g质量分数为10%的氯化钠溶液，求水的质量。').ok,false);
 assert.ok(solution.strict.checkFixed(solution.fixedWithDefaults(),100.00001,10));
 assert.ok(ca.strict.checkFixed(ca.fixedWithDefaults(),10.00001,7.3));
 assert.match(solutionModel(20,.0001).readout,/0\.00002/);
 assert.match(solutionModel(20,.0001).formulaDetail,/0\.00002/);assert.doesNotMatch(solutionModel(20,.0001).formulaDetail,/ = 0 g/);
 assert.match(ca.content(1.2345,7.3,ca.fixedWithDefaults({level:'junior'})).steps[2][1],/1\.2345/);
 assert.match(ca.model(10,.1,ca.fixedWithDefaults()).formulaDetail,/ξ ≈/);
});
