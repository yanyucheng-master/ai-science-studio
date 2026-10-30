import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const box={console,ScienceMotion:{circuitMarkup:()=>''}};box.window=box;
for(const file of ['physics-extra.js','chemistry-extra.js','chemistry-experiments.js','chemistry-equilibria.js','chemistry-equilibria-questions.js','chemistry-equilibria-experiments.js'])vm.runInNewContext(await readFile(new URL(`../../web/${file}`,import.meta.url),'utf8'),box,{filename:file});
const {hclNaohNeutralization:n,kno3Cooling:k}=box.MASTER_LAB_TEMPLATES;
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const parse=(t,q,gradeLevel='senior')=>t.parseQuestion(q,{gradeLevel});
const neutral=n.question(20,10),salt=k.question(100,20);
test('both presets, all supported asks and original levels roundtrip without changing values',()=>{
 for(const t of [n,k])for(const level of ['junior','senior'])for(const levelLocked of [false,true]){
  const preset=t.presetFor(level),f=t.fixedWithDefaults({...preset.fixed,levelLocked});
  const groups=t===n?[[10,0],[20,19.9999],[20,20.0001],[20.0001,20],[50,100]]:[[50,20],[100.0001,30],[150,40],[200,50],[100,60]];
  for(const [a,b]of groups)for(const asks of [f.asks,...f.asks.split(',')]){
   const fixed={...f,asks},q=t.question(a,b,fixed),p=parse(t,q,level);
   assert.equal(p.ok,true,`${q}: ${p.message}`);assert.equal(p.p1,a);assert.equal(p.p2,b);
   assert.equal(p.fixed.level,level);assert.equal(p.fixed.levelLocked,levelLocked);assert.equal(p.fixed.asks,asks);
   assert.doesNotMatch(JSON.stringify(t.content(a,b,fixed)),/NaN|Infinity|undefined/);
  }
 }
});
for(const q of [
 '求pH：25°C，初始盐酸20mL，累计加入NaOH 10mL，HCl与NaOH浓度均为0.1mol/L。',
 '判断酸碱性。25°C，初始有0.02L盐酸，已加入0.0199999L氢氧化钠溶液，盐酸浓度为0.1000mol/L，NaOH浓度为0.100mol/L。',
 '在25°C下，向20mL0.100mol/L的盐酸中累计加入30mL0.1mol/L的NaOH溶液，计算混合液pH。'
])test(`neutral grammar with explicit roles: ${q}`,()=>assert.equal(parse(n,q).ok,true,parse(n,q).message));
for(const [name,q]of [
 ['missing concentration',neutral.replace('HCl与NaOH的浓度均为0.100mol/L，','')],
 ['missing added volume',neutral.replace('累计加入NaOH溶液体积为10mL，','')],['wrong concentration',neutral.replace('0.100mol','0.2mol')],
 ['rounded concentration',neutral.replace('0.100mol','0.100000000000000001mol')],['wrong temperature',neutral.replace('25°C','26°C')],
 ['excess precision',neutral.replace('为10mL','为10.00001mL')],['unbound units',neutral.replace('为10mL','为10')],
 ['consumed is not initial',neutral.replace('初始盐酸','消耗盐酸')],['remaining is not added',neutral.replace('累计加入NaOH','剩余NaOH')],
 ['annotation relabels volume',neutral.replace('为10mL','为10mL（反应后余量）')],['same solution initial and added',neutral.replace('累计加入NaOH溶液','累计加入盐酸')],
 ['reverse direction asks for the beaker solution',neutral.replace('初始盐酸','初始NaOH溶液').replace('累计加入NaOH溶液','累计加入盐酸')],
 ['acid into base missing NaOH concentration','将20mL0.1mol/L盐酸滴入30mLNaOH溶液中，求混合液的pH。'],['undirected mixing','25°C，将20mL0.1mol/L盐酸与30mL0.1mol/LNaOH溶液混合，求pH。'],
 ['stated non-room temperature','20°C，向20mL0.1mol/L的盐酸中加入30mL0.1mol/L的NaOH溶液，求混合液的pH。'],['same reagent mixing','25°C，向20mL0.1mol/L的盐酸中加入30mL0.1mol/L的盐酸，求混合液的pH。'],
 ['duplicate condition',neutral+'初始盐酸体积为20mL。'],['extra subquestion',neutral.replace('，求','，求反应热、')],
 ['remaining amount',neutral.replace('理论恰好中和所需NaOH总体积','还需加入NaOH体积')],['indicator endpoint',neutral.replace('理论恰好中和所需NaOH总体积','酚酞变色的终点体积')],
 ['unknown substance',neutral.replace('HCl与NaOH','硫酸与NaOH')],['extra condition',neutral+'体积收缩为5mL。'],['unknown initial roles','25°C，盐酸20mL，NaOH10mL，HCl与NaOH浓度均为0.1mol/L，求pH。']
])test(`reject neutral ${name}`,()=>assert.equal(parse(n,q).ok,false,q));
test('both addition directions and room/unstated temperature roundtrip exactly',()=>{
 for(const direction of ['baseIntoAcid','acidIntoBase'])for(const temperatureAssumed of [false,true])for(const level of ['junior','senior'])for(const levelLocked of [false,true])
  for(const asks of ['equivalence,nature,ph','equivalence','nature','ph'])for(const [a,b]of [[10,0],[20,19.9999],[20,20.0001],[50,100],[35.5,12]]){
   const f=n.fixedWithDefaults({level,levelLocked,asks,direction,temperatureAssumed}),q=n.question(a,b,f),p=parse(n,q,level);
   assert.equal(p.ok,true,`${q}: ${p.message}`);assert.equal(p.p1,a);assert.equal(p.p2,b);
   assert.deepEqual(JSON.parse(JSON.stringify(n.fixedWithDefaults(p.fixed))),JSON.parse(JSON.stringify(f)));
   assert.doesNotMatch(JSON.stringify(n.content(a,b,f)),/NaN|Infinity|undefined/);
  }
});
for(const [q,p1,p2,direction,temperatureAssumed,pH]of [
 ['向20mL 0.100mol/L的盐酸中加入15mL 0.100mol/L的NaOH溶液，求混合液的pH。',20,15,'baseIntoAcid',true,1.84509804001],
 ['常温下，向20mL 0.1mol/L的盐酸中逐滴加入30mL 0.1mol/L的NaOH溶液，求混合液的pH，并判断酸碱性。',20,30,'baseIntoAcid',false,12.30102999566],
 ['室温下向20mL0.1mol/L盐酸中滴加20mL0.1mol/LNaOH溶液，求pH。',20,20,'baseIntoAcid',false,7],
 ['25°C，将20mL 0.1mol/L盐酸滴入30mL 0.1mol/L NaOH溶液中，求混合液的pH。',30,20,'acidIntoBase',false,12.30102999566],
 ['向30mL 0.1mol/L NaOH溶液中滴加20mL 0.1mol/L盐酸，求pH和理论恰好中和所需盐酸的总体积。',30,20,'acidIntoBase',true,12.30102999566],
 ['在25°C时将20mL盐酸逐滴加入20.0001mL NaOH溶液中，两溶液浓度均为0.1mol/L，求pH。',20.0001,20,'acidIntoBase',false,7.454963016858]
])test(`natural neutral phrasing: ${q}`,()=>{
 const p=parse(n,q);assert.equal(p.ok,true,p.message);assert.equal(p.p1,p1);assert.equal(p.p2,p2);
 assert.equal(p.fixed.direction,direction);assert.equal(p.fixed.temperatureAssumed,temperatureAssumed);
 near(n.model(p.p1,p.p2,p.fixed).pH,pH,1e-9);
 const c=n.content(p.p1,p.p2,p.fixed);
 if(temperatureAssumed)assert.match(c.recognitionText+c.visualHtml+c.steps[0][1],/未注明温度[^。]*25°C/);else assert.doesNotMatch(c.recognitionText+c.visualHtml,/未注明温度/);
 if(direction==='acidIntoBase'){assert.equal(c.params.map(x=>x.label).join('|'),'初始NaOH溶液体积|累计加入盐酸');assert.match(c.visualHtml,/碱液中加酸/);assert.match(c.visualHtml,/累计加入 HCl/);}
 else assert.equal(c.params.map(x=>x.label).join('|'),'初始盐酸体积|累计加入NaOH');
});
test('acid-into-base frames start alkaline, add acid along the same curve and keep the beaker fixed',()=>{
 const f=n.fixedWithDefaults({direction:'acidIntoBase'}),m=n.model(20,30,f);
 near(n.frame(m,0).pH,13);near(n.frame(m,2/3).pH,7);assert.equal(n.frame(m,2/3).addedVolume,20);
 near(n.frame(m,1).pH,-Math.log10(.1*10/50),1e-9);
 let last=Infinity;for(let i=0;i<=60;i++){const fr=n.frame(m,i/60);assert.equal(fr.baseVolume,20);assert.ok(fr.pH<=last);last=fr.pH;}
 assert.match(n.content(20,30,f).steps[0][1],/初始NaOH溶液20mL，累计加盐酸 30mL/);
 assert.ok(n.strict.checkFixed(n.fixedWithDefaults({direction:'sideways'}),20,20));
 assert.ok(n.strict.checkFixed(n.fixedWithDefaults({temperatureAssumed:'yes'}),20,20));
 assert.ok(n.strict.checkFixed(f,9.9999,20));assert.equal(n.strict.checkFixed(f,10,0),'');
});
test('KNO3 final-temperature slider stays on the five table temperatures',()=>{
 for(const [w,t]of [[100,20],[100.0001,30],[50,60]]){const param=k.content(w,t).params[1];assert.equal(param.step,10);assert.equal(param.min,20);assert.equal(param.max,60);}
});
test('KNO3 question-first and exact kg conversion preserve physical quantities',()=>{
 const q='求析出晶体质量、母液质量：初始为60°C饱和的纯KNO3水溶液，水质量为0.1000001kg，终温为20°C，不蒸发且不损失水，充分达到平衡。';
 const p=parse(k,q);assert.equal(p.ok,true,p.message);assert.equal(p.p1,100.0001);assert.equal(p.p2,20);
});
for(const [name,q]of [
 ['solution mass is not water',salt.replace('水质量','溶液总质量')],['missing water mass',salt.replace('水质量为100g，','')],
 ['missing pure material',salt.replace('的纯KNO₃','的KNO₃')],['missing equilibrium',salt.replace('充分达到平衡，','')],
 ['missing closed water condition',salt.replace('不蒸发且不损失水，','')],['unsaturated',salt.replace('饱和的','不饱和的')],
 ['interpolation',salt.replace('冷却至20°C','冷却至25°C')],['rounded final temperature',salt.replace('冷却至20°C','冷却至20.00000000000000001°C')],
 ['unsupported initial temperature',salt.replace('初始为60','初始为50')],['extra given mass',salt+'溶质质量为60g。'],
 ['duplicate final temperature',salt+'冷却至30°C。'],['mass fraction ask',salt.replace('母液质量','母液质量分数')],
 ['reaction quantity',salt.replace('析出晶体质量','生成KNO₃质量')],['water loss',salt.replace('不蒸发且不损失水','蒸发10g水')],
 ['wrong chemical',salt.replaceAll('KNO₃','NaCl')],['extra unknown ask',salt.replace('母液质量','母液质量和析晶速率')],['water excessive precision',salt.replace('为100g','为100.00001g')]
])test(`reject cooling ${name}`,()=>assert.equal(parse(k,q).ok,false,q));
test('grade-specific explanations keep junior reasoning qualitative',()=>{
 const junior=n.content(20,10,n.fixedWithDefaults({level:'junior'}));
 assert.doesNotMatch(junior.formulaHtml,/lg|log|n\(HCl\)/);
 assert.match(n.content(20,10).formulaHtml,/n\(HCl\)/);
 assert.match(k.content().visualHtml,/初中知识复习/);
});
test('frames use the same numerical model; cooling never interpolates, rewinding retains no residue',()=>{
 const m=n.model(20,20);
 near(n.frame(m,0).pH,1);near(n.frame(m,.5).pH,1.47712125472);near(n.frame(m,1).pH,7);
 const c=k.model(100,20),ts=new Set();
 for(let i=0;i<=100;i++){const f=k.frame(c,i/100);ts.add(f.finalTemperature);near(f.crystals+f.motherLiquor,210);}
 assert.deepEqual([...ts],[60,50,40,30,20]);assert.deepEqual([0,1,0].map(p=>k.frame(c,p).crystals),[0,78.4,0]);
 for(const bad of [25,19,61,NaN])assert.ok(k.strict.checkFixed(k.fixedWithDefaults(),100,bad));
 assert.ok(n.strict.checkFixed(n.fixedWithDefaults(),20,20.00001));
});
test('new parsers do not accept existing chemistry or unrelated templates',()=>{
 for(const q of ['10g纯碳酸钙与足量稀盐酸充分反应，求生成二氧化碳的质量。','20°C时，配制100g质量分数为10%的氯化钠溶液，求所需盐和水的质量。','单位圆中角θ=30°，求sinθ。'])for(const t of [n,k])assert.equal(parse(t,q).ok,false);
});
