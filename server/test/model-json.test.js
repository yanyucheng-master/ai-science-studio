import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModelJson, parseModelJson } from '../src/model-json.js';

test('invalid JSON escapes from LaTeX become literal backslashes', () => {
  const raw = String.raw`{"a":"\(v^{2}\)","b":"\mathrm{m}\cdot\mathrm{s}^{-1}","c":"\sqrt{2}\,\Delta x","d":"\ce{CuSO4}","e":"\underline{x}\{y\}"}`;
  assert.deepEqual(parseModelJson(raw), {
    a: String.raw`\(v^{2}\)`,
    b: String.raw`\mathrm{m}\cdot\mathrm{s}^{-1}`,
    c: String.raw`\sqrt{2}\,\Delta x`,
    d: String.raw`\ce{CuSO4}`,
    e: String.raw`\underline{x}\{y\}`
  });
});

test('LaTeX commands that look like JSON escapes are not turned into control characters', () => {
  const raw = String.raw`{"f":"\frac{1}{2}","t":"2\times 3\text{ m}\theta\tau\tan x\to\therefore","b":"\beta\bar{v}\boxed{1}","n":"\nu\neq\ne\nabla\neg","r":"\rho\right)\rm\rightleftharpoons"}`;
  const parsed = parseModelJson(raw);
  assert.equal(parsed.f, String.raw`\frac{1}{2}`);
  assert.equal(parsed.t, String.raw`2\times 3\text{ m}\theta\tau\tan x\to\therefore`);
  assert.equal(parsed.b, String.raw`\beta\bar{v}\boxed{1}`);
  assert.equal(parsed.n, String.raw`\nu\neq\ne\nabla\neg`);
  assert.equal(parsed.r, String.raw`\rho\right)\rm\rightleftharpoons`);
  assert.ok(!/[\u0000-\u001f]/.test(JSON.stringify(Object.values(parsed)).replace(/\\[nrt]/g, '')));
});

test('genuine JSON escapes keep their meaning', () => {
  const raw = '{"text":"第一步\\n第二步\\t对齐\\"引号\\" \\\\ 反斜杠 \\u4e2d \\/ \\nThe end","next":"\\n1. 列式"}';
  assert.deepEqual(parseModelJson(raw), JSON.parse(raw));
  assert.equal(parseModelJson(raw).text, '第一步\n第二步\t对齐"引号" \\ 反斜杠 中 / \nThe end');
});

test('correctly escaped LaTeX passes through unchanged', () => {
  const value = {
    steps: [String.raw`列式：\(v^{2}-v_{0}^{2}=2as\)`, String.raw`代入：\(s=\frac{20^{2}}{2\times 5}=40\ \mathrm{m}\)`],
    formulas: [String.raw`s=\frac{v_{0}^{2}}{2a}`, String.raw`\ce{Fe + CuSO4 -> FeSO4 + Cu}`],
    finalAnswer: '刹车距离为 40 m\n（方向：沿运动方向）',
    note: 'tab\there "quoted" back\\slash \u4e2d'
  };
  const raw = JSON.stringify(value);
  assert.equal(normalizeModelJson(raw), raw);
  assert.deepEqual(parseModelJson(raw), value);
});

test('mixed correct and single backslashes in one answer', () => {
  const raw = String.raw`{"steps":["\\(a=\\frac{F}{m}\\)，再由 \(v=at\) 得 \(\frac{1}{2}\)"]}`;
  assert.equal(parseModelJson(raw).steps[0], String.raw`\(a=\frac{F}{m}\)，再由 \(v=at\) 得 \(\frac{1}{2}\)`);
});

test('raw line breaks inside strings, trailing commas, fences and surrounding text', () => {
  assert.deepEqual(parseModelJson('{"summary":"第一行\n第二行\t对齐","steps":["a","b",],}'), { summary: '第一行\n第二行\t对齐', steps: ['a', 'b'] });
  assert.deepEqual(parseModelJson('```json\n{"mode":"hint","summary":"先看受力"}\n```'), { mode: 'hint', summary: '先看受力' });
  assert.deepEqual(parseModelJson('好的，以下是回答：{"mode":"hint","summary":"x"} 希望有帮助'), { mode: 'hint', summary: 'x' });
  assert.deepEqual(parseModelJson('\uFEFF{"mode":"hint","summary":"x"}'), { mode: 'hint', summary: 'x' });
});

test('commas and backslashes inside strings are not mistaken for syntax', () => {
  const raw = String.raw`{"a":"1, ]","b":"x,}","c":"路径 C:\\data\\new","d":"\\"}`;
  assert.deepEqual(parseModelJson(raw), { a: '1, ]', b: 'x,}', c: String.raw`路径 C:\data\new`, d: '\\' });
});

test('anything that is not a JSON object is rejected', () => {
  for (const value of ['', '   ', 'not-json', '[1,2]', '"text"', '42', 'null', '{"a":', '{"a":"unterminated}']) {
    assert.equal(parseModelJson(value), null, JSON.stringify(value));
  }
});

test('normalization never changes the meaning of correctly escaped JSON', () => {
  const samples = [
    { a: '' }, { a: '\\' }, { a: '\\\\' }, { a: '"\\"' }, { a: '\n\r\t\b\f' }, { a: '\u0001\u001f' },
    { a: 'x\\frac', b: ['\\(', '\\)', '\\times'] }, { nested: { list: [1, 2.5, true, null, 'a,]}'] } },
    { a: 'é漢字😀', b: '\u2028\u2029' }
  ];
  for (const sample of samples) {
    const raw = JSON.stringify(sample);
    assert.deepEqual(JSON.parse(normalizeModelJson(raw)), sample, raw);
    const pretty = JSON.stringify(sample, null, 2);
    assert.deepEqual(JSON.parse(normalizeModelJson(pretty)), sample, pretty);
  }
});
