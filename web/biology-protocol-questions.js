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
    let text = ''; const map = [], protectedSeparators = new Set();
    const gap = c => /[\s,，。;；:：!?！？、.]/u.test(c || '');
    const number = c => /[0-9零一二三四五六七八九十百两]/u.test(c || '');
    const latin = c => /[a-zA-Z]/u.test(c || '');
    const unitStart = c => /[a-zA-Z片组厘毫瓦昼小]/u.test(c || '');
    const left = [], right = []; let nearest = -1;
    for (let i=0;i<chars.length;i++) { left[i]=nearest; if (!gap(chars[i])) nearest=i; }
    nearest=-1;
    for (let i=chars.length-1;i>=0;i--) { right[i]=nearest; if (!gap(chars[i])) nearest=i; }
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (gap(c)) {
        const l=chars[left[i]],r=chars[right[i]],space=/\s/u.test(c);
        // Separators inside a number must never turn 3,0 / 3 0 into 30.
        // Spaces between a complete value and its unit remain legitimate.
        const numericBoundary=number(l)&&number(r);
        const tokenBoundary=!space&&(number(l)&&unitStart(r)||latin(l)&&latin(r));
        if (!numericBoundary&&!tokenBoundary) continue;
        protectedSeparators.add(spans[i][0]);
      }
      for (let n = 0; n < c.length; n++) { text += c[n]; map.push(spans[i]); }
    }
    const excerpt = offset => {
      const start = map[offset]?.[0] ?? source.length;
      const tail = source.slice(start);
      const delimiter = [...tail.matchAll(/[，,。；;！？?\n]/gu)].find(m=>!protectedSeparators.has(start+m.index));
      const part = delimiter ? tail.slice(0, delimiter.index) : tail;
      const points = Array.from(part || tail);
      return points.slice(0, 72).join('') + (points.length > 72 ? '…' : '');
    };
    return { source, text, excerpt };
  }
  function matchCondition(rest, rules) {
    for (let index=0;index<rules.length;index++) {
      const r=rules[index],m=rest.match(r.re);
      if(m)return {r,index,m};
    }
    return null;
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
      const found = matchCondition(rest, rules);
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
  const rule = (name, source, optional = false, routingRole = 'condition') => Object.freeze({name,re:new RegExp('^(?:'+source+')','u'),optional,routingRole});
  function routingSource(value) {
    let text=String(value).normalize('NFKC').trim();
    // A whole quoted question is still a candidate for local validation. Embedded labels
    // are literal background, not instructions. This view never changes parser input.
    const pairs=[['“','”'],['「','」'],['『','』'],['"','"'],["'","'"]];
    const request=text.match(/^(?:请)?(?:生成|演示|回答|解释|说明)(?:以下|下面)?(?:实验|题目)?[:：,，]?/u);
    const target=request?text.slice(request[0].length).trim():text;
    const pair=pairs.find(([a,b])=>target.startsWith(a)&&target.endsWith(b));
    if(pair)text=target.slice(pair[0].length,-pair[1].length);
    // Keep separators and numeric whitespace. sourceView, shared with parse(), decides
    // which gaps are equivalent. An opaque marker prevents joining across quoted labels.
    return text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"|'[^'\n]*'/gu,'\uFFFC');
  }
  function assess(value, config) {
    const parsed=parse(value,config),text=sourceView(routingSource(value)).text;
    const conditions=[],seen=new Set(),asks=new Set();
    for(let pos=0;pos<text.length;) {
      const rest=text.slice(pos),found=matchCondition(rest,config.rules);
      if(found) {
        if(!seen.has(found.index))conditions.push({name:found.r.name,role:found.r.routingRole,canonicalOffset:pos});
        seen.add(found.index);pos+=found.m[0].length;continue;
      }
      const ask=Object.entries(config.askRules).map(([key,re])=>({key,m:rest.match(re)})).find(x=>x.m);
      if(ask){asks.add(ask.key);pos+=ask.m[0].length;continue;}
      pos+=text.codePointAt(pos)>0xFFFF?2:1;
    }
    const has=role=>conditions.some(x=>x.role===role),procedures=conditions.filter(x=>x.role==='procedure').length;
    const confirmed=has('objective')&&(has('book')||has('material')||procedures>0)||procedures>=2;
    const uncertain=procedures>0||(has('objective')||has('material'))&&asks.size>0;
    const ownership=parsed.ok?'complete':confirmed?'confirmed':uncertain?'uncertain':'none';
    return {candidate:ownership!=='none',ownership,parsed,evidence:{conditions,asks:[...asks],procedureCount:procedures}};
  }
  window.MasterLabProtocolQuestions = Object.freeze({ sourceView, parse, rule, routingSource, assess });
})();
