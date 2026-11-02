(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit,C=window.MasterLabMicroscope,Q=window.MasterLabMicroscopeQuestions;
  if(!kit||!C||!Q)return;
  const {fact,stages}=kit.helpers;
  const number=n=>String(Number(n.toPrecision(10)));
  const titles={magnification:'总放大倍数',field:'换物镜比较视野',direction:'倒像与移片方向'};
  const base={version:1,level:'junior',levelLocked:false};
  const defaults={...base,...C.COMPARISON_CONDITIONS,mode:'field',eyepiece:10,initialObjective:10,asks:'area,count,diameter'};
  const ranges=(i,f)=>f.mode==='direction'?[-5,5]:f.mode==='magnification'?[1,i?100:40]:i?[0,2000]:[1,100];
  function presetFor(level,mode='field'){
    if(mode==='magnification')return {p1:10,p2:40,fixed:{...base,level,mode,noAdditionalOptics:true,asks:'magnification'}};
    if(mode==='direction')return {p1:2,p2:1,fixed:{...base,level,mode,invertedImage:true,positiveAxes:true,asks:'direction'}};
    return {p1:40,p2:200,fixed:{...defaults,level}};
  }
  function fraction(a,b,power=1){
    let x=Math.round(a*100)**power,y=Math.round(b*100)**power;
    const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(x,y);x/=g;y/=g;
    return y===1?String(x):`${x} / ${y}`;
  }
  function parameter(param,index,f){
    const [min,max]=ranges(index,f),common={...param,min,max};
    if(f.mode==='direction')return {...common,label:index?'玻片竖直移位':'玻片水平移位',desc:index?'正值向上，负值向下；示意格':'正值向右，负值向左；示意格',unit:'格',step:1};
    if(f.mode==='magnification')return {...common,label:index?'物镜倍数':'目镜倍数',desc:'只计算两镜乘积，无额外放大镜组',unit:'倍',step:.01};
    return {...common,label:index?'原视野细胞数':'新物镜倍数',desc:index?'0–2000整数；按面积估计新视野数量':'原物镜、目镜与视场数保持不变',unit:index?'个':'倍',step:index?1:.01};
  }
  function model(p1,p2,f=defaults){
    const error=Q.issue(f,p1,p2);if(error)throw new RangeError(error);
    const common={mode:f.mode,level:f.level,asks:f.asks,heading:titles[f.mode],metricUnit:'',badge:'显微镜 · 条件控制'};
    if(f.mode==='magnification'){
      const total=C.magnification(p1,p2),answer=`总放大倍数为 ${number(total)} 倍`;
      return {...common,eyepiece:p1,objective:p2,totalMagnification:total,metrics:[p1,p2,total],metricUnit:'倍',
        facts:[fact('总放大倍数',`${number(total)} 倍`),fact('目镜',`${p1} 倍`),fact('物镜',`${p2} 倍`)],
        formula:'总放大倍数 = 目镜倍数 × 物镜倍数',formulaDetail:`${p1} × ${p2} = ${number(total)}；题目明确没有额外放大镜组。`,
        conclusion:answer+'。',readout:answer,contextParameters:`当前目镜${p1}倍、物镜${p2}倍，无额外放大镜组。只求总倍数，不能据此推出视野细胞数。`};
    }
    if(f.mode==='direction'){
      const image=C.invertedImageOffset(p1,p2),answer=image.direction==='不移动'?'物像不移动':`物像向${image.direction}移动`;
      return {...common,horizontal:p1,vertical:p2,image,metrics:[p1,p2,0],facts:[fact('物像方向',image.direction),fact('玻片水平示意',`${p1} 格`),fact('玻片竖直示意',`${p2} 格`)],
        formula:'倒像中，物像移动方向与玻片移动方向相反',formulaDetail:`水平分量反向，竖直分量反向。${answer}；图上格数仅表示方向和相对位置，不代表实际移动距离。`,
        conclusion:answer+'。',readout:answer,contextParameters:`物像为倒像，向右/向上为正；玻片水平${p1}格、竖直${p2}格，均为无长度单位的示意坐标。只判断方向，不计算实际物像距离。`};
    }
    const m=C.compareObjectives({...f,targetObjective:p1,initialCount:p2});
    const diameterText=fraction(f.initialObjective,p1),areaText=fraction(f.initialObjective,p1,2);
    const answers={diameter:`新/原视野直径比 = ${diameterText}`,area:`新/原视野面积比 = ${areaText}`,count:`新视野细胞数 ≈ ${number(m.approximateCount)} 个`};
    return {...common,...m,diameterText,areaText,metrics:[p1,p2,m.approximateCount],metricUnit:'个',
      facts:[fact('近似细胞数',`≈ ${number(m.approximateCount)} 个`),fact('新/原直径比',diameterText),fact('新/原面积比',areaText)],
      formula:'新视野细胞数 ≈ 原细胞数 × (原物镜倍数 / 新物镜倍数)²',
      formulaDetail:`新/原直径比 = ${f.initialObjective} / ${p1} = ${diameterText}；面积比 = ${areaText}。由原视野 ${p2} 个估计，新视野约 ${number(m.approximateCount)} 个。`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',readout:`物镜 ${f.initialObjective} → ${p1} 倍 · 约 ${number(m.approximateCount)} 个`,
      contextParameters:`目镜${f.eyepiece}倍，原物镜${f.initialObjective}倍，新物镜${p1}倍，原视野${p2}个。目镜、视场数、中间倍率、样本不变且分布均匀。仅求相对比例和近似数量；中间倍率未知，不报告绝对总倍数。`};
  }
  function fieldFigure(label,radius,kind){return `<figure><svg class="microscope-diagram microscope-field" viewBox="0 0 240 220" role="img" aria-label="${label}，与另一视野按同一比例绘制"><defs><pattern id="microscope-grid-${kind}" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16"/></pattern></defs><circle class="microscope-field-fill" data-microscope-radius="${kind}" cx="120" cy="110" r="${radius}"/><circle class="microscope-grid" cx="120" cy="110" r="${radius}" fill="url(#microscope-grid-${kind})"/><path class="microscope-diameter" d="M${120-radius} 110H${120+radius}"/></svg><figcaption>${label}</figcaption></figure>`;}
  function directionFigure(label,x,y,invert){return `<figure><svg class="microscope-diagram microscope-direction" viewBox="0 0 240 220" role="img" aria-label="${label}，无实际长度单位"><path class="microscope-axis" d="M20 110H220M120 20V200"/><circle class="microscope-center" cx="120" cy="110" r="3"/><path class="microscope-vector" d="M120 110L${120+x*14} ${110-y*14}"/><g data-microscope-position="${invert?'image':'slide'}" data-x="${x}" data-y="${y}" transform="translate(${120+x*14} ${110-y*14})${invert?' rotate(180)':''}"><text x="0" y="0" dominant-baseline="central" text-anchor="middle">e</text></g></svg><figcaption>${label}</figcaption></figure>`;}
  function visual(m){
    let body;
    if(m.mode==='magnification')body=`<div class="microscope-product"><div><span>目镜</span><strong>${m.eyepiece} 倍</strong></div><b>×</b><div><span>物镜</span><strong>${m.objective} 倍</strong></div><b>=</b><div><span>总放大倍数</span><strong data-microscope-total>${number(m.totalMagnification)} 倍</strong></div></div><p>调节两个倍数，观察乘积。此模式未给出视场条件，因此不计算细胞数量。</p>`;
    else if(m.mode==='field'){
      const originalRadius=90/Math.max(1,m.diameterRatio),targetRadius=originalRadius*m.diameterRatio;
      body=`<p>目镜 ${m.eyepiece} 倍、原物镜 ${m.initialObjective} 倍固定。只更换物镜，比较同一样本上的可见范围。</p><div class="microscope-panels">${fieldFigure(`原视野 · 物镜 ${m.initialObjective} 倍`,originalRadius,'original')}${fieldFigure(`新视野 · 物镜 ${m.targetObjective} 倍`,targetRadius,'target')}</div><p class="microscope-note">两圆按同一比例绘制；网格只表示视野范围，不表示实际细胞。极端倍数比下，小圆会很小，可结合下方精确比例查看。</p><dl class="microscope-results"><div><dt>新/原直径比</dt><dd>${m.diameterText}</dd></div><div><dt>新/原面积比</dt><dd>${m.areaText}</dd></div><div><dt>新视野近似细胞数</dt><dd data-microscope-count>≈ ${number(m.approximateCount)} 个</dd></div></dl><p>这是均匀样本的面积估计，包含视野边缘的不完整细胞。非整数结果保留为近似量，不取整为精确计数。</p>`;
    }else body=`<div class="microscope-panels">${directionFigure('玻片上的物体',m.horizontal,m.vertical,false)}${directionFigure('显微镜中的倒像',m.image.x,m.image.y,true)}</div><p class="microscope-direction-result" data-microscope-direction>${m.conclusion}</p><div class="microscope-move-controls" aria-label="移动玻片"><button type="button" data-microscope-move="left">向左移</button><button type="button" data-microscope-move="right">向右移</button><button type="button" data-microscope-move="up">向上移</button><button type="button" data-microscope-move="down">向下移</button></div><p class="microscope-note">十字标记为原位置。这里只比较倒像和移动方向，示意刻度没有长度单位，不能读出实际移动距离。</p>`;
    return `<section class="biology-microscope-scene" data-mode="${m.mode}" aria-label="显微镜探究"><h3>${m.heading}</h3>${body}<details><summary>适用条件与教材依据</summary><p>${m.contextParameters}</p><p>人教七上2024体系正文第14–16页：显微镜操作与总倍数。Nikon MicroscopyU 的视野关系包含视场数、物镜和中间倍率；细胞数按面积估计是本实验的课堂近似。</p><p>常见教学显微镜在照明、光阑等条件保持不变时，高倍视野通常较暗；本实验只作定性说明，不计算亮度百分比。</p></details><nav class="microscope-examples" aria-label="打开另一种显微镜示例"><span>打开示例</span>${Object.entries(titles).filter(([k])=>k!==m.mode).map(([k,v])=>`<button type="button" data-microscope-example="${k}">${v}</button>`).join('')}</nav></section>`;
  }
  kit.register({microscope:{id:'microscope',subject:'生物',level:'both',block:'观察工具',stage:'显微镜',title:'显微镜：倍数、视野与倒像',menuTitle:'显微镜探究',menuMeta:'倍数 · 视野比例 · 倒像方向',defaults:[40,200],resetToQuestion:true,preserveExplicitGrade:true,formatMetric:number,keywords:/显微镜|目镜|物镜/,
    params:[{label:'新物镜倍数',desc:'原物镜不变',unit:'倍',min:1,max:100,step:.01,value:40},{label:'原视野细胞数',desc:'按面积估计',unit:'个',min:0,max:2000,step:1,value:200}],parameter,
    strict:{sameConditions:true,fixedDefaults:defaults,rangeFor:ranges,intent:{require:[/显微镜/]},values:(s,t,c)=>Q.parse(s,c),checkFixed:Q.issue,used:(a,b,f)=>(f.mode==='magnification'?[a,b]:f.mode==='field'?[f.eyepiece,f.initialObjective,a]:[]).map(value=>({cls:'times',value})),asks:{supported:/总放大倍数|视野|物像移动方向|^(?:光学显微镜|目镜|物镜|原物镜|新物镜|同一目镜|中间倍率|同一样本|无额外放大镜组|物像为倒像|设向右|向上为正|玻片水平移位|竖直移位)/,unsupported:/精确细胞数|实际距离|分辨率|亮度百分比/}},
    question:(a,b,f=defaults)=>Q.question(a,b,f),model,visual,presetFor,recognition:m=>m.readout,
    copy:m=>({steps:[['核对适用条件',m.contextParameters,'先确定模式和保持不变的条件。'],['建立关系',m.formula,'总倍数、视野比例和倒像方向分别讨论。'],['代入当前参数',m.formulaDetail,'原题可通过重置恢复。'],['解释结果',m.conclusion,m.mode==='field'?'近似数量可以是小数。':'根据关系说明参数变化。']],hint:m.mode==='field'?'先预测物镜倍数增加一倍时，直径和面积各怎样变化。':'调整参数，比较变化前后的结果。',mentor:m.mode==='field'?'物镜从10倍变为40倍，为什么细胞数量约变为原来的1/16，而不是1/4？':m.mode==='direction'?'视野中的物像偏左上时，应该向哪个方向移动玻片才能移到中央？':'目镜倍数增加时，总倍数怎样变化？仅凭总倍数能确定细胞数吗？',challenge:'先预测，再调整参数；用给定条件解释结果。',sceneTip:m.conclusion,generationStages:stages('核对显微镜条件','区分倍数、视野与倒像关系','计算并生成比较示意')})}});
})();
