import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={};box.window=box;
for(const name of ['biology-microscope-core.js','biology-microscope-questions.js'])vm.runInNewContext(await readFile(new URL('../../web/'+name,import.meta.url),'utf8'),box);
const Q=box.MasterLabMicroscopeQuestions,C=box.MasterLabMicroscope;
const total='光学显微镜，目镜为10倍，物镜为40倍，无额外放大镜组，求总放大倍数。';
const field='光学显微镜，目镜为10倍，原物镜为10倍，新物镜为40倍，同一目镜且视场数不变，中间倍率不变，同一样本且分布均匀，原视野有200个细胞，求新视野与原视野的直径比、新视野与原视野的面积比、近似细胞数。';
test('independent total and field questions retain physical quantities and answers',()=>{
  const a=Q.parse(total);assert.equal(a.ok,true,a.message);assert.equal(C.magnification(a.p1,a.p2),400);
  const b=Q.parse(field);assert.equal(b.ok,true,b.message);assert.equal(b.p1,40);assert.equal(b.p2,200);
  const m=C.compareObjectives({...b.fixed,targetObjective:b.p1,initialCount:b.p2});assert.equal(m.diameterRatio,.25);assert.equal(m.approximateCount,12.5);
});
test('each supported ask and explicit grade survives serialization',()=>{
  for(const q of [total,field])for(const level of ['junior','senior']){
    const p=Q.parse(q);for(const ask of (p.fixed.mode==='magnification'?['magnification']:['area','diameter','count','area,count,diameter'])){
      const f={...p.fixed,asks:ask,level,levelLocked:true};const r=Q.parse(Q.question(p.p1,p.p2,f));
      assert.equal(r.ok,true,r.message);assert.equal(r.fixed.level,level);assert.equal(r.fixed.levelLocked,true);assert.equal(r.fixed.asks,ask);
    }
  }
});
test('fullwidth input and declared two-decimal lens precision are accepted',()=>{
  const p=Q.parse(total.replace('10倍','１２．５倍'));assert.equal(p.ok,true,p.message);assert.equal(p.p1,12.5);
  assert.equal(Q.parse(total.replace('10倍','10.001倍')).ok,false);
  assert.equal(Q.parse(field.replace('200个','200.1个')).ok,false);
});
const invalid=[
  total.replace('无额外放大镜组，',''),total+'另有2倍中间镜组。',total.replace('40倍','0倍'),total.replace('10倍','41倍'),
  field.replace('同一目镜且视场数不变，',''),field.replace('中间倍率不变，',''),field.replace('同一样本且分布均匀，',''),
  field.replace('均匀','不均匀'),field+'同时更换目镜。',field+'切换到另一样本。',field+'原视野有100个细胞。',
  field.replace('近似细胞数','精确细胞数'),field.replace('新视野与原视野的直径比','视野直径'),field.replace('新视野与原视野的面积比','亮度减少百分比'),
  field.replace('200个','2001个'),field.replace('200个','-1个'),field.replace('新物镜为40倍','新物镜为未知倍'),field.replace('原物镜为10倍，','')
];
for(const q of invalid)test('reject unsupported or missing microscope condition: '+q,()=>assert.equal(Q.parse(q).ok,false));
test('invalid serialized mode and non-scientific defaults are not accepted',()=>{
  const p=Q.parse(field);assert.match(Q.issue({...p.fixed,sameFieldNumber:false},p.p1,p.p2),/须明确/);
  assert.match(Q.issue({...p.fixed,asks:'magnification'},p.p1,p.p2),/不支持/);
  assert.equal(Q.parse(null).ok,false);assert.equal(Q.parse('求总放大倍数。').ok,false);
});
