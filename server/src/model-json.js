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
// Commands that may follow a doubled backslash. In a single-backslash string,
// "\\" before anything else is a LaTeX row break (cases, aligned).
const COMMON_COMMANDS = new Set([
  ...LATEX_NRT_WORDS, ...AMBIGUOUS_NRT_WORDS,
  'alpha', 'approx', 'angle', 'arccos', 'arcsin', 'arctan', 'bar', 'because', 'begin', 'beta', 'bf', 'bigcirc',
  'binom', 'bm', 'boldsymbol', 'bot', 'boxed', 'cap', 'cdot', 'cdots', 'ce', 'cfrac', 'chi', 'circ', 'cos', 'cot',
  'cup', 'dagger', 'ddot', 'deg', 'degree', 'Delta', 'delta', 'dfrac', 'displaystyle', 'div', 'dot', 'dots',
  'downarrow', 'ell', 'emptyset', 'end', 'epsilon', 'equiv', 'eta', 'exp', 'forall', 'frac', 'Gamma', 'gamma',
  'ge', 'geq', 'geqslant', 'gg', 'hat', 'hbar', 'in', 'infty', 'int', 'iota', 'kappa', 'Lambda', 'lambda',
  'land', 'langle', 'lceil', 'ldots', 'le', 'left', 'leftarrow', 'Leftarrow', 'leftrightarrow',
  'Leftrightarrow', 'leq', 'leqslant', 'lfloor', 'lg', 'lim', 'll', 'ln', 'log', 'longrightarrow', 'lor', 'max',
  'mathbf', 'mathrm', 'mathit', 'mid', 'min', 'mp', 'mu', 'Omega', 'omega', 'operatorname', 'overline',
  'overrightarrow', 'parallel', 'partial', 'perp', 'Phi', 'phi', 'Pi', 'pi', 'pm', 'prime', 'prod', 'propto',
  'Psi', 'psi', 'pu', 'qquad', 'quad', 'Rightarrow', 'Sigma', 'sigma', 'sim', 'simeq', 'sin', 'sqrt', 'square',
  'subset', 'subseteq', 'sum', 'supset', 'supseteq', 'Theta', 'underline', 'uparrow', 'upsilon', 'varepsilon',
  'varphi', 'vec', 'vee', 'wedge', 'widehat', 'xi', 'xrightarrow', 'zeta'
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

function normalizeStringBody(body) {
  const single = writtenWithSingleBackslashes(body);
  if (!single && !/[\u0000-\u001f]/.test(body)) return body;
  let output = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\') {
      const next = body[index + 1];
      if (next === '\\') {
        // A doubled backslash is an escaped backslash, except that a
        // single-backslash string uses it for LaTeX row breaks.
        const after = body[index + 2];
        const word = letterRun(body, index + 2);
        const rowBreak = single && (after === undefined || /[\s\d&\\]/.test(after) ||
          (word.length > 0 && (word.length === 1 || !COMMON_COMMANDS.has(word))));
        output += rowBreak ? '\\\\\\\\' : '\\\\';
        index += 1;
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
