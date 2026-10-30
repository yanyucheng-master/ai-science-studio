(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit,C=window.MasterLabMendel;if(!kit||!C)return;
  const {fact,stages}=kit.helpers;
  const askText={expected:'各基因型期望个数',genotype:'各基因型概率',phenotype:'显隐性概率',simulation:'本次模拟个数'};
  const fixedDefaults={...C.CONDITIONS,parent1:'Aa',parent2:'Aa',level:'senior',levelLocked:false,asks:'expected,genotype,phenotype',simulationVersion:1};
  const conditions='一对常染色体等位基因A和a，A对a完全显性，配子等概率且随机受精，后代独立且无选择差异';
  const value=n=>String(n),percent=p=>`${p*100}%`;
  function issue(f,n,seed){
    if(!['junior','senior'].includes(f.level)||typeof f.levelLocked!=='boolean'||f.simulationVersion!==1||typeof f.asks!=='string'||!f.asks||f.asks.split(',').some(k=>!Object.hasOwn(askText,k)))return '学段、所问或模拟版本无效。';
    try{C.validate({...f,n,seed});return '';}catch(e){return e.message;}
  }
  function parse(text,context={}){
    let s=window.MasterLabQuestionGuard.normalize(text).replace(/\s/g,'');
    const grade=s.match(/^(初中|高中)[:：,，]?/);if(grade)s=s.slice(grade[0].length);
    const f={level:grade?(grade[1]==='初中'?'junior':'senior'):context.gradeLevel||'senior',levelLocked:Boolean(grade),simulationVersion:1};
    const given={},asks=new Set();let bad=false,afterAsk=false;
    const put=(k,v)=>{if(Object.hasOwn(given,k))bad=true;given[k]=v;};
    for(const clause of s.split(/[，,。；;？?：:]+/).filter(Boolean)){
      const marker=clause.match(/^(?:请)?(?:求|计算|比较)(.+)$/),body=marker?marker[1]:clause;
      const names=body.split(/、|以及|及/),keys=names.map(name=>Object.keys(askText).find(k=>askText[k]===name));
      if(marker||afterAsk&&keys.every(Boolean)){if(keys.some(k=>!k))bad=true;else keys.forEach(k=>asks.add(k));afterAsk=true;continue;}
      afterAsk=false;let m;
      if(clause==='一对常染色体等位基因A和a')put('autosomal',true);
      else if(clause==='A对a完全显性')put('completeDominance',true);
      else if(clause==='配子等概率且随机受精'){put('equalGametes',true);put('randomFertilization',true);}
      else if(clause==='后代独立且无选择差异'){put('independentOffspring',true);put('noSelection',true);}
      else if((m=clause.match(/^(?:亲本|亲本组合)(?:为|是|=)?(AA|Aa|aa)[×*](AA|Aa|aa)$/))){put('parent1',m[1]);put('parent2',m[2]);}
      else if((m=clause.match(/^后代数(?:为|是|=)?(\d{1,4})(?:个)?$/)))put('n',Number(m[1]));
      else if((m=clause.match(/^模拟种子(?:为|是|=)?(\d{1,4})$/)))put('seed',Number(m[1]));
      else bad=true;
    }
    const {n,seed,...rest}=given;Object.assign(f,rest,{asks:[...asks].sort().join(',')});
    if(bad||!asks.size||issue(f,n,seed))return {ok:false,message:'请完整说明一对常染色体、完全显性、等概率配子与随机受精、后代独立无选择，以及亲本、后代数和模拟种子；支持基因型概率、显隐性概率、期望或模拟个数。'};
    return {ok:true,p1:n,p2:seed,fixed:f};
  }
  function question(n,seed,f=fixedDefaults){return `${f.levelLocked?(f.level==='junior'?'初中：':'高中：'):''}${conditions}，亲本为${f.parent1}×${f.parent2}，后代数为${n}个，模拟种子为${seed}，求${f.asks.split(',').map(k=>askText[k]).join('、')}。`;}
  let cache;
  function model(n,seed,f=fixedDefaults){
    const error=issue(f,n,seed);if(error)throw new RangeError(error);
    const key=JSON.stringify([n,seed,f.parent1,f.parent2]);
    const m=cache?.key===key?cache.model:C.model({...f,n,seed});cache={key,model:m};
    const triplet=(obj,suffix)=>C.GENOTYPES.map(g=>`${g} ${obj[g]}${suffix}`).join('、');
    const answers={genotype:`理论概率：${C.GENOTYPES.map(g=>`${g} ${percent(m.probabilities[g])}`).join('、')}`,phenotype:`显性 ${percent(m.dominant)}，隐性 ${percent(m.recessive)}`,expected:`期望个数：${triplet(m.expected,'')}`,simulation:`本次模拟：${triplet(m.counts,'个')}（可复现抽样，非实测）`};
    return {...m,level:f.level,asks:f.asks,metrics:[n,seed,m.recessive*100],metricUnit:'%',
      facts:[fact('理论隐性概率',percent(m.recessive)),fact('隐性期望个数',value(m.expected.aa)),fact('本次模拟隐性',`${m.counts.aa} 个`)],
      formula:'期望个数 = 后代数 × 理论概率',formulaDetail:`${answers.genotype}；${answers.expected}。期望允许小数，模拟实际个数是整数。`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',readout:`${m.parent1} × ${m.parent2} · 隐性概率 ${percent(m.recessive)}`,badge:'分离定律 · 理论与抽样',
      contextParameters:`亲本${m.parent1}×${m.parent2}；${conditions}；当前比较后代数${n}、种子${seed}、模拟版本1。理论与期望不随种子改变，模拟结果不是实测。`};
  }
  function visual(m){return `<section class="biology-mendel-scene" aria-label="孟德尔单基因分离模型">
    <h3>${m.parent1} × ${m.parent2}：预测与抽样</h3><p>${m.level==='junior'?'简化概念拓展':'一对等位基因的分离'}。A 完全显性；同一亲本产生的两个配子槽位各以 50% 概率抽取。纯合亲本两个槽位相同。</p>
    <div class="mendel-panels"><div><h4>配子组合棋盘</h4><table class="mendel-punnett"><caption>每格概率 25%；相同基因型合并统计</caption><thead><tr><th scope="col">亲本1 ↓<br>亲本2 →</th>${[...m.parent2].map(g=>`<th scope="col">${g}</th>`).join('')}</tr></thead><tbody>${[...m.parent1].map((g,i)=>`<tr><th scope="row">${g}</th>${m.slots.slice(i*2,i*2+2).map(s=>`<td class="mendel-${s.genotype}">${s.genotype}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div><h4>理论概率始终不变</h4>${C.GENOTYPES.map(g=>`<div class="mendel-prob-row"><span>${g}</span><div class="mendel-track"><i style="width:${m.probabilities[g]*100}%"></i></div><strong>${percent(m.probabilities[g])}</strong></div>`).join('')}<p>显性 ${percent(m.dominant)}；隐性 ${percent(m.recessive)}。调整后代数会改变期望数量，不改变理论比例。</p></div></div>
    <table class="mendel-results"><caption>目标 N = ${m.n}；种子 ${m.seed}。完整模拟结果与期望分别列出；可复现抽样，非实测</caption><thead><tr><th scope="col">基因型</th><th scope="col">期望个数</th><th scope="col">本次模拟</th></tr></thead><tbody>${C.GENOTYPES.map(g=>`<tr><th scope="row">${g}</th><td>${m.expected[g]}</td><td>${m.counts[g]}</td></tr>`).join('')}</tbody></table>
    <div class="mendel-playback"><strong data-mendel-progress></strong><p data-mendel-last></p><div class="mendel-current-counts" data-mendel-counts></div></div>
    <p class="mendel-note">播放按进度展示已确定的模拟序列，不代表真实生长时间。每次抽取后放回；改变种子可比较不同样本。样本不保证精确符合理论比例，也不保证每次增加数量都更接近理论。</p>
    <details><summary>模型边界与教材依据</summary><p>仅限一对常染色体等位基因、完全显性、等概率配子、随机受精、后代独立、无选择差异。排除伴性、致死、不完全显性及未知亲本反推。修改亲本请编辑题目后重新生成。</p><p>人教高中必修2《遗传与进化》第一章第一节，正文第5–7页：分离、随机结合与放回抽样。这里使用A/a与原创棋盘示意；伪随机模拟用于比较，不是实验实测，也不构成遗传规律的证明。</p></details>
  </section>`;}
  function renderFrame(root,m,p){const el=root.querySelector('.biology-mendel-scene');if(!el)return;const f=C.frame(m,p);el.dataset.shown=String(f.shown);el.querySelector('[data-mendel-progress]').textContent=`播放当前：已展示 ${f.shown} 个，共 ${m.n} 个`;el.querySelector('[data-mendel-last]').textContent=f.last?`最近一次：${f.last.a} 与 ${f.last.b} 结合为 ${f.last.genotype}`:'从两个亲本分别取一个配子，准备开始。';el.querySelector('[data-mendel-counts]').textContent=C.GENOTYPES.map(g=>`${g}：${f.counts[g]}`).join('　');}
  kit.register({mendel:{id:'mendel',subject:'生物',level:'both',block:'遗传',stage:'遗传与概率',title:'孟德尔分离定律：理论与模拟',menuTitle:'孟德尔分离定律',menuMeta:'配子组合 · 理论概率 · 抽样',defaults:[400,1],resetToQuestion:true,motion:{duration:10},formatMetric:value,keywords:/亲本|孟德尔|基因型|等位基因/,
    params:[{label:'后代数 N',desc:'1–2000整数；不改变理论比例',unit:'个',min:1,max:2000,step:1,value:400},{label:'模拟种子',desc:'1–9999整数；相同条件可复现',unit:'',min:1,max:9999,step:1,value:1}],
    strict:{sameConditions:true,caps:[[1,2000],[1,9999]],fixedDefaults,intent:{require:[/亲本/,/基因/]},values:(s,t,c)=>parse(s,c),checkFixed:issue,used:()=>[],asks:{supported:/基因型|显隐性|期望|模拟个数|^(?:一对常染色体等位基因A和a|A对a完全显性|配子等概率且随机受精|后代独立且无选择差异|亲本(?:为|是|=)?(?:AA|Aa|aa)[×*](?:AA|Aa|aa)|后代数(?:为|是|=)?\d+个|模拟种子(?:为|是|=)?\d+)$/,unsupported:/反推|患病|至少|恰好|连续|伴性/}},
    question,model,visual,renderFrame,frame:C.frame,recognition:m=>m.readout,presetFor:level=>({p1:400,p2:1,fixed:{...fixedDefaults,level}}),
    copy:m=>({steps:[['核对条件',`${m.parent1}×${m.parent2}，${m.n}个后代；${conditions}。`,'只在给定模型中计算。'],['分别形成配子','每个亲本向后代提供一个等位基因。','杂合子两种各一半；纯合子只有一种。'],['先预测再抽样',m.formulaDetail,'种子不改变理论概率，期望个数不是必然结果。'],['比较并解释',m.conclusion,'改变种子观察样本波动；不能以一次比例吻合证明定律。']],hint:`先预测${m.parent1}×${m.parent2}时隐性概率，再比较期望个数与本次模拟。`,mentor:`在当前${m.n}个后代中，隐性期望为${m.expected.aa}。这是否意味着每次模拟都恰好得到这个数量？请结合当前亲本和理论概率解释。`,challenge:'保持亲本不变，分别调整后代数和种子，观察哪些结果保持不变。',sceneTip:m.conclusion,generationStages:stages('核对亲本与遗传模型','枚举配子组合计算理论概率','生成可复现的放回抽样')})}});
})();
