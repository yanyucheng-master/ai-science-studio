import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','math-extra.js','math-experiments.js'])vm.runInNewContext(await readFile(new URL(`../../web/${file}`,import.meta.url),'utf8'),box,{filename:file});
const {pythagoras:p,arithmeticSum:s}=box.MASTER_LAB_TEMPLATES;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const parse=(t,q)=>t.parseQuestion(q,{gradeLevel:t.level});
const bank=JSON.parse(await readFile(new URL('../eval/local-template-bank.json',import.meta.url),'utf8'));
for(const row of bank.filter(r=>['pythagoras','arithmeticSum'].includes(r.templateId||r.target))){
 test(`new math bank ${row.expect}: ${row.q}`,()=>{const t=box.MASTER_LAB_TEMPLATES[row.templateId||row.target],v=parse(t,row.q);assert.equal(v.ok,row.expect==='local',v.message);if(v.ok){const m=t.model(v.p1,v.p2,v.fixed);for(const [key,value]of Object.entries(row.answer||{})){const actual=key==='p1'?v.p1:key==='p2'?v.p2:m[key];typeof value==='number'?near(actual,value):assert.ok(actual.includes(value),`${key}: ${actual}`);}}});
}
test('independent right triangles: 3-4-5, 5-12-13, irrational and endpoints',()=>{
 for(const [a,b,c,area,perimeter] of [[3,4,5,6,12],[5,12,13,30,30],[1,1,Math.SQRT2,.5,2+Math.SQRT2],[20,20,20*Math.SQRT2,200,40+20*Math.SQRT2]]){
  const m=p.model(a,b,p.fixedWithDefaults());near(m.c,c);near(m.area,area);near(m.perimeter,perimeter);
  near((a+b)**2-4*area,m.c2);near(m.c**2,a*a+b*b);
 }
 assert.match(p.model(1,1,p.fixedWithDefaults()).cText,/√2/);
});
test('area proof: symmetry, scaling and four triangles preserve area',()=>{
 for(let a=1;a<=10;a++)for(let b=1;b<=10;b++){
  const m=p.model(a,b,p.fixedWithDefaults()),swap=p.model(b,a,p.fixedWithDefaults()),double=p.model(2*a,2*b,p.fixedWithDefaults());
  near(swap.c,m.c);near(swap.area,m.area);near(double.c,2*m.c);near(double.area,4*m.area);
 }
});
test('actual SVG polygons: four congruent triangles, central square, no missing area',()=>{
 for(const [a,b]of [[3,4],[1,20],[20,1],[20,20]]){
  const m=p.model(a,b,p.fixedWithDefaults()),html=p.visual(m),points=[...html.matchAll(/<polygon points="([^"]+)"/g)].map(v=>v[1].split(' ').map(pair=>pair.split(',').map(Number)));
  const area=pts=>Math.abs(pts.reduce((sum,[x,y],i)=>{const [u,v]=pts[(i+1)%pts.length];return sum+x*v-y*u;},0))/2;
  const scale=260/(a+b);assert.equal(points.length,5);for(const triangle of points.slice(0,4))assert.ok(Math.abs(area(triangle)-a*b/2*scale**2)<.001);
  assert.ok(Math.abs(area(points[4])-(a*a+b*b)*scale**2)<.001);assert.ok(Math.abs(points.reduce((sum,polygon)=>sum+area(polygon),0)-260*260)<.001);
  const square=points[4],edges=square.map(([x,y],i)=>[square[(i+1)%4][0]-x,square[(i+1)%4][1]-y]);
  for(let i=0;i<4;i++)assert.ok(Math.abs(edges[i][0]*edges[(i+1)%4][0]+edges[i][1]*edges[(i+1)%4][1])<.001);
 }
});
test('independent sequence answers, negative/zero difference, n=1 and odd count',()=>{
 for(const [a,d,n,an,sum]of [[1,2,10,19,100],[2,3,5,14,40],[5,-2,6,-5,0],[-3,0,7,-3,-21],[20,-10,1,20,20],[-20,-10,30,-310,-4950]]){
  const m=s.model(d,n,s.fixedWithDefaults({a1:a}));assert.equal(m.an,an);assert.equal(m.sum,sum);
 }
 for(let a=-20;a<=20;a+=5)for(let d=-10;d<=10;d++)for(let n=1;n<=30;n++){
  let expected=0,term=a;for(let i=0;i<n;i++){expected+=term;term+=d;}
  const m=s.model(d,n,s.fixedWithDefaults({a1:a}));assert.equal(m.sum,expected);assert.ok(m.terms.every((v,i)=>v+m.terms[n-1-i]===m.pair));
 }
});
test('no rounding or clamping of fractional, missing, nonfinite and out-of-range values',()=>{
 for(const [a,b]of [[0,4],[21,4],[3.5,4],[NaN,4],[3,Infinity]])assert.throws(()=>p.model(a,b,p.fixedWithDefaults()),{name:'RangeError'});
 for(const [d,n,a]of [[11,10,1],[2,0,1],[2,31,1],[2,3.2,1],[.1,10,1],[2,10,21],[2,10,NaN]])assert.throws(()=>s.model(d,n,s.fixedWithDefaults({a1:a})),{name:'RangeError'});
});
test('generated questions roundtrip all values and asks',()=>{
 for(const [t,a,b,f]of [[p,3,4,{}],[p,20,1,{}],[s,-3,5,{a1:-4}],[s,0,1,{a1:20}]]){
  const fixed=t.fixedWithDefaults(f),q=t.question(a,b,fixed),parsed=parse(t,q);
  assert.equal(parsed.ok,true,`${q}: ${parsed.message}`);assert.equal(parsed.p1,a);assert.equal(parsed.p2,b);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.fixed)),JSON.parse(JSON.stringify(fixed)));
  assert.doesNotMatch(JSON.stringify(t.content(a,b,fixed)),/NaN|undefined|Infinity|物理量/);
 }
});
test('question-first, condition-first, colon/period and explicit labels',()=>{
 for(const q of ['求斜边长度。直角三角形的两条直角边分别为3cm和4cm。','求斜边长度：直角三角形的直角边a=3cm，直角边b=4cm。','直角三角形的直角边b=4cm，直角边a=3cm，求三角形面积和周长。'])assert.equal(parse(p,q).ok,true,`${q}: ${parse(p,q).message}`);
 for(const q of ['求前10项和。等差数列首项为1，公差为2。','求第n项：等差数列项数n=10，公差d=2，首项a₁=1。','等差数列首项为-3，公差为0，项数为7，求前n项的和。'])assert.equal(parse(s,q).ok,true,`${q}: ${parse(s,q).message}`);
});
test('reject inverse questions, numeric roles, unknown constraints/types/actions and unsupported units',()=>{
 for(const q of [
  '直角三角形两条直角边分别为3cm和4cm（周长），求斜边长度。',
  '求斜边长度。直角三角形两条直角边分别为3cm和4cm（面积）。',
  '直角三角形两条直角边分别为3cm和4cm，求斜边面积。',
  '直角三角形两条直角边分别为3cm和4cm，求斜边长度和角度。',
  '直角三角形两条直角边分别为3cm和4cm，求斜边长度。周长为99cm。',
  '直角三角形两条直角边分别为3m和4m，求斜边长度。',
  '直角三角形斜边为5cm，直角边a=3cm，求另一条直角边。',
  '直角三角形两条直角边分别为3.1cm和4cm，求斜边长度。',
  '直角三角形两条直角边分别为3cm和4cm，求减少斜边的长度。'
 ])assert.equal(parse(p,q).ok,false,q);
 for(const q of [
  '等差数列首项为1，公差为2，项数为10，求前n项的面积。',
  '等差数列首项为1，公差为2，项数为10，求前n项和及概率。',
  '求前n项和。等差数列首项为1，公差为2（末项），项数为10。',
  '等差数列首项为1，公差为2，项数为10（和），求第n项。',
  '等差数列首项为1，公差为2，项数为10，求前9项和。',
  '等差数列首项为1，项数为10，求公差。',
  '等差数列首项为1，公差为2，项数为10，求前n项和。末项为999。',
  '等差数列首项为1g，公差为2，项数为10，求前n项和。',
  '等差数列首项为1，公差为2，项数为10.1，求前n项和。'
 ])assert.equal(parse(s,q).ok,false,q);
});
