import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={};box.window=box;
vm.runInNewContext(await readFile(new URL('../../web/chemistry-equilibria.js',import.meta.url),'utf8'),box);
const {neutralization,cooling}=box.MasterLabChemistryEquilibria;
const acid=(v,extra={})=>({acidVolume:20,baseVolume:v,temperature:25,acidConcentration:.1,baseConcentration:.1,...extra});
const salt=(t,extra={})=>({waterMass:100,initialTemperature:60,finalTemperature:t,saturated:true,pure:true,waterLoss:0,equilibrium:true,...extra});
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
test('independent acid/base calculations and near-equivalence high precision reference',()=>{
  // References from independent Decimal bisection recorded in Issue #5.
  for(const [v,expected,nature] of [[0,1,'酸性'],[10,1.47712125472,'酸性'],[20,7,'中性'],[30,12.30102999566,'碱性'],[19.9999,6.545035287507,'酸性'],[20.0001,7.454963016858,'碱性']]) {
    const m=neutralization(acid(v));near(m.pH,expected);assert.equal(m.nature,nature);assert.equal(m.equivalentBaseVolume,20);
  }
});
test('electroneutrality, water equilibrium and monotonic pH including both volume boundaries',()=>{
  for(const va of [10,20,50]) {
    let last=-Infinity;
    for(const vb of [0,1,va-.0001,va,va+.0001,70,100]) {
      const m=neutralization(acid(vb,{acidVolume:va}));
      assert.ok(Number.isFinite(m.pH)&&m.pH>=last);last=m.pH;
      near(m.hydrogen+m.sodium,m.hydroxide+m.chloride,1e-14);
      near(m.hydrogen*m.hydroxide,1e-14,1e-28);
      near(m.volumeL,(va+vb)/1000);
    }
  }
});
test('missing conditions, unsupported concentration/temperature and excessive precision are rejected',()=>{
  for(const data of [undefined,{},acid(10,{temperature:20}),acid(10,{acidConcentration:.2}),acid(10,{baseConcentration:undefined}),acid(-1),acid(100.0001),acid(19.99999),acid(NaN),acid(10,{acidVolume:9.9999})]) assert.throws(()=>neutralization(data),{name:'RangeError'});
});
test('independent textbook data at each supported temperature, water scaling and conservation',()=>{
  for(const [t,d,c,mother]of [[20,31.6,78.4,131.6],[30,45.8,64.2,145.8],[40,63.9,46.1,163.9],[50,85.5,24.5,185.5],[60,110,0,210]]) {
    for(const w of [50,100,200]) {
      const m=cooling(salt(t,{waterMass:w}));near(m.dissolved,d*w/100);near(m.crystals,c*w/100);near(m.motherLiquor,mother*w/100);near(m.crystals+m.motherLiquor,2.1*w);
    }
  }
  assert.deepEqual([60,20,60].map(t=>cooling(salt(t)).crystals),[0,78.4,0]);
});
test('cooling rejects unknown or contradictory physical conditions without clamping',()=>{
  for(const data of [undefined,{},salt(25),salt('20'),salt(20,{waterMass:49}),salt(20,{waterMass:100.00001}),salt(20,{waterMass:Infinity}),salt(20,{initialTemperature:50}),salt(20,{saturated:false}),salt(20,{pure:undefined}),salt(20,{waterLoss:1}),salt(20,{equilibrium:false})]) assert.throws(()=>cooling(data),{name:'RangeError'});
});
