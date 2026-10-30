/* Deterministic mathematics demonstrations; no executable AI output.
   Pythagoras uses integer hundredths of cm; only the approved geometry module is registered. */
(() => {
  'use strict';
  const kit = window.MasterLabTemplateKit;
  if (!kit) return;
  const { fact, miss, stages } = kit.helpers;
  const num = n => String(Number(n.toFixed(6))).replace(/-/g, '−');
  const clean = s => s.replace(/[\s，,。；;：:、]/g, '');
  const asksFor = (source, allowed) => {
    const keys = new Set(); let bad = false;
    const clauses = source.replace(/[,，]\s*(?=求出|求|计算|验证|说明)/g, '；');
    const rest = clauses.replace(/(?:求出|求|计算|验证|说明)\s*[:：]?\s*([^。;；:：!?！？]+)/g, (_, text) => {
      const parts = text.split(/以及|[、,，和与及]/).map(s => s.trim()).filter(Boolean);
      if (!parts.length) bad = true;
      for (const part of parts) {
        const key = Object.keys(allowed).find(k => allowed[k].test(part));
        if (key) keys.add(key); else bad = true;
      }
      return ' ';
    });
    return { ok: !bad && keys.size > 0, rest, asks: [...keys].sort().join(',') };
  };
  const pythAsks = {
    hypotenuse: /^(?:斜边\s*c?|斜边\s*c?长|斜边\s*c?的?长度|斜边\s*c?的长)$/i,
    areas: /^(?:三个|三条)(?:边上|边上的)正方形的?面积$/,
    areaA: /^(?:直角边\s*a|a边|BC边)(?:上|上的)正方形的?面积$/i,
    areaB: /^(?:直角边\s*b|b边|AC边)(?:上|上的)正方形的?面积$/i,
    areaC: /^(?:斜边\s*c?|c边|AB边)(?:上|上的)正方形的?面积$/i,
    proof: /^(?:勾股(?:定理|关系)|面积关系|拼图证明)$/
  };
  const cmHundredths = value => Number.isFinite(value) && value >= 1 && value <= 12 && Math.round(value*100)/100 === value;
  function lengthCm(raw, unit) {
    const precision = /^(mm|毫米)$/i.test(unit) ? 1 : /^(m|米)$/i.test(unit) ? 4 : 2;
    const decimals = raw.split('.')[1]?.length || 0;
    if (decimals > precision || raw.length > 10) return NaN;
    const cents = Number(raw.replace('.', '')) * 10**(precision-decimals);
    return Number.isSafeInteger(cents) ? cents/100 : NaN;
  }
  function parsePyth(source) {
    let a, b, duplicate = false;
    const right = /直角三角形|∠\s*C\s*(?:=|为|是)\s*90\s*(?:°|度)/i.test(source);
    let rest = source.replace(/两条直角边(?:的长度)?(?:分别)?(?:为|是|=)\s*([+-]?\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米|m|米)\s*(?:和|与|、|,)\s*([+-]?\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米|m|米)/gi, (_, x, ux, y, uy) => {
      if (a !== undefined || b !== undefined) duplicate = true;
      a = lengthCm(x, ux); b = lengthCm(y, uy); return ' ';
    });
    for (const [label, pattern] of [
      ['a', /(?:直角边\s*a(?:\s*=\s*(?:BC|CB))?|(?:a\s*=\s*)?(?:BC|CB))\s*(?:的长度)?\s*(?:为|是|=)\s*([+-]?\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米|m|米)/gi],
      ['b', /(?:直角边\s*b(?:\s*=\s*(?:AC|CA))?|(?:b\s*=\s*)?(?:AC|CA))\s*(?:的长度)?\s*(?:为|是|=)\s*([+-]?\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米|m|米)/gi]
    ]) rest = rest.replace(pattern, (_, value, unit) => {
      if ((label === 'a' ? a : b) !== undefined) duplicate = true;
      if (label === 'a') a = lengthCm(value, unit); else b = lengthCm(value, unit);
      return ' ';
    });
    let rightCount=0;
    rest=rest.replace(/∠\s*C\s*(?:=|为|是)\s*90\s*(?:°|度)/gi,()=>{if(++rightCount>1)duplicate=true;return ' ';});
    const ask = asksFor(rest, pythAsks);
    const unknown = clean(ask.rest.replace(/直角三角形\s*ABC|三角形\s*ABC|△\s*ABC|直角三角形|已知|一个|在|中|的|请/gi, ''));
    if (!right || duplicate || !cmHundredths(a) || !cmHundredths(b) || !ask.ok || unknown) return miss('需明确直角及两条直角边，各1–12cm、最多两位小数；支持cm、mm、m的精确换算。仅求斜边、边上正方形面积或说明面积关系；不支持反推、三角形面积/周长及额外条件。');
    return { ok: true, p1: a, p2: b, fixed: { asks: ask.asks } };
  }
  const fixedProblem = (f, p1, p2) => {
    const allowed = pythAsks;
    if (typeof f.asks !== 'string' || !f.asks || f.asks.split(',').some(k => !Object.hasOwn(allowed, k))) return '所问量模式无效。';
    if (!cmHundredths(p1) || !cmHundredths(p2)) return '参数超出范围或支持精度，不能舍入或夹取。';
    return '';
  };
  const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
  function rootLength(n) {
    const root=Math.floor(Math.sqrt(n));
    if (root*root===n) return {exact:num(root/100), finite:true};
    return rootLengthFactor(n);
  }
  function rootLengthFactor(n) {
    let value=n,outside=1,inside=1;
    for(let prime=2;prime*prime<=value;prime++){
      let count=0;while(value%prime===0){value/=prime;count++;}
      outside*=prime**Math.floor(count/2);if(count%2)inside*=prime;
    }
    inside*=value;
    const divisor=gcd(outside,100), top=outside/divisor,bottom=100/divisor;
    return {exact:`${top===1?'':top}√${inside}${bottom===1?'':`/${bottom}`}`,finite:false};
  }
  function pythModel(a, b, f = { asks: 'areas,hypotenuse,proof' }) {
    if (fixedProblem( f, a, b)) throw new RangeError('Invalid right-triangle configuration');
    const A=Math.round(a*100),B=Math.round(b*100),a2=A*A/10000,b2=B*B/10000,c2=(A*A+B*B)/10000,c=Math.sqrt(A*A+B*B)/100;
    const area=A*B/20000,perimeter=a+b+c,root=rootLength(A*A+B*B),cExact=root.exact,cText=root.finite?cExact:`${cExact} ≈ ${num(c)}`;
    const answers = { hypotenuse: `斜边 c = ${cText} cm`, areas:`三个正方形面积：a²=${num(a2)}、b²=${num(b2)}、c²=${num(c2)} cm²`,areaA:`a边上正方形面积=${num(a2)} cm²`,areaB:`b边上正方形面积=${num(b2)} cm²`,areaC:`c边上正方形面积=${num(c2)} cm²`, proof: '同一大正方形减去相同四片全等三角形，两种无重叠终态的剩余面积相等，故a²+b²=c²' };
    const conclusion = f.asks.split(',').map(k => answers[k]).join('；')+'。';
    return { a, b, c, a2,b2,c2,area,perimeter,cExact,cText,asks:f.asks,puzzle:true,metrics:[a,b,c],metricUnit:'cm',facts:[fact('斜边 c',`${cText} cm`),fact('a² 与 b²',`${num(a2)} 和 ${num(b2)} cm²`),fact('c²',`${num(c2)} cm²`)],conclusion,
      formula:'a² + b² = c²',formulaDetail:`证明：同形同面积四片相减，c²=a²+b²。应用：c²=${num(c2)} cm²，c=${cText} cm`,readout:`斜边 ${cText} cm`,badge:'两种无重叠终态 · 全等割补' };
  }
  const shell = (kind, title, body, note) => `<section class="math-lab-scene math-${kind}" aria-label="${title}"><div class="math-scene-heading"><strong>${title}</strong><span data-math-phase>观察条件</span></div>${body}<p class="math-model-note">${note}</p><p class="math-progress" aria-live="off" data-math-progress>推导进度 0%</p></section>`;
  // All vertices use only the two given legs. No computed hypotenuse is used to
  // construct the proof. Every moving piece is a translation of one rigid copy.
  function puzzleGeometry(a,b,progress=0) {
    const L=a+b,p=Math.max(0,Math.min(1,progress));
    const canonical=[[0,0],[a,0],[0,b]],origins=[[0,0],[L,0],[L,L],[0,L]],destinations=[[0,a],[L,0],[a,L],[a,a]];
    const rotations=[0,90,180,270],cos=[1,0,-1,0],sin=[0,1,0,-1];
    const pieces=origins.map(([x,y],i)=>{
      const tx=x+(destinations[i][0]-x)*p,ty=y+(destinations[i][1]-y)*p;
      return {x:tx,y:ty,rotation:rotations[i],vertices:canonical.map(([u,v])=>[tx+cos[i]*u-sin[i]*v,ty+sin[i]*u+cos[i]*v])};
    });
    return {L,canonical,pieces,center:[[a,0],[L,a],[b,L],[0,b]],squares:[[[0,0],[a,0],[a,a],[0,a]],[[a,a],[L,a],[L,L],[a,L]]]};
  }
  function puzzleBoard(m,kind) {
    const geo=puzzleGeometry(m.a,m.b),scale=260/geo.L,pt=([x,y])=>`${num(50+x*scale)},${num(50+y*scale)}`;
    return `<svg class="math-puzzle-board" data-puzzle-board="${kind}" viewBox="0 0 360 345" role="img" aria-label="${kind==='reference'?'拼法一：四片围出斜边正方形':'平移四个全等三角形：终态二留下a和b两个正方形'}"><text x="180" y="21" text-anchor="middle">大正方形边长 a + b</text><rect x="50" y="50" width="260" height="260" class="math-outline"/><polygon points="${geo.center.map(pt).join(' ')}" class="math-hypotenuse-square" data-puzzle-center/>${geo.squares.map((points,i)=>`<polygon points="${points.map(pt).join(' ')}" class="math-leg-square math-leg-square-${i}" data-puzzle-remainder="${i}" visibility="hidden"/>`).join('')}${geo.pieces.map((piece,i)=>`<g data-puzzle-piece="${i}" transform="translate(${50+piece.x*scale} ${50+piece.y*scale}) rotate(${piece.rotation})"><polygon points="0,0 ${m.a*scale},0 0,${m.b*scale}" class="math-proof-triangle math-piece-${i}"/></g>`).join('')}${kind==='reference'?`<text x="40" y="41" text-anchor="end">C</text><text x="${55+m.a*scale}" y="41">B</text><text x="40" y="${57+m.b*scale}" text-anchor="end">A</text>`:''}<text x="180" y="337" text-anchor="middle">四片总面积 = ${num(4*m.area)} cm²</text></svg>`;
  }
  function pythVisual(m) {
    return shell('pyth','勾股定理 · 两种面积拼法',`<p class="math-vertex-key">每片均有 ∠C = 90°；a = BC = ${num(m.a)} cm，b = AC = ${num(m.b)} cm，c = AB。</p><div class="math-puzzle-panels"><figure><figcaption>拼法Ⅰ · 无重叠终态参照</figcaption>${puzzleBoard(m,'reference')}<p>剩余 <strong>c²</strong>：四条边都是斜边c；相邻两锐角互余，所以四个内角均为90°。</p></figure><figure><figcaption data-puzzle-caption>搬移示意 · 播放至终态Ⅱ</figcaption>${puzzleBoard(m,'moving')}<p data-puzzle-description>拖动上方进度至100%，比较留下的两个正方形。</p></figure></div><p class="math-puzzle-status" data-puzzle-status>四片仅作刚性平移；证明只比较两种无重叠终态。</p><div class="math-live-equation"><strong>先证明：</strong>同一大正方形，减去同样四片 → c² = a² + b²。<br><strong>再应用：</strong>a² = ${num(m.a2)}、b² = ${num(m.b2)}、c² = ${num(m.c2)} cm²；c = ${m.cText} cm。</div>`, '依据人教版八下17.1的全等割补与面积相等思想，采用另一种面积推导；不是复刻教材赵爽图17.1-6。搬移中允许暂时覆盖，不将覆盖状态用于面积证明。');
  }
  function renderFrame(root, model, progress, {reducedMotion=false}={}) {
    const scene=root.querySelector('.math-lab-scene'); if(!scene) return;
    const p=Math.max(0,Math.min(1,progress)), step=Math.min(3,Math.floor(p*4));
    scene.dataset.step=String(step);
    scene.querySelector('[data-math-phase]').textContent=['观察条件','构造与搬移','等量关系','核对结果'][step];
    scene.querySelector('[data-math-progress]').textContent=`推导进度 ${Math.round(p*100)}% · ${reducedMotion?'减少动态效果':'步骤示意'}`;
    if(model.puzzle){
      const t=p<=.15?0:p>=.85?1:(p-.15)/.7,geo=puzzleGeometry(model.a,model.b,t),scale=260/geo.L,board=scene.querySelector('[data-puzzle-board="moving"]');
      geo.pieces.forEach((piece,i)=>board.querySelector(`[data-puzzle-piece="${i}"]`).setAttribute('transform',`translate(${50+piece.x*scale} ${50+piece.y*scale}) rotate(${piece.rotation})`));
      board.querySelector('[data-puzzle-center]').setAttribute('visibility',t===0?'visible':'hidden');
      board.querySelectorAll('[data-puzzle-remainder]').forEach(e=>e.setAttribute('visibility',t===1?'visible':'hidden'));
      board.dataset.terminal=String(t===0||t===1);board.dataset.position=String(t);
      scene.querySelector('[data-puzzle-caption]').textContent=t===1?'拼法Ⅱ · 无重叠终态':t===0?'搬移示意 · 从拼法Ⅰ出发':'搬移中 · 不作面积证明';
      scene.querySelector('[data-puzzle-description]').textContent=t===1?'两矩形各由两片铺满，留下a×a和b×b两个正方形。':'四片的直角边、斜边与面积始终不变；终态只由a、b构造。';
      scene.querySelector('[data-puzzle-status]').textContent=t===1?'两种终态无重叠、无缺口：相同大正方形减去相同四片，剩余面积相等。':t===0?'四片仅作刚性平移；播放或拖动进度至100%，比较两种终态。':'搬移中可能暂时覆盖；此时隐藏剩余面积，不用中间覆盖状态证明等式。';
    }
  }
  const pyth={id:'pythagoras',subject:'数学',level:'junior',menuTitle:'勾股定理面积拼图',menuMeta:'两种拼法 · 刚性搬移 · 面积证明',stage:'初中',block:'几何',title:'勾股定理：两种拼法的面积证明',defaults:[3,4],keywords:/直角三角形|勾股|∠\s*C\s*(?:=|为|是)\s*90/,
    params:[{label:'直角边 a = BC',desc:'1–12cm，最多两位小数；∠C=90°',unit:'cm',min:1,max:12,step:.01,value:3},{label:'直角边 b = AC',desc:'1–12cm，最多两位小数；c=AB为斜边',unit:'cm',min:1,max:12,step:.01,value:4}],
    strict:{sameConditions:true,intent:{require:[/直角三角形|勾股|∠\s*C\s*(?:=|为|是)\s*90/]},fixedDefaults:{asks:'areas,hypotenuse,proof'},caps:[[1,12],[1,12]],values:parsePyth,used:(a,b)=>[{cls:'length',value:a/100},{cls:'length',value:b/100},{cls:'angle',value:90}],checkFixed:(f,a,b)=>fixedProblem(f,a,b),asks:{supported:/斜边|面积|勾股|拼图/,unsupported:/周长|角度|体积|概率|反推|质量/}},
    question:(a,b,f={asks:'areas,hypotenuse,proof'})=>`直角三角形ABC中，∠C=90°，直角边a=BC=${a}cm，直角边b=AC=${b}cm，${f.asks.split(',').map(k=>({hypotenuse:'求斜边c的长度',areas:'求三个边上正方形的面积',areaA:'求直角边a上正方形的面积',areaB:'求直角边b上正方形的面积',areaC:'求斜边c上正方形的面积',proof:'说明面积关系'}[k])).join('；')}。`,model:pythModel,visual:pythVisual,geometryAt:puzzleGeometry,recognition:m=>`${num(m.a)}cm、${num(m.b)}cm两直角边｜${m.readout}`,formatMetric:num,resetToQuestion:true,motion:{duration:10},renderFrame,
    presetFor:()=>({p1:3,p2:4,fixed:{asks:'areas,hypotenuse,proof'}}),
    copy:m=>({steps:[['明确直角与边的角色',`∠C=90°；a=BC=${num(m.a)}cm，b=AC=${num(m.b)}cm，c=AB。`,'题目必须给两条直角边；不把一般三角形或斜边当直角边。'],['先核对全等与两种分割','拼法Ⅰ中央四边形四边都是c，相邻锐角互余给每个直角；拼法Ⅱ两矩形各由两片铺满，留下a、b两个正方形。','终态无重叠无缺口；移动中可能暂时覆盖，不参与证明。'],['由面积相等得定理','两个大正方形边长同为a+b，减去同样四个全等三角形，故c²=a²+b²。','只依赖全等与分割，没有先用开方计算c来证明。'],['再应用结论回答',m.conclusion,'长度cm、面积cm²；根式或有限小数是精确值，≈后的六位小数仅为近似。']],hint:'先证明两个终态分割成立，再从相同总面积减去相同四片。',mentor:'为什么中央四边形四条边相等且每个角为直角？移动中重叠时能用作面积证明吗？',challenge:'交换a、b，或合法同比放大，比较长度与正方形面积。',sceneTip:m.conclusion,generationStages:stages('核对直角及两条直角边','构造两种无重叠终态','先证明再开方计算')})};
  kit.register({pythagoras:pyth});
})();
