import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const name of ['physics-extra.js','biology-mendel-core.js','biology-mendel.js'])vm.runInNewContext(await readFile(new URL('../../web/'+name,import.meta.url),'utf8'),box);
const C=box.MasterLabMendel,t=box.MASTER_LAB_TEMPLATES.mendel;
const f=t.fixedWithDefaults(),input=(a,b,n=400,seed=1)=>({...C.CONDITIONS,parent1:a,parent2:b,n,seed});
test('all nine crosses have independent expected probabilities and roundtrip',()=>{
 const expected=[[1,0,0],[.5,.5,0],[0,1,0],[.5,.5,0],[.25,.5,.25],[0,.5,.5],[0,1,0],[0,.5,.5],[0,0,1]];
 let i=0;for(const a of C.GENOTYPES)for(const b of C.GENOTYPES){const m=C.model(input(a,b));assert.deepEqual(Object.values(m.probabilities),expected[i++]);assert.equal(Object.values(m.counts).reduce((a,b)=>a+b),400);for(const level of ['junior','senior']){const p=t.parseQuestion(t.question(400,1,{...f,parent1:a,parent2:b,level,levelLocked:true}));assert.equal(p.ok,true,p.message);assert.equal(p.fixed.parent1,a);assert.equal(p.fixed.parent2,b);assert.equal(p.fixed.level,level);}}
});
test('fractional expectation stays separate from integer samples and N/seed cannot change probability',()=>{
 const m=C.model(input('Aa','Aa',3));assert.deepEqual(Object.values(m.expected),[.75,1.5,.75]);
 for(const n of [1,17,400,2000])for(const seed of [1,42,9999]){const v=C.model(input('Aa','Aa',n,seed));assert.deepEqual(Object.values(v.probabilities),[.25,.5,.25]);assert.ok(Object.values(v.counts).every(Number.isInteger));}
});
test('sampling agrees with independent modular powers, retains prefix and frame reversal',()=>{
 const m=C.model(input('Aa','Aa',25,42));const modulus=2147483647n;
 const draw=k=>Number((42n*16807n**BigInt(16+k))%modulus-1n)/2147483646;
 const independently=[];for(let i=0;i<25;i++){const a=draw(i*2+1)<.5?'A':'a',b=draw(i*2+2)<.5?'A':'a';independently.push(a===b?a+a:'Aa');}
 assert.deepEqual(Array.from(m.samples,s=>s.genotype),independently);
 assert.deepEqual(Array.from(C.model(input('Aa','Aa',8,42)).samples,s=>s.genotype),independently.slice(0,8));
 assert.equal(C.frame(m,0).shown,0);assert.equal(C.frame(m,1).shown,25);assert.equal(C.frame(m,0).counts.aa,0);
 assert.deepEqual({...C.frame(m,1).counts},{...m.counts});
});
const q=t.question(400,1);
for(const invalid of [q.replace('常染色体','性染色体'),q.replace('完全显性','不完全显性'),q.replace('配子等概率且随机受精，',''),q.replace('后代独立且无选择差异，',''),q.replace('Aa×Aa','aa×未知'),q.replace('400个','400.1个'),q.replace('400个','2001个'),q.replace('为1，','为0，'),q.replace('为1，','为1.000000000000000001，'),q+'后代数为400个。',q.replace('显隐性概率','显隐性概率及患病概率'),q.replace('期望个数','实际必然个数'),q+'其中aa致死。'])test('reject unsupported full question '+invalid,()=>assert.equal(t.parseQuestion(invalid).ok,false));
test('all asks and question-first clauses validate without unknown condition loss',()=>{
 for(const asks of ['genotype','phenotype','expected','simulation','expected,genotype,phenotype,simulation']){const s=t.question(3,9999,{...f,asks});assert.equal(t.parseQuestion(s).ok,true,s);}
 const parts=q.split('，'),ask=parts.pop();assert.equal(t.parseQuestion(ask.replace('。','：')+parts.join('，')+'。').ok,true);
 assert.equal(t.parseQuestion(q+'光照12小时。').ok,false);
});
