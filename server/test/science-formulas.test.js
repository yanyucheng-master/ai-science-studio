import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const formula = createRequire(import.meta.url)('../../web/science-formulas.js');

const cases = [
  ['1/2gt²', '\\frac{1}{2}gt^{2}'],
  ['m/M', '\\frac{m}{M}'], ['G/(3F)', '\\frac{G}{3F}'],
  ['5.6 g ÷ 56 g/mol', '\\frac{5.6 g}{56 \\mathrm{g/mol}}'],
  ['340 m/s ÷ 600 Hz', '\\frac{340 \\mathrm{m/s}}{600 Hz}'],
  ['W有/W总', '\\frac{W_{\\text{有}}}{W_{\\text{总}}}'],
  ['1/R并', '\\frac{1}{R_{\\text{并}}}'],
  ['R₁R₂/(R₁+R₂)', '\\frac{R_{1}R_{2}}{R_{1}+R_{2}}'],
  ['v₀²/(2a)', '\\frac{v_{0}^{2}}{2a}'],
  ['U/(R₁+R₂)', '\\frac{U}{R_{1}+R_{2}}'],
  ['dv/dt', '\\frac{dv}{dt}'], ['m dv/dt', 'm \\frac{dv}{dt}'],
  ['√(2h/g)', '\\sqrt{\\frac{2h}{g}}'],
  ['1/(2√x)', '\\frac{1}{2\\sqrt{x}}'],
  ['μmg/M', '\\frac{μmg}{M}'],
  ['v₀²/(2μg(1+m/M))', '\\frac{v_{0}^{2}}{2μg(1+\\frac{m}{M})}'],
  ['F浮=G排=ρ液gV排', 'F_{\\text{浮}}=G_{\\text{排}}=ρ_{\\text{液}}gV_{\\text{排}}'],
  ['Q吸=Q放', 'Q_{\\text{吸}}=Q_{\\text{放}}'],
  ['a_A', 'a_{A}'], ['e^{-kt/m}', 'e^{−\\frac{kt}{m}}'],
  ['v0^2', 'v_{0}^{2}'], ['0^2', '0^{2}'], ['(20)^2', '(20)^{2}'],
  ['(-400)/(-10)', '\\frac{−400}{−10}'],
  ['W额+R总+F示+F压+Q放+G排+V排', 'W_{\\text{额}}+R_{\\text{总}}+F_{\\text{示}}+F_{\\text{压}}+Q_{\\text{放}}+G_{\\text{排}}+V_{\\text{排}}'],
  ['CuSO₄', 'CuSO_{4}'], ['Cu²⁺', 'Cu^{2+}'],
  ['m/s²', '\\mathrm{m/s^{2}}'], ['kg/m³', '\\mathrm{kg/m^{3}}'],
  ['J/(kg·℃)', '\\mathrm{J/(kg·℃)}'],
  ['m²/s²', '\\mathrm{m^{2}/s^{2}}'], ['g/mol', '\\mathrm{g/mol}'],
  ['1/f+1/u=1/v', '\\frac{1}{f}+\\frac{1}{u}=\\frac{1}{v}'],
  ['a/b/c', '\\frac{\\frac{a}{b}}{c}'],
  ['sin(x)/cos(x)', '\\frac{\\sin (x)}{\\cos (x)}'],
  ['\\sin x/\\cos x', '\\frac{\\sin x}{\\cos x}'],
  ['n(Fe)/n(Cu)', '\\frac{n(Fe)}{n(Cu)}'],
  ['mv₀/k(1−e^{-kt/m})', '\\frac{mv_{0}}{k}(1−e^{−\\frac{kt}{m}})'],
  ['B/b 这对基因同理', 'B/b 这对基因同理'],
  ['0.1mol / 6.4g', '0.1mol / 6.4g'],
  ['https://example.com/a/b?q=1/2', 'https://example.com/a/b?q=1/2'],
  ['初中/高中', '初中/高中'], ['API/JSON', 'API/JSON'],
  ['\\frac{W_{\\text{有}}}{W_{\\text{总}}}', '\\frac{W_{\\text{有}}}{W_{\\text{总}}}'],
  ['\\dfrac{1}{2}', '\\dfrac{1}{2}'],
  ['P(A\\_B\\_)=9/16', 'P(A\\_B\\_)=\\frac{9}{16}'],
  ['\\ce{2H2 + O2 -> 2H2O}', '\\ce{2H2 + O2 -> 2H2O}'],
  ['\\begin{cases}x^2&x>0\\\\-x&x<0\\end{cases}', '\\begin{cases}x^2&x>0\\\\-x&x<0\\end{cases}'],
  ['\\left(\\frac{1}{x}\\right)^2', '\\left(\\frac{1}{x}\\right)^2'],
  ['\\left(W有/W总\\right)', '\\left(\\frac{W_{\\text{有}}}{W_{\\text{总}}}\\right)'],
  ['\\begin{aligned}η&=W有/W总\\\\x&=1/2\\end{aligned}', '\\begin{aligned}η&=\\frac{W_{\\text{有}}}{W_{\\text{总}}}\\\\x&=\\frac{1}{2}\\end{aligned}'],
  ['\\mathrm{m}/\\mathrm{s}^{2}', '\\mathrm{m}/\\mathrm{s}^{2}']
];
for (const [input, expected] of cases) test(`display notation: ${input}`, () => {
  assert.equal(formula.normalizeTex(input), expected);
});
test('display parser has bounded depth for untrusted nested source', () => {
  const source = '('.repeat(100) + '1/2' + ')'.repeat(100);
  assert.doesNotThrow(() => formula.parse(source));
});
test('long slash chains retain their source without a recursive rendering tree', () => {
  const source = Array(8000).fill('a').join('/');
  assert.equal(formula.normalizeTex(source), source);
});
