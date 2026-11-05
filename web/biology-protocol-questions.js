/* Fixed-protocol text grammar. No code evaluation, HTML parsing or scientific inference. */
(() => {
  'use strict';
  function sourceView(value) {
    const source = String(value), chars = [], spans = [];
    const units = { '厘米':'cm', '毫米':'mm', '瓦特':'W', '瓦':'W' };
    for (const m of source.matchAll(/厘米|毫米|瓦特|瓦|[\s\S]/gu)) {
      const normalized = units[m[0]] || m[0].normalize('NFKC');
      for (const c of normalized) { chars.push(c); spans.push([m.index, m.index + m[0].length]); }
    }
    let text = ''; const map = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (/\s|[,，。;；:：!?！？、]/u.test(c)) continue;
      if (c === '.' && (!/\d/.test(chars[i-1] || '') || !/\d/.test(chars[i+1] || ''))) continue;
      for (let n = 0; n < c.length; n++) { text += c[n]; map.push(spans[i]); }
    }
    const excerpt = offset => {
      const start = map[offset]?.[0] ?? source.length;
      const tail = source.slice(start), stop = tail.search(/[，,。；;！？?\n]/u);
      const part = stop < 0 ? tail : tail.slice(0, stop);
      const points = Array.from(part || tail);
      return points.slice(0, 72).join('') + (points.length > 72 ? '…' : '');
    };
    return { source, text, excerpt };
  }
  function parse(value, { rules, askRules, askNames, defaults }) {
    if (typeof value !== 'string' || !value.trim()) return {ok:false,message:'请输入实验条件和所问。'};
    const view = sourceView(value), seen = new Set(), asks = new Set();
    let pos = 0, askMode = false;
    const fail = message => ({ok:false,message});
    const fragment = () => '「' + view.excerpt(pos) + '」';
    while (pos < view.text.length) {
      let rest = view.text.slice(pos);
      const marker = rest.match(/^(?:请你|请|试)?(?:说明|解释|比较|说出|指出|描述|列出|简述)/u);
      if (marker) { pos += marker[0].length; rest = view.text.slice(pos); askMode = true; }
      const atom = Object.entries(askRules).map(([key,re]) => ({key,m:rest.match(re)})).find(x=>x.m);
      const questionSuffix = atom && /^(?:分别)?(?:是什么|有哪些|为何|有什么作用)/u.test(rest.slice(atom.m[0].length));
      if (atom && (askMode || questionSuffix)) {
        asks.add(atom.key); pos += atom.m[0].length; askMode = true;
        const suffix = view.text.slice(pos).match(/^(?:分别)?(?:是什么|有哪些|为何|有什么作用)/u); if (suffix) pos += suffix[0].length;
        const join = view.text.slice(pos).match(/^(?:以及|和|及|与)/u);
        if (join) { pos += join[0].length; if (!Object.values(askRules).some(re=>re.test(view.text.slice(pos)))) return fail('所问含未支持或不完整的子问：'+fragment()+'。'); }
        continue;
      }
      if (marker) return fail('无法确认所问：'+fragment()+'。支持'+Object.values(askNames).join('、')+'。');
      const found = rules.map((r,index)=>({r,index,m:rest.match(r.re)})).find(x=>x.m);
      if (!found) return fail('无法确认条件或子问：'+fragment()+'。请核对操作、数值角色与所问；不会自动补条件。');
      if (seen.has(found.index)) return fail('条件重复或可能矛盾：'+found.r.name+'；原文'+fragment()+'。');
      seen.add(found.index); pos += found.m[0].length; askMode = false;
    }
    const missing = rules.filter((r,i)=>!r.optional&&!seen.has(i)).map(r=>r.name);
    if (missing.length) return fail('缺少可核对条件：'+missing.join('；')+'。');
    if (!asks.size) return fail('尚未明确所问。支持'+Object.values(askNames).join('、')+'。');
    return {ok:true,p1:1,p2:1,fixed:{...defaults,asks:[...asks].sort().join(',')}};
  }
  // All alternatives are authored vocabulary/word-order slots, not student expressions.
  const rule = (name, source, optional = false) => Object.freeze({name,re:new RegExp('^(?:'+source+')','u'),optional});
  window.MasterLabProtocolQuestions = Object.freeze({ sourceView, parse, rule });
})();
