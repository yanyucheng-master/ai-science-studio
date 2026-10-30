import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','math-extra.js','math-experiments.js','unit-circle.js'])vm.runInNewContext(await readFile(new URL(`../../web/${file}`,import.meta.url),'utf8'),box,{filename:file});
const t=box.MASTER_LAB_TEMPLATES.unitCircle;
const near=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const parse=q=>t.parseQuestion(q,{gradeLevel:'senior'});
const fixed=extra=>t.fixedWithDefaults(extra);
const bank=JSON.parse(await readFile(new URL('../eval/local-template-bank.json',import.meta.url),'utf8'));
for(const row of bank.filter(r=>(r.templateId||r.target)==='unitCircle'))test(`unit circle bank ${row.expect}: ${row.q}`,()=>{
 const v=parse(row.q);assert.equal(v.ok,row.expect==='local',v.message);if(v.ok){const m=t.model(v.p1,v.p2,v.fixed);for(const [key,expected]of Object.entries(row.answer||{}))near(key==='p1'?v.p1:key==='p2'?v.p2:m[key],expected);}
});

for(const [degree,x,y,cos,sin,position]of [
 [0,1,0,'1','0','x轴正半轴'],[90,0,1,'0','1','y轴正半轴'],[180,-1,0,'−1','0','x轴负半轴'],[270,0,-1,'0','−1','y轴负半轴'],
 [-360,1,0,'1','0','x轴正半轴'],[360,1,0,'1','0','x轴正半轴'],[30,Math.sqrt(3)/2,.5,'√3/2','1/2','Ⅰ'],[-30,Math.sqrt(3)/2,-.5,'√3/2','−1/2','Ⅳ'],
 [45,Math.SQRT1_2,Math.SQRT1_2,'√2/2','√2/2','Ⅰ'],[120,-.5,Math.sqrt(3)/2,'−1/2','√3/2','Ⅱ'],[225,-Math.SQRT1_2,-Math.SQRT1_2,'−√2/2','−√2/2','Ⅲ']
])test(`independent exact unit circle ${degree}°`,()=>{
 const m=t.model(degree,1,fixed());near(m.cos,x);near(m.sin,y);assert.equal(m.cosText,cos);assert.equal(m.sinText,sin);assert.ok(m.position.includes(position));assert.equal(m.exact,true);
 assert.equal(Object.is(m.sin,-0)||Object.is(m.cos,-0),false);if(degree%90===0)assert.match(m.position,/不属于象限/);
});

// Independent convergent Taylor sums, rather than Math.sin/cos or model output.
function handSeries(degree){
 let x=degree*3.141592653589793/180;while(x>Math.PI)x-=2*Math.PI;while(x<-Math.PI)x+=2*Math.PI;
 let sin=x,cos=1,st=x,ct=1;
 for(let i=1;i<=20;i++){st*=-x*x/((2*i)*(2*i+1));ct*=-x*x/((2*i-1)*(2*i));sin+=st;cos+=ct;}
 return {sin,cos};
}
test('ordinary angles agree with independent series, not special-angle rounding',()=>{
 for(const degree of [-359.99,-271.23,-179.99,-.01,.01,17.32,29.99,30.01,89.99,90.01,179.99,359.99]){
  const expected=handSeries(degree),m=t.model(degree,1,fixed());near(m.sin,expected.sin);near(m.cos,expected.cos);assert.equal(m.exact,false);assert.match(m.sinText,/^≈/);assert.match(m.cosText,/^≈/);
 }
 assert.match(t.model(89.99,1,fixed()).position,/Ⅰ/);assert.match(t.model(90.01,1,fixed()).position,/Ⅱ/);assert.match(t.model(-.01,1,fixed()).position,/Ⅳ/);
 assert.ok(t.model(89.99,1,fixed()).cos>0);assert.equal(t.model(90,1,fixed()).cos,0);
});
test('identity, signs, symmetry and periodic coordinates, with original rotation retained',()=>{
 for(let cents=-36000;cents<=0;cents+=137){
  const degree=cents/100,other=(cents+36000)/100,m=t.model(degree,1,fixed()),n=t.model(other,1,fixed());
  near(m.sin*m.sin+m.cos*m.cos,1);near(m.sin,n.sin);near(m.cos,n.cos);assert.equal(m.theta,degree);assert.equal(n.theta,other);
  const negative=t.model(-degree,1,fixed());near(negative.sin,-m.sin);near(negative.cos,m.cos);
 }
 const a=t.model(330,1,fixed()),b=t.model(-30,1,fixed());near(a.sin,b.sin);near(a.cos,b.cos);assert.equal(a.direction,'逆时针');assert.equal(b.direction,'顺时针');assert.notEqual(a.radianExact,b.radianExact);assert.notEqual(a.turns,b.turns);
 assert.equal(a.turnsText,'11/12');assert.equal(b.turnsText,'1/12');
});
test('exact radians conversion uses integer divisibility, no expression evaluation',()=>{
 for(const [text,value]of [['π/6',30],['-π/2',-90],['π/4',45],['3π/2',270],['-2π',-360],['2π',360],['π/18000',.01],['0',0]])assert.equal(t.parseAngle(text,'rad'),value);
 for(const raw of ['π/7','π/36000','1+π/6','Math.PI/6','globalThis.bad=1','1','13π/6','π/0','π/-2','1.5π','9999999π'])assert.equal(t.parseAngle(raw,'rad'),null,raw);
 for(const [d,text]of [[30,'π/6'],[-90,'−π/2'],[45,'π/4'],[0,'0'],[360,'2π'],[-360,'−2π'],[.01,'π/18000']])assert.equal(t.radiansText(d),text);
 assert.equal(box.bad,undefined);
});
const positive=[
 '在单位圆中，角θ=30°，求sinθ和cosθ。',
 '求sinθ、cosθ、点P的坐标。单位圆中角θ=-π/2。',
 '求点P的坐标：单位圆中，角θ=π/6rad。',
 '在圆心为原点O、半径为1的单位圆中，角θ=45度，判断象限或坐标轴位置。',
 '单位圆中，θ=-360°，求cosθ；说明周期关系。',
 '单位圆中，θ=0rad，判断坐标轴位置。',
 '单位圆中，角度为-30.01°，求正弦值、余弦值。',
 '单位圆中，θ=π/18000弧度，求点P的坐标。',
 '单位圆中θ=150°，求sinθ、cosθ，并求点P的坐标。',
 '单位圆中θ=150°，求 sinθ、cosθ，并求点 P 的坐标。',
 '单位圆中，θ=30°，求sinθ，再判断象限。',
 '单位圆中，θ=-π/3，求cosθ，求点P的坐标。'
];
for(const q of positive)test(`checked complete question: ${q}`,()=>{const v=parse(q);assert.equal(v.ok,true,v.message);const m=t.model(v.p1,v.p2,v.fixed);assert.ok(!/NaN|undefined|Infinity/.test(m.conclusion));});
const negative=[
 '单位圆中，θ=30，求sinθ。','单位圆中，θ=0，求cosθ。','单位圆中，θ=π/6°，求sinθ。','单位圆中，θ=30°rad，求cosθ。',
 '单位圆中，θ=π/7，求点P的坐标。','单位圆中，θ=π/36000，求sinθ。','单位圆中，θ=1rad，求sinθ。','单位圆中，θ=0.005°，求sinθ。',
 '单位圆中，θ=360.01°，求sinθ。','单位圆中，θ=-360.01°，求sinθ。','单位圆中，θ=30.000°，求cosθ。','单位圆中，θ=30°，θ=45°，求cosθ。',
 '单位圆中，半径为2，θ=30°，求sinθ。','单位圆中，半径为1cm，θ=30°，求点P的坐标。','单位圆中，半径为1，半径为1，θ=30°，求sinθ。',
 '求sinθ。单位圆中，θ=30°（温度）。','求点P的坐标：单位圆中，θ=30°（余弦值）。','单位圆中，sinθ=1/2，求角θ。',
 '单位圆中，θ=30°，求sinθ和tanθ。','单位圆中，θ=30°，求cosθ和温度。','单位圆中，θ=30°，求消耗sinθ。',
 '单位圆中，θ=30°，求sinθ。振幅为2。','单位圆中，θ=30°，求三角方程的解。','单位圆中，θ=30°，求导数。','单位圆中，θ=30°，求反正弦。',
 '单位圆中，θ=30°，求sinθ。另一个角为60°。','角θ=30°，求sinθ。','单位圆中，θ=1+π/6，求sinθ。',
 '单位圆中θ=150°，求sinθ，并求tanθ。','单位圆中θ=150°，求sinθ，并求点Q的坐标。'
];
for(const q of negative)test(`reject full-sentence counterexample: ${q}`,()=>assert.equal(parse(q).ok,false,q));
test('canonical question/fixed unit/asks roundtrip every angle and mode, fixed radius never unlocked',()=>{
 for(const degree of [-360,-270,-30.01,0,.01,30,45,89.99,360])for(const unit of ['deg','rad'])for(const asks of ['sin','cos,point,position','cos,periodic,point,position,sin']){
  const f=fixed({unit,asks}),q=t.question(degree,1,f),v=parse(q);assert.equal(v.ok,true,`${q}: ${v.message}`);assert.equal(v.p1,degree);assert.equal(v.p2,1);assert.equal(v.fixed.unit,unit);assert.equal(v.fixed.asks,asks);
  const c=t.content(degree,1,f);assert.equal(c.params[1].locked,true);assert.equal(c.params[1].min,1);assert.equal(c.params[1].max,1);assert.doesNotMatch(JSON.stringify(c),/物理量|NaN|undefined|Infinity/);
 }
 for(const degree of [NaN,Infinity,-360.01,360.01,.001])assert.throws(()=>t.model(degree,1,fixed()),{name:'RangeError'});
 for(const r of [0,2,1.01])assert.throws(()=>t.model(30,r,fixed()),{name:'RangeError'});
 assert.throws(()=>t.model(30,1,fixed({unit:'unknown'})),{name:'RangeError'});
 assert.throws(()=>t.model(30,1,fixed({asks:'tan'})),{name:'RangeError'});
});
test('ordinary sine word does not match unit circle or alter old template parsing',()=>{
 for(const q of ['函数y=sinx，求在x=0处的切线。','二次函数y=x²，求顶点坐标。','直角三角形两条直角边分别为3cm和4cm，求斜边长度。','等差数列首项为1，公差为2，项数为10，求前n项和。'])assert.equal(parse(q).ok,false,q);
 assert.equal(box.MASTER_LAB_TEMPLATES.pythagoras.parseQuestion('直角三角形两条直角边分别为3cm和4cm，求斜边长度。').ok,true);
 assert.equal(Object.hasOwn(box.MASTER_LAB_TEMPLATES,'arithmeticSum'),false);
});
