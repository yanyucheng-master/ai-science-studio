/* Display-only science notation. Never run this parser on questions, model data or requests.
 * The small syntax tree is shared by HTML, SVG and the plain-text parts of tutor replies.
 * TeX is still typeset by the bundled KaTeX, with trust disabled by its caller.
 */
(() => {
  "use strict";
  const SUB = Object.fromEntries([..."₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎"].map((c, i) => [c, "0123456789+−=()"[i]]));
  Object.assign(SUB, { "ₐ": "a", "ₑ": "e", "ₕ": "h", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "ₗ": "l", "ₘ": "m", "ₙ": "n", "ₒ": "o", "ₚ": "p", "ᵣ": "r", "ₛ": "s", "ₜ": "t", "ᵤ": "u", "ᵥ": "v", "ₓ": "x", "ᵧ": "y" });
  const SUP = Object.fromEntries([..."⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ"].map((c, i) => [c, "0123456789+−=()ni"[i]]));
  const SUFFIX = { W: "有|总|额", R: "并|总|额|内", F: "浮|示|压|拉|阻|摩|合|支", Q: "吸|放|总", G: "排|物|总", V: "排|物|总", ρ: "液|物|水", c: "水|液|物", a: "相", x: "相", v: "共|末|初", t: "共|末|初" };
  const GREEK = { rho: "ρ", mu: "μ", lambda: "λ", eta: "η", Delta: "Δ", theta: "θ", omega: "ω", tau: "τ", pi: "π", alpha: "α", beta: "β", gamma: "γ", epsilon: "ε", sigma: "σ", phi: "φ", Omega: "Ω" };
  const OPERATORS = { times: "×", cdot: "·", div: "÷", approx: "≈", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", pm: "±", to: "→", infty: "∞" };
  const FUNCTIONS = new Set(["sin", "cos", "tan", "ln", "log", "exp"]);
  const UNIT = "(?:kg|km|cm|mm|ms|mol|mL|kJ|kW|kPa|Pa|Hz|g|m|s|h|N|J|W|A|V|Ω|K|L|℃|°C)";
  const UNIT_POWER = "(?:[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+|\\^\\{?[-−+]?\\d+\\}?)?";
  const UNIT_RATIO = new RegExp(`^(?:J\\s*\\/\\s*\\(kg\\s*[·×*]\\s*(?:℃|°C|K)\\)|(?:km|cm|mm|m)${UNIT_POWER}\\s*\\/\\s*(?:s|h)${UNIT_POWER}|(?:kg|g)\\s*\\/\\s*(?:cm|m)${UNIT_POWER}|(?:kg|g)\\s*\\/\\s*(?:s|mol)|N(?:·s)?\\s*\\/\\s*(?:kg|m)|(?:J|kJ)\\s*\\/\\s*(?:kg|mol)|(?:mol|g)\\s*\\/\\s*(?:L|mL))(?![A-Za-z])`);
  const UNIT_ATOM = new RegExp(`^${UNIT}(?![A-Za-z])`);
  const ALLOWED = new Set(["BR", "STRONG", "B", "EM", "I", "SPAN", "SUB", "SUP", "SMALL"]);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const renderedSvg = new WeakMap();
  const txt = value => ({ type: "text", value, raw: value });
  const row = children => ({ type: "row", children });
  const isAtom = n => n && ["atom", "number", "group", "root", "frac", "unit", "tex", "function", "call"].includes(n.type);
  const raw = n => n.raw ?? (n.children || []).map(raw).join("");
  const unwrap = n => n.type === "group" ? row(n.children) : n;
  const flatten = list => list.length === 1 ? list[0] : row(list);
  const treeDepth = n => 1 + Math.max(0, ...(n.children || [n.numerator, n.denominator, n.content, n.fn, n.argument].filter(Boolean)).map(treeDepth), ...(n.sub || []).map(treeDepth), ...(n.sup || []).map(treeDepth));

  function groupAt(source, start) {
    const close = { "(": ")", "{": "}", "[": "]" }[source[start]];
    if (!close) return null;
    const stack = [close];
    for (let i = start + 1; i < source.length; i++) {
      if (source[i] === "\\") { i++; continue; }
      if ("({[".includes(source[i])) stack.push({ "(": ")", "{": "}", "[": "]" }[source[i]]);
      else if (source[i] === stack.at(-1)) {
        stack.pop();
        if (!stack.length) return { value: source.slice(start + 1, i), end: i + 1, open: source[start], close };
      }
    }
    return null;
  }

  function fenceAt(source, start) {
    const delimiter = /^(?:\\[A-Za-z]+|\\[{}|]|[()[\]|.])/;
    const open = source.slice(start).match(delimiter)?.[0];
    if (!open) return null;
    const pattern = /\\(left|right)(?:\\[A-Za-z]+|\\[{}|]|[()[\]|.])/g;
    pattern.lastIndex = start + open.length;
    let nesting = 1, match;
    while ((match = pattern.exec(source))) {
      nesting += match[1] === "left" ? 1 : -1;
      if (!nesting) return { open: `\\left${open}`, close: match[0], value: source.slice(start + open.length, match.index), end: pattern.lastIndex };
    }
    return null;
  }

  function parse(source, options = {}, depth = 0) {
    source = String(source ?? "");
    if (depth > 24 || source.length > 30000) return [txt(source)];
    const tokens = [];
    let i = 0;
    const child = value => parse(value, options, depth + 1);
    while (i < source.length) {
      const start = i, rest = source.slice(i);
      const protectedText = rest.match(/^(?:https?:\/\/[^\s<>，。；]+|www\.[^\s<>，。；]+|`[^`\n]*`|(?:[A-Za-z]:[\\/]|\.\.?\/)[^\s，。；]+)/);
      if (protectedText) { tokens.push(txt(protectedText[0])); i += protectedText[0].length; continue; }
      const allele = /基因|遗传|等位|这对/.test(source) && rest.match(/^([A-Z])\/([a-z])(?![A-Za-z])/);
      if (allele && allele[1].toLowerCase() === allele[2]) { tokens.push(txt(allele[0])); i += allele[0].length; continue; }
      const unit = !options.inUnit && rest.match(UNIT_RATIO);
      if (unit) {
        tokens.push({ type: "unit", children: parse(unit[0], { ...options, inUnit: true }, depth + 1), raw: unit[0] });
        i += unit[0].length; continue;
      }
      const whitespace = rest.match(/^\s+/);
      if (whitespace) { tokens.push({ type: "space", value: whitespace[0], raw: whitespace[0] }); i += whitespace[0].length; continue; }
      let node;
      if (source[i] === "\\") {
        const command = rest.match(/^\\([A-Za-z]+|.)/);
        if (!command) { tokens.push(txt(source[i++])); continue; }
        i += command[0].length;
        const name = command[1];
        if (name === "left") {
          const fence = fenceAt(source, i);
          if (fence) { i = fence.end; node = { type: "group", open: fence.open, close: fence.close, children: child(fence.value) }; }
        } else if (name === "begin" || name === "end") {
          const environment = groupAt(source, i);
          if (environment) { i = environment.end; node = { type: "literal", value: source.slice(start, i), tex: source.slice(start, i) }; }
        } else if (name === "\\") node = { type: "literal", value: "\n", tex: command[0] };
        else if (name === "frac" || name === "dfrac" || name === "tfrac") {
          while (source[i] === " ") i++;
          const numerator = groupAt(source, i);
          let at = numerator?.end ?? i;
          while (source[at] === " ") at++;
          const denominator = groupAt(source, at);
          if (numerator && denominator) { i = denominator.end; node = { type: "frac", command: name, numerator: row(child(numerator.value)), denominator: row(child(denominator.value)) }; }
        } else if (name === "sqrt") {
          const index = source[i] === "[" ? groupAt(source, i) : null;
          if (index) i = index.end;
          const content = groupAt(source, i);
          if (content) { i = content.end; node = { type: "root", content: row(child(content.value)), index: index?.value }; }
        } else if (["text", "mathrm", "operatorname", "ce"].includes(name)) {
          const content = groupAt(source, i);
          if (content) { i = content.end; node = { type: "tex", command: name, value: content.value, unit: name === "mathrm" && new RegExp(`^${UNIT}$`).test(content.value) }; }
        } else if (FUNCTIONS.has(name)) node = { type: "function", value: name, tex: true };
        else if (name === "_") node = { type: "literal", value: "_", tex: command[0] };
        else if (GREEK[name]) node = { type: "atom", value: GREEK[name] };
        else if (OPERATORS[name]) node = { type: "op", value: OPERATORS[name] };
        if (!node) node = { type: "tex", value: command[0] };
      } else if (source[i] === "√") {
        i++;
        const content = groupAt(source, i);
        if (content) { i = content.end; node = { type: "root", content: row(child(content.value)) }; }
        else {
          // Without parentheses a radical covers one scripted atom, not the rest of the line.
          const tail = rest.slice(1).match(/^[A-Za-zΑ-Ωα-ω0-9]+(?:[²³⁰¹⁴⁵⁶⁷⁸⁹]+|\^\{[^{}]*\}|\^[-−+]?\d+)?/);
          if (tail) { i += tail[0].length; node = { type: "root", content: row(child(tail[0])) }; }
          else node = txt("√");
        }
      } else if ("({[".includes(source[i])) {
        const content = groupAt(source, i);
        if (content) { i = content.end; node = { type: "group", children: child(content.value), open: content.open, close: content.close }; }
      }
      if (!node) {
        const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
        const word = rest.match(/^[A-Za-z]{2,}/);
        const unitAtom = rest.match(UNIT_ATOM);
        if (word && FUNCTIONS.has(word[0])) { i += word[0].length; node = { type: "function", value: word[0] }; }
        else if (number) { i += number[0].length; node = { type: "number", value: number[0] }; }
        else if (unitAtom) { i += unitAtom[0].length; node = { type: "atom", value: unitAtom[0], unit: true }; }
        else if (word && word[0].length >= 3 && !/[A-Za-z]/.test(source[start - 1] || "") && (/^[A-Z]{3,}$/.test(word[0]) || !/^[A-Z][a-z]?(?:[A-Z][a-z]?)+$/.test(word[0]))) { i += word[0].length; node = txt(word[0]); }
        else if (/[A-Za-zΑ-Ωα-ω∞]/.test(source[i])) { node = { type: "atom", value: source[i++] }; }
        else if (/[=≈+−\-×*÷/·<>≤≥≠±→]/.test(source[i])) { node = { type: "op", value: source[i] === "-" ? "−" : source[i] === "*" ? "×" : source[i] }; i++; }
        else { tokens.push(txt(source[i++])); continue; }
      }
      if (isAtom(node) && node.type !== "unit") {
        if (node.type === "atom") {
          const suffix = SUFFIX[node.value] && source.slice(i).match(new RegExp(`^(?:${SUFFIX[node.value]})`));
          if (suffix) { node.sub = [txt(suffix[0])]; i += suffix[0].length; }
          else if (/^[A-Za-z]$/.test(node.value) && /^\d/.test(source.slice(i))) {
            const digits = source.slice(i).match(/^\d+/)[0]; node.sub = [txt(digits)]; i += digits.length;
          } else if (/^[avFxy]$/.test(node.value) && /^[AB](?![a-z])/.test(source.slice(i))) { node.sub = [txt(source[i++])]; }
          else if (source[i] === "∞") { node.sub = [txt(source[i++])]; }
        }
        let continuing = true;
        while (continuing && i < source.length) {
          const map = SUB[source[i]] !== undefined ? SUB : SUP[source[i]] !== undefined ? SUP : null;
          if (map) {
            let value = ""; while (map[source[i]] !== undefined) value += map[source[i++]];
            node[map === SUB ? "sub" : "sup"] = child(value);
          } else if (source[i] === "_" || source[i] === "^") {
            const which = source[i++] === "_" ? "sub" : "sup";
            const content = groupAt(source, i);
            if (content) { node[which] = child(content.value); i = content.end; }
            else if (i < source.length) {
              const value = source.slice(i).match(/^(?:[−+-]?\d+|[A-Za-zΑ-Ωα-ω])/);
              if (value) { node[which] = child(value[0]); i += value[0].length; }
              else { i--; continuing = false; }
            }
          } else continuing = false;
        }
      }
      node.raw = source.slice(start, i);
      if (node.sub) node.unit = false;
      tokens.push(node);
    }

    // A named function and its argument form one operand. Keep k(1-e…) as a
    // product after a quotient; only recognized functions/quantity names bind.
    for (let k = tokens.length - 2; k >= 0; k--) {
      const fn = tokens[k];
      let next = k + 1;
      while (tokens[next]?.type === "space") next++;
      const argument = tokens[next];
      if ((fn.type === "function" && isAtom(argument)) ||
          (fn.type === "atom" && /^[fnVP]$/.test(fn.value) && next === k + 1 && argument?.type === "group" && argument.open === "(")) {
        const call = { type: "call", fn, argument, separator: tokens.slice(k + 1, next).map(raw).join(""), raw: tokens.slice(k, next + 1).map(raw).join("") };
        if (treeDepth(call) > 48) return [txt(source)];
        tokens.splice(k, next - k + 1, call);
      }
    }
    if (!options.inUnit) for (let k = 0; k < tokens.length; k++) {
      if (tokens[k].type !== "op" || !["/", "÷"].includes(tokens[k].value)) continue;
      let left = k - 1, right = k + 1;
      while (tokens[left]?.type === "space") left--;
      while (tokens[right]?.type === "space") right++;
      if (!isAtom(tokens[left]) || !isAtom(tokens[right])) continue;
      let a = left, b = right;
      while (a > 0 && isAtom(tokens[a - 1])) a--;
      // A quantity with a unit is one operand in a numeric substitution using ÷.
      if (tokens[k].value === "÷" && tokens[a - 1]?.type === "space" && tokens[a - 2]?.type === "number") a -= 2;
      if (!["group", "root", "number"].includes(tokens[right].type)) while (isAtom(tokens[b + 1]) && !["group", "root"].includes(tokens[b + 1].type)) b++;
      if (tokens[k].value === "÷" && tokens[b + 1]?.type === "space" && (tokens[b + 2]?.unit || tokens[b + 2]?.type === "unit")) b += 2;
      const lhs = tokens.slice(a, left + 1), rhs = tokens.slice(right, b + 1);
      if (tokens[k].value === "/" && (lhs.some(n => n.type === "unit") || rhs.some(n => n.type === "unit") || (lhs.at(-1)?.unit && rhs[0]?.type === "number") || (lhs.every(n => n.unit) && rhs.every(n => n.unit)))) continue;
      const fraction = { type: "frac", numerator: unwrap(flatten(lhs)), denominator: unwrap(flatten(rhs)), raw: tokens.slice(a, b + 1).map(raw).join("") };
      if (treeDepth(fraction) > 48) return [txt(source)];
      tokens.splice(a, b - a + 1, fraction); k = a;
    }
    // Keep a measured value and its unit on the same line. This is a display
    // group only; fraction operands above are resolved before quantities bind.
    for (let k = tokens.length - 2; k >= 0; k--) {
      if (tokens[k].type !== "number") continue;
      let end = k + 1;
      if (tokens[end]?.type === "space") end++;
      if (tokens[end]?.unit || tokens[end]?.type === "unit") {
        const children = tokens.slice(k, end + 1);
        tokens.splice(k, end - k + 1, { type: "quantity", children, raw: children.map(raw).join("") });
      }
    }
    return tokens;
  }

  const changed = nodes => nodes.some(n => n.type === "frac" || n.type === "root" || n.type === "quantity" || n.sub || n.sup || (n.children && changed(n.children)) || (n.type === "call" && changed([n.fn, n.argument])));
  const element = (tag, className, value) => { const n = document.createElement(tag); if (className) n.className = className; if (value !== undefined) n.textContent = value; return n; };
  function appendNodes(container, nodes) {
    for (const n of nodes) {
      if (n.sub || n.sup) {
        const span = element("span", "science-math science-scripted");
        span.dataset.mathSource = raw(n);
        span.setAttribute("role", "math"); span.setAttribute("aria-label", raw(n));
        appendNodes(span, [{ ...n, sub: null, sup: null }]);
        const scripts = element("span", `science-scripts${n.sub && n.sup ? " has-both" : ""}`);
        if (n.sup) { const sup = element("sup"); appendNodes(sup, n.sup); scripts.append(sup); }
        if (n.sub) { const sub = element("sub"); appendNodes(sub, n.sub); scripts.append(sub); }
        span.append(scripts); container.append(span); continue;
      }
      if (n.type === "frac") {
        const span = element("span", "science-math vfrac"); span.dataset.mathSource = raw(n); span.setAttribute("role", "math"); span.setAttribute("aria-label", raw(n));
        const num = element("span", "vfrac-num"), den = element("span", "vfrac-den");
        appendNodes(num, [n.numerator]); appendNodes(den, [n.denominator]); span.append(num, den); container.append(span);
      } else if (n.type === "root") {
        const span = element("span", "science-math sqrt-formula"); span.dataset.mathSource = raw(n); span.setAttribute("role", "math"); span.setAttribute("aria-label", raw(n));
        if (n.index) span.append(element("sup", "sqrt-index", n.index));
        const radicand = element("span", "sqrt-radicand"); appendNodes(radicand, [n.content]); span.append(element("span", "sqrt-sign", "√"), radicand); container.append(span);
      } else if (n.type === "quantity") {
        const span = element("span", "science-math science-quantity"); span.dataset.mathSource = raw(n);
        appendNodes(span, n.children); container.append(span);
      } else if (n.type === "call") {
        appendNodes(container, [n.fn]); container.append(document.createTextNode(n.separator)); appendNodes(container, [n.argument]);
      } else if (n.type === "group") {
        container.append(document.createTextNode(n.open)); appendNodes(container, n.children); container.append(document.createTextNode(n.close));
      } else if (n.children) appendNodes(container, n.children);
      else container.append(document.createTextNode(n.value ?? n.raw ?? ""));
    }
  }

  function appendText(container, source) { appendNodes(container, parse(source)); }
  function enhance(root) {
    if (!root || root.closest?.(".science-math, .katex, [data-no-formula], textarea, input")) return;
    if (root.namespaceURI === SVG_NS) {
      if (root.tagName.toLowerCase() === "text") enhanceSvgText(root);
      else root.querySelectorAll("text").forEach(enhanceSvgText);
      return;
    }
    for (const node of [...root.childNodes]) {
      if (node.nodeType === 3) {
        const nodes = parse(node.data);
        if (changed(nodes)) { const fragment = document.createDocumentFragment(); appendNodes(fragment, nodes); node.replaceWith(fragment); }
      } else if (node.nodeType === 1 && !node.matches("script, style, textarea, input, code, pre, .science-math, .katex, .ai-inline-math, .ai-display-math, [data-no-formula]")) enhance(node);
    }
    if (root.matches?.(".vfrac:not(.science-math)")) {
      const numerator = root.querySelector(":scope > .vfrac-num"), denominator = root.querySelector(":scope > .vfrac-den");
      if (numerator && denominator) {
        root.dataset.mathSource = `(${sourceText(numerator)})/(${sourceText(denominator)})`;
        root.classList.add("science-math"); root.setAttribute("role", "math"); root.setAttribute("aria-label", root.dataset.mathSource);
      }
    }
  }

  function safeFragment(value) {
    const template = document.createElement("template"); template.innerHTML = String(value ?? "");
    const output = document.createDocumentFragment();
    const copy = (from, to) => {
      for (const node of from.childNodes) {
        if (node.nodeType === 3) to.append(document.createTextNode(node.data));
        else if (node.nodeType === 1 && ALLOWED.has(node.tagName)) {
          const clean = element(node.tagName.toLowerCase());
          const classes = [...node.classList].filter(c => /^(?:vfrac(?:-num|-den)?|sqrt-(?:formula|sign|radicand|index)|science-(?:math|scripted|scripts|quantity)|has-both)$/.test(c));
          if (classes.length) clean.className = classes.join(" ");
          if (classes.includes("science-math") && node.dataset.mathSource) {
            clean.dataset.mathSource = node.dataset.mathSource;
            clean.setAttribute("role", "math"); clean.setAttribute("aria-label", node.dataset.mathSource);
          }
          copy(node, clean); to.append(clean);
        } else if (node.nodeType === 1) to.append(document.createTextNode(node.outerHTML));
      }
    };
    copy(template.content, output); enhance(output); return output;
  }
  function html(value) { const host = element("span"); host.append(safeFragment(value)); return host.innerHTML; }
  function setHtml(host, value) { if (host) host.replaceChildren(safeFragment(value)); }

  function toTexNode(n) {
    let value;
    if (n.type === "frac") value = `\\${n.command || 'frac'}{${toTexNode(n.numerator)}}{${toTexNode(n.denominator)}}`;
    else if (n.type === "root") value = `\\sqrt${n.index ? `[${n.index}]` : ""}{${toTexNode(n.content)}}`;
    else if (n.type === "call") value = `${toTexNode(n.fn)}${n.separator || (n.fn.type === "function" ? " " : "")}${toTexNode(n.argument)}`;
    else if (n.type === "function") value = `\\${n.value}`;
    else if (n.type === "literal") value = n.tex;
    else if (n.type === "group") value = `${n.open}${n.children.map(toTexNode).join("")}${n.close}`;
    else if (n.type === "unit") value = `\\mathrm{${n.children.map(toTexNode).join("")}}`;
    else if (n.children) value = n.children.map(toTexNode).join("");
    else if (n.type === "tex") value = n.command ? `\\${n.command}{${n.value}}` : n.value;
    else value = n.value ?? n.raw ?? "";
    const script = children => children.map(c => c.type === "text" && /[\u3400-\u9fff]/.test(c.value) ? `\\text{${c.value}}` : toTexNode(c)).join("");
    if (n.sub) value += `_{${script(n.sub)}}`;
    if (n.sup) value += `^{${script(n.sup)}}`;
    return value;
  }
  function normalizeTex(source) {
    // Preserve native TeX layout, alignment and extension commands. Within
    // fences/environments only shorthand notation needs an additional pass.
    if (/\\(?:newcommand|def|over|atop|color|href|url|html\w*)\b/.test(source)) return source;
    const shorthand = /[/√₀-₉²³]/.test(source) || Object.entries(SUFFIX).some(([base, suffix]) => new RegExp(`${base}(?:${suffix})`).test(source));
    if (/\\(?:begin|end|left|right)\b/.test(source) && !shorthand) return source;
    return parse(source, { tex: true }).map(toTexNode).join("");
  }

  let measureContext;
  function svgLayout(nodes, size, font) {
    measureContext ||= document.createElement("canvas").getContext("2d");
    const layout = (n, s) => {
      if (n.sub || n.sup) {
        const base = layout({ ...n, sub: null, sup: null }, s);
        const sub = n.sub ? svgLayout(n.sub, s * .65, font) : null;
        const sup = n.sup ? svgLayout(n.sup, s * .65, font) : null;
        const down = .27 * s, up = -.53 * s;
        return { w: base.w + Math.max(sub?.w || 0, sup?.w || 0), a: Math.max(base.a, sup ? sup.a - up : 0), d: Math.max(base.d, sub ? sub.d + down : 0), paint(x, y, glyphs, lines) { base.paint(x, y, glyphs, lines); sub?.paint(x + base.w, y + down, glyphs, lines); sup?.paint(x + base.w, y + up, glyphs, lines); } };
      }
      if (n.type === "frac") {
        const num = layout(n.numerator, s * .88), den = layout(n.denominator, s * .88), pad = .13 * s, gap = .16 * s, axis = -.26 * s;
        const w = Math.max(num.w, den.w) + pad * 2, ny = axis - gap - num.d, dy = axis + gap + den.a;
        return { w, a: num.a - ny, d: den.d + dy, paint(x, y, glyphs, lines) { num.paint(x + (w - num.w) / 2, y + ny, glyphs, lines); den.paint(x + (w - den.w) / 2, y + dy, glyphs, lines); lines.push([x, y + axis, x + w, y + axis, Math.max(.8, s * .055)]); } };
      }
      if (n.type === "root") {
        const content = layout(n.content, s), sign = .62 * s, a = content.a + .13 * s;
        return { w: sign + content.w + .12 * s, a, d: content.d, paint(x, y, glyphs, lines) { content.paint(x + sign, y, glyphs, lines); lines.push([x + sign, y - a, x + sign + content.w + .1 * s, y - a, Math.max(.8, s * .055)]); lines.push([x, y - .2 * s, x + .18 * s, y - .3 * s, 1], [x + .18 * s, y - .3 * s, x + .34 * s, y + content.d, 1], [x + .34 * s, y + content.d, x + sign, y - a, 1]); } };
      }
      if (n.type === "call") return svgLayout([n.fn, txt(n.separator), n.argument], s, font);
      if (n.children) return svgLayout(n.type === "group" ? [txt(n.open), ...n.children, txt(n.close)] : n.children, s, font);
      const value = n.value ?? n.raw ?? "";
      measureContext.font = `${font.weight} ${s}px ${font.family}`;
      const metrics = measureContext.measureText(value);
      return { w: metrics.width, a: metrics.actualBoundingBoxAscent || s * .8, d: metrics.actualBoundingBoxDescent || s * .15,
        paint(x, y, glyphs) { glyphs.push({ x, y, size: s, value }); } };
    };
    const boxes = nodes.map(n => layout(n, size));
    return { w: boxes.reduce((sum, b) => sum + b.w, 0), a: Math.max(0, ...boxes.map(b => b.a)), d: Math.max(0, ...boxes.map(b => b.d)), paint(x, y, glyphs, lines) { for (const b of boxes) { b.paint(x, y, glyphs, lines); x += b.w; } } };
  }
  function enhanceSvgText(node) {
    const previous = renderedSvg.get(node);
    const signature = ["x", "y", "text-anchor", "font-size", "visibility", "transform"].map(a => node.getAttribute(a)).join("|");
    const retained = previous?.text === node.textContent && node.hasAttribute("data-math-source");
    if (retained && previous.signature === signature) return;
    previous?.rules.forEach(n => n.remove());
    const source = retained ? previous.source : node.textContent, nodes = parse(source);
    if (!changed(nodes)) {
      if (previous) { node.removeAttribute("data-math-source"); node.removeAttribute("aria-label"); renderedSvg.delete(node); }
      return;
    }
    const style = getComputedStyle(node), size = parseFloat(style.fontSize) || 16;
    const box = svgLayout(nodes, size, { family: style.fontFamily, weight: style.fontWeight });
    const anchor = node.getAttribute("text-anchor") || style.textAnchor;
    const x = parseFloat(node.getAttribute("x")) || 0, y = parseFloat(node.getAttribute("y")) || 0;
    const left = x - (anchor === "middle" ? box.w / 2 : anchor === "end" ? box.w : 0);
    const glyphs = [], lines = [], rules = [];
    box.paint(left, y, glyphs, lines);
    node.replaceChildren(...glyphs.map(g => {
      const span = document.createElementNS(SVG_NS, "tspan");
      span.setAttribute("x", g.x); span.setAttribute("y", g.y); span.setAttribute("font-size", g.size); span.setAttribute("text-anchor", "start"); span.textContent = g.value; return span;
    }));
    node.dataset.mathSource = source; node.setAttribute("aria-label", source);
    for (const [x1, y1, x2, y2, width] of lines) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", `M${x1} ${y1}L${x2} ${y2}`); path.setAttribute("stroke", style.fill); path.setAttribute("stroke-width", width); path.setAttribute("fill", "none"); path.setAttribute("aria-hidden", "true"); path.classList.add("science-formula-rule");
      if (node.hasAttribute("transform")) path.setAttribute("transform", node.getAttribute("transform"));
      if (node.hasAttribute("visibility")) path.setAttribute("visibility", node.getAttribute("visibility"));
      node.after(path); rules.push(path);
    }
    renderedSvg.set(node, { text: node.textContent, source, rules, signature });
  }

  function observe(root) {
    if (!root) return;
    enhance(root);
    const observer = new MutationObserver(records => {
      const targets = new Set(records.map(r => r.target.nodeType === 3 ? r.target.parentElement : r.target));
      for (const target of targets) if (root.contains(target) || target === root) enhance(target);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["x", "y", "text-anchor", "font-size", "visibility", "transform"] });
    return observer;
  }
  function sourceText(root) {
    if (!root) return "";
    if (root.nodeType === 3) return root.data;
    if (root.dataset?.mathSource !== undefined) return root.dataset.mathSource;
    if (root.tagName === "BR") return "\n";
    if (root.matches?.("script, style, .science-formula-rule")) return "";
    if (root.matches?.(".vfrac")) return `(${sourceText(root.querySelector('.vfrac-num'))})/(${sourceText(root.querySelector('.vfrac-den'))})`;
    const value = [...(root.childNodes || [])].map(sourceText).join("");
    if (root.matches?.("sup,sub")) return `${root.tagName === 'SUP' ? '^' : '_'}{${value}}`;
    return /^(P|DIV|LI|H[1-6]|SECTION|ARTICLE|TR)$/.test(root.tagName || "") ? `${value}\n` : value;
  }
  function installCopy() {
    document.addEventListener("copy", event => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed || !event.clipboardData || /^(?:INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
      const range = selection.getRangeAt(0).cloneRange();
      const mathParent = node => {
        let math = (node.nodeType === 1 ? node : node.parentElement)?.closest("[data-math-source]");
        while (math?.parentElement?.closest("[data-math-source]")) math = math.parentElement.closest("[data-math-source]");
        return math;
      };
      const start = mathParent(range.startContainer), end = mathParent(range.endContainer);
      if (start) range.setStartBefore(start); if (end) range.setEndAfter(end);
      const fragment = range.cloneContents();
      if (!fragment.querySelector("[data-math-source], .vfrac")) return;
      event.clipboardData.setData("text/plain", sourceText(fragment)); event.preventDefault();
    });
  }
  const api = Object.freeze({ parse, normalizeTex, appendText, enhance, observe, html, setHtml, sourceText, installCopy });
  if (typeof window !== "undefined") window.ScienceFormula = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
