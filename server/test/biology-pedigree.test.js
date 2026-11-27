import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const box = { console };
box.window = box;
for (const file of ['biology-pedigree-cases.js', 'biology-pedigree-core.js', 'biology-pedigree-questions.js']) {
  vm.runInNewContext(await readFile(new URL('../../web/' + file, import.meta.url), 'utf8'), box);
}
const C = box.MasterLabPedigree, Q = box.MasterLabPedigreeQuestions;
const cases = box.MasterLabPedigreeCases.cases;
const copy = value => JSON.parse(JSON.stringify(value));
const expected = [['AD'], ['AR'], ['XD'], ['XR'], ['AD', 'AR', 'XD', 'XR'], []];

test('six original graphs have independently specified candidate sets', () => {
  cases.forEach((data, index) => assert.deepEqual(Array.from(C.analyze(data).possible), expected[index], data.id));
  assert.equal(cases[1].people.length, 6);
  assert.equal(cases[1].version, 2);
});

test('removing location preserves all compatible modes', () => {
  for (const [id, expectedModes] of [['P03', ['AD', 'AR', 'XD']], ['P04', ['AR', 'XR']]]) {
    const data = copy(Q.find(id)); data.locus = 'unknown';
    assert.deepEqual(Array.from(C.analyze(data).possible), expectedModes);
  }
});

test('AR cross follows independent four equally likely gamete combinations', () => {
  const outcomes = C.offspring(1, 1, 'AR');
  const masses = [0, 1, 2].map(dose => outcomes.filter(row => row.dose === dose)
    .reduce((sum, row) => C.add(sum, row.probability), C.fraction(0)));
  assert.deepEqual(masses.map(C.text), ['1/4', '1/2', '1/4']);
  assert.equal(C.text(C.probability(1, 1, 'AR')), '1/4');
  assert.equal(C.text(C.probability(1, 1, 'AR', 'carrier', 'unaffected')), '2/3');
  assert.equal(C.probability(2, 2, 'AR', 'carrier', 'unaffected'), null);
});

test('XR sex conditional and joint questions have different denominators', () => {
  assert.equal(C.text(C.probability(0, 1, 'XR', 'affected', 'boy')), '1/2');
  assert.equal(C.text(C.probability(0, 1, 'XR', 'affectedBoy')), '1/4');
  const outcomes = C.offspring(0, 1, 'XR');
  assert.deepEqual(Array.from(outcomes, row => row.genotype), ['XᴬXᴬ', 'XᴬXᵃ', 'XᴬY', 'XᵃY']);
  assert.ok(outcomes.every(row => C.text(row.probability) === '1/4'));
});

test('requested probability answers select only the exact conditional or joint event', () => {
  const data = Q.find('P04'), analysis = C.analyze(data);
  const conditional = data.asks[1], joint = data.asks[2];
  for (const [asks, labels, values, denominators] of [
    [conditional, ['boyConditional'], ['1/2'], ['男孩，题设机会为1/2']],
    [joint, ['affectedBoy'], ['1/4'], ['全部子代，机会为1']],
    [conditional + '|' + joint, ['boyConditional', 'affectedBoy'], ['1/2', '1/4'], ['男孩，题设机会为1/2', '全部子代，机会为1']]
  ]) {
    const answers = Array.from(C.requestedProbabilities(data, analysis, asks, 'XR'));
    assert.deepEqual(answers.map(answer => answer.field), labels);
    assert.deepEqual(answers.map(answer => answer.possibilities[0]), values);
    assert.deepEqual(answers.map(answer => answer.denominator), denominators);
  }
  assert.equal(C.requestedProbabilities(data, analysis, '方式判读', 'XR').length, 0);
  assert.throws(() => C.requestedProbabilities(data, analysis, conditional + '|无条件受累概率', 'XR'));
});

test('P02 carrier-only and P05 conditional sets keep the requested event', () => {
  const data = Q.find('P02');
  const answer = C.requestedProbabilities(data, C.analyze(data), data.asks[2], 'AR')[0];
  assert.equal(answer.field, 'carrier');
  assert.equal(answer.possibilities[0], '2/3');
  const multi = Q.find('P05');
  assert.deepEqual(Array.from(C.requestedProbabilities(multi, C.analyze(multi), multi.asks[1], 'AR')[0].possibilities).sort(), ['0', '1/4']);
});

test('P01 II-2 derivation uses the unaffected child to exclude AA', () => {
  const data = Q.find('P01'), explanation = C.genotypeDerivation(data, C.analyze(data), 'II-2', 'AD');
  const text = explanation.lines.join('');
  assert.deepEqual(Array.from(explanation.initial), [1, 2]);
  assert.deepEqual(Array.from(explanation.remaining), [1]);
  for (const fact of ['至少有一个显性A', 'F2', 'III-2为aa', '双亲必须各提供a', 'II-2若为AA无法提供a', '排除AA，剩余Aa']) assert.ok(text.includes(fact), fact);
});

test('P02 per-person proofs distinguish inferred, given and undetermined carriers', () => {
  const data = Q.find('P02'), result = C.analyze(data);
  const father = C.genotypeDerivation(data, result, 'I-1', 'AR');
  assert.equal(father.source, 'inferred');
  assert.ok(father.lines.join('').includes('II-1为aa'));
  assert.ok(father.lines.join('').includes('排除AA，剩余Aa'));
  const given = C.genotypeDerivation(data, result, 'II-4', 'AR');
  assert.equal(given.source, 'given');
  assert.ok(given.lines[0].includes('不是从子女表现推断'));
  const unknown = C.genotypeDerivation(data, result, 'II-2', 'AR');
  assert.equal(unknown.source, 'undetermined');
  assert.ok(unknown.lines.join('').includes('全图仍允许AA或Aa'));
});

test('P05 outsider proof preserves all possibilities without using unknown offspring as evidence', () => {
  const data = Q.find('P05'), result = C.analyze(data);
  for (const mode of ['AR', 'XR']) {
    const proof = C.genotypeDerivation(data, result, 'II-3', mode);
    assert.equal(proof.source, 'undetermined');
    assert.deepEqual(Array.from(proof.remaining), [0, 1]);
    assert.ok(proof.lines.join('').includes('III-1表型未知'));
    assert.ok(proof.lines.join('').includes('不能给未知基因型等权先验'));
  }
});

test('every person in each feasible model has a consistent finite proof, conflicts do not invent genotypes', () => {
  for (const data of cases) {
    const result = C.analyze(data);
    for (const mode of Object.keys(C.modes)) for (const person of data.people) {
      const proof = C.genotypeDerivation(data, result, person.id, mode);
      if (!result.results[mode].possible) assert.equal(proof, null);
      else {
        assert.ok(proof.lines.length >= 2);
        assert.deepEqual(Array.from(proof.remaining), Array.from(result.results[mode].genotypes[person.id]));
      }
    }
  }
});

test('all crosses conserve probability and use male X haploidy', () => {
  for (const mode of Object.keys(C.modes)) for (let father = 0; father <= (mode.startsWith('X') ? 1 : 2); father++) {
    for (let mother = 0; mother <= 2; mother++) {
      const outcomes = C.offspring(father, mother, mode);
      assert.equal(C.text(outcomes.reduce((sum, row) => C.add(sum, row.probability), C.fraction(0))), '1');
      if (mode.startsWith('X')) outcomes.filter(row => row.sex === 'M').forEach(row => {
        assert.equal(row.fatherAllele, 'Y');
        assert.equal(row.dose, row.motherAllele);
        assert.equal(row.carrier, false);
      });
    }
  }
});

test('given carrier and inferred carrier retain different evidence origins', () => {
  const data = Q.find('P02'), result = C.analyze(data);
  assert.equal(C.carrierEvidence(data, result, 'II-4', 'AR').source, 'given');
  for (const id of ['I-1', 'I-2']) assert.equal(C.carrierEvidence(data, result, id, 'AR').source, 'inferred');
  assert.equal(C.carrierEvidence(data, result, 'II-2', 'AR'), null);
  assert.deepEqual(Array.from(result.results.AR.genotypes['II-2']), [0, 1]);
  const withoutGiven = copy(data);
  delete withoutGiven.people.find(p => p.id === 'II-4').carrier;
  assert.deepEqual(Array.from(C.analyze(withoutGiven).results.AR.genotypes['II-4']), [0, 1]);
});

test('P05 unknown outsider remains conditional on genotype and mode', () => {
  const result = C.analyze(Q.find('P05'));
  for (const mode of ['AD', 'XD']) assert.deepEqual(Array.from(result.results[mode].pairs, pair => C.text(pair.probability)), ['0']);
  for (const mode of ['AR', 'XR']) {
    assert.deepEqual(Array.from(result.results[mode].pairs, pair => C.text(pair.probability)).sort(), ['0', '1/4']);
    assert.deepEqual(Array.from(result.results[mode].pairs, pair => pair.mother).sort(), [0, 1]);
  }
});

test('P06 identifies two actual families with mode-specific conflict members', () => {
  const result = C.analyze(Q.find('P06'));
  for (const mode of ['AD', 'XD']) assert.equal(result.results[mode].conflicts[0].family, 'F2');
  for (const mode of ['AR', 'XR']) assert.equal(result.results[mode].conflicts[0].family, 'F1');
  assert.deepEqual(Array.from(result.results.AD.conflicts[0].members), ['II-1', 'II-2', 'III-1']);
});

test('affected daughter exclusion explicitly explains the missing paternal X allele', () => {
  const result = C.analyze(Q.find('P02'));
  const conflict = result.results.XR.conflicts.find(item => item.members.includes('II-1'));
  assert.ok(conflict.text.includes('受累女儿需从父亲得到Xᵃ'));
  assert.ok(conflict.text.includes('未受累父亲XᴬY无法提供'));
});

for (const [name, mutate] of [
  ['duplicate member', data => data.people[1].id = data.people[0].id],
  ['invalid sex', data => data.people[0].sex = 'unknown'],
  ['invalid phenotype', data => data.people[0].phenotype = 'normal'],
  ['cycle', data => data.families[0].children[0] = 'I-1'],
  ['missing father', data => data.families[0].father = 'I-99'],
  ['duplicated child', data => data.families[0].children.push(data.families[0].children[0])],
  ['affected carrier', data => data.people[0].carrier = true],
  ['unknown target', data => data.target = ['I-1', 'II-1']]
]) test('reject malformed graph ' + name, () => {
  const data = copy(cases[0]); mutate(data);
  assert.throws(() => C.analyze(data), error => error.name === 'RangeError');
});

test('conditioning on an observed child restricts an unknown parental genotype', () => {
  const data = copy(Q.find('P05'));
  data.locus = 'autosome';
  // AR father is Aa. The unknown child can become evidence for the outsider.
  data.people.find(p => p.id === 'III-1').phenotype = 'affected';
  const result = C.analyze(data);
  assert.deepEqual(Array.from(result.possible), ['AR']);
  assert.deepEqual(Array.from(result.results.AR.genotypes['II-3']), [1]);
  assert.equal(C.text(result.results.AR.pairs[0].probability), '1/4');
});
