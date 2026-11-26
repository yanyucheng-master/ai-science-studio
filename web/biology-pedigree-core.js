(() => {
  'use strict';

  const modes = Object.freeze({ AD: '常染色体显性', AR: '常染色体隐性', XD: '伴X显性', XR: '伴X隐性' });
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  function fraction(n, d = 1) {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0) throw new RangeError('分数需要整数分子和正整数分母');
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
  const multiply = (a, b) => fraction(a.n * b.n, a.d * b.d);
  const text = value => value.d === 1 ? String(value.n) : `${value.n}/${value.d}`;
  const isX = mode => mode.startsWith('X');
  const ploidy = (sex, mode) => isX(mode) && sex === 'M' ? 1 : 2;
  const affected = (dose, sex, mode) => mode.endsWith('D') ? dose > 0 : dose === ploidy(sex, mode);
  const isCarrier = (dose, sex, mode) => mode.endsWith('R') && ploidy(sex, mode) === 2 && dose === 1;

  function genotype(dose, sex, mode) {
    if (!isX(mode)) return (mode === 'AD' ? ['aa', 'Aa', 'AA'] : ['AA', 'Aa', 'aa'])[dose];
    const allele = mode === 'XD' ? ['Xᵈ', 'Xᴰ'] : ['Xᴬ', 'Xᵃ'];
    if (sex === 'M') return allele[dose] + 'Y';
    return dose === 1 ? (mode === 'XD' ? allele[1] + allele[0] : allele[0] + allele[1])
      : allele[dose / 2] + allele[dose / 2];
  }

  function validate(data) {
    if (!data || !['X', 'unknown', 'autosome'].includes(data.locus)
      || !Array.isArray(data.people) || data.people.length < 2 || data.people.length > 12
      || !Array.isArray(data.families) || data.families.length > 5) throw new RangeError('家系结构或定位条件无效');
    const ids = new Set();
    for (const p of data.people) {
      if (!/^(?:I|II|III)-[1-9]\d?$/.test(p.id) || ids.has(p.id)
        || !['M', 'F'].includes(p.sex) || !['affected', 'unaffected', 'unknown'].includes(p.phenotype)
        || !Number.isInteger(p.generation) || p.generation < 1 || p.generation > 3
        || p.id.split('-')[0] !== ['I', 'II', 'III'][p.generation - 1]
        || !Number.isFinite(p.x) || p.x < 40 || p.x > 460
        || p.carrier !== undefined && typeof p.carrier !== 'boolean') throw new RangeError('成员编号、表型或携带事实无效');
      if (p.carrier && p.phenotype === 'affected') throw new RangeError('本题隐性携带者应表型未受累');
      ids.add(p.id);
    }
    const people = Object.fromEntries(data.people.map(p => [p.id, p]));
    const children = new Set(), families = new Set();
    for (const f of data.families) {
      if (families.has(f.id) || !people[f.father] || !people[f.mother]
        || people[f.father].sex !== 'M' || people[f.mother].sex !== 'F'
        || people[f.father].generation !== people[f.mother].generation
        || !Array.isArray(f.children) || !f.children.length) throw new RangeError('配偶或家庭关系无效');
      families.add(f.id);
      for (const id of f.children) {
        if (!people[id] || children.has(id) || people[id].generation !== people[f.father].generation + 1) throw new RangeError('子女重复或跨代关系无效');
        children.add(id);
      }
    }
    if (!Array.isArray(data.target) || data.target.length !== 2
      || !data.families.some(f => f.father === data.target[0] && f.mother === data.target[1])) throw new RangeError('所问配偶不在家系中');
    return people;
  }

  function domain(p, mode) {
    return Array.from({ length: ploidy(p.sex, mode) + 1 }, (_, dose) => dose).filter(dose =>
      (p.phenotype === 'unknown' || affected(dose, p.sex, mode) === (p.phenotype === 'affected'))
      && (p.carrier === undefined || isCarrier(dose, p.sex, mode) === p.carrier));
  }

  function gametes(dose, sex, mode) {
    const size = ploidy(sex, mode);
    if (dose === 0) return [{ allele: 0, probability: fraction(1) }];
    if (dose === size) return [{ allele: 1, probability: fraction(1) }];
    return [{ allele: 0, probability: fraction(1, 2) }, { allele: 1, probability: fraction(1, 2) }];
  }

  function offspring(father, mother, mode) {
    const result = [];
    for (const sex of ['F', 'M']) for (const f of gametes(father, 'M', mode)) for (const m of gametes(mother, 'F', mode)) {
      const dose = isX(mode) && sex === 'M' ? m.allele : f.allele + m.allele;
      result.push({ sex, dose, fatherAllele: isX(mode) && sex === 'M' ? 'Y' : f.allele,
        motherAllele: m.allele, probability: multiply(fraction(1, 2), multiply(f.probability, m.probability)),
        affected: affected(dose, sex, mode), carrier: isCarrier(dose, sex, mode), genotype: genotype(dose, sex, mode) });
    }
    return result;
  }

  function probability(father, mother, mode, event = 'affected', condition = '') {
    let numerator = fraction(0), denominator = fraction(0);
    for (const row of offspring(father, mother, mode)) {
      const allowed = condition === 'boy' ? row.sex === 'M' : condition === 'unaffected' ? !row.affected : true;
      if (!allowed) continue;
      denominator = add(denominator, row.probability);
      const chosen = event === 'carrier' ? row.carrier : event === 'affectedBoy' ? row.affected && row.sex === 'M' : row.affected;
      if (chosen) numerator = add(numerator, row.probability);
    }
    return denominator.n ? fraction(numerator.n * denominator.d, numerator.d * denominator.n) : null;
  }

  function analyze(data) {
    const people = validate(data);
    const results = {};
    for (const mode of Object.keys(modes)) {
      const domains = Object.fromEntries(data.people.map(p => [p.id, domain(p, mode)]));
      const locationAllowed = data.locus === 'unknown' || (data.locus === 'X') === isX(mode);
      const families = data.families.map(f => ({ ...f, rows: [] }));
      for (const family of families) {
        for (const father of domains[family.father]) for (const mother of domains[family.mother]) {
          const children = family.children.map(id => ({ id, doses: domains[id].filter(dose =>
            offspring(father, mother, mode).some(row => row.sex === people[id].sex && row.dose === dose)) }));
          if (children.every(child => child.doses.length)) family.rows.push({ father, mother, children });
        }
      }
      const assignments = [];
      function visit(index, current) {
        if (index === data.people.length) { assignments.push({ ...current }); return; }
        const member = data.people[index];
        for (const dose of domains[member.id]) {
          current[member.id] = dose;
          const fits = families.every(f => f.rows.some(row =>
            (current[f.father] === undefined || current[f.father] === row.father)
            && (current[f.mother] === undefined || current[f.mother] === row.mother)
            && row.children.every(child => current[child.id] === undefined || child.doses.includes(current[child.id]))));
          if (fits) visit(index + 1, current);
        }
        delete current[member.id];
      }
      if (locationAllowed) visit(0, {});
      const conflicts = !locationAllowed ? [{ type: 'locus', members: [], text: `题给定位与${modes[mode]}不符` }]
        : families.filter(f => !f.rows.length).flatMap(f => {
          const reasons = [];
          for (const id of f.children) {
            const child = people[id], available = new Set();
            for (const father of domains[f.father]) for (const mother of domains[f.mother]) {
              offspring(father, mother, mode).filter(row => row.sex === child.sex).forEach(row => available.add(row.dose));
            }
            if (domains[id].some(dose => available.has(dose))) continue;
            const fatherText = domains[f.father].map(dose => genotype(dose, 'M', mode)).join('或') || '无符合题给事实的基因型';
            const motherText = domains[f.mother].map(dose => genotype(dose, 'F', mode)).join('或') || '无符合题给事实的基因型';
            const childText = [...available].map(dose => genotype(dose, child.sex, mode)).join('或') || '无可行组合';
            const rule = mode === 'XR' && child.sex === 'F' && child.phenotype === 'affected'
              && people[f.father].phenotype === 'unaffected'
              ? '伴X隐性受累女儿需从父亲得到Xᵃ，但未受累父亲XᴬY无法提供。' : '';
            reasons.push({ type: 'family', family: f.id, members: [f.father, f.mother, id],
              text: `${f.id}：父亲${f.father}可为${fatherText}，母亲${f.mother}可为${motherText}。对子女${id}可能传递为${childText}，与题给表型或携带事实不符。${rule}` });
          }
          return reasons.length ? reasons : [{ type: 'family', family: f.id,
            members: [f.father, f.mother, ...f.children], text: `${f.id}：${f.father}与${f.mother}的配子不能同时满足全部子女表型及题给事实` }];
        });
      if (locationAllowed && !assignments.length && !conflicts.length) conflicts.push({ type: 'joint',
        members: data.people.map(p => p.id), text: '各家庭约束联用后没有一致基因型，请核对整条亲缘链及题给事实' });
      const genotypes = Object.fromEntries(data.people.map(p => [p.id, [...new Set(assignments.map(row => row[p.id]))].sort()]));
      const pairKeys = new Set();
      const pairs = [];
      for (const row of assignments) {
        const doses = data.target.map(id => row[id]), key = doses.join(',');
        if (pairKeys.has(key)) continue;
        pairKeys.add(key);
        pairs.push({ father: doses[0], mother: doses[1], probability: probability(...doses, mode),
          boyConditional: probability(...doses, mode, 'affected', 'boy'),
          affectedBoy: probability(...doses, mode, 'affectedBoy'), outcomes: offspring(...doses, mode) });
      }
      results[mode] = { mode, possible: assignments.length > 0, genotypes, conflicts, pairs };
    }
    return { results, possible: Object.keys(modes).filter(mode => results[mode].possible) };
  }

  function carrierEvidence(data, analysis, id, mode) {
    const p = data.people.find(person => person.id === id);
    if (!p || !analysis.results[mode]?.possible) return null;
    if (p.carrier === true) return { source: 'given', text: '题给携带者', genotype: genotype(1, p.sex, mode) };
    const doses = analysis.results[mode].genotypes[id];
    if (doses.length === 1 && isCarrier(doses[0], p.sex, mode)) {
      const related = data.families.filter(f => [f.father, f.mother, ...f.children].includes(id)).map(f => f.id).join('、');
      return { source: 'inferred', text: `由${related}及全图约束推断携带`, genotype: genotype(doses[0], p.sex, mode) };
    }
    return null;
  }

  window.MasterLabPedigree = Object.freeze({ modes, validate, fraction, add, multiply, text, genotype, affected,
    isCarrier, gametes, offspring, probability, analyze, carrierEvidence });
})();
