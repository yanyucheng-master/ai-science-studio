(() => {
  'use strict';
  const kit = window.MasterLabTemplateKit, C = window.MasterLabPedigree;
  const Q = window.MasterLabPedigreeQuestions, catalog = window.MasterLabPedigreeCases;
  if (!kit || !C || !Q || !catalog) return;
  const { fact, stages } = kit.helpers;
  const steps = ['读图与关系', '先选遗传方式', '选择关系证据', '逐人推基因型', '配子与概率', '比较并解释'];
  const drafts = new WeakMap(), analyses = new Map();
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const yOf = p => 65 + (p.generation - 1) * 135;
  const stepFrame = progress => ({ step: Math.min(5, Math.max(0, Math.floor(progress * 6))) });

  function analysis(data) {
    if (!analyses.has(data.id)) analyses.set(data.id, C.analyze(data));
    return analyses.get(data.id);
  }

  function svg(data) {
    const people = Object.fromEntries(data.people.map(p => [p.id, p]));
    const generations = Math.max(...data.people.map(p => p.generation));
    const height = generations * 135 + 15;
    const paths = data.families.map(f => {
      const father = people[f.father], mother = people[f.mother], y = yOf(father), x = (father.x + mother.x) / 2;
      const children = f.children.map(id => people[id]), xs = children.map(p => p.x), bar = y + 57;
      const path = `M${father.x + 18} ${y}H${mother.x - 18}M${x} ${y}V${bar}M${Math.min(x, ...xs)} ${bar}H${Math.max(x, ...xs)}`
        + children.map(p => `M${p.x} ${bar}V${yOf(p) - 18}`).join('');
      return `<g data-pedigree-family="${f.id}"><path d="${path}"/><text class="pedigree-family-label" x="${x + 8}" y="${y + 32}">${f.id}</text></g>`;
    }).join('');
    const symbols = data.people.map(p => {
      const shape = p.sex === 'M' ? '<rect x="-18" y="-18" width="36" height="36"/>' : '<circle r="18"/>';
      const label = `${p.id}，${p.sex === 'M' ? '男性' : '女性'}，表型${Q.phenotypeText[p.phenotype]}${p.carrier ? '，题给携带者' : ''}`;
      return `<g class="pedigree-member ${p.phenotype}" data-pedigree-member="${p.id}" role="button" tabindex="0" aria-label="${label}" aria-pressed="false" transform="translate(${p.x} ${yOf(p)})"><rect class="pedigree-hit" x="-32" y="-32" width="64" height="64" rx="9"/>${shape}${p.phenotype === 'unknown' ? '<text class="pedigree-unknown" y="7">?</text>' : ''}<text class="pedigree-id" y="44">${p.id}</text><text data-carrier-mark class="pedigree-carrier" x="27" y="-22">${p.carrier ? '携' : ''}</text></g>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" class="pedigree-svg" viewBox="0 0 500 ${height}" role="group" aria-label="${data.id}版本${data.version}原创家系，成员可点选">${Array.from({ length: generations }, (_, i) => `<text class="pedigree-generation" x="12" y="${65 + i * 135 + 6}">${['I', 'II', 'III'][i]}</text>`).join('')}${paths}${symbols}</svg>`;
  }

  function model(p1, p2, fixed = Q.defaults) {
    const error = Q.issue(fixed, p1, p2);
    if (error) throw new RangeError(error);
    const data = Q.find(fixed.caseId), solved = analysis(data);
    const result = solved.possible.length ? solved.possible.map(mode => C.modes[mode]).join('、') : '四类均与题给条件冲突';
    const answers = solved.possible.length === 1
      ? C.requestedProbabilities(data, solved, fixed.asks, solved.possible[0]) : [];
    return { data, analysis: solved, level: 'senior', asks: fixed.asks, metrics: [1, 1, data.people.length], metricUnit: '人',
      facts: [fact('家系成员', `${data.people.length}人`), fact('样例与版本', `${data.id}-v${data.version}`), fact('题给定位', data.locus === 'X' ? 'X染色体非同源区' : '未知')],
      formula: '亲子传递与题给条件 → 可行基因型 → 有条件的概率',
      formulaDetail: '给定父母基因型和模型条件时，各次生育相互独立。父母基因型未知时，子代表型可提供证据。概率的分子、分母按所问事件分别计算。',
      conclusion: `本图可行方式：${result}。${answers.map(answer => `${answer.label}：${answer.possibilities.join('或')}（分母：${answer.denominator}）。`).join('')}`,
      sceneConclusion: '先选择候选与关系证据，再用六步核对基因型和所问事件。',
      readout: `${data.id}-v${data.version} · ${data.people.length}名成员`, badge: '遗传系谱图 · 有条件推导',
      contextParameters: `${data.id}-v${data.version}；${data.locus === 'X' ? 'X非同源区' : '位置未知'}；所问${fixed.asks}；本地可行${result}。完全外显、无新突变。给定父母基因型及模型时各次生育独立。${data.id === 'P05' ? '外来II-3携带状态未知，AR和XR各有0或1/4；没有候选先验权重。' : ''}` };
  }

  function visual(m) {
    const data = m.data;
    return `<section class="biology-pedigree-scene" data-case="${data.id}" data-version="${data.version}" aria-label="遗传系谱图互动实验">
      <h3>${data.id} · ${data.title}</h3><p class="pedigree-muted">虚构课堂家系 · v${data.version} · ${data.locus === 'X' ? '题给基因位于X染色体非同源区' : '题给基因位置未知'}</p>
      <nav class="pedigree-cases" aria-label="切换完整样例">${catalog.cases.map(item => `<button type="button" data-pedigree-case="${item.id}" aria-pressed="${data.id === item.id}">${item.id}</button>`).join('')}</nav>
      <button type="button" data-experiment-reset>重置当前样例</button>
      <button type="button" data-pedigree-fullscreen>全屏查看</button>
      <nav class="pedigree-steps" aria-label="六步手动推导">${steps.map((label, i) => `<button type="button" data-experiment-step="${i}" aria-label="第${i + 1}步，${label}">${i + 1} ${label}</button>`).join('')}</nav>
      <div class="pedigree-legend" aria-label="图例"><span>□ 男性</span><span>○ 女性</span><span>■/● 受累</span><span>空心 表型未受累</span><span>? 表型未知</span><span>携 携带证据另列来源</span></div>
      <div class="pedigree-scroll" tabindex="0" aria-label="家系图，窄屏可在图内横向滚动">${svg(data)}</div>
      <p class="pedigree-muted">I、II、III为代际，编号为本图成员。窄屏可横向滑动家系图，也可用下方成员按钮点选。</p>
      <div class="pedigree-members" aria-label="按编号点选成员">${data.people.map(p => `<button type="button" data-pedigree-person="${p.id}">${p.id}</button>`).join('')}</div>
      <p class="pedigree-selection" data-pedigree-selection aria-live="polite">点选一个成员查看其亲缘与题给信息。</p>
      <div data-pedigree-pane></div>
      <details class="pedigree-conditions"><summary>本题前提、记录边界与教材定位</summary><ul>${catalog.assumptions.map(item => `<li>${item}</li>`).join('')}</ul><p>父母基因型未知时，已观察的子代表型会约束其可能集合。图示和数值来自本地假设模型。当前候选选择和证据点选是本页草稿，刷新、重置、重新生成、收藏或分享重新打开后从初始步骤开始。</p><p>人教高中《生物学 必修2 遗传与进化》2019审核体系，正文p5、p35–38、p92–94。纸质印次与官方文件同一性仍待核。家系为原创，图形附加的未知/携带来源标记是本实验图例。</p></details>
    </section>`;
  }

  function relationText(data, id) {
    const p = data.people.find(item => item.id === id);
    const parentFamily = data.families.find(f => f.children.includes(id));
    const ownFamilies = data.families.filter(f => [f.father, f.mother].includes(id));
    const relatives = [];
    if (parentFamily) relatives.push(`父母${parentFamily.father}、${parentFamily.mother}；同胞${parentFamily.children.filter(child => child !== id).join('、') || '未列'}`);
    ownFamilies.forEach(f => relatives.push(`配偶${f.father === id ? f.mother : f.father}；子女${f.children.join('、')}`));
    return `${id}，${p.sex === 'M' ? '男性' : '女性'}，表型${Q.phenotypeText[p.phenotype]}${p.carrier ? '；题给为携带者' : ''}。${relatives.join('。') || '本图未列父母和子女'}。`;
  }

  function genotypeTable(m, mode, selected) {
    if (!m.analysis.results[mode]?.possible) return '<p>该候选存在冲突，无法给出一致基因型。</p>';
    return `<table><caption>${C.modes[mode]}下的全部可行基因型</caption><thead><tr><th>成员</th><th>可能基因型</th><th>携带标记来源</th></tr></thead><tbody>${m.data.people.map(p => {
      const evidence = C.carrierEvidence(m.data, m.analysis, p.id, mode);
      const doses = m.analysis.results[mode].genotypes[p.id];
      const possiblyCarrier = doses.some(dose => C.isCarrier(dose, p.sex, mode));
      const status = evidence?.text || (possiblyCarrier ? '携带状态未知，保留可能集合'
        : p.phenotype === 'affected' ? '受累，按已列基因型说明' : '按已列基因型说明');
      return `<tr data-genotype-row="${p.id}"><th><button type="button" data-pedigree-person="${p.id}" aria-pressed="${selected === p.id}">${p.id}</button></th><td>${doses.map(dose => C.genotype(dose, p.sex, mode)).join(' 或 ')}</td><td data-carrier-source="${evidence?.source || (possiblyCarrier ? 'undetermined' : 'not-carrier')}">${status}</td></tr>`;
    }).join('')}</tbody></table>${selected ? `<section data-pedigree-derivation aria-label="${selected}的逐人推导"><h4>${selected}的推导依据</h4><ol>${C.genotypeDerivation(m.data, m.analysis, selected, mode).lines.map(line => `<li>${escape(line)}</li>`).join('')}</ol></section>` : '<p>点选表中或图上的成员，逐项查看表型、亲子传递和排除依据。</p>'}`;
  }

  function probabilityPanel(m, mode) {
    const solved = m.analysis.results[mode], data = m.data;
    if (!solved.possible) return '<p>当前候选无一致基因型，先核对冲突位置，概率不成立。</p>';
    const pairs = solved.pairs;
    const answers = C.requestedProbabilities(data, m.analysis, m.asks, mode);
    if (!answers.length) return '<p data-pedigree-probability-summary>本题未问概率；请按所问核对方式判读或冲突依据。</p>';
    const rows = pairs.map((pair, index) => `<tr><td>${C.genotype(pair.father, 'M', mode)} × ${C.genotype(pair.mother, 'F', mode)}</td>${answers.map(answer => `<td>${answer.values[index] ? C.text(answer.values[index]) : '条件事件机会为0，未定义'}</td>`).join('')}</tr>`).join('');
    const summaries = answers.map(answer => `<p data-pedigree-probability-result="${answer.field}">所问：${escape(answer.ask)}。在${C.modes[mode]}下，${answer.label}${answer.possibilities.length === 1 ? `为${answer.possibilities[0]}` : `保留${answer.possibilities.join('或')}，需补携带信息`}；分母为${answer.denominator}。</p>`).join('');
    const matrix = pairs.map(pair => `<details open><summary>${data.target.join(' × ')}，${C.genotype(pair.father, 'M', mode)} × ${C.genotype(pair.mother, 'F', mode)}</summary><table class="pedigree-gametes"><caption>列配子与性别组合，合并相同基因型前各项概率如下</caption><thead><tr><th>父方配子</th><th>母方配子</th><th>子代</th><th>概率</th></tr></thead><tbody>${pair.outcomes.map(row => {
      const fatherAllele = row.fatherAllele === 'Y' ? 'Y' : C.genotype(row.fatherAllele, 'M', mode).replace(/Y$/, '');
      const motherAllele = C.genotype(row.motherAllele, 'M', mode).replace(/Y$/, '');
      const autosomalAllele = allele => mode === 'AD' ? ['a', 'A'][allele] : ['A', 'a'][allele];
      return `<tr><td>${mode.startsWith('X') ? fatherAllele : autosomalAllele(row.fatherAllele)}</td><td>${mode.startsWith('X') ? motherAllele : autosomalAllele(row.motherAllele)}</td><td>${row.sex === 'M' ? '男' : '女'} ${row.genotype}</td><td>${C.text(row.probability)}</td></tr>`;
    }).join('')}</tbody></table></details>`).join('');
    const carrierProbability = C.text(C.probability(1, 1, 'AR', 'carrier', 'unaffected'));
    const carrier = answers.some(answer => answer.field === 'carrier') ? `<p data-carrier-probability>以双亲Aa×Aa及II-2未受累为条件，AA、Aa、Aa、aa四个配子组合各1/4。P(携带且未受累)=1/2，P(未受累)=3/4，所以P(携带 | 双亲Aa×Aa且II-2未受累)=(1/2)/(3/4)=${carrierProbability}。II-4题给携带这一事实不替代II-2的条件。</p>` : '';
    const p05 = data.id === 'P05' ? `<p data-p05-conditions>AD下II-2及II-3均为aa，受累概率0；XD下II-2为XᵈY、II-3为XᵈXᵈ，受累概率0。AR下II-2为Aa，II-3为AA时0、为Aa时1/4。XR下II-2为XᴬY，II-3为XᴬXᴬ时0、为XᴬXᵃ时1/4。</p><p>在已确定的AR或XR模型下，补II-3携带状态即可确定该模型中的数值。常染色体定位保留AD或AR，X非同源区定位保留XD或XR，进一步的显隐性证据继续缩小方式。只知道外来配偶未受累，携带状态仍可能未知。III-1表型未知，未据此增加观测证据。</p>` : '';
    return `<div data-pedigree-probability-summary><p>所问配偶为${data.target.join('与')}。</p>${summaries}</div><table data-pedigree-probabilities><caption>仅列本题受检子问，分别使用对应分母</caption><thead><tr><th>父母基因型</th>${answers.map(answer => `<th>${answer.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><p>给定父母基因型和模型条件时各次生育相互独立。男孩条件题的分母是男孩机会1/2，受累男孩题的分母是全部子代机会1。父母基因型未知时，子代表型可以提供推断证据，可行指派没有等权先验。</p>${carrier}${p05}${matrix}`;
  }

  function pane(m, draft, step) {
    const mode = draft.mode, solved = m.analysis.results[mode];
    const relationButtons = m.data.families.map(f => `<button type="button" data-pedigree-evidence="${f.id}" aria-pressed="${draft.evidence.has(f.id)}">${f.id} ${f.father}＋${f.mother} → ${f.children.join('、')}</button>`).join('');
    const modeButtons = `<div class="pedigree-modes" aria-label="查看候选模型">${Object.entries(C.modes).map(([key, title]) => `<button type="button" data-pedigree-mode="${key}" aria-pressed="${mode === key}">${title}</button>`).join('')}</div>`;
    if (step === 0) return '<h4>读图，区分表型与已知信息</h4><p>点选成员，查看父母、配偶、同胞及子女。空心图形只说明表型未受累。问号说明表型还没有给出。携带事实在图例和成员说明中单独标注。</p>';
    if (step === 1) return `<h4>先选择所有可能方式</h4><p>允许多选，保留你的判断，下一步逐个核对证据。</p><div class="pedigree-modes">${Object.entries(C.modes).map(([key, title]) => `<button type="button" data-pedigree-predict="${key}" aria-pressed="${draft.prediction.has(key)}">${title}</button>`).join('')}</div><p data-prediction>当前预测${[...draft.prediction].join('、') || '尚未选择'}。</p>`;
    if (step === 2) return `<h4>点出支持或排除的亲子关系</h4><div class="pedigree-relations">${relationButtons}</div>${modeButtons}<p data-mode-result>${C.modes[mode]}${solved.possible ? '有可行基因型，当前证据不能排除' : '在给定条件下被排除'}。</p><ul>${solved.conflicts.map(c => `<li data-conflict="${c.family || c.type}">${escape(c.text)}</li>`).join('') || '<li>逐个家庭的配子传递与全图约束可以同时满足。可行性不表示该方式已经唯一确定。</li>'}</ul><p>全图可行方式${m.analysis.possible.map(key => C.modes[key]).join('、') || '为空，须核对冲突'}。</p>`;
    if (step === 3) return `<h4>核对每人的基因型与证据来源</h4>${modeButtons}${genotypeTable(m, mode, draft.selected)}`;
    if (step === 4) return `<h4>从指定父母的配子计算</h4>${modeButtons}${probabilityPanel(m, mode)}`;
    const correct = m.analysis.possible.length === 0 ? 'none' : m.analysis.possible.length === 1 ? 'one' : 'many';
    return `<h4>比较并解释</h4><p>原预测${[...draft.prediction].join('、') || '未选择'}；本地可行方式${m.analysis.possible.join('、') || '四类均冲突'}。你选的证据${[...draft.evidence].join('、') || '尚未选择'}。</p><fieldset><legend>这张图在题给假设下能得出什么？</legend>${[['one', '有且只有一种可行方式'], ['many', '多种方式仍可行，需说明所缺信息'], ['none', '四类均有冲突，需核对题给关系或假设']].map(([value, title]) => `<label><input type="radio" name="pedigree-explanation" value="${value}" ${draft.answer === value ? 'checked' : ''}>${title}</label>`).join('')}</fieldset><button type="button" data-pedigree-check>核对解释</button><p aria-live="polite" data-explanation-feedback>${draft.checked ? draft.answer === correct ? '与全图约束一致。请结合所选关系和概率分母说明理由。' : '请回看候选排除与亲子关系，按可行集合重新判断。' : '先选结论，再核对解释。'}</p>${m.data.id === 'P05' ? '<p>补II-3携带状态确定某个隐性模型下的概率，补定位与显隐性证据缩小遗传方式，这两类信息作用不同。</p>' : ''}`;
  }

  function renderFrame(root, m, progress) {
    const el = root.querySelector('.biology-pedigree-scene');
    if (!el) return;
    let draft = drafts.get(el);
    if (!draft) {
      draft = { selected: '', mode: m.analysis.possible[0] || 'AD', prediction: new Set(), evidence: new Set(), answer: '', checked: false };
      drafts.set(el, draft);
      el.addEventListener('click', event => {
        const member = event.target.closest('[data-pedigree-member],[data-pedigree-person]');
        const button = event.target.closest('button');
        if (member) draft.selected = member.dataset.pedigreeMember || member.dataset.pedigreePerson;
        else if (button?.dataset.pedigreePredict) {
          const mode = button.dataset.pedigreePredict;
          if (draft.prediction.has(mode)) draft.prediction.delete(mode); else draft.prediction.add(mode);
        } else if (button?.dataset.pedigreeMode) draft.mode = button.dataset.pedigreeMode;
        else if (button?.dataset.pedigreeEvidence) {
          const id = button.dataset.pedigreeEvidence;
          if (draft.evidence.has(id)) draft.evidence.delete(id); else draft.evidence.add(id);
        } else if (button?.hasAttribute('data-pedigree-check')) draft.checked = true;
        else return;
        renderFrame(root, m, el._progress);
      });
      el.addEventListener('change', event => {
        if (event.target.name !== 'pedigree-explanation') return;
        draft.answer = event.target.value; draft.checked = false;
        renderFrame(root, m, el._progress);
      });
      el.addEventListener('keydown', event => {
        const node = event.target.closest('[data-pedigree-member]');
        if (node && ['Enter', ' '].includes(event.key)) { event.preventDefault(); node.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      });
    }
    const step = stepFrame(progress).step;
    el._progress = progress; el.dataset.step = String(step + 1);
    el.querySelectorAll('[data-experiment-step]').forEach((button, index) => {
      button.setAttribute('aria-current', index === step ? 'step' : 'false');
    });
    el.querySelectorAll('[data-pedigree-member],[data-pedigree-person]').forEach(node => {
      node.setAttribute('aria-pressed', (node.dataset.pedigreeMember || node.dataset.pedigreePerson) === draft.selected ? 'true' : 'false');
    });
    const selection = draft.selected ? relationText(m.data, draft.selected) : '点选一个成员查看其亲缘与题给信息。';
    const derivation = draft.selected && step >= 3 ? C.genotypeDerivation(m.data, m.analysis, draft.selected, draft.mode) : null;
    el.querySelector('[data-pedigree-selection]').textContent = selection + (derivation ? derivation.lines.join('') : '');
    el.querySelectorAll('[data-pedigree-family]').forEach(node => {
      const conflict = step >= 2 && m.analysis.results[draft.mode].conflicts.some(c => c.family === node.dataset.pedigreeFamily);
      node.classList.toggle('conflict', conflict);
      node.classList.toggle('chosen', draft.evidence.has(node.dataset.pedigreeFamily));
    });
    el.querySelectorAll('[data-pedigree-member]').forEach(node => {
      const id = node.dataset.pedigreeMember;
      const info = step >= 3 ? C.carrierEvidence(m.data, m.analysis, id, draft.mode) : null;
      node.querySelector('[data-carrier-mark]').textContent = m.data.people.find(p => p.id === id).carrier || info ? '携' : '';
      node.dataset.carrierSource = info?.source || (m.data.people.find(p => p.id === id).carrier ? 'given' : 'undetermined');
    });
    const html = pane(m, draft, step), panel = el.querySelector('[data-pedigree-pane]');
    if (panel._html !== html) {
      const active = document.activeElement;
      const focusAttribute = panel.contains(active) && ['data-pedigree-predict', 'data-pedigree-mode',
        'data-pedigree-evidence', 'data-pedigree-check', 'data-pedigree-person'].find(name => active.hasAttribute(name));
      const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : '';
      const radioValue = panel.contains(active) && active.name === 'pedigree-explanation' ? active.value : '';
      panel.innerHTML = html; panel._html = html;
      const replacement = focusAttribute ? [...panel.querySelectorAll(`[${focusAttribute}]`)].find(node => node.getAttribute(focusAttribute) === focusValue)
        : radioValue ? [...panel.querySelectorAll('input[name="pedigree-explanation"]')].find(node => node.value === radioValue) : null;
      replacement?.focus({ preventScroll: true });
    }
  }

  function clearDraft(root) {
    const el = root?.querySelector('.biology-pedigree-scene');
    const draft = el && drafts.get(el);
    if (!draft) return;
    draft.selected = '';
    draft.mode = analysis(Q.find(el.dataset.case)).possible[0] || 'AD';
    draft.prediction.clear();
    draft.evidence.clear();
    draft.answer = '';
    draft.checked = false;
  }

  window.MasterLabPedigreeUI = Object.freeze({ svg, clearDraft });
  kit.register({ pedigree: {
    id: 'pedigree', subject: '生物', level: 'senior', block: '遗传', stage: '系谱与概率',
    title: '遗传系谱图：读图、判读与概率', menuTitle: '遗传系谱图', menuMeta: '原创家系 · 四类模型 · 条件概率',
    defaults: [1, 1], resetToQuestion: true, manualSteps: 6, protocolSteps: 6, protocolFrame: stepFrame,
    clearDraft, keywords: /遗传系谱图/, formatMetric: String,
    params: [{ label: '内置家系', desc: '使用样例按钮选择', unit: '', min: 1, max: 1, step: 1, value: 1 },
      { label: '题给条件', desc: '从版本化题面恢复', unit: '', min: 1, max: 1, step: 1, value: 1 }],
    parameter: param => ({ ...param, locked: true, lockText: '内置图固定条件' }),
    strict: { originalText: true, sameConditions: true, caps: [[1, 1], [1, 1]], fixedDefaults: Q.defaults,
      intent: { require: [/遗传系谱图/] }, values: Q.parse, checkFixed: Q.issue,
      used: () => [{ cls: 'times', value: 2 }], asks: { supported: /./ } },
    question: Q.question, presetFor: () => Q.preset(), model, visual, renderFrame, recognition: m => m.readout,
    given: () => '当前版本化家系、题给定位、表型与携带事实。',
    stepContext: progress => {
      const el = document.querySelector('.biology-pedigree-scene');
      const data = el && Q.find(el.dataset.case), draft = el && drafts.get(el);
      return `${data ? `${data.id}-v${data.version}，` : ''}当前第${stepFrame(progress).step + 1}步，${steps[stepFrame(progress).step]}。${draft?.selected ? relationText(data, draft.selected) : '尚未点选成员。'}${data ? '可行方式' + (analysis(data).possible.join('、') || '为空') + '。' : ''}未知创始者没有等权先验，概率按模型及父母基因型分别列出。`;
    },
    copy: m => ({ title: `遗传系谱图 ${m.data.id}-v${m.data.version} · ${m.data.title}`,
      steps: steps.map((title, i) => [title,
      [m.data.id + '的题给成员与亲缘信息。', '先独立选择一个或多个候选。', '逐个核对每个家庭的配子传递。',
        '区分题给携带、推断携带与尚未知的基因型。', '先确定所问配偶和事件，再核对分母。', '用亲子关系解释可行、多解或冲突。'][i],
      '所有结论限于本题明确假设。']), hint: '点选成员，先找有判别力的亲子关系。', mentor: '哪些关系能够排除某种方式？哪些条件还不足以给出唯一概率？',
      challenge: '比较题给携带和推断携带，解释已知男孩与生一个受累男孩的分母。', sceneTip: m.sceneConclusion,
      generationStages: stages('核对内置家系的版本和完整题给条件', '本地校验四类遗传方式的配子约束', '准备六步判读与条件概率') })
  } });
})();
