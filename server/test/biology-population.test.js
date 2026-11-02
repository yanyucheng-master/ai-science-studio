import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const name of ['physics-extra.js','biology-population-core.js','biology-population-questions.js','biology-population.js'])vm.runInNewContext(await readFile(new URL('../../web/'+name,import.meta.url),'utf8'),box);
const C=box.MasterLabPopulation,Q=box.MasterLabPopulationQuestions,t=box.MASTER_LAB_TEMPLATES.population;
const question='种群数量按固定倍数变化，每期时长相同，初始数量为100个，每期数量是前一期的1.5倍，经过4期，求种群模型数量、数量变化趋势。';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*3e-14,`${a} != ${b}`);
test('independent hand calculations: growth, decline, stable, zero and tiny positive values',()=>{
 for(const [n,l,p,expected,trend] of [[100,1.5,4,506.25,'growth'],[80,.5,3,10,'decline'],[7,1,20,7,'stable'],[100,.1,0,100,'decline'],[1,.1,20,1e-20,'decline'],[1000000,3,20,3486784401000000,'growth']]){
  const m=C.calculate(n,l,p);near(m.quantity,expected);assert.equal(m.trend,trend);assert.equal(m.points.length,p+1);assert.equal(m.points[0].quantity,n);
 }
});
test('decimal rational oracle checks every supported multiplier at representative periods',()=>{
 for(let hundredths=10;hundredths<=300;hundredths++)for(const periods of [0,1,3,10,20]){
  // Independent exact rational exponentiation, no calls into model for expected values.
  const numerator=37n*BigInt(hundredths)**BigInt(periods),denominator=100n**BigInt(periods);
  const expected=Number(numerator)/Number(denominator),m=C.calculate(37,hundredths/100,periods);near(m.quantity,expected);
  for(let i=1;i<m.points.length;i++)assert.equal(Math.sign(m.points[i].quantity-m.points[i-1].quantity),Math.sign(hundredths-100));
 }
});
test('numeric input domains reject truncation, coercion and invalid periods',()=>{
 for(const args of [[0,1.5,4],[1.5,1.5,4],[1000001,1.5,4],[100,0,4],[100,3.01,4],[100,1.501,4],[100,1.5,-1],[100,1.5,.5],[100,1.5,21],['100',1.5,4],[100,NaN,4],[100,Infinity,4]])assert.throws(()=>C.calculate(...args));
});
test('shared template accepts explicit conditions and independent results',()=>{
 const p=t.parseQuestion(question);assert.equal(p.ok,true,p.message);assert.equal(p.p1,1.5);assert.equal(p.p2,4);assert.equal(p.fixed.initial,100);
 assert.equal(t.model(p.p1,p.p2,p.fixed).quantity,506.25);assert.equal(t.checkQuestion(question,p.p1,p.p2,p.fixed).ok,true);
 assert.equal(t.checkQuestion(question,p.p1,p.p2+1,p.fixed).ok,false);assert.equal(t.checkQuestion(question,p.p1,p.p2,{...p.fixed,initial:101}).ok,false);
});
test('both grades and every ask roundtrip while retaining fixed initial quantity',()=>{
 for(const level of ['junior','senior'])for(const asks of ['quantity','trend','quantity,trend']){
  const f={...t.presetFor(level).fixed,levelLocked:true,initial:37,asks};
  const q=t.question(.83,20,f),p=t.parseQuestion(q);assert.equal(p.ok,true,p.message);assert.deepEqual({...p.fixed},f);
  assert.equal(t.content(.83,20,f).params[0].step,.01);assert.equal(t.content(.83,20,f).params[1].step,1);
 }
 assert.equal(Q.parse(question.replace('1.5倍','１．５倍')).ok,true);
});
const rejects=[
 question.replace('种群数量按固定倍数变化，',''),question.replace('每期时长相同，',''),question.replace('初始数量为100个，',''),question.replace('每期数量是前一期的1.5倍，',''),question.replace('经过4期，',''),
 question.replace('经过4期','经过4.5期'),question.replace('经过4期','经过4年'),question.replace('1.5倍','1.501倍'),question.replace('1.5倍','0倍'),question.replace('1.5倍','-1倍'),question.replace('1.5倍','3.01倍'),
 question.replace('100个','0个'),question.replace('100个','2.5个'),question.replace('100个','1000001个'),question.replace('经过4期','经过21期'),
 question.replace('种群模型数量','实际精确数量'),question.replace('种群模型数量','种群密度'),question.replace('种群模型数量','达到1000个所需时间'),question.replace('固定倍数','可变倍数'),
 question+'环境容纳量为1000个。',question+'按S形增长。',question+'连续增长率为0.5。',question+'初始数量为80个。',question+'每期有10个迁入。',question+'求增长速率。',question+'求数量变化趋势。'
];
for(const q of rejects)test('reject unsupported population clause '+q,()=>assert.equal(t.parseQuestion(q).ok,false));
test('tiny positive numbers and zero periods are described without integer count or extinction claims',()=>{
 const f={...t.presetFor('senior').fixed,initial:1};const content=t.content(.1,20,f);
 assert.match(content.visualHtml,/1e-20/);assert.match(content.visualHtml,/不取整/);assert.match(content.visualHtml,/整数期/);
 assert.match(t.content(.5,0,f).visualHtml,/尚未经过任何一期/);
 for(const edit of [{fixedMultiplier:false},{equalPeriods:false},{asks:'inverse'},{version:2}])assert.throws(()=>t.content(1.5,4,{...f,...edit}));
});

test("shared metric index does not become numeric display precision",()=>{
 for(const [index,value,display] of [[0,1.5,"1.5"],[1,4,"4"],[2,506.25,"506.25"]])assert.equal(t.formatMetric(value,index),display);
});
