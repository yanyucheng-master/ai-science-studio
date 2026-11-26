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
