import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={};box.window=box;
vm.runInNewContext(await readFile(new URL('../../web/biology-microscope-core.js',import.meta.url),'utf8'),box);
const C=box.MasterLabMicroscope;
const input=(initialObjective=10,targetObjective=40,initialCount=200)=>({
  ...C.COMPARISON_CONDITIONS,eyepiece:10,initialObjective,targetObjective,initialCount
});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-12*Math.max(1,Math.abs(expected)),`${actual} vs ${expected}`);

test('two-lens magnification uses the product, with independent textbook-style examples',()=>{
  for(const [eye,obj,total]of [[5,4,20],[10,10,100],[10,40,400],[16,40,640],[12.5,10,125]])assert.equal(C.magnification(eye,obj),total);
});
test('objective 10 to 40 shrinks diameter four times and area sixteen times',()=>{
  const m=C.compareObjectives(input());
  assert.equal(m.diameterRatio,.25);assert.equal(m.areaRatio,.0625);
  assert.equal(m.approximateCount,12.5);assert.equal(m.countIsApproximate,true);
});
test('fractional estimates are preserved rather than rounded into cell counts',()=>{
  close(C.compareObjectives(input(4,40,50)).approximateCount,.5);
  assert.equal(C.compareObjectives(input(10,40,50)).approximateCount,3.125);
  assert.equal(C.compareObjectives(input(10,40,0)).approximateCount,0);
});
test('unchanged objective and reciprocal comparisons retain independent ratios',()=>{
  const same=C.compareObjectives(input(40,40,31));assert.equal(same.diameterRatio,1);assert.equal(same.areaRatio,1);assert.equal(same.approximateCount,31);
  const low=C.compareObjectives(input(40,10,5));assert.equal(low.diameterRatio,4);assert.equal(low.areaRatio,16);assert.equal(low.approximateCount,80);
  const a=C.compareObjectives(input(4,10,100)),b=C.compareObjectives(input(10,4,100));close(a.diameterRatio*b.diameterRatio,1);close(a.areaRatio*b.areaRatio,1);
});
test('relative field and count ratios are independent of an unchanged eyepiece',()=>{
  const a=C.compareObjectives(input());const b=C.compareObjectives({...input(),eyepiece:16});
  assert.equal(a.areaRatio,b.areaRatio);assert.equal(a.approximateCount,b.approximateCount);
});
test('each comparison condition must be supplied explicitly',()=>{
  for(const key of Object.keys(C.COMPARISON_CONDITIONS)){
    for(const value of [undefined,false,'true',1])assert.throws(()=>C.compareObjectives({...input(),[key]:value}),/须明确/);
  }
  assert.throws(()=>C.compareObjectives(null),/须明确/);
});
test('invalid and numerically unrepresentable lens/count inputs fail',()=>{
  for(const bad of [0,-1,NaN,Infinity,'10',undefined]){
    assert.throws(()=>C.magnification(bad,40),/有限正数/);assert.throws(()=>C.magnification(10,bad),/有限正数/);
    for(const key of ['eyepiece','initialObjective','targetObjective'])assert.throws(()=>C.compareObjectives({...input(),[key]:bad}),/有限正数/);
  }
  for(const bad of [-1,.5,Infinity,NaN,'50',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>C.compareObjectives({...input(),initialCount:bad}),/非负安全整数/);
  assert.throws(()=>C.magnification(1e308,10),/超出/);assert.throws(()=>C.magnification(1e-300,1e-300),/超出/);
  assert.throws(()=>C.compareObjectives(input(1e200,1e-200,1)),/超出/);
});
test('upright compound microscope image moves opposite to the slide',()=>{
  for(const [slide,image]of [['up','down'],['down','up'],['left','right'],['right','left']])assert.equal(C.invertedImageDirection(slide),image);
  for(const bad of ['north','__proto__',null,{}])assert.throws(()=>C.invertedImageDirection(bad),/仅支持/);
});
test('comparison does not mutate its input and returns immutable evidence',()=>{
  const source=Object.freeze(input());const m=C.compareObjectives(source);
  assert.equal(source.initialCount,200);assert.ok(Object.isFrozen(m));
});
