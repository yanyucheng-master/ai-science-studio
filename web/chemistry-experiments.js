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
  const grams = n => `${exactPlaces(n) === null ? "≈" : ""}${fmt(n, 3)} g`;
  const levelOf = (source, context) => {
    if (/初中/.test(source) && /高中/.test(source)) return null;
    const stated = /初中/.test(source) ? "junior" : /高中/.test(source) ? "senior" : "";
    return { level: stated || context.gradeLevel || "senior", levelLocked: Boolean(stated) };
  };
  function massRoles(source, tokens, names) {
    const map = new Map();
    names.forEach((name, role) => {
      for (const pattern of [`(${quantity})\\s*(?:的)?\\s*${name}`, `${name}\\s*(?:的)?\\s*(?:质量|用量)?\\s*(?:为|是|=|:|含有|含)?\\s*(${quantity})`]) {
        for (const match of source.matchAll(new RegExp(pattern, "gi"))) {
          const index = match.index + match[0].indexOf(match[1]);
          const token = tokens.find(t => t.cls === "mass" && t.index === index);
          if (!token) continue;
          const previous = map.get(index);
          if (previous && previous.role !== role) return null;
          map.set(index, { role, token });
        }
      }
    });
    const masses = tokens.filter(t => t.cls === "mass");
    if (map.size !== masses.length) return null;
    return names.map((_, role) => [...map.values()].filter(item => item.role === role).map(item => item.token));
  }
  // A conservative local grammar also rejects unrecognised, unitless constraints.
  // Removing a quantity here never approves it: used()/role checks validate every token separately.
  function knownNarrative(source, tokens, words) {
    let rest = source;
    for (const t of [...tokens].sort((a,b) => b.index-a.index)) rest = rest.slice(0,t.index) + " " + rest.slice(t.index+t.text.length);
    rest = rest.replace(/CaCO3|HCl|CO2/gi, " ").replace(words, " ").replace(/[\s，,。；;？?！!、：:（）()=+→↑·]/g, "");
    return !rest;
  }
  const caWords = /二氧化碳|碳酸钙|氯化氢|反应物|盐酸|溶质|溶液|纯|稀|足量|过量|足够|的|质量|用量|剩余|余量|消耗|生成|产生|理论|最多|最终|反应后|反应中|充分|完全|恰好|反应|限量|限制|哪种|是否|多少|各自|分别|求出|试求|求|计算|判断|确定|以及|及其|以及|和|与|并|及|有|取|将|把|加入|含有|含|为|是|后|中|了|请|初中|高中|方法|按|计算/g;
  const caBlocked = /纯度|杂质|石灰石|大理石|浓度|质量分数|体积|容积|密度|速率|速度|时间|压强|压力|温度|加热|催化|分步|多步|滴定|平衡|密闭|不完全|溶解度|mol\b|摩尔|氯化钙|CaCl2|蒸发|损失/i;
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
    const excessCa = /(?:足量|过量|足够)(?:的)?\s*(?:纯)?\s*(?:CaCO3|碳酸钙)|(?:CaCO3|碳酸钙)(?:固体)?\s*(?:为|是)?\s*(?:足量|过量|足够)/i.test(source);
    const excessHcl = /(?:足量|过量|足够)(?:的)?\s*(?:稀)?\s*(?:盐酸|HCl)|(?:稀盐酸|盐酸|HCl(?:溶液)?)\s*(?:为|是)?\s*(?:足量|过量|足够)/i.test(source);
    if ((excessCa && excessHcl) || (excessCa && roles[0].length) || (excessHcl && roles[1].length)) return miss("足量条件与定量条件冲突，请明确给定模式。");
    if ((!roles[0].length && !excessCa) || (!roles[1].length && !excessHcl)) return miss("需给出 CaCO₃ 与 HCl 溶质质量，或明确另一方足量；不猜测盐酸浓度。");
    const excess = excessCa ? "caco3" : excessHcl ? "hcl" : "";
    const p1 = roles[0][0] ? roles[0][0].value * 1000 : 0, p2 = roles[1][0] ? roles[1][0].value * 1000 : 0;
    if ([p1,p2].some(n => exactPlaces(n) === null)) return miss("质量换算为 g 后最多支持四位小数，请保留原题并核对输入精度。");
    const level = levelOf(source, context);
    if (!level) return miss("题目学段条件冲突。");
    const asks = caAsks(source, excess);
    if (!asks.ok) return asks;
    if (!knownNarrative(source,tokens,caWords)) return miss("题目含未支持的条件或所问，不能省略后生成实验。");
    const givens = source.split(/试求|求|计算|判断|确定/)[0];
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
    const formulaDetail=fixed.level==="junior"?proportion.solve:`ξ = ${fmt(xi,5)} mol；m(CO₂) = 44 g/mol × ξ ${exactPlaces(co2Mass)===null?"≈":"="} ${fmt(co2Mass,3)} g`;
    return {p1,p2,excess,level:fixed.level,xi,consumedCa,consumedHcl,co2Mass,remainingCa,remainingHcl,limiting,limitingText,remainingText,proportion,
      metrics:[excess==="caco3"?"足量":p1,excess==="hcl"?"足量":p2,co2Mass],metricUnit:"g",
      facts:[fact("理论 CO₂",grams(co2Mass)),fact("计量判断",limitingText),fact("反应后剩余",remainingText)],
      formula:equation,formulaDetail,readout:`理论 CO₂ ${grams(co2Mass)}`,badge:"化学计量",
      conclusion:`${limitingText}，理论生成 CO₂ ${grams(co2Mass)}。${remainingText}。`,
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
    strict:{intent:{require:[/碳酸钙|CaCO3/i,/盐酸|HCl|氯化氢/i]},fixedDefaults:{excess:"",level:"senior",levelLocked:false,asks:"co2,limiting"},caps:massBounds,preciseParams:true,
      rangeFor:(i,f)=>f.excess===(i===0?"caco3":"hcl")?[0,0]:massBounds[i],values:parseCa,
      checkFixed:(f)=>!["","hcl","caco3"].includes(f.excess)||!["junior","senior"].includes(f.level)||typeof f.levelLocked!=="boolean"||typeof f.asks!=="string"||f.asks.split(",").some(k=>!Object.hasOwn(askText,k))?"化学实验固定模式无效。":"",
      used:(p1,p2,f)=>[f.excess!=="caco3"&&{cls:"mass",value:p1/1000},f.excess!=="hcl"&&{cls:"mass",value:p2/1000}],asks:{supported:/质量|限量|限制|恰好|哪种|多少/,unsupported:/体积|速率|浓度/}},
    failMessage:"需明确 CaCO₃ 和 HCl 溶质质量，或明确另一方足量。",question:caQuestion,model:caModel,visual:caVisual,recognition:m=>`CaCO₃ 与稀盐酸｜${m.limitingText}｜${m.readout}`,
    parameter:(param,i,f)=>f.excess===(i===0?"caco3":"hcl")?{...param,value:0,min:0,max:0,step:1,locked:true,unit:"",valueText:()=>"足量"}:param,
    copy:(m,p1,p2,f)=>({metrics:[["CaCO₃",f.excess==="caco3"?"":"g"],["HCl 溶质",f.excess==="hcl"?"":"g"],["理论 CO₂","g"]],
      steps:[["提取条件",f.excess==="hcl"?`纯 CaCO₃ ${grams(p1)}，稀盐酸足量。`:f.excess==="caco3"?`纯 CaCO₃ 足量，HCl 溶质 ${grams(p2)}。`:`纯 CaCO₃ ${grams(p1)}，HCl 溶质 ${grams(p2)}。`,"核对溶质质量与足量模式，不把溶液质量代入。"],
        ["计量判断",`${equation}；${f.level==="junior"?"相关质量比 100:73:44":`n(CaCO₃)/1 与 n(HCl)/2 比较`}；${m.limitingText}。`,"先确定真正参与反应的量。"],
        ["列式计算",f.level==="junior"?`${m.proportion.set}；${m.proportion.ratio}；${m.proportion.solve}`:m.formulaDetail,"采用课堂近似质量常量，结果由本地模型计算。"],
        ["质量核对",m.conclusion,"播放仅展示计量关系，不据此推断真实速率。"]],
      hint:"小提示：先区分盐酸溶液与 HCl 溶质，再判断限量反应物。",mentor:"关键追问：改变一种反应物的质量，CO₂ 是否始终增加？哪一方先耗尽？",challenge:"拖动未锁定的质量控件，比较限量、CO₂ 和剩余质量；重置回到原题配置。",sceneTip:m.conclusion}),
    motion:{duration:8},resetToQuestion:true,frame:caFrame,renderFrame:renderCa};
  caco3Hcl.presetFor = level => ({p1:10,p2:7.3,fixed:{level,levelLocked:false,excess:"",asks:"co2,limiting"}});
  kit.register({caco3Hcl});
})();
