/* Local chemistry templates: classroom mass constants, never AI-calculated results. */
(() => {
  "use strict";
  const kit = window.MasterLabTemplateKit, chemistry = window.MasterLabChemistry;
  if (!kit || !chemistry) return;
  const { fact, miss, fmt, fmtInput, exactPlaces } = kit.helpers;
  const guard = () => window.MasterLabQuestionGuard;
  const CA = chemistry.relativeMass("CaCO3"), ACID = 2 * chemistry.relativeMass("HCl"), GAS = chemistry.relativeMass("CO2");
  const equation = "CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑";
  const quantity = "(?<![\\w.])[+-]?\\d+(?:\\.\\d+)?\\s*(?:kg|mg|g|千克|毫克|克)";
  const caName = "(?:纯\\s*)?(?:CaCO3|碳酸钙)(?:固体)?";
  const acidName = "(?:HCl(?:\\s*溶质)?|氯化氢(?:溶质)?)";
  const massBounds = [[0.1, 50], [0.1, 36.5]];
  const cleanZero = n => Math.abs(n) < 1e-12 ? 0 : n;
  const preciseParam = n => Number.isFinite(n) && Math.abs(n*1e4-Math.round(n*1e4)) <= Number.EPSILON*Math.max(1,Math.abs(n*1e4))*8;
  const massNumber = n => n!==0&&Math.abs(n)<.001?String(Number(n.toPrecision(4))):fmt(n,3);
  const grams = n => `${exactPlaces(n) === null ? "≈" : ""}${massNumber(n)} g`;
  const levelOf = (source, context) => {
    if (/初中/.test(source) && /高中/.test(source)) return null;
    const stated = /初中/.test(source) ? "junior" : /高中/.test(source) ? "senior" : "";
    return { level: stated || context.gradeLevel || "senior", levelLocked: Boolean(stated) };
  };
  function quantityRole(source,index) {
    // Temporal/semantic roles are attached before vocabulary validation. A mass
    // after “反应后，…” remains an outcome even across a comma; asking about a
    // consumed/remainder mass later does not relabel earlier initial givens.
    const markers=/未(?:参加|参与)?反应|反应后|反应完|反应结束|结束时|剩余|剩下|余下|余量|残余|残留|消耗|耗去|耗用|用去|用掉|减少|参与反应|参加反应|反应掉|反应了|反应前|初始|起始|最初|开始时|原有|投入|投料|加入前/g;
    let role='initial';
    for(const match of source.slice(0,index).matchAll(markers))role=/^(?:反应前|初始|起始|最初|开始时|原有|投入|投料|加入前)$/.test(match[0])?'initial':/消耗|耗去|耗用|用去|用掉|减少|参与反应|参加反应|反应掉|反应了/.test(match[0])?'consumed':'remaining';
    return role;
  }
  function massRoles(source, tokens, names) {
    const map = new Map();
    names.forEach((name, role) => {
      for (const pattern of [`(${quantity})\\s*(?:的)?\\s*${name}`, `${name}\\s*(?:的)?\\s*(?:(?:初始|起始|原有|投入|投料)(?:的)?)?\\s*(?:质量|用量)?\\s*(?:为|是|=|:|含有|含)?\\s*(${quantity})`]) {
        for (const match of source.matchAll(new RegExp(pattern, "gi"))) {
          const index = match.index + match[0].indexOf(match[1]);
          const token = tokens.find(t => t.cls === "mass" && t.index === index);
          if (!token) continue;
          const previous = map.get(index);
          if (previous && previous.role !== role) return null;
          map.set(index, { role, token: { ...token, conditionRole: quantityRole(source,index) } });
        }
      }
    });
    const masses = tokens.filter(t => t.cls === "mass");
    if (map.size !== masses.length) return null;
    return names.map((_, role) => [...map.values()].filter(item => item.role === role).map(item => item.token));
  }
  // A conservative local grammar also rejects unrecognised, unitless constraints.
  // Removing a quantity here never approves it: used()/role checks validate every token separately.
  function knownNarrative(source, tokens, words, extraWords=/$^/g) {
    let rest = source;
    for (const t of [...tokens].sort((a,b) => b.index-a.index)) rest = rest.slice(0,t.index) + " " + rest.slice(t.index+t.text.length);
    rest = rest.replace(/CaCO3|HCl|CO2/gi, " ").replace(extraWords," ").replace(words, " ").replace(/[\s，,。；;？?！!、：:（）()=+→↑·]/g, "");
    return !rest;
  }
  const caWords = /二氧化碳|碳酸钙|氯化氢|反应物|盐酸|溶质|溶液|纯|稀|足量|过量|足够|的|质量|用量|剩余|余量|消耗|生成|产生|理论|最多|最终|反应后|反应中|充分|完全|恰好|反应|限量|限制|哪种|是否|多少|各自|分别|求出|试求|求|计算|判断|确定|以及|及其|以及|和|与|并|及|有|取|将|把|加入|含有|含|为|是|后|中|了|请|初中|高中|方法|按|计算/g;
  const caBlocked = /纯度|杂质|石灰石|大理石|浓度|质量分数|体积|容积|密度|速率|速度|时间|压强|压力|温度|加热|催化|分步|多步|滴定|平衡|密闭|不完全|溶解度|mol\b|摩尔|氯化钙|CaCl2|蒸发|损失/i;
  // Outcome annotations can follow a mass (including in parentheses), so a
  // prefix-only binding is insufficient. No outcome given is an initial input.
  const outcomeGiven = /剩余|剩下|余下|余量|残余|残留|未(?:参加|参与)?反应|消耗|耗去|耗用|用去|用掉|减少|参与反应|参加反应|反应掉|反应了|(?:反应后|反应完|反应结束|结束时)(?:的)?(?:质量|用量|数值)|[（(]\s*(?:反应后|反应完|反应结束|结束时)\s*[）)]/;
  function caAsks(source, excess) {
    const items = guard().askItems(source), keys = new Set();
    if (!items.length) return miss("请明确所求：CO₂ 质量、限量反应物或可确定的消耗/剩余质量。");
    for (const item of items) {
      if (/(?:CO2|二氧化碳)/i.test(item) && /质量|多少|多重/.test(item)) keys.add("co2");
      else if (/限量|限制|哪种.*(?:剩余|过量)|是否.*恰好|恰好反应/.test(item)) keys.add("limiting");
      else if (/碳酸钙|CaCO3/i.test(item) && /剩余|余量|消耗/.test(item) && /质量|多少/.test(item)) {
        if (/剩余|余量/.test(item) && excess === "caco3") return miss("足量 CaCO₃ 的初始质量未知，不能计算它的剩余质量。");
        keys.add(/剩余|余量/.test(item) ? "remainingCa" : "consumedCa");
      } else if (/HCl|氯化氢/i.test(item) && /剩余|余量|消耗/.test(item) && /质量|多少/.test(item)) {
        if (/剩余|余量/.test(item) && excess === "hcl") return miss("足量盐酸的 HCl 初始质量未知，不能计算其剩余质量。");
        keys.add(/剩余|余量/.test(item) ? "remainingHcl" : "consumedHcl");
      } else return miss("题目有未支持的子问，不能省略后生成实验。");
    }
    return { ok: true, asks: [...keys].sort().join(",") };
  }
  function parseCa(source, tokens, context) {
    if (caBlocked.test(source)) return miss("当前只支持纯 CaCO₃ 与稀盐酸的单步质量关系；请使用明确 HCl 溶质质量或足量条件。");
    if (/(?:足量|过量|足够)(?:的)?\s*[+-]?\d|\d\s*(?:kg|mg|g|千克|毫克|克)\s*(?:为|是)?\s*(?:足量|过量|足够)/i.test(source)) return miss("足量与数值质量不能同时指定给同一反应物。");
    const roles = massRoles(source, tokens, [caName, acidName]);
    if (!roles || roles.some(list => list.length > 1)) return miss("每种反应物只接受一份明确质量；盐酸溶液质量不能当作 HCl 溶质质量。");
    const givens = source.split(/试求|求|计算|判断|确定/)[0];
    if(roles.flat().some(token=>token.conditionRole!=='initial')||outcomeGiven.test(givens))return miss("本实验只接收反应前的初始投入质量；消耗、反应后或剩余质量不能重绑定为初始质量，逆向条件不在首版范围内。");
    const excessCa = /(?:足量|过量|足够)(?:的)?\s*(?:纯)?\s*(?:CaCO3|碳酸钙)|(?:CaCO3|碳酸钙)(?:固体)?\s*(?:为|是)?\s*(?:足量|过量|足够)/i.test(source);
    const excessHcl = /(?:足量|过量|足够)(?:的)?\s*(?:稀)?\s*(?:盐酸|HCl)|(?:稀盐酸|盐酸|HCl(?:溶液)?)\s*(?:为|是)?\s*(?:足量|过量|足够)/i.test(source);
    if ((excessCa && excessHcl) || (excessCa && roles[0].length) || (excessHcl && roles[1].length)) return miss("足量条件与定量条件冲突，请明确给定模式。");
    if ((!roles[0].length && !excessCa) || (!roles[1].length && !excessHcl)) return miss("需给出 CaCO₃ 与 HCl 溶质质量，或明确另一方足量；不猜测盐酸浓度。");
    const excess = excessCa ? "caco3" : excessHcl ? "hcl" : "";
    const p1 = roles[0][0] ? roles[0][0].value * 1000 : 0, p2 = roles[1][0] ? roles[1][0].value * 1000 : 0;
    if ([p1,p2].some(n => !preciseParam(n))) return miss("质量换算为 g 后最多支持四位小数，请保留原题并核对输入精度。");
    const level = levelOf(source, context);
    if (!level) return miss("题目学段条件冲突。");
    const asks = caAsks(source, excess);
    if (!asks.ok) return asks;
    if (!knownNarrative(source,tokens,caWords,/反应前|初始|起始|最初|开始时|原有|投入|投料|加入前/g)) return miss("题目含未支持的条件或所问，不能省略后生成实验。");
    if (/恰好/.test(givens) && (excess || Math.abs(p1/CA-p2/ACID)>1e-10)) return miss("“恰好反应”条件与给定质量不一致。");
    return { ok:true, p1, p2, fixed:{...level, excess, asks:asks.asks} };
  }
  function caModel(p1,p2,fixed) {
    const excess=fixed.excess || "";
    if (!["","hcl","caco3"].includes(excess)) throw new RangeError("Invalid excess mode");
    [p1,p2].forEach((n,i)=>{const locked=excess===(i===0?"caco3":"hcl");if(!Number.isFinite(n)|| (locked ? n!==0 : n<massBounds[i][0]||n>massBounds[i][1]))throw new RangeError("Mass outside demonstration range");});
    const xi = excess==="hcl" ? p1/CA : excess==="caco3" ? p2/ACID : Math.min(p1/CA,p2/ACID);
    const consumedCa=CA*xi, consumedHcl=ACID*xi, co2Mass=GAS*xi;
    const remainingCa=excess==="caco3"?null:cleanZero(p1-consumedCa), remainingHcl=excess==="hcl"?null:cleanZero(p2-consumedHcl);
    const limiting=excess==="hcl"?"caco3":excess==="caco3"?"hcl":Math.abs(p1/CA-p2/ACID)<=1e-10?"both":p1/CA<p2/ACID?"caco3":"hcl";
    const limitingText=limiting==="both"?"恰好反应":`${limiting==="caco3"?"CaCO₃":"HCl 溶质"}限量`;
    const remainingText=`CaCO₃：${remainingCa===null?"足量，剩余质量未定量":grams(remainingCa)}；HCl：${remainingHcl===null?"足量，剩余质量未定量":grams(remainingHcl)}`;
    const proportion=chemistry.proportion({equation,known:{formula:limiting==="hcl"?"HCl":"CaCO3",coefficient:limiting==="hcl"?2:1,mass:limiting==="hcl"?consumedHcl:consumedCa},unknown:{formula:"CO2"},ask:"生成 CO₂ 的质量"});
    const knownMass=limiting==='hcl'?consumedHcl:consumedCa,knownRelative=limiting==='hcl'?ACID:CA;
    // The shared junior helper displays at most three decimal places. Preserve
    // this template's four-place givens rather than rounding them before substitution.
    proportion.ratio=`${knownRelative}/${GAS} = ${fmtInput(knownMass)}g/x`;
    proportion.solve=`x = ${GAS} × ${fmtInput(knownMass)} g ÷ ${knownRelative} ${exactPlaces(co2Mass)===null?'≈':'='} ${massNumber(co2Mass)} g`;
    proportion.relation=`${limiting==='hcl'?'HCl':'CaCO₃'} ${knownRelative}，CO₂ ${GAS}；已知 ${fmtInput(knownMass)} g，未知 x`;
    proportion.value=co2Mass;proportion.valueText=massNumber(co2Mass);proportion.exact=exactPlaces(co2Mass)!==null;proportion.answer=`答：生成 CO₂ ${grams(co2Mass)}。`;
    const labels={co2:'生成 CO₂',consumedCa:'消耗 CaCO₃',consumedHcl:'消耗 HCl 溶质',remainingCa:'剩余 CaCO₃',remainingHcl:'剩余 HCl 溶质',limiting:'计量判断'};
    const values={co2:co2Mass,consumedCa,consumedHcl,remainingCa,remainingHcl,limiting:limitingText};
    const requested=(fixed.asks||'co2,limiting').split(',');
    if(requested.some(key=>values[key]===null||values[key]===undefined))throw new RangeError('Requested mass is not determined');
    const answers=requested.map(key=>({key,label:labels[key],value:values[key],unit:key==='limiting'?'':'g'}));
    const answerText=answers.map(a=>`${a.label}：${a.unit?grams(a.value):a.value}`).join('；');
    const massCalc=(label,relative,value)=>`${label}：m = ${fixed.level==='junior'?`${relative}/${knownRelative} × ${fmtInput(knownMass)} g`:`${relative} g/mol × ξ`} ${exactPlaces(value)===null?'≈':'='} ${massNumber(value)} g`;
    const calculations=requested.map(key=>key==='co2'?massCalc(labels.co2,GAS,co2Mass):key==='consumedCa'?massCalc(labels.consumedCa,CA,consumedCa):key==='consumedHcl'?massCalc(labels.consumedHcl,ACID,consumedHcl):key==='remainingCa'?`${massCalc(labels.consumedCa,CA,consumedCa)}；${labels.remainingCa}：m余 = ${fmtInput(p1)} g − m消耗(CaCO₃) ${exactPlaces(remainingCa)===null?'≈':'='} ${massNumber(remainingCa)} g`:key==='remainingHcl'?`${massCalc(labels.consumedHcl,ACID,consumedHcl)}；${labels.remainingHcl}：m余 = ${fmtInput(p2)} g − m消耗(HCl) ${exactPlaces(remainingHcl)===null?'≈':'='} ${massNumber(remainingHcl)} g`:limitingText);
    const formulaDetail=(fixed.level==='senior'?`ξ ${exactPlaces(xi)===null?'≈':'='} ${fmt(xi,5)} mol；`:'')+calculations.join('；');
    return {p1,p2,excess,level:fixed.level,xi,consumedCa,consumedHcl,co2Mass,remainingCa,remainingHcl,limiting,limitingText,remainingText,proportion,answers,answerText,calculations,
      contextParameters:`当前实验参数（结果对应）：CaCO₃ ${excess==='caco3'?'足量':grams(p1)}；HCl 溶质 ${excess==='hcl'?'足量':grams(p2)}。原题保留为重置基准，当前参数可与原题不同。`,
      metrics:[excess==="caco3"?"足量":p1,excess==="hcl"?"足量":p2,co2Mass],metricUnit:"g",
      facts:[fact("所求结果",answerText),fact("计量判断",limitingText),fact("反应后剩余",remainingText)],
      formula:equation,formulaDetail,readout:answerText,badge:"化学计量",
      conclusion:`${answerText}。${limitingText}。`,
      explanation:"HCl 为溶质质量；进度仅作化学计量示意，不表示真实反应速率。"};
  }
  const askText={co2:"生成二氧化碳的质量",limiting:"限量反应物",remainingCa:"剩余碳酸钙的质量",remainingHcl:"剩余HCl溶质的质量",consumedCa:"消耗碳酸钙的质量",consumedHcl:"消耗HCl溶质的质量"};
  const caQuestion=(p1,p2,fixed={})=>`${fixed.levelLocked?(fixed.level==="junior"?"初中：":"高中："):""}${fixed.excess==="caco3"?"足量纯碳酸钙":`${fmtInput(p1)}g纯碳酸钙`}与${fixed.excess==="hcl"?"足量稀盐酸":`含HCl溶质${fmtInput(p2)}g的稀盐酸`}充分反应，求${(fixed.asks||"co2,limiting").split(",").map(k=>askText[k]).join("、")}。`;
  const caFrame=(m,p)=>{
    const progress=Math.max(0,Math.min(1,p)),extent=Math.max(0,Math.min(1,(progress-.12)/.78));
    return {progress,extent,co2Mass:m.co2Mass*extent,consumedCa:m.consumedCa*extent,consumedHcl:m.consumedHcl*extent,
      remainingCa:m.excess==="caco3"?null:cleanZero(m.p1-m.consumedCa*extent),remainingHcl:m.excess==="hcl"?null:cleanZero(m.p2-m.consumedHcl*extent),
      stage:progress<.12?"加入反应物":extent<1?"固体消耗 · 产生气泡":"反应完成 · 核对余量"};
  };
  function caVisual(m) {
    return `<section class="chemistry-lab-scene chemistry-caco3" aria-label="碳酸钙与稀盐酸化学计量示意">
      <div class="chemistry-scene-heading"><strong>二氧化碳制取</strong><span data-chem-stage>加入反应物</span></div>
      <svg class="chemistry-apparatus" viewBox="0 0 400 205" role="img" aria-label="无色溶液、碳酸钙固体与逸出气泡，器具尺寸不表示真实体积">
        <path class="chemistry-glass" d="M118 24V155Q118 176 140 176H260Q282 176 282 155V24"/>
        <path class="chemistry-liquid" d="M121 80H279V154Q279 172 260 172H140Q121 172 121 154Z"/>
        <g data-chem-solid><path class="chemistry-solid" d="M143 147L157 133L173 141L190 128L207 141L224 132L253 150L251 166H145Z"/></g>
        ${[0,1,2,3,4].map(i=>`<circle class="chemistry-bubble" data-chem-bubble="${i}" cx="${162+i*18}" cy="110" r="${3+i%2}"/>`).join("")}
        <path class="chemistry-gas-arrow" d="M314 92V36M306 44L314 36L322 44"/>
        <text x="314" y="116" text-anchor="middle">CO₂↑</text>
      </svg>
      <div class="chemistry-live-readouts"><div><span>当前 CO₂</span><strong data-chem-gas>0 g</strong></div><div><span>当前 CaCO₃ 剩余</span><strong data-chem-ca>${m.excess==="caco3"?"足量 · 未定量":grams(m.p1)}</strong></div><div><span>当前 HCl 剩余</span><strong data-chem-hcl>${m.excess==="hcl"?"足量 · 未定量":grams(m.p2)}</strong></div></div>
      <p class="chemistry-model-note">化学计量示意进度 <b data-chem-progress>0%</b> · 非真实动力学。器具、液面与固体大小仅作示意。开放容器中仅在 CO₂ 理想完全逸出时，质量相对初始减少对应 CO₂ 质量；不计其溶解及溶剂损失。</p>
    </section>`;
  }
  function renderCa(root,m,p,{reducedMotion=false}={}) {
    const scene=root.querySelector('.chemistry-caco3');if(!scene)return;
    const f=caFrame(m,p),text=(sel,s)=>{scene.querySelector(sel).textContent=s;};
    scene.dataset.extent=String(f.extent);scene.dataset.co2Mass=String(f.co2Mass);
    text('[data-chem-stage]',f.stage);text('[data-chem-gas]',grams(f.co2Mass));text('[data-chem-ca]',f.remainingCa===null?"足量 · 未定量":grams(f.remainingCa));text('[data-chem-hcl]',f.remainingHcl===null?"足量 · 未定量":grams(f.remainingHcl));text('[data-chem-progress]',`${Math.round(f.progress*100)}%`);
    const scale=m.excess==="caco3"?1-.25*f.extent:f.remainingCa/m.p1;
    scene.querySelector('[data-chem-solid]').setAttribute('transform',`translate(0 ${166*(1-scale)}) scale(1 ${scale})`);
    scene.querySelectorAll('[data-chem-bubble]').forEach((bubble,i)=>{bubble.style.opacity=!reducedMotion&&f.extent>0&&f.extent<1?'1':'0';bubble.setAttribute('cy',String(146-((p*7+i*.19)%1)*106));});
  }
  const caco3Hcl={id:"caco3Hcl",subject:"化学",level:"both",menuTitle:"碳酸钙与稀盐酸",menuMeta:"CO₂ 制取 · 限量与剩余",stage:"质量关系",block:"化学计算",title:"碳酸钙与稀盐酸：制取二氧化碳",defaults:[10,7.3],
    keywords:/碳酸钙|CaCO3/i,params:[{label:"CaCO₃ 质量",desc:"纯碳酸钙质量；足量时锁定",unit:"g",min:.1,max:50,step:.1,value:10},{label:"HCl 溶质质量",desc:"不是盐酸溶液质量；足量时锁定",unit:"g",min:.1,max:36.5,step:.05,value:7.3}],
    strict:{sameConditions:true,intent:{require:[/碳酸钙|CaCO3/i,/盐酸|HCl|氯化氢/i]},fixedDefaults:{excess:"",level:"senior",levelLocked:false,asks:"co2,limiting"},caps:massBounds,preciseParams:true,
      rangeFor:(i,f)=>f.excess===(i===0?"caco3":"hcl")?[0,0]:massBounds[i],values:parseCa,
      checkFixed:(f,p1,p2)=>[p1,p2].some((n,i)=>!preciseParam(n)||(f.excess===(i===0?'caco3':'hcl')?n!==0:n<massBounds[i][0]||n>massBounds[i][1]))?'质量超出演示范围或超过四位小数。':!["","hcl","caco3"].includes(f.excess)||!["junior","senior"].includes(f.level)||typeof f.levelLocked!=="boolean"||typeof f.asks!=="string"||f.asks.split(",").some(k=>!Object.hasOwn(askText,k))?"化学实验固定模式无效。":"",
      used:(p1,p2,f)=>[f.excess!=="caco3"&&{cls:"mass",value:p1/1000},f.excess!=="hcl"&&{cls:"mass",value:p2/1000}],asks:{supported:/质量|限量|限制|恰好|哪种|多少/,unsupported:/体积|速率|浓度/}},
    failMessage:"需明确 CaCO₃ 和 HCl 溶质质量，或明确另一方足量。",question:caQuestion,model:caModel,visual:caVisual,recognition:m=>`CaCO₃ 与稀盐酸｜${m.limitingText}｜${m.readout}`,
    parameter:(param,i,f)=>f.excess===(i===0?"caco3":"hcl")?{...param,value:0,min:0,max:0,step:1,locked:true,unit:"",valueText:()=>"足量"}:param,
    copy:(m,p1,p2,f)=>({metrics:[["CaCO₃",f.excess==="caco3"?"":"g"],["HCl 溶质",f.excess==="hcl"?"":"g"],["理论 CO₂","g"]],
      steps:[["提取条件",f.excess==="hcl"?`纯 CaCO₃ ${grams(p1)}，稀盐酸足量。`:f.excess==="caco3"?`纯 CaCO₃ 足量，HCl 溶质 ${grams(p2)}。`:`纯 CaCO₃ ${grams(p1)}，HCl 溶质 ${grams(p2)}。`,"核对溶质质量与足量模式，不把溶液质量代入。"],
        ["计量判断",`${equation}；${f.level==="junior"?"相关质量比 100:73:44":`n(CaCO₃)/1 与 n(HCl)/2 比较`}；${m.limitingText}。`,"先确定真正参与反应的量。"],
        ["按所问列式",m.formulaDetail,"按原题的每个子问列式，采用课堂近似质量常量，结果由本地模型计算。"],
        ["质量核对",m.conclusion,"播放仅展示计量关系，不据此推断真实速率。"]],
      hint:"小提示：先区分盐酸溶液与 HCl 溶质，再判断限量反应物。",mentor:"关键追问：改变一种反应物的质量，CO₂ 是否始终增加？哪一方先耗尽？",challenge:"拖动未锁定的质量控件，比较限量、CO₂ 和剩余质量；重置回到原题配置。",sceneTip:m.conclusion}),
    motion:{duration:8},resetToQuestion:true,frame:caFrame,renderFrame:renderCa};
  caco3Hcl.presetFor = level => ({p1:10,p2:7.3,fixed:{level,levelLocked:false,excess:"",asks:"co2,limiting"}});

  const solutionBlocked=/稀释|浓缩|饱和|析晶|结晶|溶解度|温度效应|加热|冷却|升温|降温|蒸发|密度|体积|容积|mol|摩尔|纯度|杂质|不纯|损失|回收|(?:向|往).{0,30}水.{0,12}(?:加|溶)|(?:在|将).{0,20}水中.{0,8}(?:加|溶)/i;
  const solutionWords=/氯化钠|NaCl|溶质质量分数|质量分数|质量百分数|溶液|盐水|溶质|溶剂|食盐|纯水|水|盐|目标|总质量|质量|所需|需要|分别|各自|各|多少|几克|为|是|的|配制|配置|制备|配成|配|求出|求|计算|步骤|方法|过程|如何|怎样|和|与|及|以及|并|按|请|初中|高中|室温|温度|时|在|纯|完全溶解|混匀|无色/gi;
  const spelledPercent=/百分之\s*(\d+(?:\.\d+)?|二十|十[一二三四五六七八九]?|[零一二三四五六七八九])/g;
  const cnDigits={零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  const readPercent=text=>/^\d/.test(text)?Number(text):text==='二十'?20:text.startsWith('十')?10+(cnDigits[text.slice(1)]||0):cnDigits[text];
  function solutionAsks(source){
    const items=guard().askItems(source),keys=new Set();
    if(!items.length)return miss("请明确所需盐、水的质量或配制步骤。");
    for(const item of items){
      if(/步骤|方法|过程|如何配|怎样配/.test(item))keys.add('steps');
      else if(/氯化钠|NaCl|食盐|盐/.test(item)&&!/盐水|溶液/.test(item))keys.add('salt');
      else if(/水|溶剂/.test(item)&&!/盐水|溶液/.test(item))keys.add('water');
      else return miss("配制实验只回答所需盐、水的质量及配制步骤，不能省略其他子问。");
    }
    if(/(?:求|计算)[^。；;？?]*(?:盐|氯化钠|NaCl|食盐)(?:和|与|、)(?:水|溶剂)/i.test(source)){keys.add('salt');keys.add('water');}
    return {ok:true,asks:[...keys].sort().join(',')};
  }
  function parseSolution(source,tokens,context){
    if(solutionBlocked.test(source))return miss("首版仅支持20°C下按目标总质量和质量分数配制稀NaCl溶液，不支持稀释、饱和、体积或温度效应题。");
    // The shared unit guard treats g10 as a label/subscript. Read compact 100g10%
    // percentages locally, without changing how other subjects tokenize quantities.
    const masses=tokens.filter(t=>t.cls==='mass'),percent=[...source.matchAll(/(?<![\d.])([+-]?\d+(?:\.\d+)?)\s*%/g)].map(m=>({cls:'percent',value:Number(m[1]),index:m.index,text:m[0]})),temps=tokens.filter(t=>t.cls==='temperature');
    const spelled=[...source.matchAll(spelledPercent)];
    if(masses.length!==1||percent.length+spelled.length!==1)return miss("必须明确目标溶液总质量和一份质量百分数，不能把水的质量当作溶液总质量。");
    if(temps.length>1||temps.some(t=>t.value!==20))return miss("当前配制模型固定20°C，不能改换题目温度。");
    const mass=masses[0],lead=source.slice(0,mass.index),tail=source.slice(mass.index+mass.text.length);
    const named=massRoles(source,tokens,['(?:(?:氯化钠|NaCl)(?:的)?溶液|盐水|(?:目标)?溶液|纯水)(?:总)?']);
    const afterPreparation=/(?:配制|配置|制备|配成|配)\s*$/.test(lead)&&!/^(?:的)?\s*水(?!溶液)/.test(tail);
    if(!named?.[0].length&&!afterPreparation)return miss("请明确这是所配溶液的总质量，不能代入溶剂水的质量。");
    const w=percent.length?percent[0].value:readPercent(spelled[0][1]);
    const percentLead=percent.length?source.slice(Math.max(0,percent[0].index-18),percent[0].index):source.slice(Math.max(0,spelled[0].index-18),spelled[0].index);
    const compact=percent.length&&percent[0].index>=mass.index+mass.text.length&&source.slice(mass.index+mass.text.length,percent[0].index).trim()==='';
    if(!/质量分数|质量百分数/.test(percentLead)&&!compact)return miss("浓度需明确为溶质质量分数，不猜测其他百分浓度。");
    const level=levelOf(source,context),asks=solutionAsks(source);
    if(!level||!asks.ok)return level?asks:miss("题目学段条件冲突。");
    const p1=mass.value*1000;
    if(!preciseParam(p1)||!preciseParam(w))return miss("参数最多支持四位小数，请核对输入精度。");
    const narrative=source.replace(spelledPercent,match=>' '.repeat(match.length));
    const narrativeTokens=[...tokens,...percent.filter(p=>!tokens.some(t=>t.index===p.index))];
    if(!knownNarrative(narrative,narrativeTokens,solutionWords))return miss("题目含未支持的条件或所问，不能丢弃后生成配制实验。");
    return {ok:true,p1,p2:w,fixed:{...level,temperature:20,asks:asks.asks}};
  }
  function solutionModel(mass,w,fixed){
    if(!Number.isFinite(mass)||!Number.isFinite(w)||mass<20||mass>500||w<0||w>20||fixed.temperature!==20)throw new RangeError("Solution parameters outside 20°C demonstration range");
    const saltMass=mass*w/100,waterMass=mass-saltMass;
    return {mass,w,saltMass,waterMass,temperature:20,level:fixed.level,metrics:[mass,w,saltMass],metricUnit:'g',
      contextParameters:`当前实验参数（结果对应）：目标溶液总质量 ${fmtInput(mass)} g；质量分数 ${fmtInput(w)}%；20°C。原题保留为重置基准，当前参数可与原题不同。`,
      facts:[fact('所需 NaCl',grams(saltMass)),fact('所需水',grams(waterMass)),fact('总质量核对',exactPlaces(saltMass)!==null&&exactPlaces(waterMass)!==null?`${fmt(saltMass)} + ${fmt(waterMass)} = ${fmt(mass)} g`:`m(NaCl) + m(水) = ${fmtInput(mass)} g（按未舍入值核对）`)],
      formula:'w = m(溶质) / m(溶液) × 100%',formulaDetail:`m(NaCl) = ${fmtInput(mass)} g × ${fmtInput(w)}% ${exactPlaces(saltMass)===null?'≈':'='} ${massNumber(saltMass)} g；m(水) = M − m(NaCl) ${exactPlaces(waterMass)===null?'≈':'='} ${massNumber(waterMass)} g`,
      readout:`盐 ${grams(saltMass)} · 水 ${grams(waterMass)}`,badge:'溶液质量分数',
      conclusion:`${w===0?'纯水（0%）':`配制 ${fmt(mass)} g、${fmt(w)}% 的 NaCl 溶液`}：需盐 ${grams(saltMass)}、水 ${grams(waterMass)}，总质量 ${grams(mass)}。`,
      explanation:'固定20°C、完全溶解、不计转移损失；分母是溶液总质量。'};
  }
  const solutionAskText={salt:'所需氯化钠的质量',water:'所需水的质量',steps:'配制步骤'};
  const solutionQuestion=(m,w,f={})=>`${f.levelLocked?(f.level==='junior'?'初中：':'高中：'):''}20°C时，配制${fmtInput(m)}g质量分数为${fmtInput(w)}%的氯化钠溶液，求${(f.asks||'salt,steps,water').split(',').map(k=>solutionAskText[k]).join('、')}。`;
  const unitProgress=n=>Math.max(0,Math.min(1,n));
  function solutionFrame(m,p){
    const progress=unitProgress(p),pure=m.w===0;
    const saltWeighed=m.saltMass*unitProgress(progress/.2),waterWeighed=m.waterMass*unitProgress((progress-(pure?0:.2))/(pure?.3:.25));
    const saltAdded=m.saltMass*unitProgress((progress-.45)/.15),waterAdded=m.waterMass*unitProgress((progress-(pure?.3:.6))/(pure?.45:.2));
    const mixed=progress===1?1:unitProgress((progress-.8)/.2),step=pure?(progress<.3?1:progress<.8?2:3):progress<.2?0:progress<.45?1:progress<.8?2:3;
    return {progress,step,saltWeighed,waterWeighed,saltAdded,waterAdded,saltOnScale:cleanZero(saltWeighed-saltAdded),waterInCup:cleanZero(waterWeighed-waterAdded),mixtureMass:saltAdded+waterAdded,mixed,
      stage:progress>=1?(pure?'纯水准备完成':'混匀完成'):[pure?'无需称盐':'称取 NaCl','称取水','依次加入容器','搅拌混匀'][step]};
  }
  function solutionVisual(m){
    return `<section class="chemistry-lab-scene chemistry-solution" aria-label="称盐、称水、加入与混匀步骤示意">
      <div class="chemistry-scene-heading"><strong>${m.w===0?'纯水（0%）':'氯化钠溶液配制'}</strong><span data-solution-stage>准备配料</span></div>
      <ol class="solution-step-list"><li>1 称盐</li><li>2 称水</li><li>3 加入</li><li>4 混匀</li></ol>
      <div class="solution-stations">
        <div class="solution-station"><span>称盐 · 托盘当前剩余</span><svg class="solution-apparatus" viewBox="0 0 180 155" role="img" aria-label="电子秤托盘上的白色纯NaCl">
          <path class="chemistry-glass" d="M25 98H155L145 113H35Z"/><g data-solution-salt>${[0,1,2,3,4,5,6].map(i=>`<rect class="chemistry-solid" x="${55+i*9}" y="${87-i%3*6}" width="8" height="8" rx="1"/>`).join('')}</g>
          <rect class="solution-scale" x="38" y="116" width="104" height="28" rx="6"/>
        </svg><strong data-solution-salt-readout>0 g</strong></div>
        <div class="solution-station"><span>称水 · 容器当前剩余</span><svg class="solution-apparatus" viewBox="0 0 180 155" role="img" aria-label="称取水的容器，不作体积换算">
          <path class="chemistry-glass" d="M48 25V122Q48 134 60 134H120Q132 134 132 122V25"/><rect class="chemistry-liquid" data-solution-water x="51" y="45" width="78" height="86"/>
        </svg><strong data-solution-water-readout>0 g</strong></div>
        <div class="solution-station"><span>加入 · 搅拌混匀</span><svg class="solution-apparatus" viewBox="0 0 180 155" role="img" aria-label="无色溶液与溶解示意盐粒">
          <path class="chemistry-glass" d="M34 42V124Q34 137 47 137H133Q146 137 146 124V42"/><rect class="chemistry-liquid" data-solution-mixture x="37" y="60" width="106" height="74"/>
          <g data-solution-crystals>${[0,1,2,3,4].map(i=>`<rect class="chemistry-solid" x="${62+i*10}" y="${120-i%2*7}" width="7" height="7"/>`).join('')}</g>
          <path class="solution-stirrer" data-solution-stirrer d="M98 15L88 120"/>
        </svg><strong data-solution-mixture-readout>0 g</strong></div>
      </div>
      <div class="chemistry-live-readouts"><div><span>目标溶液总质量</span><strong>${grams(m.mass)}</strong></div><div><span>混匀后质量分数</span><strong>${fmt(m.w)}%</strong></div><div><span>已称配料总质量</span><strong data-solution-weighed>0 g</strong></div></div>
      <p class="chemistry-model-note">操作步骤示意进度 <b data-solution-progress>0%</b>。固定20°C，完全溶解、不计转移损失。盐水无色；液面和盐粒仅作示意，不代表精确体积、密度或粒子数。${m.w===0?'0%无需称盐，直接称水。':''}</p>
    </section>`;
  }
  function renderSolution(root,m,p,{reducedMotion=false}={}){
    const scene=root.querySelector('.chemistry-solution');if(!scene)return;const f=solutionFrame(m,p);
    const text=(sel,value)=>{scene.querySelector(sel).textContent=value;};
    scene.dataset.mixtureMass=String(f.mixtureMass);scene.dataset.step=String(f.step);
    text('[data-solution-stage]',f.stage);text('[data-solution-progress]',`${Math.round(f.progress*100)}%`);text('[data-solution-salt-readout]',m.w===0?'无需称盐':grams(f.saltOnScale));text('[data-solution-water-readout]',grams(f.waterInCup));text('[data-solution-mixture-readout]',grams(f.mixtureMass));text('[data-solution-weighed]',grams(f.saltWeighed+f.waterWeighed));
    scene.querySelector('[data-solution-salt]').style.opacity=f.saltOnScale>0?'1':'0';scene.querySelector('[data-solution-crystals]').style.opacity=m.w>0&&f.saltAdded>0?String(1-f.mixed):'0';
    const liquid=(selector,fraction,height,bottom)=>{const el=scene.querySelector(selector);el.setAttribute('height',String(height*fraction));el.setAttribute('y',String(bottom-height*fraction));};
    liquid('[data-solution-water]',f.waterInCup/m.waterMass,86,131);liquid('[data-solution-mixture]',f.waterAdded/m.waterMass,74,134);
    const stirring=!reducedMotion&&f.step===3&&p<1?Math.sin(p*70)*7:0;scene.querySelector('[data-solution-stirrer]').setAttribute('transform',`translate(${stirring} 0)`);
    scene.querySelectorAll('.solution-step-list li').forEach((el,i)=>{el.classList.toggle('is-current',i===f.step);if(i===f.step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  }
  const naclSolution={id:'naclSolution',subject:'化学',level:'both',menuTitle:'氯化钠溶液配制',menuMeta:'质量分数 · 称量与混匀',stage:'溶液配制',block:'化学计算',title:'配制一定质量分数的氯化钠溶液',defaults:[100,10],keywords:/氯化钠|NaCl|盐水|食盐/i,
    params:[{label:'溶液总质量 M',desc:'盐和水的总质量，不是水的质量',unit:'g',min:20,max:500,step:10,value:100},{label:'质量分数 w',desc:'盐质量÷溶液总质量×100%；0%为纯水',unit:'%',min:0,max:20,step:.5,value:10}],
    strict:{sameConditions:true,intent:{require:[/配制|配|制备|配置/,/氯化钠|NaCl|盐水|食盐/i,/溶液|盐水/]},caps:[[20,500],[0,20]],preciseParams:true,fixedDefaults:{level:'senior',levelLocked:false,temperature:20,asks:'salt,steps,water'},values:parseSolution,
      checkFixed:(f,m,w)=>!preciseParam(m)||!preciseParam(w)||m<20||m>500||w<0||w>20?'参数超出演示范围或超过四位小数。':f.temperature!==20||!['junior','senior'].includes(f.level)||typeof f.levelLocked!=='boolean'||typeof f.asks!=='string'||f.asks.split(',').some(k=>!Object.hasOwn(solutionAskText,k))?'配制模型固定条件无效。':'',
      used:(m,w)=>[{cls:'mass',value:m/1000},{cls:'percent',value:w},{cls:'temperature',value:20}],asks:{supported:/质量|氯化钠|NaCl|食盐|盐|水|步骤|方法|配制|多少/,unsupported:/体积|密度|溶解度|浓度.*变化/}},
    failMessage:'请给出目标溶液总质量与溶质质量分数。',question:solutionQuestion,model:solutionModel,visual:solutionVisual,recognition:m=>`NaCl 配制｜M=${fmt(m.mass)}g，w=${fmt(m.w)}%｜${m.readout}`,
    copy:(m)=>({metrics:[['溶液总质量','g'],['目标质量分数','%'],['所需 NaCl','g']],steps:[['提取条件',`20°C，目标总质量 ${grams(m.mass)}，质量分数 ${fmt(m.w)}%。`,'确认给出的是溶液总质量。'],['质量分数定义','w = m(溶质) / m(溶液) × 100%',m.level==='junior'?'分母包含盐和水，不能只取水的质量。':'质量分数为无量纲比值；用质量守恒核对配料，不引入体积加和或物质的量浓度。'],['计算配料',m.formulaDetail,'盐质量与水质量之和必须等于目标总质量。'],['称量与混匀',m.w===0?'无需称盐，称取纯水后加入容器。':`称取 NaCl ${grams(m.saltMass)}、水 ${grams(m.waterMass)}，依次加入并搅拌至完全溶解。`,'盐水保持无色，操作进度不表示真实溶解速率。']],hint:'小提示：百分数的分母是溶液总质量；求盐后，再用总质量减去盐质量求水。',mentor:'关键追问：固定质量分数使总质量加倍，盐和水各怎样变化？固定总质量提高质量分数时呢？',challenge:'调整总质量或质量分数，观察配料关系；主动重置回原题配置。',sceneTip:m.conclusion}),
    presetFor:level=>({p1:level==='junior'?100:200,p2:level==='junior'?10:5,fixed:{level,levelLocked:false,temperature:20,asks:'salt,steps,water'}}),motion:{duration:10},resetToQuestion:true,frame:solutionFrame,renderFrame:renderSolution};
  kit.register({caco3Hcl,naclSolution});
})();
