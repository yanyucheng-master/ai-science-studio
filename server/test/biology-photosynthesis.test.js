import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const f of ['physics-extra.js','biology-photosynthesis-core.js','biology-photosynthesis.js'])vm.runInNewContext(await readFile(new URL('../../web/'+f,import.meta.url),'utf8'),box);
const C=box.MasterLabPhotosynthesis,t=box.MASTER_LAB_TEMPLATES.photosynthesis;
const f=t.fixedWithDefaults(),q=t.question(1,1),json=x=>JSON.parse(JSON.stringify(x));

test('six stages and materials independently match the verified textbook operations',()=>{
 assert.deepEqual(Array.from(C.STEPS,s=>s.title),['暗处理','双面遮光与光照','摘叶并去纸','酒精水浴脱色','漂洗与滴碘','冲洗并观察']);
 for(const material of ['盆栽天竺葵','黑纸片','曲别针','酒精','清水','小烧杯','水浴锅','培养皿','碘液','镊子'])assert.ok(C.MATERIALS.includes(material));
 assert.ok(!C.MATERIALS.includes('酒精灯'));
 assert.match(C.STEPS[4].action,/先.*漂洗.*再.*培养皿.*碘液/);
 assert.match(C.STEPS[5].action,/稍停.*冲掉.*再比较/);
});
test('independent phase expectations preserve the actual chemical-test order',()=>{
 const expectations=[
  [0,0,'green','green',false],[1/6,1,'green','green',false],[1/3,2,'green','green',false],
  [.5,3,'green','green',false],[.64,3,'yellowWhite','yellowWhite',false],
  [2/3,4,'yellowWhite','yellowWhite',false],[.77,4,'iodine','iodine',false],
  [.85,5,'iodine','iodine',false],[.95,5,'blue','yellowWhite',true],[1,5,'blue','yellowWhite',true]
 ];
 for(const [p,step,exposed,covered,ready]of expectations){const x=C.frame(p);assert.deepEqual([x.step,x.exposed,x.covered,x.observationReady],[step,exposed,covered,ready]);}
 assert.equal(C.frame(1/6).paper,true);assert.equal(C.frame(1/3).paper,false);assert.equal(C.frame(1/3).paperRemoved,true);
 assert.equal(C.frame(2/3).waterRinse,true);assert.equal(C.frame(2/3).iodine,false);
});
test('rewind and reset are pure and cannot retain final stain in earlier steps',()=>{
 const before=json(C.frame(0));C.frame(1);assert.deepEqual(json(C.frame(0)),before);
 const positions=[0,.2,.6,.95,1],snapshots=positions.map(p=>json(C.frame(p)));
 for(let i=positions.length-1;i>=0;i--){C.frame(1);assert.deepEqual(json(C.frame(positions[i])),snapshots[i]);}
 for(const p of [-.01,1.01,NaN,Infinity,'1',null])assert.throws(()=>C.frame(p));
});
test('all supported combinations roundtrip without invented numerical conditions',()=>{
 for(let bits=1;bits<16;bits++){
  const asks=['conclusion','phenomenon','purpose','steps'].filter((_,i)=>bits>>i&1).join(',');
  const question=t.question(1,1,{...f,asks}),p=t.parseQuestion(question);
  assert.equal(p.ok,true,p.message);assert.equal(p.fixed.asks,asks);assert.equal(p.fixed.level,'junior');
  assert.equal(t.checkQuestion(question,1,1,p.fixed).ok,true);
  assert.equal(t.content(1,1,p.fixed).level,'junior');
 }
 assert.equal(t.parseQuestion(q,{gradeLevel:'senior'}).fixed.level,'junior');
 assert.equal(t.content().params.every(p=>p.locked),true);
});
test('question-first, punctuation and whitespace do not hide conditions',()=>{
 const chunks=q.slice(0,-1).split('，'),ask=chunks.pop();
 for(const sep of ['。',':','；','，'])assert.equal(t.parseQuestion(ask+sep+chunks.join(sep)+'。').ok,true);
 assert.equal(t.parseQuestion(q.replaceAll('，','，\n ')).ok,true);
});
const invalid=[
 q.replace('先暗处理一昼夜','先暗处理一小时'),q.replace('盆栽天竺葵先暗处理一昼夜，',''),
 q.replace('从上下两面局部遮光','从上面局部遮光'),q.replace('局部遮光','整叶遮光'),
 q.replace('阳光下几小时','灯光下5分钟'),q.replace('并移去黑纸片','但保留黑纸片'),
 q.replace('酒精水浴脱色','酒精灯直接加热脱色'),q.replace('酒精水浴脱色','清水水浴脱色'),
 q.replace('清水漂洗后','不漂洗直接'),q.replace('稍停片刻用清水冲掉碘液再观察','不冲洗碘液直接观察'),
 q.replace('实验结论','淀粉质量'),q.replace('实验现象','释放氧气的体积'),
 q+'二氧化碳浓度为0.04%。',q+'水浴温度80℃。',q+'先滴碘液，再用酒精脱色。',
 q+'求光合作用速率。',q+'最后用带火星木条检验氧气。',q+'盆栽天竺葵先暗处理一昼夜。',
 q.replace('实验现象','实验现象和淀粉质量'),q.replace('制造有机物','制造氧气'),
 '探究光合作用，说明实验现象。','绿叶在光下制造有机物，说明实验结论。',
 q.replace('清水漂洗后置于培养皿滴加碘液','滴加碘液后置于培养皿用清水漂洗')
];
invalid.forEach((s,i)=>test('reject full-question counterexample '+i,()=>assert.equal(t.parseQuestion(s).ok,false,s)));
test('front-loaded asks do not bypass late constraints or answer an unsupported subquestion',()=>{
 const clauses=q.slice(0,-1).split('，'),ask=clauses.pop(),conditions=clauses.join('，');
 for(const suffix of ['二氧化碳不足。','酒精浓度为75%。','求原见光区的淀粉质量。','实验现象为绿色（滴碘后）。'])assert.equal(t.parseQuestion(ask+'：'+conditions+'。'+suffix).ok,false);
 assert.equal(t.parseQuestion('说明实验现象和光合作用速率：'+conditions+'。').ok,false);
});
test('fixed protocol and asks are validated for direct models and restoration',()=>{
 for(const [a,b]of [[0,1],[2,1],[1,0],[1,2],[1.0001,1]])assert.throws(()=>t.model(a,b,f));
 for(const patch of [{curriculum:'old-7a'},{protocolVersion:2},{level:'senior'},{asks:'oxygen'},{asks:'phenomenon,phenomenon'},{temperature:80}])assert.throws(()=>t.model(1,1,{...f,...patch}));
 const m=t.model(1,1,f);assert.match(m.conclusion,/光.*不可缺少/);assert.match(m.readout,/教材预期/);
 assert.equal('starchMass'in m,false);assert.equal('oxygenVolume'in m,false);
});
test('visual is local markup and does not echo untrusted input or add a player',()=>{
 const html=t.visual(t.model(1,1,f));assert.equal((html.match(/data-photosynthesis-step=/g)||[]).length,6);
 assert.equal(/<script|onclick=|requestAnimationFrame|data-photo-play/.test(html),false);
 assert.match(html,/水浴/);assert.match(html,/不是真实生理速率/);
 assert.equal(t.parseQuestion(q+'<img src=x onerror=alert(1)>').ok,false);
});
