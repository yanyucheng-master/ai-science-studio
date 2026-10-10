// Tolerant parsing of the model's JSON answer.
//
// The tutor prompt asks for LaTeX inside JSON strings. Models regularly write
// a single backslash (\( \frac \mathrm), which is either an invalid JSON escape
// (JSON.parse throws) or a valid one with the wrong meaning (\f, \t, \b, \n, \r
// turn \frac, \times, \beta, \nu, \rho into control characters). Each string
// literal is read twice: first to see whether it is written in this
// single-backslash style, then to keep genuine JSON escapes and turn LaTeX
// backslashes into literal ones. Correctly escaped output passes through
// unchanged.

// Commands starting with a JSON escape letter. \b or \f followed by a letter is
// always LaTeX (a backspace or form feed never belongs in tutor text); n, r and
// t need the word to be a known command because \n and \t are common in text.
const LATEX_NRT_WORDS = new Set([
  'nabla', 'natural', 'nearrow', 'neq', 'nexists', 'ngeq', 'ngeqq', 'ngeqslant', 'ngtr', 'nleftarrow',
  'nLeftarrow', 'nleftrightarrow', 'nLeftrightarrow', 'nleq', 'nleqq', 'nleqslant', 'nless', 'nmid', 'ncong',
  'newline', 'nolimits', 'nonumber', 'notag', 'notin', 'nparallel', 'nrightarrow', 'nRightarrow', 'nsim',
  'nsubseteq', 'nsupseteq', 'nwarrow',
  'rangle', 'rbrace', 'rbrack', 'rceil', 'rfloor', 'rho', 'right', 'rightarrow', 'rightharpoondown',
  'rightharpoonup', 'rightleftarrows', 'rightleftharpoons', 'rightrightarrows', 'raisebox', 'rlap', 'rtimes',
  'rVert', 'rvert',
  'tbinom', 'text', 'textbf', 'textcircled', 'textcolor', 'textdegree', 'textit', 'textnormal', 'textrm',
  'textsf', 'textstyle', 'texttt', 'textup', 'tfrac', 'therefore', 'theta', 'thicksim', 'thickspace',
  'thinspace', 'tilde', 'times', 'tiny', 'triangle', 'triangledown', 'triangleleft', 'triangleq',
  'triangleright', 'twoheadrightarrow'
]);
// Short commands that are also plausible text after a real newline or tab
// ("\ne=1.6×10^-19" may be a line break before e). They count as LaTeX only in
// a string that is clearly written with single backslashes.
const AMBIGUOUS_NRT_WORDS = new Set(['ne', 'neg', 'ni', 'not', 'nu', 'rm', 'ring', 'tan', 'tanh', 'tau', 'to', 'top', 'tt']);
// Commands that may follow a doubled backslash. Inside an environment, "\\"
// before anything else is a LaTeX row break (cases, aligned, array).
const COMMON_COMMANDS = new Set([
  ...LATEX_NRT_WORDS, ...AMBIGUOUS_NRT_WORDS,
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'vartheta', 'iota', 'kappa', 'lambda',
  'mu', 'xi', 'pi', 'varpi', 'varrho', 'sigma', 'varsigma', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  'acute', 'aleph', 'amalg', 'angle', 'approx', 'approxeq', 'arccos', 'arcsin', 'arctan', 'arg', 'ast', 'asymp',
  'backsim', 'backslash', 'bar', 'barwedge', 'because', 'begin', 'bf', 'big', 'Big', 'bigcap', 'bigcirc', 'bigcup',
  'bigg', 'Bigg', 'biggl', 'biggr', 'bigl', 'Bigl', 'bigodot', 'bigoplus', 'bigotimes', 'bigr', 'Bigr', 'bigstar',
  'bigsqcup', 'biguplus', 'bigvee', 'bigwedge', 'binom', 'blacksquare', 'blacktriangle', 'bm', 'bmod', 'boldsymbol',
  'bot', 'Box', 'boxdot', 'boxed', 'boxminus', 'boxplus', 'boxtimes', 'breve', 'bullet', 'cancel', 'bcancel', 'cap',
  'cdot', 'cdotp', 'cdots', 'ce', 'cfrac', 'check', 'checkmark', 'circ', 'circledcirc', 'clubsuit', 'color',
  'colorbox', 'complement', 'cong', 'coprod', 'cos', 'cosh', 'cot', 'coth', 'csc', 'cup', 'dagger', 'ddagger',
  'dashv', 'ddot', 'dddot', 'ddots', 'deg', 'degree', 'det', 'dfrac', 'diamond', 'Diamond', 'diamondsuit', 'dim',
  'displaystyle', 'div', 'divideontimes', 'dot', 'doteq', 'dotplus', 'dots', 'dotsb', 'dotsc', 'downarrow',
  'Downarrow', 'downharpoonleft', 'downharpoonright', 'ell', 'emph', 'emptyset', 'end', 'enspace', 'eqref',
  'equiv', 'exists', 'exp', 'fbox', 'flat', 'forall', 'frac', 'frown', 'gcd', 'ge', 'geq', 'geqq', 'geqslant', 'gets',
  'gg', 'grave', 'gt', 'gtrsim', 'hat', 'hbar', 'heartsuit', 'hline', 'hom', 'hookleftarrow', 'hookrightarrow',
  'hphantom', 'hslash', 'hspace', 'huge', 'Huge', 'iff', 'iiint', 'iint', 'Im', 'imath', 'impliedby', 'implies', 'in',
  'inf', 'infty', 'int', 'intercal', 'jmath', 'kern', 'ker', 'land', 'langle', 'large', 'Large', 'LARGE', 'lbrace',
  'lbrack', 'lceil', 'ldots', 'le', 'leadsto', 'left', 'leftarrow', 'Leftarrow', 'leftharpoondown',
  'leftharpoonup', 'leftleftarrows', 'leftrightarrow', 'Leftrightarrow', 'leftrightarrows',
  'leftrightharpoons', 'leq', 'leqq', 'leqslant', 'lesssim', 'lfloor', 'lg', 'lgroup', 'lim', 'liminf', 'limits',
  'limsup', 'll', 'ln', 'lnot', 'log', 'longleftarrow', 'Longleftarrow', 'longleftrightarrow',
  'Longleftrightarrow', 'longmapsto', 'longrightarrow', 'Longrightarrow', 'lor', 'lozenge', 'lparen', 'lt',
  'lVert', 'lvert', 'ltimes', 'mapsto', 'mathbb', 'mathbf', 'mathcal', 'mathfrak', 'mathit', 'mathop', 'mathrel',
  'mathring', 'mathrm', 'mathscr', 'mathsf', 'mathtt', 'max', 'measuredangle', 'mho', 'mid', 'min', 'mkern',
  'mod', 'models', 'mp', 'odot', 'oint', 'ominus', 'operatorname', 'oplus', 'oslash', 'otimes', 'over',
  'overbrace', 'overgroup', 'overleftarrow', 'overleftrightarrow', 'overline', 'overrightarrow', 'overset',
  'parallel', 'partial', 'perp', 'phantom', 'pm', 'pmod', 'pod', 'Pr', 'prec', 'preceq', 'prime', 'prod', 'propto',
  'pu', 'qquad', 'quad', 'Re', 'Rightarrow', 'scriptscriptstyle', 'scriptsize', 'scriptstyle', 'searrow', 'sec',
  'setminus', 'sharp', 'sim', 'simeq', 'sin', 'sinh', 'small', 'smallsetminus', 'smile', 'space', 'spadesuit',
  'sphericalangle', 'sqcap', 'sqcup', 'sqrt', 'square', 'stackrel', 'star', 'subset', 'subseteq', 'subsetneq',
  'succ', 'succeq', 'sum', 'sup', 'supset', 'supseteq', 'supsetneq', 'swarrow', 'tag', 'underbrace', 'undergroup',
  'underline', 'underset', 'uparrow', 'Uparrow', 'updownarrow', 'Updownarrow', 'uplus', 'Vert', 'vert', 'vdash',
  'vdots', 'vec', 'vee', 'veebar', 'vphantom', 'wedge', 'widecheck', 'widehat', 'widetilde', 'wp', 'xcancel',
  'xleftarrow', 'xLeftarrow', 'xleftrightarrow', 'xlongequal', 'xrightarrow', 'xRightarrow', 'xrightleftharpoons'
]);

function letterRun(source, start) {
  return /^[A-Za-z]*/.exec(source.slice(start, start + 40))[0];
}

// True when a string literal body contains a backslash that cannot be a JSON
// escape meant as text: an invalid escape, \b or \f before a letter, \u without
// four hex digits, or a known n/r/t LaTeX command.
function writtenWithSingleBackslashes(body) {
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] !== '\\') continue;
    const next = body[index + 1];
    if (next === '\\' || next === '"' || next === '/') { index += 1; continue; }
    if (next === undefined) return true;
    if (next === 'u') {
      if (/^[0-9a-fA-F]{4}$/.test(body.slice(index + 2, index + 6))) { index += 5; continue; }
      return true;
    }
    if (next === 'b' || next === 'f') {
      if (/[A-Za-z]/.test(body[index + 2] || '')) return true;
      index += 1;
      continue;
    }
    if (next === 'n' || next === 'r' || next === 't') {
      if (LATEX_NRT_WORDS.has(letterRun(body, index + 1))) return true;
      index += 1;
      continue;
    }
    return true;
  }
  return false;
}

// "\" followed by one of these is valid LaTeX (\ , \{, \|, \&, \( ...).
const CONTROL_SYMBOL = /[\s,;:!>{}|#$%&_()[\]]/;

// Where \begin{...} and \end{...} start, however many backslashes are written,
// and whether each environment writes a row break as "\\\\" (correctly
// escaped) somewhere. Answers mix styles from one formula to the next.
function environmentMarks(body) {
  const marks = [];
  const open = [];
  for (const match of body.matchAll(/(?<!\\)\\+(begin|end)\s*\{/g)) {
    if (match[1] === 'begin') {
      const mark = { at: match.index, begin: true, doubled: false };
      open.push(mark);
      marks.push(mark);
    } else {
      const begin = open.pop();
      if (begin) begin.doubled = /\\{4}/.test(body.slice(begin.at, match.index));
      marks.push({ at: match.index, begin: false });
    }
  }
  for (const begin of open) begin.doubled = /\\{4}/.test(body.slice(begin.at));
  return marks;
}

// Decides whether a doubled backslash is a LaTeX row break ("\\" in the decoded
// text) rather than an escaped backslash ("\" in the decoded text, starting a
// command, a control space or a math delimiter).
function doubledIsRowBreak({ single, depth, doubledBreaks, after, word }) {
  if (after === ')' || after === ']') return false;
  if (after === undefined) return single || depth > 0;
  if (depth === 0) {
    // Outside an environment, \cong, "\ " and \( are meant; only a string written
    // with single backslashes uses "\\" before something that is not LaTeX.
    return single && (word.length === 1 || (word.length === 0 && !CONTROL_SYMBOL.test(after)));
  }
  if (word.length > 1 && COMMON_COMMANDS.has(word)) return false;
  // A formula that writes commands with one backslash writes row breaks with two.
  if (single && !doubledBreaks) return true;
  // An environment that writes row breaks as "\\\\" only means a row break where
  // "\" + next cannot be LaTeX, such as a digit, a sign or a lone letter.
  if (word.length > 1) return false;
  return word.length === 1 || after === '&' || after === '(' || after === '[' || !CONTROL_SYMBOL.test(after);
}

function normalizeStringBody(body) {
  const single = writtenWithSingleBackslashes(body);
  const marks = environmentMarks(body);
  if (!single && !marks.length && !/[\u0000-\u001f]/.test(body)) return body;
  const environments = [];
  let nextMark = 0;
  let output = '';
  for (let index = 0; index < body.length; index += 1) {
    while (nextMark < marks.length && marks[nextMark].at < index) {
      if (marks[nextMark].begin) environments.push(marks[nextMark].doubled);
      else environments.pop();
      nextMark += 1;
    }
    const depth = environments.length;
    const char = body[index];
    if (char === '\\') {
      const next = body[index + 1];
      if (next === '\\') {
        let run = 2;
        while (body[index + run] === '\\') run += 1;
        const after = body[index + run];
        let rowBreak;
        if (run === 2) {
          rowBreak = doubledIsRowBreak({ single, depth, doubledBreaks: environments.at(-1), after, word: letterRun(body, index + 2) });
          output += rowBreak ? '\\\\\\\\' : '\\\\';
        } else if (run === 3 && single) {
          // A row break followed by a single-backslash command (\\\frac).
          output += '\\\\\\\\';
        } else {
          // Correctly escaped backslashes; an odd one left over starts the next
          // escape and is read on its own below.
          output += '\\\\'.repeat(Math.floor(run / 2));
          rowBreak = run % 2 === 0 && (run / 2) % 2 === 0;
        }
        // The client reads "\\(" and "\\[" as math delimiters and KaTeX reads
        // "\\[" as a spacing argument: separate a row break from what follows.
        if (rowBreak && depth > 0 && (after === '(' || after === '[')) output += ' ';
        index += (run === 3 && single ? 2 : run - (run % 2)) - 1;
        continue;
      }
      if (next === '"' || next === '/') {
        output += char + next;
        index += 1;
        continue;
      }
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(body.slice(index + 2, index + 6))) {
        output += body.slice(index, index + 6);
        index += 5;
        continue;
      }
      const word = letterRun(body, index + 1);
      const latex = ((next === 'b' || next === 'f') && word.length > 1) ||
        LATEX_NRT_WORDS.has(word) || (single && AMBIGUOUS_NRT_WORDS.has(word));
      if (next && 'bfnrt'.includes(next) && !latex) {
        output += char + next;
        index += 1;
        continue;
      }
      // Invalid escape or LaTeX command: keep the backslash as a literal.
      output += '\\\\';
      continue;
    }
    const code = char.charCodeAt(0);
    if (code < 0x20) {
      output += char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : ' ';
      continue;
    }
    output += char;
  }
  return output;
}

function nextNonSpace(source, start) {
  for (let index = start; index < source.length; index += 1) {
    if (!/\s/.test(source[index])) return source[index];
  }
  return '';
}

export function normalizeModelJson(raw) {
  const source = String(raw ?? '');
  let output = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      // A backslash always takes the next character, so \" never ends a string.
      let end = index + 1;
      while (end < source.length && source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
      output += `"${normalizeStringBody(source.slice(index + 1, Math.min(end, source.length)))}${end < source.length ? '"' : ''}`;
      index = end;
      continue;
    }
    // Trailing commas before a closing bracket are a common model slip.
    if (char === ',' && /[}\]]/.test(nextNonSpace(source, index + 1))) continue;
    output += char;
  }
  return output;
}

function tryParseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parseCandidate(candidate) {
  return tryParseObject(normalizeModelJson(candidate)) || tryParseObject(candidate);
}

// Returns the parsed object, or null when no candidate is a JSON object.
export function parseModelJson(content) {
  const source = String(content ?? '').replace(/^﻿/, '').trim();
  if (!source) return null;
  const direct = parseCandidate(source);
  if (direct) return direct;
  const fenced = source.match(/```(?:json)?([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) {
    const parsed = parseCandidate(fenced[1].trim());
    if (parsed) return parsed;
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  return start >= 0 && end > start ? parseCandidate(source.slice(start, end + 1)) : null;
}
