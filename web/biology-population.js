(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit,C=window.MasterLabPopulation,Q=window.MasterLabPopulationQuestions;if(!kit||!C||!Q)return;
  const {fact,stages}=kit.helpers;
  const defaults={version:1,mode:'discrete',level:'senior',levelLocked:false,initial:100,fixedMultiplier:true,equalPeriods:true,asks:'quantity,trend'};
  const logisticDefaults={version:1,mode:'logistic',level:'senior',levelLocked:false,initial:100,capacity:1000,constantCapacity:true,constantRate:true,timeUnit:'day',asks:'peak,quantity,rate'};
  const ranges=(i,f)=>f.mode==='logistic'?(i?[0,20]:[.01,2]):(i?[0,20]:[.1,3]);
  function presetFor(level,mode='discrete'){
    return mode==='logistic'?{p1:.5,p2:10,fixed:{...logisticDefaults,level}}:{p1:1.5,p2:4,fixed:{...defaults,level}};
  }
  function parameter(p,index,f){
    if(f.mode!=='logistic')return p;
    const [min,max]=ranges(index,f);
    return {...p,min,max,step:.01,label:index?'经过时间 t':'连续增长参数 r',unit:index?'天':'天⁻¹',desc:index?'从题目初态开始计算，可取小数天':'连续模型参数，不是每期倍数λ'};
  }
  const number=(n,digits=8)=>String(Number(n.toPrecision(digits)));
  const trendText={growth:'指数增长（J形趋势）',stable:'数量稳定',decline:'指数下降'};
  function model(multiplier,periods,f=defaults){
    const error=Q.issue(f,multiplier,periods);if(error)throw new RangeError(error);
    if(f.mode==='logistic')return logisticModel(multiplier,periods,f);
    const m=C.calculate(f.initial,multiplier,periods),answer=`第${periods}期模型数量 ≈ ${number(m.quantity)} 个`;
    const trend=trendText[m.trend],comparison=multiplier>1?'大于':multiplier<1?'小于':'等于';
    const contextParameters=`初始数量${m.initial}个，每期时长相同，固定倍数λ=${multiplier}，经过${periods}期。仅按整数期递推计算；结果为模型量，不是实际个体计数。`;
    return {...m,mode:'discrete',level:f.level,asks:f.asks,metrics:[multiplier,periods,m.quantity],metricUnit:'个',badge:'种群 · 离散模型',
      facts:[fact('模型数量',`≈ ${number(m.quantity)} 个`),fact('题给初始数量',`${m.initial} 个`),fact('随期数变化',trend)],
      formula:'Nₜ = N₀ × λᵗ',formulaDetail:`Nₜ = ${m.initial} × ${multiplier}^${periods} ≈ ${number(m.quantity)}。λ${comparison}1，模型随期数表现为${trend}。`,
      conclusion:f.asks.split(',').map(k=>k==='quantity'?answer:`模型随期数表现为${trend}`).join('；')+'。',
      readout:answer,contextParameters,trendText:trend};
  }
  function logisticModel(rate,time,f){
    const m=C.logistic(f.initial,f.capacity,rate,time);
    const peakExplanation=m.peakPosition==='past'
      ? `初始数量${m.initial}已大于K/2=${m.capacity/2}，从题目起点往后增长速率持续下降；最大值在第0天，为${number(m.peakRate)}个/天。`
      : `N=K/2=${m.capacity/2}时增长速率最大；从题目起点算起在${number(m.peakTime)}天达到，最大值为${number(m.peakRate)}个/天。`;
    const answers={quantity:`${time}天时模型数量 ≈ ${number(m.quantity)} 个`,rate:`瞬时增长速率 ≈ ${number(m.growthRate)} 个/天`,peak:`起点后最大增长速率 ≈ ${number(m.peakRate)} 个/天，在${number(m.peakTime)}天达到`};
    const contextParameters=`采用连续logistic模型，N₀=${m.initial}个，K=${m.capacity}个且恒定，r=${rate}每天且恒定，t=${time}天。0<N₀<K；r不是离散每期倍数λ。数量与速率都是模型量。`;
    return {...m,mode:'logistic',level:f.level,asks:f.asks,metrics:[rate,time,m.quantity],metricUnit:'个',badge:'种群 · 连续logistic模型',
      facts:[fact('模型数量',`≈ ${number(m.quantity)} 个`),fact('瞬时增长速率',`≈ ${number(m.growthRate)} 个/天`),fact('环境容纳量 K',`${m.capacity} 个`)],
      formula:f.level==='junior'?'模型数量增长并趋近固定环境容纳量 K':'dN/dt = rN(1 − N/K)',
      formulaDetail:`${time}天时，N ≈ ${number(m.quantity)}个；瞬时增长速率 ≈ ${number(m.growthRate)}个/天。${peakExplanation}`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',readout:answers.quantity,contextParameters,peakExplanation};
  }
  function examples(mode){return `<nav class="population-examples" aria-label="打开另一种种群模型示例"><span>生成另一模型的新题</span><button type="button" data-population-example="${mode==='logistic'?'discrete':'logistic'}">${mode==='logistic'?'打开固定倍数示例':'打开S型增长示例'}</button></nav>`;}
  function logisticChart(m,metric){
    const isRate=metric==='growthRate',left=128,right=454,top=42,bottom=230;
    const ymax=isRate?m.rate*m.capacity/4*1.15:m.capacity*1.15;
    const x=t=>left+(right-left)*t/Math.max(.01,m.time),y=n=>bottom-(bottom-top)*n/ymax;
    const ticks=[...new Set([0,m.time/2,m.time])],guide=isRate?m.rate*m.capacity/4:m.capacity;
    return `<svg class="population-chart" data-population-chart="${metric}" viewBox="0 0 480 285" role="img" aria-label="${isRate?'瞬时增长速率':'模型数量'}随时间的变化，纵轴线性且从零开始"><text x="10" y="20">${isRate?'增长速率（个/天）':'模型数量（个）'}</text>${[0,.5,1].map(v=>`<path class="population-grid" d="M${left} ${y(guide*v)}H${right}"/><text x="${left-10}" y="${y(guide*v)+6}" text-anchor="end">${number(guide*v,4)}</text>`).join('')}<path class="population-axis" d="M${left} ${top}V${bottom}H${right}"/><path class="population-capacity" d="M${left} ${y(guide)}H${right}"/><text class="population-guide-label" x="${right}" y="${y(guide)-8}" text-anchor="end">${isRate?'rK/4':'K'}</text>${ticks.map(t=>`<text x="${x(t)}" y="${bottom+24}" text-anchor="middle">${number(t,4)}</text>`).join('')}<text x="${right}" y="277" text-anchor="end">时间（天）</text><polyline class="population-curve" points="${m.points.map(p=>`${x(p.time)},${y(p[metric])}`).join(' ')}"/><circle data-population-current="${metric}" data-value="${m[metric]}" cx="${x(m.time)}" cy="${y(m[metric])}" r="5"/>${m.peakPosition!=='past'&&m.peakTime<=m.time?`<circle class="population-peak" data-population-peak="${metric}" cx="${x(m.peakTime)}" cy="${y(isRate?m.peakRate:m.peakQuantity)}" r="5"/>`:''}</svg>`;
  }
  function logisticVisual(m){
    return `<section class="biology-population-scene" data-mode="logistic" aria-label="S型种群数量模型"><h3>环境容纳量怎样限制种群增长？</h3><p>题给初始数量 <strong>${m.initial} 个</strong>，环境容纳量 <strong>K=${m.capacity} 个</strong>；K与连续增长参数r保持不变。</p><div class="population-answer"><span>经过 ${m.time} 天的模型数量</span><strong data-population-quantity>≈ ${number(m.quantity)} 个</strong><span data-population-rate>瞬时增长速率 ≈ ${number(m.growthRate)} 个/天</span></div><div class="population-logistic-charts">${logisticChart(m,'quantity')}${logisticChart(m,'growthRate')}</div><p class="population-note">两图对应同一时间段，分别看数量和增长快慢。曲线由解析模型采样绘制；蓝点为当前时刻，橙点为图中可见的速率峰值时刻。e记法表示10的幂。</p><p data-population-peak-note>${m.peakExplanation}</p>${m.peakTime>m.time?'<p>峰值时刻在当前展示时间段之后；图中只显示此前的曲线片段。</p>':''}${m.time===0?'<p>第0天就是题给初态，尚未经过时间；当前只显示初态点。</p>':''}<p>数量在有限时间内趋近K，近似显示为K不等于已经精确达到K。模型量不取整为真实个体计数，速率也不是一天内的实际净增加数量。</p><details class="population-table"><summary>查看抽样时刻的模型读数</summary><table><thead><tr><th scope="col">时间（天）</th><th scope="col">数量（个）</th><th scope="col">速率（个/天）</th></tr></thead><tbody>${m.table.map(p=>`<tr><th scope="row">${number(p.time)}</th><td>${number(p.quantity)}</td><td>${number(p.growthRate)}</td></tr>`).join('')}</tbody></table><p class="population-note">表格为当前时间段的五个抽样时刻，读数均为近似值；不表示时间只能取这些值。</p></details><details class="population-conditions"><summary>模型条件与教材依据</summary><p>${m.contextParameters}</p><p>${m.level==='junior'?'初中作为概念拓展观察：数量增加时，增长快慢不一定同时增加。完整解析式属于进一步数学建模。':'模型定义：dN/dt = rN(1 − N/K)。解析式：N(t) = K / [1 + (K/N₀ − 1) × exp(−rt)]。'}</p><p>人教高中《生物学 选择性必修2》正文第9页介绍S形增长与K；这里的定量函数另据OpenStax Calculus Volume 2 §4.4的logistic模型。只有给出K、r和初态，才能确定时间曲线；现实环境中的K未必恒定。</p></details>${examples('logistic')}</section>`;
  }
  function chart(m){
    const left=128,right=454,top=35,bottom=228,x=t=>left+(right-left)*t/Math.max(1,m.periods);
    const ymax=Math.max(m.initial,m.quantity)*1.15,y=q=>bottom-(bottom-top)*q/ymax;
    const ticks=[...new Set([0,Math.round(m.periods/2),m.periods])];
    const dots=m.points.map(p=>`<circle data-population-point="${p.period}" data-quantity="${p.quantity}" cx="${x(p.period)}" cy="${y(p.quantity)}" r="${p.period===m.periods?5:3.5}"/>`).join('');
    return `<svg class="population-chart" viewBox="0 0 480 280" role="img" aria-label="整数期模型数量，纵轴线性且从零开始"><text x="10" y="18">模型数量（个）</text>${[0,.5,1].map(f=>`<path class="population-grid" d="M${left} ${y(ymax*f)}H${right}"/><text class="population-y-label" x="${left-10}" y="${y(ymax*f)+6}" text-anchor="end">${number(ymax*f,4)}</text>`).join('')}<path class="population-axis" d="M${left} ${top}V${bottom}H${right}"/>${ticks.map(t=>`<text x="${x(t)}" y="${bottom+24}" text-anchor="middle">${t}</text>`).join('')}<text x="${right}" y="275" text-anchor="end">期数 t</text><polyline class="population-guide" points="${m.points.map(p=>`${x(p.period)},${y(p.quantity)}`).join(' ')}"/>${dots}</svg>`;
  }
  function visual(m){
    if(m.mode==='logistic')return logisticVisual(m);
    return `<section class="biology-population-scene" data-mode="discrete" aria-label="种群数量模型"><h3>固定倍数下，种群数量怎样变化？</h3><p>题给初始数量 <strong>${m.initial} 个</strong>。每一期时长相同；λ 表示下一期是本期的多少倍。</p><div class="population-answer"><span>经过 ${m.periods} 期的模型数量</span><strong data-population-quantity>≈ ${number(m.quantity)} 个</strong><span data-population-trend>${m.trendText}</span></div>${chart(m)}<p class="population-note">只计算整数期；虚线仅连接计算点，不代表期内变化。纵轴随参数自动缩放，比较大小请同时看读数。e 表示10的幂。</p>${m.periods===0?'<p>第0期就是初始状态，尚未经过任何一期；趋势描述的是随后按该倍数递推的变化。</p>':''}<p>小数是模型计算量，不取整为实际个体数。数量很小时也不能据此断言已经灭绝。</p><details class="population-table"><summary>查看逐期模型数量</summary><table><thead><tr><th scope="col">期数</th><th scope="col">模型数量（个，近似显示）</th></tr></thead><tbody>${m.points.map(p=>`<tr><th scope="row">${p.period}</th><td>${number(p.quantity)}</td></tr>`).join('')}</tbody></table></details><details class="population-conditions"><summary>模型条件与教材依据</summary><p>${m.contextParameters}</p><p>依据人教高中《生物学 选择性必修2 生物与环境》2019体系正文第7–9页的数量模型。本实验将年度步长推广为等长的“期”；初中模式为概念拓展。</p><p>λ大于1才呈J形增长趋势，等于1为稳定，小于1为下降。固定倍数是假设；现实中的资源、空间和环境会限制增长。当前离散模式没有加入环境容纳量；S型请打开另一模型示例。</p></details>${examples('discrete')}</section>`;
  }
  kit.register({population:{id:'population',subject:'生物',level:'both',block:'种群',stage:'种群数量',title:'种群数量：离散与S型模型',menuTitle:'种群数量模型',menuMeta:'倍数 · 环境容纳量 · 增长速率',defaults:[1.5,4],resetToQuestion:true,preserveExplicitGrade:true,formatMetric:n=>number(n),keywords:/种群/,
    params:[{label:'每期倍数 λ',desc:'下一期数量是本期的多少倍',unit:'倍',min:.1,max:3,step:.01,value:1.5},{label:'经过期数 t',desc:'等长时间段，只取整数期',unit:'期',min:0,max:20,step:1,value:4}],
    parameter,strict:{sameConditions:true,fixedDefaults:defaults,rangeFor:ranges,intent:{require:[/种群/]},values:(s,t,c)=>Q.parse(s,c),checkFixed:Q.issue,used:(a,b,f)=>f.mode==='logistic'?[]:[{cls:'times',value:a}],asks:{supported:/种群模型数量|数量变化趋势|瞬时增长速率|起点后最大增长速率/,unsupported:/反推|实际数量|精确数量|密度|环境容纳量|时间|倍数/}},
    question:(a,b,f=defaults)=>Q.question(a,b,f),model,visual,presetFor,recognition:m=>m.readout,
    copy:m=>m.mode==='logistic'?{steps:[['核对连续模型',m.contextParameters,'初态、K、r与时间必须明确。'],['建立模型',m.formula,'连续参数r与离散倍数λ分开。'],['查看数量与速率',m.formulaDetail,'数量仍在增加时，增长速率可以下降。'],['解释适用范围',m.conclusion,'K恒定是模型条件，不代表所有真实环境。']],hint:'先预测：数量从K/2增加到更接近K时，增长会更快还是更慢？',mentor:`初始数量${m.initial}个，K=${m.capacity}个。从这个起点开始，为什么增长速率${m.peakPosition==='past'?'会一直降低':'在K/2处达到峰值'}？`,challenge:'保持初态和K不变，调整r比较曲线达到相同数量的时间。',sceneTip:m.conclusion,generationStages:stages('核对连续模型及固定条件','计算数量、速率与峰值','绘制同一时间段的两条曲线')}:
    {steps:[['核对条件',m.contextParameters,'先确认每期时长相同、倍数固定。'],['建立递推',m.formula,'经过一期乘一次λ；经过t期共乘t次。'],['代入参数',m.formulaDetail,'λ是相邻两期的数量比，不直接等于增长率。'],['解释范围',m.conclusion,'这是模型推算，不是实际调查计数。']],hint:'先预测：倍数从1.5改成1或0.5，数量会怎样变化？',mentor:`初始数量${m.initial}个，当前每期倍数为${m.multiplier}。为什么改变倍数比增加相同数量会产生不同结果？`,challenge:'比较λ大于1、等于1和小于1的结果，再用逐期表解释差别。',sceneTip:m.conclusion,generationStages:stages('核对初态、倍数与等长期数','逐期计算模型数量','绘制整数期计算点')}}});
})();
