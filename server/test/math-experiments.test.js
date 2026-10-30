import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','math-extra.js','math-experiments.js'])vm.runInNewContext(await readFile(new URL(`../../web/${file}`,import.meta.url),'utf8'),box,{filename:file});
const {pythagoras:p}=box.MASTER_LAB_TEMPLATES;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const parse=(t,q)=>t.parseQuestion(q,{gradeLevel:t.level});
const bank=JSON.parse(await readFile(new URL('../eval/local-template-bank.json',import.meta.url),'utf8'));
for(const row of bank.filter(r=>(r.templateId||r.target)==='pythagoras')){
 test(`new math bank ${row.expect}: ${row.q}`,()=>{const t=box.MASTER_LAB_TEMPLATES[row.templateId||row.target],v=parse(t,row.q);assert.equal(v.ok,row.expect==='local',v.message);if(v.ok){const m=t.model(v.p1,v.p2,v.fixed);for(const [key,value]of Object.entries(row.answer||{})){const actual=key==='p1'?v.p1:key==='p2'?v.p2:m[key];typeof value==='number'?near(actual,value):assert.ok(actual.includes(value),`${key}: ${actual}`);}}});
}
test('independent right triangles and three squares: finite decimals, radicals and endpoints',()=>{
 for(const [a,b,c,area,perimeter] of [[3,4,5,6,12],[5,12,13,30,30],[1,1,Math.SQRT2,.5,2+Math.SQRT2],[12,12,12*Math.SQRT2,72,24+12*Math.SQRT2],[1.5,2,2.5,1.5,6],[1.25,1.25,1.25*Math.SQRT2,.78125,2.5+1.25*Math.SQRT2]]){
  const m=p.model(a,b,p.fixedWithDefaults());near(m.c,c);near(m.area,area);near(m.perimeter,perimeter);
  near((a+b)**2-4*area,m.c2);near(m.c**2,a*a+b*b);
 }
 assert.deepEqual([p.model(3,4).a2,p.model(3,4).b2,p.model(3,4).c2],[9,16,25]);
 assert.deepEqual([p.model(5,12).a2,p.model(5,12).b2,p.model(5,12).c2],[25,144,169]);
 assert.match(p.model(1,1,p.fixedWithDefaults()).cText,/√2/);
 assert.equal(p.model(1.5,2).cText,'2.5');assert.equal(p.model(1.25,1.25).cExact,'5√2/4');
});
test('area proof: symmetry, scaling and four triangles preserve area',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  const m=p.model(a,b,p.fixedWithDefaults()),swap=p.model(b,a,p.fixedWithDefaults()),double=p.model(2*a,2*b,p.fixedWithDefaults());
  near(swap.c,m.c);near(swap.area,m.area);near(double.c,2*m.c);near(double.area,4*m.area);
 }
});
const polygonArea=pts=>Math.abs(pts.reduce((sum,[x,y],i)=>{const [u,v]=pts[(i+1)%pts.length];return sum+x*v-y*u;},0))/2;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Independent convex polygon intersection, including polygons that share edges.
function intersection(subject,clip){
 let out=subject;
 for(let i=0;i<clip.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],input=out;out=[];if(!input.length)break;
  for(let j=0;j<input.length;j++){
   const q=input[j],r=input[(j+input.length-1)%input.length],qv=cross(a,b,q),rv=cross(a,b,r),qi=qv>=-1e-10,ri=rv>=-1e-10;
   if(qi!==ri){const t=rv/(rv-qv);out.push([r[0]+t*(q[0]-r[0]),r[1]+t*(q[1]-r[1])]);}
   if(qi)out.push(q);
  }
 }
 return out;
}
const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
test('both terminal partitions: containment, pairwise nonoverlap, no missing area, central right angles',()=>{
 const examples=[[3,4],[5,12],[1,1],[1,12],[12,1],[12,12],[1.01,11.99],[3.25,4.75]];
 for(let i=0;i<80;i++)examples.push([1+((i*137)%1101)/100,1+((i*283)%1101)/100]);
 for(const [a,b]of examples)for(const end of [0,1]){
  const geo=p.geometryAt(a,b,end),shapes=[...geo.pieces.map(t=>t.vertices),...(end?geo.squares:[geo.center])];
  for(const shape of shapes)for(const [x,y]of shape)assert.ok(x>=-1e-9&&y>=-1e-9&&x<=geo.L+1e-9&&y<=geo.L+1e-9);
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++)assert.ok(polygonArea(intersection(shapes[i],shapes[j]))<1e-7,`${a}/${b} end${end}: overlap ${i}/${j}`);
  near(shapes.reduce((sum,v)=>sum+polygonArea(v),0),(a+b)**2);
  for(const square of end?geo.squares:[geo.center]){
   const lengths=square.map((v,i)=>distance2(v,square[(i+1)%4]));lengths.forEach(v=>near(v,lengths[0]));
   for(let i=0;i<4;i++){const u=square[i],v=square[(i+1)%4],w=square[(i+2)%4];near((v[0]-u[0])*(w[0]-v[0])+(v[1]-u[1])*(w[1]-v[1]),0);}
  }
 }
});
test('moving pieces retain rigidity and area, with reset equal to the first valid partition',()=>{
 for(const [a,b]of [[1,12],[12,1],[3.25,4.75],[1,1]])for(const progress of [0,.1,.3,.5,.9,1,0]){
  const geo=p.geometryAt(a,b,progress);
  for(const piece of geo.pieces){const v=piece.vertices;near(distance2(v[0],v[1]),a*a);near(distance2(v[0],v[2]),b*b);near(distance2(v[1],v[2]),a*a+b*b);near(polygonArea(v),a*b/2);}
 }
 const html=p.visual(p.model(1,12));assert.equal((html.match(/data-puzzle-piece=/g)||[]).length,8);assert.match(html,/不是复刻教材赵爽图/);assert.match(html,/先证明/);assert.match(html,/再应用/);
});
test('no rounding or clamping of fractional, missing, nonfinite and out-of-range values',()=>{
 for(const [a,b]of [[0,4],[12.01,4],[3.001,4],[NaN,4],[3,Infinity],[-1,4]])assert.throws(()=>p.model(a,b,p.fixedWithDefaults()),{name:'RangeError'});
});
test('generated questions roundtrip all values and asks',()=>{
 for(const [t,a,b,f]of [[p,3,4,{}],[p,12,1,{}],[p,1.25,11.99,{asks:'areaA,areaC'}]]){
  const fixed=t.fixedWithDefaults(f),q=t.question(a,b,fixed),parsed=parse(t,q);
  assert.equal(parsed.ok,true,`${q}: ${parsed.message}`);assert.equal(parsed.p1,a);assert.equal(parsed.p2,b);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.fixed)),JSON.parse(JSON.stringify(fixed)));
  assert.doesNotMatch(JSON.stringify(t.content(a,b,fixed)),/NaN|undefined|Infinity|物理量/);
 }
});
test('question-first, condition-first, colon/period and explicit labels',()=>{
 for(const q of ['求斜边长度。直角三角形的两条直角边分别为3cm和4cm。','求斜边长度：直角三角形的直角边a=3cm，直角边b=4cm。','三角形ABC中，∠C=90°，AC=40mm，BC=0.03m，求三个边上正方形的面积。','直角三角形的直角边b=4cm，直角边a=3.25cm，求直角边a上正方形的面积。'])assert.equal(parse(p,q).ok,true,`${q}: ${parse(p,q).message}`);
});
test('natural unlabelled-leg phrasing from the 10-30 public acceptance report',()=>{
 for(const [q,a,b,asks]of [
  ['两直角边分别为6cm和8cm，求斜边长。',6,8,'hypotenuse'],
  ['两直角边分别为 6 cm 和 8 cm，求斜边。',6,8,'hypotenuse'],
  ['一个直角三角形的两条直角边分别是9cm和12cm，用面积拼图验证勾股定理。',9,12,'proof'],
  ['两条直角边分别是9cm和12cm，用面积拼图验证。',9,12,'proof'],
  ['Rt△ABC中，两直角边长分别为6和8cm，利用勾股定理求斜边的长。',6,8,'hypotenuse'],
  ['直角三角形两直角边分别为5cm和12cm，求斜边，并说明面积关系。',5,12,'hypotenuse,proof'],
  ['直角三角形的直角边分别为30mm、0.04m，求斜边长度。',3,4,'hypotenuse']
 ]){const v=parse(p,q);assert.equal(v.ok,true,`${q}: ${v.message}`);assert.equal(v.p1,a);assert.equal(v.p2,b);assert.equal(v.fixed.asks,asks);}
 for(const q of ['两直角边分别为6和8，求斜边。','两直角边分别为6cm和8cm，斜边为10cm，求斜边。','两直角边分别为6cm和8cm，求斜边并求三角形面积。','两直角边之和为14cm，求斜边。','两直角边分别为6cm和8，求斜边。','直角边为6cm，求斜边。','两直角边分别为6cm和8cm，用面积拼图验证周长。'])
  assert.equal(parse(p,q).ok,false,q);
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
  '直角三角形两条直角边分别为3.001cm和4cm，求斜边长度。',
  '直角三角形两条直角边分别为3cm和4cm，求三角形面积和周长。',
  '三角形ABC中，∠A=90°，BC=3cm，AC=4cm，求斜边长度。',
  '三角形两边分别为3cm和4cm，求斜边长度。',
  '直角三角形两条直角边分别为3cm和4cm，BC=5cm，求斜边长度。',
  '求斜边长度。直角三角形两条直角边分别为30.01mm和4cm。',
  '直角三角形两条直角边分别为3cm和4cm，求减少斜边的长度。'
 ])assert.equal(parse(p,q).ok,false,q);

});

test('deferred arithmetic template is absent from the registry',()=>{assert.equal(Object.hasOwn(box.MASTER_LAB_TEMPLATES,'arithmeticSum'),false);});
