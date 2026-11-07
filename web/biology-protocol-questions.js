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
  function routingSource(value, quotes = []) {
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
    return text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"\n]*"|'[^'\n]*'/gu, quote => {
      quotes.push(quote.slice(1, -1));
      return '\uFFFC';
    });
  }
  const REPORT = /^(?:背景(?:信息|资料|材料)?\s*:|[^:]{0,24}?(?:卡片|展板|海报|笔记|讲义|资料|材料|说明牌|记录|报告)(?:上|里|中)?\s*(?:写着|写有|记载|记录|提到|介绍|列出|展示|说明|显示|说)(?:了|着)?)/u;
  const HEADING = /^(?:(?:另外|另有|还有|下面|接下来)(?:是)?\s*)?(?:请?(只|仅)(?:需)?(?:回答|解答|问|做)(?:这道|以下|下面)?|(?:另|再)?(?:请)?(?:解答|回答))?\s*(?:一道|一条)?\s*(物理|数学|化学|生物)(?:实验)?(?:题|问题)?\s*:/u;
  const ASK = /^(?:(?:同时|另外|顺便|接着|并|另|还|再|也|又)\s*)*(?:我(?:们)?|请(?:你)?|试)?\s*(?:(只|仅)(?:需)?\s*)?(?:请问|问|求(?:出|得)?(?!助)|计算|算出|估算|判断|确定|解释|说明|比较|说出|指出|描述|列出|简述|回答|解答)\s*:?\s*/u;
  const INTERROGATIVE = /为什么|为何|如何|怎样|是什么|有哪些|有什么|多少|是否|能否|能不能|会不会/u;
  const PROTOCOL_TARGET = /(?:这些|上述|前述|卡片上的|材料中的)(?:实验|步骤|操作)|这两(?:步|个操作)|水浴|脱色|碘液|遮光|天竺葵|淀粉|叶圆片|浮片|叶片(?:浮起|上浮)|菠菜|富含CO2|产氧/u;

  // Separate reported facts from requests for routing. A report can continue
  // across commas and semicolons, until a question, a heading or a new sentence.
  function routingParts(value, quotes) {
    const tokens = routingSource(value, quotes).split(/(\r?\n|[。!?;]|(?<!\d)[,.]|[,.](?!\d)|(?=(?:并|另|还|再)?请(?:你)?(?:问|解释|说明|比较|回答|解答)))/u);
    const parts = [];
    let reporting = false;
    for (let i = 0; i < tokens.length; i += 2) {
      const text = tokens[i].trim();
      const separator = tokens[i + 1] || '';
      const heading = text.match(HEADING);
      const reportStart = text.match(REPORT);
      const ask = text.match(ASK);
      const request = Boolean(!heading && (ask || INTERROGATIVE.test(text) || separator === '?'));
      if (heading || request) reporting = false;
      else if (reportStart) reporting = true;
      if (heading?.[1] && heading[2] !== '生物' && !parts.some(part => part.request || part.subject === '生物')) {
        // An explicit exclusive subject can scope earlier facts out. Earlier
        // questions or a named biology task remain available for clarification.
        for (const part of parts) part.reported = true;
      }
      parts.push({text, separator, reported: reporting, request, exclusive: Boolean(ask?.[1]),
        target: ask ? text.slice(ask[0].length) : text, subject: heading?.[2]});
      if (/[。.!?\n]/u.test(separator)) reporting = false;
    }
    return parts;
  }

  function scan(value, config) {
    const text = sourceView(value).text;
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
    return {conditions, asks: [...asks]};
  }

  function assess(value, config) {
    const parsed = parse(value, config);
    const quotes = [];
    const parts = routingParts(value, quotes);
    const active = parts.map(part => (part.reported ? '\uFFFC' : part.text) + part.separator).join('');
    const reported = parts.filter(part => part.reported).map(part => part.text + part.separator).join('\uFFFC');
    const {conditions, asks} = scan(active, config);
    const background = scan([reported, ...quotes].join('\uFFFC'), config).conditions;
    const subjectEvidence = [...conditions, ...background].some(({role}) => ['objective','material','procedure'].includes(role));
    const requests = parts.filter(part => !part.reported && part.request);
    const asksAboutProtocol = ({target}) => PROTOCOL_TARGET.test(target)
      || target.split(/以及|和|与|及|、|并且/u).some(item =>
        Object.values(config.askRules).some(pattern => pattern.test(sourceView(item).text)));
    const namedBiologyTask = parts.some(part => !part.reported && part.subject === '生物');
    const requested = subjectEvidence && (namedBiologyTask || requests.some(asksAboutProtocol));
    const singleExclusiveRequest = !namedBiologyTask && requests.length === 1 && requests[0].exclusive;
    const has=role=>conditions.some(x=>x.role===role),procedures=conditions.filter(x=>x.role==='procedure').length;
    const confirmed=has('objective')&&(has('book')||has('material')||procedures>0)||procedures>=2;
    const uncertain=procedures>0||(has('objective')||has('material'))&&asks.length>0||requested
      || background.length > 0 && requests.length === 0;
    const questionSections = [];
    let section = '', hasRequest = false;
    for (const part of parts) {
      if (!part.reported) {
        section += part.text + part.separator;
        hasRequest ||= part.request || Boolean(part.subject);
      }
      if (/[。.!?;\n]/u.test(part.separator)) {
        if (hasRequest) questionSections.push(section);
        section = '';
        hasRequest = false;
      }
    }
    if (hasRequest) questionSections.push(section);
    const ownership=parsed.ok?'complete':confirmed?'confirmed':uncertain?'uncertain':'none';
    return {candidate:ownership!=='none',ownership,parsed,evidence:{conditions,asks,procedureCount:procedures,background,requested,singleExclusiveRequest,questionSections}};
  }
  window.MasterLabProtocolQuestions = Object.freeze({ sourceView, parse, rule, routingSource, assess });
})();
