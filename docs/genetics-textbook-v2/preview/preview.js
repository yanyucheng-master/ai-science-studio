/* Review-only, two textbook redraws. No product routing, storage, AI or share APIs. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  const gene = text => `<span class="gp-gene">${text}</span>`;
  const XB = 'X<sup>B</sup>', Xb = 'X<sup>b</sup>';
  const state = { case: 'color', step: 0, selected: null, extension: null };
  const colorPeople = [
    ['I-1',365,42,'m',true,'Ⅱ–2、Ⅱ–3、Ⅱ–5 的父亲','XᵇY'],
    ['I-2',431,42,'f',false,'Ⅱ–2、Ⅱ–3、Ⅱ–5 的母亲','XᴮXᴮ 或 XᴮXᵇ'],
    ['II-1',119,134,'f',false,'Ⅱ–2 的配偶，Ⅲ–1 至 Ⅲ–4 的母亲','XᴮXᴮ 或 XᴮXᵇ'],
    ['II-2',185,134,'m',false,'Ⅰ–1 的儿子，Ⅲ–1 至 Ⅲ–4 的父亲','XᴮY'],
    ['II-3',338,134,'f',false,'Ⅰ–1 的女儿，Ⅲ–5、Ⅲ–6 的母亲','XᴮXᵇ'],
    ['II-4',404,134,'m',false,'Ⅱ–3 的配偶，Ⅲ–5、Ⅲ–6 的父亲','XᴮY'],
    ['II-5',625,134,'f',false,'Ⅰ–1 的女儿，Ⅲ–7 至 Ⅲ–12 的母亲','XᴮXᵇ'],
    ['II-6',691,134,'m',false,'Ⅱ–5 的配偶，Ⅲ–7 至 Ⅲ–12 的父亲','XᴮY'],
    ['III-1',70,236,'f',false,'Ⅱ–1 与 Ⅱ–2 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-2',124,236,'m',false,'Ⅱ–1 与 Ⅱ–2 的儿子','XᴮY'],
    ['III-3',178,236,'f',false,'Ⅱ–1 与 Ⅱ–2 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-4',232,236,'f',false,'Ⅱ–1 与 Ⅱ–2 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-5',340,236,'m',false,'Ⅱ–3 与 Ⅱ–4 的儿子，Ⅲ–6 的哥哥或弟弟','XᴮY'],
    ['III-6',394,236,'m',true,'Ⅱ–3 与 Ⅱ–4 的儿子','XᵇY'],
    ['III-7',520,236,'m',true,'Ⅱ–5 与 Ⅱ–6 的儿子','XᵇY'],
    ['III-8',574,236,'m',false,'Ⅱ–5 与 Ⅱ–6 的儿子','XᴮY'],
    ['III-9',628,236,'f',false,'Ⅱ–5 与 Ⅱ–6 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-10',682,236,'f',false,'Ⅱ–5 与 Ⅱ–6 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-11',736,236,'f',false,'Ⅱ–5 与 Ⅱ–6 的女儿','XᴮXᴮ 或 XᴮXᵇ'],
    ['III-12',790,236,'m',true,'Ⅱ–5 与 Ⅱ–6 的儿子','XᵇY'],
  ];
  const combinedPeople = [
    ['I-1',100,53,'m',false,'Ⅱ–1 的父亲，表型正常','Aa XᴮY'],
    ['I-2',236,53,'f',false,'Ⅱ–1 的母亲，表型正常','Aa XᴮXᵇ'],
    ['II-1',168,184,'m',true,'Ⅰ–1 与 Ⅰ–2 的儿子，两病均患','aa XᵇY'],
  ];
  const displayId = id => id.replace('III-', 'Ⅲ–').replace('II-', 'Ⅱ–').replace('I-', 'Ⅰ–');
  const cases = {
    color: {
      title: 'Ⅱ–3 为什么是携带者？Ⅲ–6 的 b 来自哪里？',
      detail: '读教材中的三代红绿色盲家系，沿着 Ⅰ–1 → Ⅱ–3 → Ⅲ–6 找到传递路径。',
      full: '按 p35 原图关系重绘。先在 X / Y 连锁的讨论范围内判断基因的位置与显隐性；再标出Ⅰ代1、2，Ⅱ代1—6，以及Ⅲ代5、6、7、9共12名成员的可能基因型。当前主问聚焦其中一条传递路径，不改变原家系。',
      heading: '同一家系，三代关系',
      source: '据人教版必修2 p35「分析人类红绿色盲」重绘 · 20名成员、亲缘关系与原图一致',
      people: colorPeople,
      legend: '<span><i class="gp-symbol"></i>男性</span><span><i class="gp-symbol female"></i>女性</span><span><i class="gp-symbol affected"></i>红绿色盲</span><span>空心：色觉正常</span>',
      steps: [
        `<h3>先找父母，再找子代</h3><p>Ⅰ–1 是Ⅱ–3的父亲；Ⅱ–3与Ⅱ–4生育了Ⅲ–5、Ⅲ–6。横线连接配偶，同胞线下接各个子代。</p><div class="gp-keyline">点选Ⅱ–3和Ⅲ–6，对照同一条母子关系。</div><p>小家系里男性患者较多只是线索，不能单凭人数判定遗传方式。</p>`,
        `<h3>正常女儿，也可能携带 b</h3><p>患病父亲Ⅰ–1的 ${gene(`${Xb}Y`)} 中，X传给女儿，Y传给儿子。Ⅱ–3一定得到父亲的${gene(Xb)}；她色觉正常，所以另一条X带B。</p><div class="gp-keyline">Ⅱ–3：${gene(`${XB}${Xb}`)}，色觉正常的携带者。</div><p>在教材先比较X / Y连锁的语境下，Ⅰ–1有正常儿子，排除Y连锁；他的正常女儿不符合完全外显的伴X显性。此图本身不能排除所有常染色体解释。</p>`,
        `<h3>儿子的 X 来自母亲</h3><p>Ⅱ–3可形成两类卵细胞，Ⅱ–4可形成两类精子。</p><p>母方（各1/2）</p><div class="gp-gametes"><span>${XB}</span><span>${Xb}</span></div><p>父方（各1/2）</p><div class="gp-gametes"><span>${XB}</span><span>Y</span></div><p>Ⅲ–6从父亲获得Y，从母亲获得${gene(Xb)}；不能把父亲的Y画成携带b的X。</p>`,
        `<h3>b 的路径：外祖父 → 母亲 → 儿子</h3><p>Ⅰ–1的${gene(Xb)}传给Ⅱ–3；Ⅱ–3再把它传给Ⅲ–6。Ⅲ–6是${gene(`${Xb}Y`)}，Ⅱ–3是${gene(`${XB}${Xb}`)}。</p><p>Ⅰ–2、Ⅱ–1、Ⅲ–9虽正常，仍有两种可能，不能默认不携带。</p><details><summary>查看原问12名成员的基因型</summary><table><tbody><tr><th>Ⅰ–1</th><td>XᵇY</td></tr><tr><th>Ⅰ–2、Ⅱ–1</th><td>XᴮXᴮ 或 XᴮXᵇ</td></tr><tr><th>Ⅱ–2、Ⅱ–4、Ⅱ–6、Ⅲ–5</th><td>XᴮY</td></tr><tr><th>Ⅱ–3、Ⅱ–5</th><td>XᴮXᵇ</td></tr><tr><th>Ⅲ–6、Ⅲ–7</th><td>XᵇY</td></tr><tr><th>Ⅲ–9</th><td>XᴮXᴮ 或 XᴮXᵇ</td></tr></tbody></table></details>`,
      ],
      extensions: [
        ['son', '已知是男孩，患红绿色盲？', '给定Ⅱ–3 XᴮXᵇ × Ⅱ–4 XᴮY，在男孩中仅比较来自母亲的两类X：', '1/2'],
        ['boy', '生一个红绿色盲男孩？', '同一对亲本，男女机会各1/2：1/2（男孩）× 1/2（得到Xᵇ）＝', '1/4'],
      ],
    },
    combined: {
      title: '双亲都正常，为什么孩子会同时患两种病？',
      detail: '一对表型正常的夫妇，生了一个既患白化病又患红绿色盲的男孩。推双亲基因型；列出两病均不患的子代基因型。',
      full: '按 p38「拓展应用」第1题条件与所问简写、配项目图形。白化病为常染色体隐性，正常A对白化a为显性；红绿色盲用Xᴮ / Xᵇ表示。原题没有系谱图；此处把文字条件画成两代三人图，不增加其他子代。概率选项另标为题后变式。',
      heading: '由文字条件画出家系',
      source: '据人教版必修2 p38 拓展应用1配图 · 编号为本项目所加，未增补题给子代',
      people: combinedPeople,
      legend: '<span><i class="gp-symbol"></i>男性</span><span><i class="gp-symbol female"></i>女性</span><span><i class="gp-symbol albino"></i>白化病</span><span><i class="gp-symbol colorblind"></i>红绿色盲</span>',
      steps: [
        `<h3>先把两种病分开看</h3><p>Ⅰ–1、Ⅰ–2均表型正常；Ⅱ–1为男孩，斜纹表示白化病，实点表示红绿色盲。</p><div class="gp-keyline">Aa / aa 记白化病位点；Xᴮ / Xᵇ记色觉位点。两套符号不能混写。</div><p>图里只有题给的一个孩子，没有假设其他孩子的表型。</p>`,
        `<h3>从患病儿子推回双亲</h3><p>儿子是${gene(`aa ${Xb}Y`)}。两个a分别来自双亲，而双亲都不患白化病，所以两人均为Aa。</p><p>儿子的Xᵇ来自母亲。母亲正常，故为${gene(`${XB}${Xb}`)}；父亲正常，为${gene(`${XB}Y`)}。</p><div class="gp-keyline">母：${gene(`Aa ${XB}${Xb}`)}<br>父：${gene(`Aa ${XB}Y`)}</div>`,
        `<h3>独立分离后，各有四类配子</h3><p>母方（各1/4）</p><div class="gp-gametes"><span>A${XB}</span><span>A${Xb}</span><span>a${XB}</span><span>a${Xb}</span></div><p>父方（各1/4）</p><div class="gp-gametes"><span>A${XB}</span><span>AY</span><span>a${XB}</span><span>aY</span></div><p>4×4共有16个等可能配子组合；合并相同基因型后，基因型本身不一定等概率。</p>`,
        `<h3>两病均不患：六种可能</h3><p>白化病位点须为AA或Aa；女孩色觉须为XᴮXᴮ或XᴮXᵇ，男孩须为XᴮY。</p><table><thead><tr><th>女孩</th><th>男孩</th></tr></thead><tbody><tr><td>AA XᴮXᴮ</td><td>AA XᴮY</td></tr><tr><td>Aa XᴮXᴮ</td><td>Aa XᴮY</td></tr><tr><td>AA XᴮXᵇ</td><td></td></tr><tr><td>Aa XᴮXᵇ</td><td></td></tr></tbody></table><p>这是“可能基因型”的答案。下方变式再问概率，不能将六种直接当成等概率。</p>`,
      ],
      extensions: [
        ['neither','两病均不患','(3/4) × (3/4) ＝','9/16'],
        ['albino','只患白化病','(1/4) × (3/4) ＝','3/16'],
        ['colorblind','只患红绿色盲','(3/4) × (1/4) ＝','3/16'],
        ['both','两病均患','(1/4) × (1/4) ＝','1/16'],
        ['boy-both','已知男孩时两病均患','给定是男孩，(1/4) × (1/2) ＝','1/8'],
      ],
    },
  };
  function element(name, attrs = {}, text) {
    const e = document.createElementNS(svgNS, name);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, String(v)));
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function path(d, className = 'gp-link') { return element('path', { d, class: className }); }
  function drawGraph() {
    const svg = $('family-svg'), c = cases[state.case];
    svg.replaceChildren();
    svg.setAttribute('viewBox', state.case === 'color' ? '0 0 860 310' : '0 0 340 256');
    svg.setAttribute('class', state.case);
    if (state.case === 'color') {
      [42,134,236].forEach((y,i) => svg.append(element('text',{x:18,y:y+5,'font-size':15},['Ⅰ','Ⅱ','Ⅲ'][i])));
      const links = ['M365 42H431','M398 42V88H185V134','M398 88H625V134','M338 88V134',
        'M119 134H185','M338 134H404','M625 134H691',
        'M152 134V181H70V236','M152 181H232V236','M124 181V236','M178 181V236',
        'M371 134V181H340V236','M371 181H394V236',
        'M658 134V181H520V236','M658 181H790V236',... [574,628,682,736].map(x=>`M${x} 181V236`)];
      links.forEach(d=>svg.append(path(d)));
      if(state.step >= 1) svg.append(path('M365 42H398V88H338V134H371V181H394V236','gp-path'));
    } else {
      const defs = element('defs');
      const pattern = element('pattern',{id:'albino-pattern',patternUnits:'userSpaceOnUse',width:6,height:6,patternTransform:'rotate(35)'});
      pattern.append(element('rect',{width:6,height:6,fill:'#fff',stroke:'none'}),element('path',{d:'M0 0V6',stroke:'#899dbb','stroke-width':2}));
      defs.append(pattern); svg.append(defs);
      svg.append(element('text',{x:12,y:58,'font-size':15},'Ⅰ'),element('text',{x:12,y:189,'font-size':15},'Ⅱ'));
      svg.append(path('M100 53H236'),path('M168 53V184'));
    }
    c.people.forEach(p => {
      const [id,x,y,sex,affected] = p;
      const g = element('g',{class:'gp-person',role:'button',tabindex:0,'data-person':id,'aria-pressed':id===state.selected,'aria-label':`${displayId(id)}，${sex==='f'?'女性':'男性'}，${state.case==='combined'&&affected?'白化病与红绿色盲均患':affected?'红绿色盲':'表型正常'}${state.step>=1?'，'+p[6]:''}`});
      g.append(element('rect',{class:'gp-hit',x:x-24,y:y-24,width:48,height:48}));
      g.append(element('rect',{class:'gp-halo',x:x-21,y:y-21,width:42,height:42,rx:sex==='f'?21:5}));
      const attrs={class:'gp-glyph'+(affected&&state.case==='color'?' affected':'')};
      const shape = sex==='f'?element('circle',{...attrs,cx:x,cy:y,r:15}):element('rect',{...attrs,x:x-15,y:y-15,width:30,height:30});
      if(state.case==='combined'&&affected) shape.setAttribute('style','fill:url(#albino-pattern)');
      g.append(shape);
      if(state.case==='combined'&&affected) g.append(element('circle',{cx:x,cy:y,r:4.5,fill:'#223c62',stroke:'none','pointer-events':'none'}));
      if(state.step>=1) {
        const mark = state.case==='color'&&['II-3','II-5'].includes(id)?'携':state.case==='combined'&&id==='I-1'?'携a':state.case==='combined'&&id==='I-2'?'携a,b':null;
        if(mark) g.append(element('text',{class:'gp-carrier',x:x+19,y:y-20,'pointer-events':'none'},mark));
      }
      g.append(element('text',{class:'gp-id',x,y:y+41,'pointer-events':'none'},displayId(id)));
      g.addEventListener('click',()=>selectPerson(id));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPerson(id);}});
      svg.append(g);
    });
  }
  function selectPerson(id) {
    state.selected=id;
    document.querySelectorAll('[data-person]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.person===id));
    updateInfo();
  }
  function updateInfo() {
    const p=cases[state.case].people.find(p=>p[0]===state.selected);
    $('member-info').textContent = p ? `${displayId(p[0])} · ${p[5]}${state.step>=1?' · '+p[6]:''}` : '点选一名成员，查看亲缘关系。';
  }
  function renderStep() {
    const oldScroll=$('graph-viewport').scrollLeft;
    $('legend').innerHTML=cases[state.case].legend+(state.step>=1?`<span>${state.case==='color'?'携：由亲缘推定的正常携带者':'携a / b：由子代推定的携带标记'}</span>`:'');
    $('step-count').textContent=`${state.step+1} / 4`;
    document.querySelectorAll('[data-step]').forEach(b=>{if(Number(b.dataset.step)===state.step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    $('step-content').innerHTML=cases[state.case].steps[state.step].replace(/[ⅠⅡⅢ]–\d+/g,id=>`<span class="gp-person-ref">${id}</span>`); // constant authored content only
    $('previous').disabled=state.step===0;
    $('next').disabled=state.step===3;
    drawGraph(); $('graph-viewport').scrollLeft=oldScroll; updateInfo();
  }
  function renderCase() {
    const c=cases[state.case];
    document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.case===state.case));
    $('question-title').textContent=c.title; $('question-detail').textContent=c.detail; $('question-full').textContent=c.full;
    $('family-title').textContent=c.heading; $('graph-source').textContent=c.source;
    $('legend').innerHTML=c.legend;
    $('pan-hint').hidden=state.case!=='color';
    $('original-question').open=false;
    $('extension-options').replaceChildren();
    c.extensions.forEach(([key,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.extension=key;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>{
        state.extension=key;
        document.querySelectorAll('[data-extension]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.extension===key));
        const item=c.extensions.find(e=>e[0]===key);
        $('extension-result').replaceChildren(document.createTextNode(item[2]));
        const value=document.createElement('strong');value.textContent=item[3];$('extension-result').append(value);
        $('extension-result').append(document.createTextNode('。这是模型概率，不是家庭实际生育次数或观察频率。'));
      });
      $('extension-options').append(b);
    });
    $('extension-result').textContent='选择一个明确的变式问题再计算；原问答案与变式分开。';
    renderStep();
    const viewport=$('graph-viewport'); viewport.scrollLeft=state.case==='color'&&viewport.clientWidth<700?245:0;
  }
  document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>{state.case=b.dataset.case;state.step=0;state.selected=null;state.extension=null;renderCase();}));
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{state.step=Number(b.dataset.step);renderStep();}));
  $('previous').addEventListener('click',()=>{if(state.step>0){state.step--;renderStep();}});
  $('next').addEventListener('click',()=>{if(state.step<3){state.step++;renderStep();}});
  $('reset').addEventListener('click',()=>{state.step=0;state.selected=null;state.extension=null;renderCase();});
  renderCase();
})();
