// Tolerant parsing of the model's JSON answer.
//
// The tutor prompt asks for LaTeX inside JSON strings. Models regularly write
// a single backslash (\( \frac \mathrm), which is either an invalid JSON escape
// (JSON.parse throws) or a valid one with the wrong meaning (\f, \t, \b, \n, \r
// turn \frac, \times, \beta, \nu, \rho into control characters). Inside string
// literals this pass keeps genuine JSON escapes and turns LaTeX backslashes into
// literal ones. Correctly escaped output passes through unchanged.

// LaTeX commands whose first letter is also a JSON escape letter (b f n r t).
const LATEX_ESCAPE_WORDS = new Set([
  // b
  'bar', 'beta', 'because', 'begin', 'bf', 'big', 'bigg', 'biggl', 'biggr', 'bigl', 'bigr', 'bigcap', 'bigcup',
  'binom', 'bmod', 'boldsymbol', 'bot', 'boxed', 'breve', 'bullet', 'backslash', 'blacktriangle',
  // f
  'frac', 'forall', 'flat', 'frown', 'fbox', 'framebox',
  // n
  'nu', 'ne', 'neq', 'nabla', 'neg', 'not', 'notin', 'nleq', 'ngeq', 'nless', 'ngtr', 'nmid', 'natural',
  'newline', 'nolimits', 'nsubseteq', 'nexists', 'nearrow', 'nwarrow', 'nparallel',
  // r
  'rho', 'right', 'rightarrow', 'rightleftharpoons', 'rightharpoonup', 'rightleftarrows', 'rm', 'rangle',
  'rceil', 'rfloor', 'rbrace', 'rbrack', 'rvert', 'rVert', 'rtimes', 'ring', 'raisebox',
  // t
  'times', 'text', 'textrm', 'textbf', 'textit', 'textsf', 'texttt', 'textup', 'textnormal', 'textcircled',
  'textdegree', 'tfrac', 'theta', 'tau', 'tan', 'tanh', 'to', 'top', 'triangle', 'triangleq', 'therefore',
  'tilde', 'thinspace', 'tiny', 'tt', 'triangledown', 'triangleleft', 'triangleright'
]);

function latexWordAt(source, start) {
  const match = /^[A-Za-z]+/.exec(source.slice(start, start + 32));
  return Boolean(match) && LATEX_ESCAPE_WORDS.has(match[0]);
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
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (!inString) {
      if (char === '"') inString = true;
      // Trailing commas before a closing bracket are a common model slip.
      if (char === ',' && /[}\]]/.test(nextNonSpace(source, index + 1))) continue;
      output += char;
      continue;
    }
    if (char === '"') {
      inString = false;
      output += char;
      continue;
    }
    if (char === '\\') {
      const next = source[index + 1];
      if (next === '\\' || next === '"' || next === '/') {
        output += char + next;
        index += 1;
        continue;
      }
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(index + 2, index + 6))) {
        output += source.slice(index, index + 6);
        index += 5;
        continue;
      }
      if (next && 'bfnrt'.includes(next) && !latexWordAt(source, index + 1)) {
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

function tryParseObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Returns the parsed object, or null when no candidate is a JSON object.
export function parseModelJson(content) {
  const source = String(content ?? '').replace(/^﻿/, '').trim();
  if (!source) return null;
  const candidates = [source];
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(source.slice(start, end + 1));
  for (const candidate of candidates) {
    const parsed = tryParseObject(normalizeModelJson(candidate)) || tryParseObject(candidate);
    if (parsed) return parsed;
  }
  return null;
}
