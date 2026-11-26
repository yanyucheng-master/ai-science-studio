(() => {
  'use strict';
  const catalog = window.MasterLabPedigreeCases;
  if (!catalog) return;
  const defaults = Object.freeze({ caseId: 'P01', version: 1, level: 'senior', levelLocked: true,
    asks: catalog.cases[0].asks.join('|') });
  const compact = text => String(text).normalize('NFKC').replace(/[−–—]/g, '-').replace(/[\s，,。；;：:、！？?]/g, '');
  const find = id => catalog.cases.find(data => data.id === id);
  const phenotypeText = { affected: '受累', unaffected: '未受累', unknown: '未知' };
  function clauses(data) {
    return [
      `高中遗传系谱图${data.id}-v${data.version}`,
      ...catalog.assumptions,
      data.locus === 'X' ? '基因位于X染色体非同源区' : '基因位置未知',
      ...data.people.map(p => `${p.id}${p.sex === 'M' ? '男性' : '女性'}表型${phenotypeText[p.phenotype]}${p.carrier ? '且题给为携带者' : ''}`),
      ...data.families.map(f => `${f.father}与${f.mother}的子女为${f.children.join('、')}`)
    ];
  }
  function issue(fixed, p1, p2) {
    const data = find(fixed.caseId);
    if (!data || fixed.version !== data.version || fixed.level !== 'senior' || fixed.levelLocked !== true
      || p1 !== 1 || p2 !== 1 || typeof fixed.asks !== 'string') return '样例、版本或高中固定条件无效';
    const asks = fixed.asks.split('|');
    if (!asks.length || new Set(asks).size !== asks.length || asks.some(ask => !data.asks.includes(ask))) return '含本样例未支持的子问';
    return '';
  }
  function preset(caseId = 'P01') {
    const data = find(caseId);
    if (!data) throw new RangeError('未知系谱图样例');
    return { p1: 1, p2: 1, fixed: { ...defaults, caseId, version: data.version, asks: data.asks.join('|') } };
  }
  function question(p1 = 1, p2 = 1, fixed = defaults) {
    const error = issue(fixed, p1, p2);
    if (error) throw new RangeError(error);
    return clauses(find(fixed.caseId)).join('。') + '。求' + fixed.asks.split('|').join('、') + '。';
  }
  function parse(input) {
    let source = compact(input);
    const headers = [...source.matchAll(/高中遗传系谱图(P\d+)-v(\d+)/g)];
    if (headers.length !== 1) return { ok: false, message: '请使用一个版本化内置系谱图样例P01–P06，并保留题给成员、关系、条件和具体所问。' };
    const header = headers[0], data = find(header[1]);
    if (!data || header[2] !== String(data.version)) return { ok: false, message: '未知系谱图样例或版本，请从六张内置图重新选择。P02使用v2。' };
    for (const clause of clauses(data).sort((a, b) => b.length - a.length)) {
      const expected = compact(clause);
      const index = source.indexOf(expected);
      if (index < 0) return { ok: false, message: `缺少或改动了题给条件：${clause}。请核对该项。` };
      source = source.slice(0, index) + source.slice(index + expected.length);
    }
    source = source.replace(/^(?:请)?(?:求|计算|判断)/, '');
    const asks = [];
    for (const ask of [...data.asks].sort((a, b) => b.length - a.length)) {
      const expected = compact(ask), index = source.indexOf(expected);
      if (index >= 0) { asks.push(ask); source = source.slice(0, index) + source.slice(index + expected.length); }
    }
    if (source || !asks.length) return { ok: false, message: `无法确认条件或子问：${source.slice(0, 100) || '所问为空'}。本入口只支持所选内置图的判读与列出的概率问题。` };
    // Keep asks in catalog order so equivalent questions restore the same fixed state.
    return { ok: true, p1: 1, p2: 1, fixed: { ...defaults, caseId: data.id, version: data.version,
      asks: data.asks.filter(ask => asks.includes(ask)).join('|') } };
  }
  function candidate(input) {
    const source = compact(input);
    const header = /高中遗传系谱图P\d+-v\d+/;
    return /^(?:(?:请)?(?:求|计算|判断))?高中遗传系谱图P\d+-v\d+/.test(source)
      || /^(?:请)?(?:打开|生成|查看)(?:高中)?遗传系谱图/.test(source)
      || /^(?:请)?(?:求|计算|判断)(?:方式判读|I{1,3}-\d+与I{1,3}-\d+|双亲Aa×Aa)/.test(source) && header.test(source);
  }
  window.MasterLabPedigreeQuestions = Object.freeze({ defaults, find, clauses, phenotypeText, issue, preset, question, parse, candidate });
})();
