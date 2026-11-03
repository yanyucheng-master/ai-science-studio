import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','biology-population-core.js','biology-population-questions.js','biology-population.js'])vm.runInNewContext(await readFile(new URL('../../web/'+file,import.meta.url),'utf8'),box);
const C=box.MasterLabPopulation,Q=box.MasterLabPopulationQuestions,t=box.MASTER_LAB_TEMPLATES.population;
const q='采用连续logistic种群模型，环境容纳量K恒定，连续增长参数r恒定，初始数量为100个，环境容纳量K为1000个，连续增长参数r为0.5每天，经过10天，求种群模型数量、瞬时增长速率、起点后最大增长速率。';
const near=(a,b,tol=3e-14)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*tol,`${a} != ${b}`);
test('independent 60-digit decimal reference values for amount and rate',()=>{
 for(const [n,k,r,time,amount,rate]of [
  [100,1000,.5,10,942.8256185740148563,26.9527357672705543],
  [100,1000,.5,4,450.8530603792838225,123.7922891629588392],
  [750,1000,.5,2,890.7682274269640720,48.6500962167942420],
  [500,1000,.5,2,731.0585786300048793,98.3059666207409263],
  [1,3,.5,1,1.3555882856328181314,.3715242094589219130],
  [10,100,.25,1.25,13.1847140751101070,2.8615868056715103382],
  [999999,1000000,2,20,1000000,8.49671700730018529e-18]]){
  const m=C.logistic(n,k,r,time);near(m.quantity,amount);near(m.growthRate,rate);
 }
});
test('independent RK4 integration of the differential equation across initial regimes',()=>{
 for(const n of [10,500,900])for(const r of [.01,.5,2])for(const time of [.25,10,20]){
  const h=time/4000,f=p=>r*p*(1-p/1000);let expected=n;
  for(let i=0;i<4000;i++){const a=f(expected),b=f(expected+h*a/2),c=f(expected+h*b/2),d=f(expected+h*c);expected+=h*(a+2*b+2*c+d)/6;}
  const actual=C.logistic(n,1000,r,time);near(actual.quantity,expected,2e-9);
  assert.ok(actual.growthRate>0);assert.ok(actual.points.every((p,i,a)=>i===0||p.quantity>=a[i-1].quantity));
 }
});
test('half-capacity maximum is distinguished from the maximum after a high initial state',()=>{
 const before=C.logistic(100,1000,.5,10),at=C.logistic(500,1000,.5,0),after=C.logistic(750,1000,.5,2);
 near(before.peakTime,4.394449154672439);assert.equal(before.peakRate,125);assert.equal(before.peakQuantity,500);assert.equal(before.peakPosition,'future');
 assert.ok(before.points.some(p=>Math.abs(p.quantity-500)<1e-12));assert.equal(at.peakTime,0);assert.equal(at.peakRate,125);assert.equal(at.peakPosition,'initial');
 assert.equal(after.peakTime,0);near(after.peakRate,93.75);assert.equal(after.peakQuantity,750);assert.equal(after.peakPosition,'past');assert.ok(after.inflectionTime<0);
 const odd=C.logistic(1,3,.5,10);assert.equal(odd.peakQuantity,1.5);assert.equal(odd.peakRate,.375);
 const far=C.logistic(1,1000000,.01,20);assert.ok(far.peakTime>20);assert.equal(far.points.length,121);
});
test('initial point exact; saturation keeps a positive growth rate even when quantity rounds to K',()=>{
 for(const initial of [1,333,999999])assert.equal(C.logistic(initial,1000000,.73,0).quantity,initial);
 const m=C.logistic(999999,1000000,2,20);assert.equal(m.quantity,1000000);assert.ok(m.growthRate>0);
 const f={...t.presetFor('senior','logistic').fixed,initial:999999,capacity:1000000};
 assert.match(t.content(2,20,f).visualHtml,/不等于已经精确达到K/);
});
test('closed solution obeys the ODE under independent finite differencing',()=>{
 for(const [initial,k,r,time]of [[20,100,.3,2],[500,1000,.8,3],[900,1000,.5,5]]){
  const m=C.logistic(initial,k,r,time),slope=(C.logistic(initial,k,r,time+.01).quantity-C.logistic(initial,k,r,time-.01).quantity)/.02;
  near(m.growthRate,slope,2e-5);
 }
});
test('bounds and precision fail rather than clip values or silently supply missing coefficients',()=>{
 for(const args of [[0,1000,.5,2],[1.5,1000,.5,2],[1000,1000,.5,2],[1001,1000,.5,2],[1,1000001,.5,2],[1,1000,0,2],[1,1000,2.01,2],[1,1000,.501,2],[1,1000,.5,-1],[1,1000,.5,20.01],[1,1000,.5,2.001],[1,1000,NaN,2]])assert.throws(()=>C.logistic(...args));
});
test('continuous parser and shared guard retain every condition, unit and ask',()=>{
 const p=t.parseQuestion(q);assert.equal(p.ok,true,p.message);assert.equal(p.fixed.mode,'logistic');assert.equal(p.p1,.5);assert.equal(p.p2,10);
 assert.equal(p.fixed.initial,100);assert.equal(p.fixed.capacity,1000);assert.equal(p.fixed.timeUnit,'day');assert.equal(p.fixed.asks,'peak,quantity,rate');
 const content=t.content(p.p1,p.p2,p.fixed);near(content.model.quantity,942.8256185740149);assert.equal(content.params[0].min,.01);assert.equal(content.params[1].step,.01);assert.equal(content.params[1].unit,'天');
 assert.equal(t.checkQuestion(q,p.p1,p.p2,p.fixed).ok,true);assert.equal(t.checkQuestion(q,p.p1,p.p2,{...p.fixed,capacity:2000}).ok,false);
});
test('both modes and grades roundtrip without turning continuous days into integer periods',()=>{
 for(const mode of ['logistic','discrete'])for(const level of ['junior','senior']){
  const preset=t.presetFor(level,mode),f={...preset.fixed,levelLocked:true};const p=t.parseQuestion(t.question(preset.p1,preset.p2,f));assert.equal(p.ok,true,p.message);assert.equal(p.fixed.mode,mode);assert.equal(p.fixed.level,level);
 }
 for(const asks of ['quantity','rate','peak','quantity,rate','peak,quantity','peak,rate','peak,quantity,rate']){
  const f={...t.presetFor('senior','logistic').fixed,asks};const p=t.parseQuestion(t.question(.01,1.25,f));assert.equal(p.ok,true,p.message);assert.equal(p.p2,1.25);assert.equal(p.fixed.asks,asks);
 }
 const old=t.presetFor('senior');delete old.fixed.mode;assert.equal(t.parseQuestion(t.question(old.p1,old.p2,old.fixed)).fixed.mode,'discrete');
});
const rejects=[q.replace('采用连续logistic种群模型，',''),q.replace('环境容纳量K恒定，',''),q.replace('连续增长参数r恒定，',''),q.replace('环境容纳量K为1000个，',''),q.replace('连续增长参数r为0.5每天，',''),q.replace('初始数量为100个，',''),q.replace('经过10天，',''),q.replace('0.5每天','0.5'),q.replace('0.5每天','0.5每年'),q.replace('0.5每天','0.501每天'),q.replace('10天','10.001天'),q.replace('10天','10期'),q.replace('初始数量为100个','初始数量为1000个'),q.replace('初始数量为100个','初始数量为1500个'),q.replace('环境容纳量K为1000个','环境容纳量K为1000.5个'),q+'每期数量是前一期的1.5倍。',q+'环境容纳量每年改变。',q+'求精确达到K的时间。',q+'求反推初态。',q+'初始数量为200个。',q+'求数量变化趋势。',q.replace('连续logistic','离散logistic'),q+'每天捕捞10个。'];
for(const invalid of rejects)test('reject unsupported logistic condition '+invalid,()=>assert.equal(t.parseQuestion(invalid).ok,false));
test('mode-specific text does not falsely promise a future peak or grade calculus as a junior requirement',()=>{
 const f={...t.presetFor('junior','logistic').fixed,initial:750};const content=t.content(.5,2,f);
 assert.match(content.model.peakExplanation,/最大值在第0天/);assert.match(content.visualHtml,/初中作为概念拓展/);assert.doesNotMatch(content.visualHtml,/dN\/dt/);
 for(const patch of [{constantRate:false},{constantCapacity:false},{timeUnit:'year'},{mode:'unknown'},{asks:'trend'}])assert.throws(()=>t.content(.5,2,{...f,...patch}));
});
