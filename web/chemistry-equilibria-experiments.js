/* Approved chemistry v2 templates. One shared app clock; no network calls. */
(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit, core=window.MasterLabChemistryEquilibria, Q=window.MasterLabEquilibriaQuestions;
  if(!kit||!core||!Q)return;
  const {fact,stages}=kit.helpers;
  const number=n=>String(Number(n.toFixed(6)));
  const mass=n=>`${Math.round(n*1e6)/1e6===n?'':'≈ '}${number(n)} g`;
  const clamp=p=>Math.max(0,Math.min(1,p));
  const neutralDefaults={level:'senior',levelLocked:false,temperature:25,acidConcentration:.1,baseConcentration:.1,asks:'equivalence,nature,ph'};
  const coolingDefaults={level:'senior',levelLocked:false,initialTemperature:60,saturated:true,pure:true,waterLoss:0,equilibrium:true,asks:'crystals,dissolved,mother'};
  function modeIssue(f,patterns){
    return !['junior','senior'].includes(f.level)||typeof f.levelLocked!=='boolean'||typeof f.asks!=='string'||!f.asks||f.asks.split(',').some(k=>!Object.hasOwn(patterns,k))?'学段或所问模式无效。':'';
  }
  function neutralIssue(f,a,b){
    const issue=modeIssue(f,Q.acidAsks);if(issue)return issue;
    try{core.neutralization({...f,acidVolume:a,baseVolume:b});return '';}catch(e){return e.message;}
  }
  function coolingIssue(f,w,t){
    const issue=modeIssue(f,Q.saltAsks);if(issue)return issue;
    try{core.cooling({...f,waterMass:w,finalTemperature:t});return '';}catch(e){return e.message;}
  }
  function neutralModel(a,b,f=neutralDefaults){
    const issue=neutralIssue(f,a,b);if(issue)throw new RangeError(issue);
    const m=core.neutralization({...f,acidVolume:a,baseVolume:b});
    const answers={ph:`目标混合液 pH ≈ ${number(m.pH)}`,nature:`目标混合液呈${m.nature}`,equivalence:`理论恰好中和需累计加入 NaOH ${number(a)} mL（总体积）`};
    return {...m,level:f.level,asks:f.asks,metrics:[a,b,m.pH],metricUnit:'',
      facts:[fact('目标 pH',`≈ ${number(m.pH)}`),fact('目标酸碱性',m.nature),fact('理论中和总加碱量',`${number(a)} mL`)],
      contextParameters:`25°C；HCl和NaOH均为0.100mol/L；初始盐酸${number(a)}mL，当前目标累计加碱${number(b)}mL。结果对应目标参数，原题保留作重置基准。`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',
      formula:f.level==='junior'?'HCl + NaOH → NaCl + H₂O':'H⁺ + OH⁻ → H₂O；pH = −lg[H⁺]',
      formulaDetail:f.level==='junior'?`同浓度两液：加碱量小于${number(a)}mL呈酸性，等于时理论中性，大于时呈碱性。`:`混合总体积 ${number(m.volumeL)} L；n(HCl)=${number(m.acidMol)} mol，n(NaOH)=${number(m.baseMol)} mol；计入水电离后 pH ≈ ${number(m.pH)}。`,
      readout:`目标 pH ≈ ${number(m.pH)} · ${m.nature}`,badge:'理论中和 · 非实际终点'};
  }
  function coolingModel(w,t,f=coolingDefaults){
    const issue=coolingIssue(f,w,t);if(issue)throw new RangeError(issue);
    const m=core.cooling({...f,waterMass:w,finalTemperature:t});
    const answers={crystals:`析出晶体 ${mass(m.crystals)}`,dissolved:`终态溶解 KNO₃ ${mass(m.dissolved)}`,mother:`母液 ${mass(m.motherLiquor)}`};
    return {...m,level:f.level,asks:f.asks,metrics:[w,t,m.crystals],metricUnit:'g',
      facts:[fact('目标析晶质量',mass(m.crystals)),fact('目标仍溶解',mass(m.dissolved)),fact('目标母液质量',mass(m.motherLiquor))],
      contextParameters:`纯KNO₃和水，60°C饱和液已备好；水${number(w)}g，目标终温${t}°C，不蒸发、不失水并达到平衡。当前比较参数与原题重置基准分开。`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',formula:'m(晶体) = W × [S(60) − S(T)] / 100',
      formulaDetail:`初始溶质 ${mass(m.initialSolute)}；终态溶解 ${mass(m.dissolved)}；晶体 ${mass(m.crystals)} + 母液 ${mass(m.motherLiquor)} = 总质量 ${mass(m.totalMass)}。`,
      readout:`${t}°C · 析晶 ${mass(m.crystals)}`,badge:f.level==='junior'?'溶解度与冷却结晶':'初中知识复习 · 质量守恒拓展'};
  }
  // Parenthesized units keep the shared formula formatter from turning SVG
  // axis labels into stacked fractions that extend outside the viewBox.
  const axes=(ylabel,xlabel)=>`<path d="M48 28V232H420" class="eq-axis"/><text x="48" y="18">${ylabel}</text><text x="234" y="279" text-anchor="middle">${xlabel}</text>`;
  const vessel=crystals=>`<svg class="eq-vessel" viewBox="0 0 240 220" role="img" aria-label="无色溶液容器示意，不代表精确体积"><path d="M42 42V180Q42 196 58 196H182Q198 196 198 180V42" class="eq-glass"/><path d="M46 86H194V180Q194 192 182 192H58Q46 192 46 180Z" class="eq-liquid"/>${crystals?Array.from({length:12},(_,i)=>`<rect data-eq-crystal x="${60+i%6*22}" y="${166+Math.floor(i/6)*13}" width="12" height="10" class="eq-crystal"/>`).join(''):'<path class="eq-drop" data-eq-drop d="M120 15Q103 38 120 38Q137 38 120 15"/><path d="M150 52L132 173" class="eq-stirrer"/>'}<text x="120" y="213" text-anchor="middle">液面、粒子仅为示意</text></svg>`;
  let curveCache;
  function neutralCurve(a){
    if(curveCache?.a===a)return curveCache.path;
    const volumes=[...Array.from({length:201},(_,i)=>i/2),a,a-.0001,a+.0001,a-.01,a+.01].filter(v=>v>=0&&v<=100).sort((x,y)=>x-y);
    const path=volumes.map((b,i)=>{const m=core.neutralization({...neutralDefaults,acidVolume:a,baseVolume:b});return `${i?'L':'M'}${48+3.72*b},${232-m.pH*14}`;}).join(' ');
    curveCache={a,path};return path;
  }
  function neutralVisual(m){
    return `<section class="chemistry-lab-scene chemistry-v2-scene eq-neutral" aria-label="盐酸中累计加入氢氧化钠的理论中和实验">
      <div class="chemistry-scene-heading"><strong>理论中和 · 盐酸中加碱</strong><span data-eq-phase>演示初态</span></div>
      <p>25°C；两液均为 0.100 mol/L。初始盐酸 ${number(m.acidVolume)} mL；目标累计加碱 ${number(m.baseVolume)} mL。</p>
      <div class="eq-panels"><figure><figcaption>无指示剂 · 原液无色</figcaption>${vessel(false)}<p>NaOH 累计加入量，不是滴定管一次读数。</p></figure>
      <figure><figcaption>pH 随累计加碱量变化</figcaption><svg viewBox="0 0 450 290" class="eq-graph" role="img" aria-label="固定初始盐酸体积下的理论pH曲线">${axes('pH','累计加入 NaOH（mL）')}${[0,7,14].map(v=>`<text x="36" y="${238-v*14}" text-anchor="end">${v}</text><path d="M48 ${232-v*14}H420" class="eq-grid"/>`).join('')}${[0,50,100].map(v=>`<text x="${48+3.72*v}" y="254" text-anchor="middle">${v}</text>`).join('')}<path d="${neutralCurve(m.acidVolume)}" class="eq-curve"/><line x1="${48+3.72*m.acidVolume}" x2="${48+3.72*m.acidVolume}" y1="28" y2="232" class="eq-grid"/><circle data-eq-point r="5" class="eq-point"/></svg><p>虚线对应理论等量；实际指示剂终点另按实验判断。</p></figure></div>
      <div class="eq-current" aria-live="off"><strong data-eq-current></strong><span data-eq-current-nature></span></div>
      <div class="eq-ph-scale"><span>酸性</span><span>中性</span><span>碱性</span></div><p class="chemistry-model-note">颜色仅为 pH 标尺，原液不会因 pH 改变自动变色。播放展示加液比较过程，下方结果对应目标题目参数；进度不代表真实滴定时间。</p>
      <details class="eq-reference"><summary>模型条件与教材操作参照</summary><p>完全电离、混合体积可加、忽略活度；采用常温课堂近似 Kw ≈ 1×10⁻¹⁴。pH 是理论读数，不是试纸实测值。</p><p>初中人教实验10-10：5mL稀NaOH中滴入酚酞，再慢慢滴入盐酸并不断搅拌，红色恰好褪去。教材使用烧杯、滴管、玻璃棒；取样测pH用洁净干燥玻璃棒点到试纸，不将试纸浸入原液。</p><p>高中实验活动2：检漏、分别润洗滴定管、排气泡并准确读数；用已知酸滴定20.00mL待测NaOH，滴入酚酞，边滴边摇动；近终点细滴至褪色持续半分钟，记录并重复测定。本场景方向不同，不判实际终点，也不完整复刻教材操作。</p></details>
    </section>`;
  }
  function neutralFrame(m,p){
    const b=Math.round(m.baseVolume*clamp(p)*10000)/10000;
    return core.neutralization({...neutralDefaults,acidVolume:m.acidVolume,baseVolume:b});
  }
  function renderNeutral(root,m,p,{reducedMotion=false}={}){
    const scene=root.querySelector('.eq-neutral');if(!scene)return;
    const n=neutralFrame(m,p);scene.dataset.currentBaseVolume=String(n.baseVolume);scene.dataset.currentPh=String(n.pH);
    scene.querySelector('[data-eq-phase]').textContent=p>=1?'到达目标加碱量':p<=0?'演示初态':'加入碱液示意';
    scene.querySelector('[data-eq-current]').textContent=`演示当前：累计 ${number(n.baseVolume)} mL；pH ≈ ${number(n.pH)}`;
    scene.querySelector('[data-eq-current-nature]').textContent=n.nature;
    const dot=scene.querySelector('[data-eq-point]');dot.setAttribute('cx',String(48+3.72*n.baseVolume));dot.setAttribute('cy',String(232-14*n.pH));
    scene.querySelector('[data-eq-drop]').style.opacity=m.baseVolume>0&&p>0&&p<1&&!reducedMotion?'1':'0';
  }
  function coolingVisual(m){
    return `<section class="chemistry-lab-scene chemistry-v2-scene eq-cooling" aria-label="硝酸钾冷却结晶平衡状态示意">
      <div class="chemistry-scene-heading"><strong>硝酸钾 · 冷却结晶</strong><span data-eq-phase>60°C 初态</span></div><p>${m.badge}。60°C 起始饱和液已备好；水 ${number(m.waterMass)} g；目标终温 ${m.finalTemperature}°C。</p>
      <div class="eq-panels"><figure><figcaption>无色母液与白色晶体</figcaption>${vessel(true)}<p>纯KNO₃和水，不蒸发、不失水；各状态均达到平衡。</p></figure><figure><figcaption>教材离散溶解度数据</figcaption><svg viewBox="0 0 450 290" class="eq-graph" role="img" aria-label="每100克水的硝酸钾溶解度数据">${axes('S（g，每100g水）','温度（°C）')}<polyline class="eq-grid" points="${Object.entries(core.SOLUBILITY).map(([t,s])=>`${48+(t-20)*9.3},${232-s*1.7}`).join(' ')}"/>${Object.entries(core.SOLUBILITY).map(([t,s])=>`<circle cx="${48+(t-20)*9.3}" cy="${232-s*1.7}" r="4" class="eq-table-point"/><text x="${48+(t-20)*9.3}" y="254" text-anchor="middle">${t}</text><text x="${48+(t-20)*9.3}" y="${220-s*1.7}" text-anchor="${t==='20'?'start':t==='60'?'end':'middle'}">${s}</text>`).join('')}<circle data-eq-point r="6" class="eq-point"/></svg><p>单位为 g KNO₃ / 100g水。连线仅示意，不用于插值。</p></figure></div>
      <div class="eq-current" aria-live="off"><strong data-eq-current></strong><span data-eq-mass></span></div>
      <div class="eq-mass-bar" aria-label="晶体与母液的质量比例"><span data-eq-crystal-bar></span><span></span></div><p class="eq-mass-legend">蓝色：晶体质量；浅色：母液质量。<span data-eq-conservation></span></p>
      <p class="chemistry-model-note">播放只逐点显示60、50、40、30、20°C中适用的平衡状态；进度不表示真实冷却时间、析晶速率或成核过程。晶体形状与数量为示意。下方结果对应目标终温。</p>
      <details class="eq-reference"><summary>教材操作参照与适用条件</summary><p>人教初中实验9-6：向10mL水中分次加入3g硝酸钾并搅拌，观察剩余固体；加热使剩余固体溶解，再加溶质并搅拌，静置冷却观察结晶。教材操作没有指定本场景的60°C与水质量范围。</p><p>数据来自表9-1：20、30、40、50、60°C时为31.6、45.8、63.9、85.5、110g每100g水。只计算无水KNO₃晶体；母液含水和仍溶解的溶质。高中内容为初中知识复习与质量守恒拓展，不引入Ksp。</p></details>
    </section>`;
  }
  function coolingFrame(m,p){
    const temperatures=[60,50,40,30,20].filter(t=>t>=m.finalTemperature);
    const t=temperatures[Math.min(temperatures.length-1,Math.floor(clamp(p)*temperatures.length))];
    return core.cooling({...coolingDefaults,waterMass:m.waterMass,finalTemperature:t});
  }
  function renderCooling(root,m,p){
    const scene=root.querySelector('.eq-cooling');if(!scene)return;
    const n=coolingFrame(m,p);scene.dataset.currentTemperature=String(n.finalTemperature);scene.dataset.crystalMass=String(n.crystals);
    scene.querySelector('[data-eq-phase]').textContent=`${n.finalTemperature}°C 平衡状态`;
    scene.querySelector('[data-eq-current]').textContent=`演示当前：${n.finalTemperature}°C；晶体 ${mass(n.crystals)}`;
    scene.querySelector('[data-eq-mass]').textContent=`仍溶解 ${mass(n.dissolved)}；母液 ${mass(n.motherLiquor)}`;
    scene.querySelector('[data-eq-conservation]').textContent=`晶体 + 母液 = ${mass(n.totalMass)}；水恒为 ${mass(n.waterMass)}。`;
    const dot=scene.querySelector('[data-eq-point]');dot.setAttribute('cx',String(48+(n.finalTemperature-20)*9.3));dot.setAttribute('cy',String(232-n.solubility*1.7));
    scene.querySelector('[data-eq-crystal-bar]').style.width=`${100*n.crystals/n.totalMass}%`;
    scene.querySelectorAll('[data-eq-crystal]').forEach((el,i)=>el.style.opacity=n.crystals>0&&i<Math.ceil(12*n.crystals/(m.waterMass*.784))?'1':'0');
  }
  const shared={subject:'化学',level:'both',block:'化学计算',resetToQuestion:true,motion:{duration:10},formatMetric:number};
  const neutral={...shared,id:'hclNaohNeutralization',menuTitle:'强酸强碱中和与pH',menuMeta:'盐酸中加碱 · 理论等量 · pH',stage:'酸碱与中和',title:'盐酸与氢氧化钠：理论中和与pH',defaults:[20,20],keywords:/(?=.*(?:盐酸|HCl))(?=.*(?:氢氧化钠|NaOH))/i,
    params:[{label:'初始盐酸体积',desc:'10–50mL；最多四位小数',unit:'mL',min:10,max:50,step:.1,value:20},{label:'累计加入NaOH',desc:'0–100mL；这是累计总量',unit:'mL',min:0,max:100,step:.1,value:20}],
    strict:{sameConditions:true,preciseParams:true,caps:[[10,50],[0,100]],fixedDefaults:neutralDefaults,intent:{require:[/盐酸|HCl/i,/氢氧化钠|NaOH/i]},values:(s,t,c)=>Q.neutralization(s,c),checkFixed:neutralIssue,
      used:(a,b)=>[{cls:'volume',value:a},{cls:'volume',value:b},{cls:'temperature',value:25},{cls:'amount',value:.1}],asks:{supported:/pH|酸碱性|中和|体积/i,unsupported:/质量|质量分数|还需|热量|误差|终点|反推/}},
    question:Q.neutralizationQuestion,model:neutralModel,visual:neutralVisual,frame:neutralFrame,renderFrame:renderNeutral,recognition:m=>`HCl/NaOH｜${m.readout}`,
    presetFor:level=>({p1:20,p2:20,fixed:{...neutralDefaults,level,asks:level==='junior'?'nature':'equivalence,nature,ph'}}),
    copy:m=>({steps:[['核对模型条件',`25°C，初始盐酸${number(m.acidVolume)}mL，累计加NaOH ${number(m.baseVolume)}mL；两液同浓度。`,'原题与当前比较条件分开，不能用示意默认值补题。'],['理解中和','HCl + NaOH → NaCl + H₂O',m.level==='junior'?'酸与碱反应生成盐和水；相同浓度下比较两液体积。':'先计算酸、碱的物质的量，混合总体积用于浓度计算。'],['比较酸碱性',m.formulaDetail,m.level==='junior'?'pH为理论读数；初中不要求对数和水自解离推导。':'等量附近同时计入水电离，避免把极少过量误作中性。'],['按所问回答',m.conclusion,'理论等量点不能代替指示剂实际终点。']],hint:'先预测加碱量不足、恰好等量、过量时分别呈什么性质，再比较曲线。',mentor:'为什么计算混合液浓度要用混合总体积？理论等量与实际终点有何区别？',challenge:'保持初始盐酸不变，比较等量点两侧；随后重置回原题。',sceneTip:m.conclusion,generationStages:stages('核对温度、浓度、体积与所问','计算理论中和与水电离平衡','绘制曲线和无色溶液示意')})};
  const cooling={...shared,id:'kno3Cooling',menuTitle:'硝酸钾冷却结晶',menuMeta:'五点溶解度 · 析晶 · 质量守恒',stage:'溶解度与结晶',title:'硝酸钾：冷却结晶与质量守恒',defaults:[100,20],keywords:/硝酸钾|KNO3/i,
    params:[{label:'水质量 W',desc:'50–200g；不是溶液总质量',unit:'g',min:50,max:200,step:10,value:100},{label:'目标终温',desc:'只支持20、30、40、50、60°C',unit:'°C',min:20,max:60,step:10,value:20}],
    strict:{sameConditions:true,preciseParams:true,caps:[[50,200],[20,60]],fixedDefaults:coolingDefaults,intent:{require:[/硝酸钾|KNO3/i,/饱和/]},values:(s,t,c)=>Q.cooling(s,c),checkFixed:coolingIssue,
      // The complete grammar above validates every clause. The shared ask
      // scanner can include trailing givens after a question-first colon.
      used:(w,t)=>[{cls:'mass',value:w/1000},{cls:'temperature',value:60},{cls:'temperature',value:t}],asks:{supported:/质量|晶体|溶解|母液|^(?:冷却后|终态)?(?:充分)?达到平衡$|^(?:全程)?(?:不蒸发(?:且|并)?不(?:损失|损耗)水|水不蒸发且无损失)$/,unsupported:/质量分数|体积|密度|反推|速率|生成|消耗/}},
    question:Q.coolingQuestion,model:coolingModel,visual:coolingVisual,frame:coolingFrame,renderFrame:renderCooling,recognition:m=>`KNO₃｜水${number(m.waterMass)}g｜${m.readout}`,
    presetFor:level=>({p1:100,p2:20,fixed:{...coolingDefaults,level}}),
    copy:m=>({steps:[['固定起始状态','60°C饱和纯KNO₃水溶液已备好；不蒸发、不失水。',m.level==='junior'?'饱和必须同时说明温度与水的质量。':'初中知识复习与质量守恒拓展，不引入沉淀溶解平衡。'],['读取同一教材数表',`60°C：110g；${m.finalTemperature}°C：${m.solubility}g（均按每100g水）。`,'分母是水质量，不是溶液质量；不对其他温度插值。'],['计算并核对守恒',m.formulaDetail,'母液=水+仍溶解的KNO₃；晶体+母液=初始总质量。'],['按所问回答',m.conclusion,'数据精度按教材表值，动画不表示真实成核或结晶速度。']],hint:'温度下降后，每100g水能保留多少溶质？原来的多余溶质在哪里？',mentor:'母液质量为什么不能只用终态溶解量代替？水量加倍时各质量怎样变化？',challenge:'保持水量不变，比较各终温；回到60°C时晶体应为0。',sceneTip:m.conclusion,generationStages:stages('核对饱和初态、水量与终温','按五点教材数据计算各质量','显示平衡状态与质量守恒')})};
  kit.register({hclNaohNeutralization:neutral,kno3Cooling:cooling});
})();
