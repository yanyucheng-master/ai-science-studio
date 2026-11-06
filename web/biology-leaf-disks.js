(() => {
  'use strict';
  const kit = window.MasterLabTemplateKit, C = window.MasterLabLeafDisks, Q = window.MasterLabLeafDiskQuestions;
  if (!kit || !C || !Q) return;
  const { fact, stages } = kit.helpers;
  function model(p1, p2, fixed = Q.DEFAULTS) {
    const error = Q.issue(fixed, p1, p2); if (error) throw new RangeError(error);
    const answers = {
      steps: '制备30片→注射器排气沉底→暗处清水待用→准备富CO₂清水→三杯各10片并设置强中弱光→同一时段观察记录',
      purpose: '排气使细胞间隙充水而沉底，暗处待用保护初态；以其他条件可比的三组观察光照影响',
      variables: '自变量是光照强度；以同一时段浮起叶片数作观察指标；材料、叶片数、供碳、温度与时段等保持可比',
      indicator: '记录同一时间段内每组浮起的圆形小叶片数量；每组投入10片，浮起数须实测',
      limits: '尚无实测记录，不能给出各组浮起数或强弱排名；浮起数是间接指标，不等于总产氧量或糖的质量'
    };
    return { level: 'senior', asks: fixed.asks, metrics: [30, 3, 10], metricUnit: '片', observedCounts: [null, null, null],
      facts: [fact('取材与分组', '30片 → 3组 × 10片'), fact('改变的条件', '光照强度'), fact('实测浮起数', '待观察、待记录')],
      formula: '同一时段、其他条件可比 → 比较各组浮起数量',
      formulaDetail: '这是教材的探究方案，没有光强到浮片数的确定计算公式。5 W是灯功率，不是叶面照度；图上距离不代表实测厘米。',
      conclusion: fixed.asks.split(',').map(key => answers[key]).join('；') + '。',
      readout: '观察指标：同一时段内各组叶片浮起数量', badge: '高中 · 叶圆片探究',
      contextParameters: '人教2019审定体系必修1第105页固定参考流程：0.6cm直径叶圆片30片、三组各10片、5W LED灯、富CO₂清水、其他条件可比、同一观察时段。未给出实测浮片数、照度、精确距离或观察分钟数；不得由动画补出结果。' };
  }
  const leaf = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path data-leaf-blade d="M0 95C-100 55-110-48-28-90L0-120 28-90C110-48 100 55 0 95Z" fill="#81aa74" stroke="#4a7659" stroke-width="2"/><path data-leaf-veins d="M0 110V-100M0-40-55-65M0-5 60-35M0 35-45 10" stroke="#527b5b" fill="none" stroke-width="3"/></g>`;
  const disks = (count, x, y, columns = 10, dx = 17, dy = 15) => Array.from({ length: count }, (_, i) => `<circle data-leaf-disk cx="${x + i % columns * dx}" cy="${y + Math.floor(i / columns) * dy}" r="5" fill="#79a968" stroke="#4f7e56"/>`).join('');
  const beaker = (x, y, width, height, count = 0, dark = false) => `<g data-leaf-beaker transform="translate(${x} ${y})">${dark ? `<rect x="-25" y="-30" width="${width + 50}" height="${height + 55}" rx="12" fill="#29384e"/>` : ''}<path d="M0 0V${height - 12}q0 12 12 12H${width - 12}q12 0 12-12V0" fill="#f8fcff" stroke="#819ab5" stroke-width="3"/><path d="M4 35H${width - 4}V${height - 13}q0 9-9 9H13q-9 0-9-9Z" fill="#deedf4"/><path d="M4 35H${width - 4}" stroke="#a3c4d5"/>${disks(count, 14, height - 35, count === 30 ? 10 : 5, count === 30 ? (width - 28) / 10 : (width - 28) / 5, 12)}</g>`;
  function apparatus(frame) {
    if (frame.step === 0) return `${leaf(175, 190, .85)}<circle data-punch-hole cx="215" cy="195" r="14" fill="#f9fcff" stroke="#8b9eb2" stroke-dasharray="3 3"/><path d="M155 130H290V175H155Z" fill="#d8e3ec" stroke="#819ab5"/><path d="M215 145V195" stroke="#667d95" stroke-width="15"/>${disks(frame.cutCount, 370, 140, 6, 24, 25)}<text x="100" y="330">避开大叶脉 · 直径0.6 cm</text><text x="370" y="300">制备目标30片</text>`;
    if (frame.step === 1) {
      const phase = frame.syringePhase, shift = phase === 2 ? (frame.local * 3 - 2) * 65 : 0;
      return `<path d="M90 175H145M90 195H145" stroke="#819ab5" stroke-width="3"/><rect x="145" y="110" width="365" height="150" rx="10" fill="#f9fcff" stroke="#819ab5" stroke-width="3"/><path d="M150 155H480V255H150Z" fill="#dfedf4"/><path d="M${490 + shift} 95V275M${490 + shift} 185H${590 + shift}M${590 + shift} 145V225" fill="none" stroke="#819ab5" stroke-width="7"/>${phase > 0 ? '<ellipse cx="85" cy="185" rx="18" ry="30" fill="#e3c6ab"/><text x="50" y="285">堵住前孔</text>' : '<path d="M90 185 55 155" stroke="#819ab5" stroke-width="3"/><text x="50" y="75">先排尽残留空气</text>'}${disks(30, 185, frame.submerged ? 220 : 175, 10, 25, 10)}${phase === 2 ? '<g fill="none" stroke="#7eafc5"><circle cx="245" cy="150" r="8"/><circle cx="320" cy="132" r="5"/><circle cx="390" cy="148" r="7"/></g>' : ''}<text x="200" y="325">${phase === 0 ? '吸入清水，排残余空气' : phase === 1 ? '手指堵孔，准备缓慢拉动' : '缓拉活塞 · 叶内气体逸出'}</text>`;
    }
    if (frame.step === 2) return `${beaker(195, 70, 290, 240, 30, true)}<text x="185" y="350">黑暗处 · 清水中待用</text>`;
    if (frame.step === 3) return `${[100, 295, 490].map(x => beaker(x, 110, 130, 170)).join('')}<path d="M160 45 150 90M355 45 350 90M550 45 550 90" stroke="#90a9bf" stroke-width="4"/><g fill="none" stroke="#89b5c9"><circle cx="165" cy="200" r="6"/><circle cx="360" cy="192" r="7"/><circle cx="555" cy="203" r="6"/></g><text x="170" y="335">三杯均为富CO₂的清水</text>`;
    if (frame.step === 4) return `<path d="M50 155 120 125 150 160 80 190Z" fill="#e6d28d" stroke="#899db3"/><path d="M90 180V300H40" stroke="#899db3" fill="none" stroke-width="6"/><path data-lamp-rays d="M155 150 650 90M155 170 650 280" stroke="#e4c663" stroke-width="3" opacity=".7"/>${[[180, 130], [355, 130], [535, 130]].map(([x, y]) => beaker(x, y, 110, 130, 10)).join('')}<path d="M165 325H655" stroke="#819ab5" stroke-width="3"/>${Array.from({ length: 22 }, (_, i) => `<path d="M${170 + i * 22} 325v${i % 5 === 0 ? 15 : 8}" stroke="#819ab5"/>`).join('')}<text x="25" y="38">5 W LED</text><text data-group-label x="190" y="85">强</text><text data-group-label x="370" y="85">中</text><text data-group-label x="550" y="85">弱</text><text x="250" y="375">米尺比较距离 · 各10片</text>`;
    const y = 280 - frame.mechanismRise * 145;
    return `${beaker(210, 75, 270, 245)}<ellipse data-mechanism-disk cx="345" cy="${y}" rx="27" ry="10" fill="#79a968" stroke="#4f7e56"/><g fill="none" stroke="#7cafc4"><circle cx="335" cy="${y - 18}" r="7"/><circle cx="355" cy="${y - 30}" r="5"/></g><path d="M520 270V135m-10 15 10-15 10 15" fill="none" stroke="#4e84bc" stroke-width="3"/><text x="150" y="38">单片上浮机理示意</text><text x="150" y="370">不是任一组数据，不表示真实速度</text>`;
  }
  function visual() {
    return `<section class="biology-leaf-disks-scene" aria-label="高中光合作用叶圆片探究"><div class="leaf-disks-heading"><h3>光照怎样影响光合作用？</h3><span>人教必修1 · 教材参考案例</span></div><nav class="leaf-disks-steps" aria-label="教材六步，共用同一播放时间轴">${C.STEPS.map((s, i) => `<button type="button" data-leaf-step="${i}" aria-label="回看第${i + 1}步：${s.title}；定位步骤开头并暂停，点击播放继续"><span>${i + 1}</span>${s.title}</button>`).join('')}</nav><div class="leaf-disks-layout"><figure><svg data-leaf-svg viewBox="0 0 700 400" role="img" aria-label="教材操作示意"></svg><figcaption data-leaf-caption></figcaption></figure><div class="leaf-disks-explanation"><h4 data-leaf-title></h4><p data-leaf-action></p><div class="leaf-disks-purpose"><strong>为什么这样做</strong><p data-leaf-purpose></p></div></div></div><section class="leaf-disks-record" aria-label="同一时段观察记录表"><h4>记录留给实测，网页不预填结果</h4><table><caption>三组观察同一时间段；其他条件保持可比</caption><thead><tr><th scope="col">光照组</th><th scope="col">投入叶片</th><th scope="col">浮起数量</th></tr></thead><tbody>${['强', '中', '弱'].map(label => `<tr><th scope="row">${label}光</th><td>10片</td><td data-observed-count>待观察</td></tr>`).join('')}</tbody></table><p>教材没有提供统一结果。动画不预测各组浮起数，也不能用上浮示意给三组排出实测强弱。</p></section><p class="leaf-disks-note">步骤按钮定位各步开头并暂停，点击统一播放可回看该步全过程，第6步也从观察过程开头开始。演示压缩操作顺序，不模拟真实光合速率。图中的距离、气泡和单片上浮速度不作测量依据；5 W是灯功率，不能直接换算为叶面照度。</p><details class="leaf-disks-conditions"><summary>器材、变量与教材边界</summary><p>${C.MATERIALS.join('、')}。直径0.6 cm，30片分成3组，每组10片。</p><p>人教版《生物学 必修1 分子与细胞》2019审定体系，第105页参考案例。本流程选择菠菜及富CO₂清水；教材还允许吊兰等绿叶、或1%–2% NaHCO₃溶液供碳。这里不另开这些实验模式，也不加入氧浓度传感器测定。</p><p>只改变光照强度。材料、叶片数、供碳、温度与观察时段等须保持可比。光合作用释放的氧气积累有助于叶片上浮，但植物同时呼吸，浮片数是间接指标，不能换成总产氧量或糖质量；零片上浮也不等于光合作用为零。</p><p>原创器材与上浮机理示意，未复制教材照片；不同于初中的同叶遮光与碘液检验淀粉。</p></details></section>`;
  }
  function renderFrame(root, model, progress) {
    const el = root.querySelector('.biology-leaf-disks-scene'); if (!el) return;
    const f = C.frame(progress), s = C.STEPS[f.step];
    el.dataset.step = String(f.step + 1); el.dataset.hasObservedData = 'false';
    el.querySelector('[data-leaf-svg]').innerHTML = apparatus(f);
    el.querySelector('[data-leaf-title]').textContent = `第${f.step + 1}步 · ${s.title}`;
    el.querySelector('[data-leaf-action]').textContent = s.action;
    el.querySelector('[data-leaf-purpose]').textContent = s.purpose;
    const captions = ['打孔器直径0.6 cm，目标30片；叶片图不按实物比例绘制。', '先排尽注射器残留空气，再堵孔缓拉。处理后叶片沉底，必要时重复2–3次。', '全部处理叶片在黑暗处清水中待用；不套用初中实验的一昼夜暗处理。', '三只小烧杯均加富含CO₂的清水；图中气泡仅示意补充CO₂。', '同一5 W LED光源，米尺比较远近；图中从左到右依次为强、中、弱组，各杯10片，图中无精确厘米值。', '独立的单片上浮机理图，不是强、中、弱任一组的结果。三组浮起数仍须同一时段实测。'];
    el.querySelector('[data-leaf-caption]').textContent = captions[f.step];
    el.querySelector('[data-leaf-svg]').setAttribute('aria-label', s.title + '：' + captions[f.step]);
    el.querySelectorAll('[data-leaf-step]').forEach((button, i) => { button.classList.toggle('active', i === f.step); button.setAttribute('aria-current', i === f.step ? 'step' : 'false'); });
  }
  kit.register({ leafDisks: { id: 'leafDisks', subject: '生物', level: 'senior', block: '植物生理', stage: '光合作用', title: '高中光合作用：叶圆片与光照', menuTitle: '光照与叶圆片上浮', menuMeta: '三组对照 · 排气 · 同时段观察', defaults: [1, 1], resetToQuestion: true, localOnly: true, protocolCandidate: Q.protocolCandidate, protocolAssessment: Q.protocolAssessment, diagnosticPriority: Q.diagnosticPriority, motion: { duration: 18 }, formatMetric: String, keywords: /叶圆片|圆形小叶片|光合作用强度|光照强度/,
    params: [{ label: '教材固定流程', desc: '30片、三组各10片', unit: '', min: 1, max: 1, step: 1, value: 1 }, { label: '同一时段观察', desc: '不预填实测浮起数', unit: '', min: 1, max: 1, step: 1, value: 1 }], parameter: param => ({ ...param, locked: true, lockText: '教材固定设置' }),
    strict: { originalText: true, sameConditions: true, caps: [[1, 1], [1, 1]], fixedDefaults: Q.DEFAULTS, intent: { require: [/光照强度/, /光合作用强度/] }, values: Q.parse, checkFixed: Q.issue, used: () => [{ cls: 'length', value: .006 }, { cls: 'power', value: 5 }], asks: { supported: /实验步骤|操作步骤|操作流程|操作目的|各步骤的目的|各步操作的目的|实验变量|自变量与因变量|观察指标|观测指标|结果分析边界|分析结果的限制/, unsupported: /实验结论|速率|多少|产氧量|总量|温度|浓度|质量/ } },
    question: Q.question, model, visual, renderFrame, given: () => '直径0.6 cm的叶圆片30片；3组各10片；5 W LED；同一时段观察，实测浮起数尚未给出。', presetFor: () => ({ p1: 1, p2: 1, fixed: { ...Q.DEFAULTS } }), recognition: m => m.readout,
    stepContext: progress => { const f = C.frame(progress), s = C.STEPS[f.step]; return `当前教材第${f.step + 1}步：${s.title}。${s.action}尚未提供任何一组的实际观察记录；不能从动画给出浮片数、三组实测排名或光合速率。`; },
    copy: m => ({ steps: C.STEPS.map((s, i) => [`${i + 1} ${s.title}`, s.action, s.purpose]), hint: '先判断哪一项是改变的条件，再说明为什么三组必须观察同一时间段。', mentor: '排气为什么使叶圆片下沉？上浮的数量为什么只是比较指标，不能直接等同于光合作用总产氧量？', challenge: '回看六步，找出排气、暗处待用、供碳和同一时段观察分别控制了什么。', sceneTip: '三组投入相同数量的叶片，在同一时段记录浮起数量；实测数据尚未给出，不预设结果。', generationStages: stages('核对人教高中参考案例的条件', '区分固定投放数和待测浮起数', '准备六步操作与上浮机理示意') })
  } });
})();
