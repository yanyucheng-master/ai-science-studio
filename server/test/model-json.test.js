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

// Adversarial review (2026-10-10): commands missing from a word list, row breaks in
// equation systems and newline false positives.
test('any \\b or \\f before a letter is LaTeX, never a backspace or form feed', () => {
  const raw = String.raw`{"a":"力是矢量：\(\bm{F}=m\bm{a}\)","b":"\bigcirc \blacksquare \bcancel{x} \boxplus","c":"\footnotesize \fallingdotseq"}`;
  const parsed = parseModelJson(raw);
  assert.equal(parsed.a, String.raw`力是矢量：\(\bm{F}=m\bm{a}\)`);
  assert.equal(parsed.b, String.raw`\bigcirc \blacksquare \bcancel{x} \boxplus`);
  assert.equal(parsed.c, String.raw`\footnotesize \fallingdotseq`);
  assert.ok(!/[\u0000-\u001f]/.test(parsed.a + parsed.b + parsed.c));
});

test('row breaks in single-backslash equation systems keep their rows', () => {
  const cases = parseModelJson(String.raw`{"s":"联立得 \(\begin{cases}F-f=ma\\f=\mu mg\end{cases}\)"}`).s;
  assert.equal(cases, String.raw`联立得 \(\begin{cases}F-f=ma\\f=\mu mg\end{cases}\)`);
  const kinematics = parseModelJson(String.raw`{"s":"\(\begin{cases}v_{1}=v_{0}+at\\v_{1}^{2}-v_{0}^{2}=2as\end{cases}\)"}`).s;
  assert.equal(kinematics, String.raw`\(\begin{cases}v_{1}=v_{0}+at\\v_{1}^{2}-v_{0}^{2}=2as\end{cases}\)`);
  const spaced = parseModelJson(String.raw`{"s":"\(\begin{cases}x+y=3 \\ x-y=1\\2x+y=5\end{cases}\)"}`).s;
  assert.equal(spaced, String.raw`\(\begin{cases}x+y=3 \\ x-y=1\\2x+y=5\end{cases}\)`);
  const aligned = parseModelJson(String.raw`{"s":"\(\begin{aligned}a&=b\\&=c\\\frac{1}{2}&=d\end{aligned}\)"}`).s;
  assert.equal(aligned, String.raw`\(\begin{aligned}a&=b\\&=c\\\frac{1}{2}&=d\end{aligned}\)`);
});

test('correctly escaped row breaks and double-escaped commands are unchanged', () => {
  const value = { s: String.raw`\(\begin{cases}x+y=3\\x-y=1\end{cases}\)`, t: String.raw`\(a=\frac{F}{m}\)` };
  assert.deepEqual(parseModelJson(JSON.stringify(value)), value);
  const mixed = parseModelJson(String.raw`{"s":"\\(a=\\frac{F}{m}\\)，再由 \(v=at\) 得 \(\frac{1}{2}\)"}`).s;
  assert.equal(mixed, String.raw`\(a=\frac{F}{m}\)，再由 \(v=at\) 得 \(\frac{1}{2}\)`);
});

test('negated and textbook relation commands are not lost to newlines or tabs', () => {
  const parsed = parseModelJson(String.raw`{"a":"\(p\Rightarrow q\)，但 \(q\nRightarrow p\)","b":"\(x\ngeqslant 3\)，\(y\nleqslant 1\)","c":"\(\textcolor{red}{F=ma}\)，\(\textstyle\frac{1}{2}\)，\(\tbinom{5}{2}\)"}`);
  assert.equal(parsed.a, String.raw`\(p\Rightarrow q\)，但 \(q\nRightarrow p\)`);
  assert.equal(parsed.b, String.raw`\(x\ngeqslant 3\)，\(y\nleqslant 1\)`);
  assert.equal(parsed.c, String.raw`\(\textcolor{red}{F=ma}\)，\(\textstyle\frac{1}{2}\)，\(\tbinom{5}{2}\)`);
});

test('a real newline before e, u or o stays a newline in correctly escaped text', () => {
  const value = { a: String.raw`已知电子电荷量：` + '\n' + String.raw`e=1.6\times10^{-19}\ \mathrm{C}`, b: String.raw`\(v=u+at\)，其中` + '\n' + 'u 为初速度', c: '列表：\tto do' };
  assert.deepEqual(parseModelJson(JSON.stringify(value)), value);
});

test('short commands such as \\ne and \\nu are LaTeX in single-backslash text', () => {
  const parsed = parseModelJson(String.raw`{"a":"\(a\ne 0\)","b":"\(c=\lambda\nu\)","c":"\(x\to 0\)，\(\tan\theta\)"}`);
  assert.equal(parsed.a, String.raw`\(a\ne 0\)`);
  assert.equal(parsed.b, String.raw`\(c=\lambda\nu\)`);
  assert.equal(parsed.c, String.raw`\(x\to 0\)，\(\tan\theta\)`);
});

test('an unclosed fence followed by long whitespace does not stall the event loop', () => {
  const started = Date.now();
  assert.deepEqual(parseModelJson('{"a":1} ```json\n' + '\n'.repeat(200000) + 'x'), { a: 1 });
  assert.equal(parseModelJson('```json\n' + ' '.repeat(200000) + 'x'), null);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`);
});

// Second adversarial review (2026-10-10): a row break before a sign, a Chinese
// character or a bracket, and mixed strings whose correct escapes were doubled.
test('single-backslash row breaks before signs, CJK text and brackets stay row breaks', () => {
  const raw = String.raw`{"s":"\(\begin{cases}x=1\\-y=2\\+z=3\\①式\\(a+b)=3\\[x]=1\\|x|<1\\中\end{cases}\)"}`;
  assert.equal(parseModelJson(raw).s, String.raw`\(\begin{cases}x=1\\-y=2\\+z=3\\①式\\ (a+b)=3\\ [x]=1\\|x|<1\\中\end{cases}\)`);
  const array = parseModelJson(String.raw`{"s":"\(\left\{\begin{array}{l}F-f=ma\\mg-N=0\end{array}\right.\)"}`).s;
  assert.equal(array, String.raw`\(\left\{\begin{array}{l}F-f=ma\\mg-N=0\end{array}\right.\)`);
});

test('correct escapes in a mixed string are not turned into row breaks', () => {
  const raw = String.raw`{"s":"速度 \\(v=2\\ \\mathrm{m/s}\\)，\\(\\triangle ABC\\cong\\triangle DEF\\)，\\(\\odot O\\)，\\(x\\in\\mathbb{R}\\)，由 \(a=\frac{F}{m}\)"}`;
  assert.equal(parseModelJson(raw).s, String.raw`速度 \(v=2\ \mathrm{m/s}\)，\(\triangle ABC\cong\triangle DEF\)，\(\odot O\)，\(x\in\mathbb{R}\)，由 \(a=\frac{F}{m}\)`);
  const rows = String.raw`{"s":"\\(\\begin{cases}x+y=3\\\\x-y=1\\\\2x=4\\end{cases}\\)，再由 \(v=at\)"}`;
  assert.equal(parseModelJson(rows).s, String.raw`\(\begin{cases}x+y=3\\x-y=1\\2x=4\end{cases}\)，再由 \(v=at\)`);
  const spaced = String.raw`{"s":"\\(\\begin{cases}v=2\\ \\mathrm{m/s}\\\\a=1\\end{cases}\\)，\(\frac{1}{2}\)"}`;
  assert.equal(parseModelJson(spaced).s, String.raw`\(\begin{cases}v=2\ \mathrm{m/s}\\a=1\end{cases}\)，\(\frac{1}{2}\)`);
});

test('an under-escaped row break inside a correctly escaped environment becomes a row break', () => {
  const raw = String.raw`{"s":"\\(\\begin{cases}x=1\\y=2\\2x=3\\-z=0\\end{cases}\\)","t":"\\(\\begin{aligned}a&=b\\&=c\\end{aligned}\\)"}`;
  const parsed = parseModelJson(raw);
  assert.equal(parsed.s, String.raw`\(\begin{cases}x=1\\y=2\\2x=3\\-z=0\end{cases}\)`);
  assert.equal(parsed.t, String.raw`\(\begin{aligned}a&=b\\&=c\end{aligned}\)`);
  const value = { s: String.raw`\(\begin{cases}x=1\\ (y)=2\end{cases}\)`, t: String.raw`\(\left\{x\right\}\ \{y\}\)` };
  assert.deepEqual(parseModelJson(JSON.stringify(value)), value);
});

test('each environment keeps its own row-break style within one answer', () => {
  const raw = String.raw`{"s":"由 \\(\\begin{cases}x+y=5\\\\x-y=1\\end{cases}\\) 得 \(\begin{cases}ax+by=2\\bx+ay=4\\mg=\rho Vg\\ -x+y=1\end{cases}\)"}`;
  assert.equal(parseModelJson(raw).s, String.raw`由 \(\begin{cases}x+y=5\\x-y=1\end{cases}\) 得 \(\begin{cases}ax+by=2\\bx+ay=4\\mg=\rho Vg\\ -x+y=1\end{cases}\)`);
});

test('a long run of backslashes does not stall the event loop', () => {
  const started = Date.now();
  const raw = `{"s":"${'\\\\'.repeat(40000)}x${'\\\\'.repeat(40000)}\\begin{cases}a\\\\b\\end{cases}"}`;
  assert.equal(parseModelJson(raw).s.slice(-30), String.raw`\\\begin{cases}a\\b\end{cases}`);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started}ms`);
});
