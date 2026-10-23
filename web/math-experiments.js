/* Deterministic mathematics demonstrations. Two checked inputs, no executable AI output.
   Integer domains keep all squared areas and arithmetic sums exact. */
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
      // “项和” names the quantity; its final 和 is not a conjunction.
      const parts = text.replace(/(前\s*n\s*项)(?:的)?和/gi, '$1∑').split(/以及|[、,，和与及]/).map(s => s.trim().replace(/项∑/g, '项和')).filter(Boolean);
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
    hypotenuse: /^(?:斜边|斜边长|斜边的?长度|斜边的长)$/,
    area: /^(?:三角形的?)?面积$/,
    perimeter: /^(?:三角形的?)?周长$/,
    proof: /^(?:勾股(?:定理|关系)|面积关系|拼图证明)$/
  };
  const sumAsks = { term: /^第\s*n\s*项(?:的值)?$/i, sum: /^前\s*n\s*项(?:的)?和$/i, proof: /^(?:求和公式|首尾配对|配对关系)$/ };
  const integer = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  function parsePyth(source) {
    let a, b, duplicate = false;
    let rest = source.replace(/两条直角边(?:的长度)?(?:分别)?(?:为|是|=)\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)\s*(?:和|与|、|,)\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)/gi, (_, x, y) => {
      if (a !== undefined || b !== undefined) duplicate = true;
      a = Number(x); b = Number(y); return ' ';
    });
    rest = rest.replace(/直角边\s*([ab])\s*(?:的长度)?\s*(?:为|是|=)\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)/gi, (_, label, x) => {
      if ((label.toLowerCase() === 'a' ? a : b) !== undefined) duplicate = true;
      if (label.toLowerCase() === 'a') a = Number(x); else b = Number(x);
      return ' ';
    });
    const ask = asksFor(rest, pythAsks);
    const unknown = clean(ask.rest.replace(/已知|一个|在|中|直角三角形|的|请/g, ''));
    if (duplicate || !integer(a, 1, 20) || !integer(b, 1, 20) || !ask.ok || unknown) return miss('请明确两条直角边（各1–20cm的整数），仅求斜边长度、三角形面积、周长或勾股面积关系；其他条件与子问暂不支持。');
    return { ok: true, p1: a, p2: b, fixed: { asks: ask.asks } };
  }
  function parseSum(source) {
    const values = {}; let duplicate = false;
    let rest = source;
    for (const [key, re] of [
      ['a1', /首项\s*(?:a1)?\s*(?:为|是|=)\s*(-?\d+(?:\.\d+)?)/gi],
      ['d', /公差\s*d?\s*(?:为|是|=)\s*(-?\d+(?:\.\d+)?)/gi],
      ['n', /项数\s*n?\s*(?:为|是|=)\s*(\d+(?:\.\d+)?)(?:\s*项)?/gi]
    ]) rest = rest.replace(re, (_, value) => { if (key in values) duplicate = true; values[key] = Number(value); return ' '; });
    // A numeric term count in an explicit ask is also a condition; never infer it.
    const counts = [...rest.matchAll(/(?:前|第)\s*(\d+(?:\.\d+)?)\s*项/g)].map(m => Number(m[1]));
    if (counts.length) {
      if (counts.some(n => n !== (values.n ?? counts[0]))) duplicate = true;
      values.n ??= counts[0]; rest = rest.replace(/(前|第)\s*\d+(?:\.\d+)?\s*项/g, '$1n项');
    }
    const ask = asksFor(rest, sumAsks);
    const unknown = clean(ask.rest.replace(/已知|一个|等差数列|的|请/g, ''));
    if (duplicate || !integer(values.a1, -20, 20) || !integer(values.d, -10, 10) || !integer(values.n, 1, 30) || !ask.ok || unknown) return miss('需明确整数首项a₁（−20–20）、公差d（−10–10）、项数n（1–30），仅求第n项、前n项和或配对关系；不支持逆向题与额外约束。');
    return { ok: true, p1: values.d, p2: values.n, fixed: { a1: values.a1, asks: ask.asks } };
  }
  const fixedProblem = (kind, f, p1, p2) => {
    const allowed = kind === 'pyth' ? pythAsks : sumAsks;
    if (typeof f.asks !== 'string' || !f.asks || f.asks.split(',').some(k => !Object.hasOwn(allowed, k))) return '所问量模式无效。';
    if (kind === 'pyth' ? !integer(p1, 1, 20) || !integer(p2, 1, 20) : !integer(f.a1, -20, 20) || !integer(p1, -10, 10) || !integer(p2, 1, 30)) return '参数必须为范围内的整数，不能舍入或夹取。';
    return '';
  };
  function pythModel(a, b, f = { asks: 'area,hypotenuse,perimeter,proof' }) {
    if (fixedProblem('pyth', f, a, b)) throw new RangeError('Invalid right-triangle configuration');
    const c2 = a*a+b*b, c = Math.sqrt(c2), area = a*b/2, perimeter = a+b+c;
    const cText = Number.isInteger(c) ? num(c) : `√${c2} ≈ ${num(c)}`;
    const answers = { hypotenuse: `斜边 c = ${cText} cm`, area: `三角形面积 = ${num(area)} cm²`, perimeter: `周长 ${Number.isInteger(c) ? '=' : '≈'} ${num(perimeter)} cm`, proof: `c² = a² + b² = ${c2} cm²` };
    const conclusion = f.asks.split(',').map(k => answers[k]).join('；')+'。';
    return { a, b, c, c2, area, perimeter, cText, asks: f.asks, metrics:[a,b,c], metricUnit:'cm', facts:[fact('斜边',`${cText} cm`),fact('两直角边平方和',`${c2} cm²`),fact('三角形面积',`${num(area)} cm²`)], conclusion,
      formula:'a² + b² = c²',formulaDetail:`${a}² + ${b}² = ${c2}，c = ${cText} cm`,readout:`斜边 ${cText} cm`,badge:'四个全等直角三角形 · 面积守恒' };
  }
  function sumModel(d, n, f = { a1: 1, asks: 'sum,term,proof' }) {
    if (fixedProblem('sum', f, d, n)) throw new RangeError('Invalid arithmetic-sequence configuration');
    const terms = Array.from({length:n},(_,i)=>f.a1+i*d), an=terms[n-1], pair=f.a1+an, sum=n*pair/2;
    const answers = {term:`第 ${n} 项 aₙ = ${num(an)}`,sum:`前 ${n} 项和 Sₙ = ${num(sum)}`,proof:`每对和为 ${num(pair)}，2Sₙ = ${n} × ${num(pair)}`};
    return {a1:f.a1,d,n,terms,an,pair,sum,asks:f.asks,metrics:[d,n,sum],metricUnit:'',facts:[fact('第 n 项',num(an)),fact('每对和',num(pair)),fact('前 n 项和',num(sum))],conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',formula:'Sₙ = n(a₁ + aₙ)/2',formulaDetail:`aₙ = ${num(f.a1)} + (${n} − 1) × (${num(d)}) = ${num(an)}；Sₙ = ${n} × (${num(f.a1)} + ${num(an)})/2 = ${num(sum)}`,readout:`Sₙ = ${num(sum)}`,badge:'倒序相加 · 每列的和相等'};
  }
  const shell = (kind, title, body, note) => `<section class="math-lab-scene math-${kind}" aria-label="${title}"><div class="math-scene-heading"><strong>${title}</strong><span data-math-phase>观察条件</span></div>${body}<p class="math-model-note">${note}</p><p class="math-progress" aria-live="off" data-math-progress>推导进度 0%</p></section>`;
  function pythVisual(m) {
    const s=260/(m.a+m.b), a=m.a*s, b=m.b*s, x=80,y=35,L=260;
    const pt=(u,v)=>`${num(x+u)},${num(y+v)}`;
    const corners=[[pt(0,0),pt(a,0),pt(0,b)],[pt(L,0),pt(L,a),pt(a,0)],[pt(L,L),pt(b,L),pt(L,a)],[pt(0,L),pt(0,b),pt(b,L)]];
    return shell('pyth','勾股定理 · 面积拼图',`<svg class="math-area-diagram" viewBox="0 0 420 335" role="img" aria-label="边长a加b的大正方形，四个全等直角三角形围成斜边正方形"><rect x="80" y="35" width="260" height="260" class="math-outline"/>${corners.map((p,i)=>`<polygon points="${p.join(' ')}" class="math-proof-triangle" data-math-triangle="${i}"/>`).join('')}<polygon points="${[pt(a,0),pt(L,a),pt(b,L),pt(0,b)].join(' ')}" class="math-hypotenuse-square"/><text x="210" y="155" text-anchor="middle">c² = ${m.c2}</text><text x="210" y="181" text-anchor="middle">a² + b²</text><text x="210" y="24" text-anchor="middle">a + b = ${m.a+m.b} cm</text><text x="210" y="322" text-anchor="middle">四个三角形面积共 ${2*m.a*m.b} cm²</text></svg><div class="math-live-equation">(${m.a} + ${m.b})² − 4 × ${num(m.area)} = ${m.c2} cm²</div>`, 'a、b是两条直角边，c是斜边。图形按比例绘制；四个直角三角形全等，中央四边形各角为90°。播放高亮推导步骤，不改变边长或面积。');
  }
  function sumVisual(m) {
    return shell('sum','等差数列 · 首尾配对',`<p class="math-sequence-rule">首项 a₁ = ${num(m.a1)} · 公差 d = ${num(m.d)} · 项数 n = ${m.n}</p><div class="math-pair-grid" role="list" aria-label="正序和倒序的逐项配对">${m.terms.map((v,i)=>`<div class="math-pair" role="listitem" data-math-pair="${i}"><span>a<sub>${i+1}</sub></span><b>${num(v)}</b><span>＋</span><b>${num(m.terms[m.n-1-i])}</b><span>＝ ${num(m.pair)}</span></div>`).join('')}</div><div class="math-live-equation">2Sₙ = ${m.n} × (${num(m.pair)}) = ${num(2*m.sum)}<br>Sₙ = ${num(m.sum)}</div>`, '上下两组分别为原数列与倒序数列，所以总和是2Sₙ。奇数项时中间项也出现两次。负数和零按代数相加，不把有向数值当作面积。');
  }
  function renderFrame(root, model, progress, {reducedMotion=false}={}) {
    const scene=root.querySelector('.math-lab-scene'); if(!scene) return;
    const p=Math.max(0,Math.min(1,progress)), step=Math.min(3,Math.floor(p*4));
    scene.dataset.step=String(step);
    scene.querySelector('[data-math-phase]').textContent=['观察条件','构造与配对','等量关系','核对结果'][step];
    scene.querySelector('[data-math-progress]').textContent=`推导进度 ${Math.round(p*100)}% · ${reducedMotion?'减少动态效果':'步骤示意'}`;
    scene.querySelectorAll('[data-math-pair]').forEach((e,i)=>e.classList.toggle('is-current',p===1||i===Math.min(model.n-1,Math.floor(p*model.n))));
  }
  const pyth={id:'pythagoras',subject:'数学',level:'junior',menuTitle:'勾股定理面积拼图',menuMeta:'直角边 · 斜边 · 面积关系',stage:'初中',block:'几何',title:'勾股定理：四个三角形的面积拼图',defaults:[3,4],keywords:/直角三角形|勾股/,
    params:[{label:'直角边 a',desc:'第一条直角边，整数1–20cm',unit:'cm',min:1,max:20,step:1,value:3},{label:'直角边 b',desc:'第二条直角边，整数1–20cm',unit:'cm',min:1,max:20,step:1,value:4}],
    strict:{sameConditions:true,intent:{require:[/直角三角形|勾股/]},fixedDefaults:{asks:'area,hypotenuse,perimeter,proof'},caps:[[1,20],[1,20]],values:parsePyth,used:(a,b)=>[{cls:'length',value:a/100},{cls:'length',value:b/100}],checkFixed:(f,a,b)=>fixedProblem('pyth',f,a,b),asks:{supported:/斜边|面积|周长|勾股|拼图/,unsupported:/角度|体积|概率|反推|质量/}},
    question:(a,b)=>`直角三角形的两条直角边分别为${a}cm和${b}cm，求斜边长度、三角形面积和周长，验证勾股关系。`,model:pythModel,visual:pythVisual,recognition:m=>`${m.a}cm、${m.b}cm两直角边｜${m.readout}`,formatMetric:num,resetToQuestion:true,motion:{duration:8},renderFrame,
    presetFor:()=>({p1:3,p2:4,fixed:{asks:'area,hypotenuse,perimeter,proof'}}),
    copy:m=>({steps:[['明确直角边',`a=${m.a}cm，b=${m.b}cm；c为斜边。`,'仅适用于直角三角形。'],['构造面积拼图','将四个全等直角三角形放入边长a+b的正方形。','相邻两锐角互余，中央四边形为边长c的正方形。'],['面积相等',`c²=(a+b)²−4×ab/2=a²+b²=${m.c2} cm²`,'同一大正方形减去四个三角形。'],['按所问回答',m.conclusion,'长度用cm，面积用cm²；根式保留，六位小数仅为显示近似。']],hint:'先确认直角，再用面积相等说明a²+b²=c²。',mentor:'改变一条直角边，观察中央正方形面积怎样变化；为什么四个角都是直角？',challenge:'把两条直角边互换，比较斜边、面积和周长。',sceneTip:m.conclusion,generationStages:stages('识别两条直角边','构造四个全等直角三角形','核对面积与斜边')})};
  const sum={id:'arithmeticSum',subject:'数学',level:'senior',menuTitle:'等差数列首尾配对',menuMeta:'通项 · 前n项和 · 倒序相加',stage:'高中',block:'数列',title:'等差数列：倒序相加求前n项和',defaults:[2,10],keywords:/等差数列/,
    params:[{label:'公差 d',desc:'整数−10–10；首项由原题锁定',unit:'',min:-10,max:10,step:1,value:2},{label:'项数 n',desc:'正整数1–30；不会将小数舍入',unit:'',min:1,max:30,step:1,value:10}],
    strict:{sameConditions:true,intent:{require:[/等差数列/]},fixedDefaults:{a1:1,asks:'proof,sum,term'},caps:[[-10,10],[1,30]],values:parseSum,used:(d,n)=>[{cls:'count',value:n}],checkFixed:(f,d,n)=>fixedProblem('sum',f,d,n),asks:{supported:/第|前|配对|求和/,unsupported:/概率|极限|最值|递推|反推|面积/}},
    question:(d,n,f={a1:1})=>`等差数列首项a₁=${f.a1}，公差d=${d}，项数n=${n}，求第n项和前n项和，说明首尾配对。`,model:sumModel,visual:sumVisual,recognition:m=>`a₁=${num(m.a1)}｜d=${num(m.d)}｜n=${m.n}｜${m.readout}`,formatMetric:num,resetToQuestion:true,motion:{duration:10},renderFrame,
    presetFor:()=>({p1:2,p2:10,fixed:{a1:1,asks:'proof,sum,term'}}),
    copy:m=>({steps:[['读取条件',`a₁=${num(m.a1)}，d=${num(m.d)}，n=${m.n}`,'首项由题目保存；改变公差、项数进行比较。'],['计算第n项',`aₙ=a₁+(n−1)d=${num(m.an)}`,'相邻两项的差均为d，d允许为负数或零。'],['正序与倒序相加',`每列之和 a₁+aₙ=${num(m.pair)}，共有${m.n}列。`,'两行之和为2Sₙ；奇数项的中间项也各出现一次。'],['按所问回答',m.conclusion,'Sₙ=n(a₁+aₙ)/2=na₁+n(n−1)d/2。']],hint:'把同一数列倒写一遍，每列的和都相等。',mentor:'公差为负数或零时，倒序相加为什么仍成立？奇数项的中间项怎样配对？',challenge:'保持项数不变，增加公差1，前n项和增加多少？',sceneTip:m.conclusion,generationStages:stages('识别首项、公差和项数','构造正序与倒序两行','核对逐项和与求和公式')})};
  kit.register({pythagoras:pyth,arithmeticSum:sum});
})();
