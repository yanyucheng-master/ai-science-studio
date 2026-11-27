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

  // Match the catalog's complete subquestion, never a substring such as “男孩”.
  function requestedProbabilities(data, analysis, asks, mode) {
    const selected = asks.split('|'), couple = data.target.join('与');
    if (selected.some(ask => !data.asks.includes(ask))) throw new RangeError('未支持的概率子问');
    const definitions = new Map([
      [couple + '下一子代受累概率', { label: '下一子代受累概率', field: 'probability', denominator: '全部子代，机会为1' }],
      [couple + '下一子代受累概率及所缺信息', { label: '下一子代受累概率', field: 'probability', denominator: '全部子代，机会为1' }],
      [couple + '已知下一子代为男孩时受累概率', { label: '已知下一子代为男孩时受累概率', field: 'boyConditional', denominator: '男孩，题设机会为1/2' }],
      [couple + '下一子代为受累男孩概率', { label: '下一子代为受累男孩概率', field: 'affectedBoy', denominator: '全部子代，机会为1' }]
    ]);
    if (data.carrierTarget) definitions.set(`双亲Aa×Aa且${data.carrierTarget}未受累时${data.carrierTarget}的携带概率`,
      { label: `${data.carrierTarget}的条件携带概率`, field: 'carrier', denominator: '双亲Aa×Aa所生的未受累子代，机会为3/4' });
    const pairs = analysis.results[mode].pairs;
    return selected.filter(ask => definitions.has(ask)).map(ask => {
      const definition = definitions.get(ask);
      const values = pairs.map(pair => definition.field === 'carrier'
        ? probability(pair.father, pair.mother, mode, 'carrier', 'unaffected') : pair[definition.field]);
      return { ask, ...definition, values, possibilities: [...new Set(values.map(value => value ? text(value) : '条件事件机会为0，未定义'))] };
    });
  }

  // Explain eliminations using only facts already available at that iteration.
  // Full enumeration remains the authority for the final feasible genotype set.
  function genotypeDerivation(data, analysis, id, mode) {
    const people = validate(data), person = people[id], solved = analysis.results[mode];
    if (!person || !solved?.possible) return null;
    const candidates = Object.fromEntries(data.people.map(p => [p.id, domain(p, mode)]));
    const initial = [...candidates[id]], events = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const family of data.families) {
        const members = [family.father, family.mother, ...family.children];
        const before = Object.fromEntries(members.map(member => [member, [...candidates[member]]]));
        const rows = [];
        for (const father of before[family.father]) for (const mother of before[family.mother]) {
          const children = family.children.map(child => ({ id: child, doses: before[child].filter(dose =>
            offspring(father, mother, mode).some(row => row.sex === people[child].sex && row.dose === dose)) }));
          if (children.every(child => child.doses.length)) rows.push({ father, mother, children });
        }
        // A possible graph always has at least one locally supported row.
        for (const member of members) {
          const after = before[member].filter(dose => rows.some(row => member === family.father ? row.father === dose
            : member === family.mother ? row.mother === dose : row.children.find(child => child.id === member).doses.includes(dose)));
          if (after.length === before[member].length) continue;
          candidates[member] = after;
          events.push({ member, family, before, remaining: after, removed: before[member].filter(dose => !after.includes(dose)) });
          changed = true;
        }
      }
    }
    const names = doses => doses.map(dose => genotype(dose, person.sex, mode)).join('或');
    const phenotype = person.phenotype === 'affected' ? '受累' : person.phenotype === 'unaffected' ? '未受累' : '未知';
    const lines = [person.carrier === true ? `${id}题给为携带者，${modes[mode]}下为${names(initial)}；这不是从子女表现推断的标记。`
      : `${id}题给表型${phenotype}，${modes[mode]}下初始可能为${names(initial)}。`];
    if (mode === 'AD' && person.phenotype === 'affected') lines.push('受累说明至少有一个显性A，不能仅凭表型区分AA和Aa。');
    if (mode.endsWith('R') && person.phenotype === 'unaffected' && initial.length > 1) lines.push('表型未受累不等于已知非携带，须保留两种可能。');
    for (const event of events.filter(event => event.member === id)) {
      const { family, before } = event;
      const related = [family.father, family.mother, ...family.children].filter(member => member !== id)
        .map(member => `${member}为${before[member].map(dose => genotype(dose, people[member].sex, mode)).join('或')}`).join('，');
      lines.push(`${family.id}（${family.father}与${family.mother}→${family.children.join('、')}）：结合${related}逐项检查配子传递，排除${names(event.removed)}，剩余${names(event.remaining)}。`);
      if (!isX(mode) && [family.father, family.mother].includes(id)) {
        for (const child of family.children) {
          const childDoses = before[child];
          if (childDoses.length !== 1 || ![0, 2].includes(childDoses[0])) continue;
          const alleleDose = childDoses[0] / 2;
          if (!event.removed.some(dose => !gametes(dose, person.sex, mode).some(g => g.allele === alleleDose))) continue;
          const allele = mode === 'AD' ? ['a', 'A'][alleleDose] : ['A', 'a'][alleleDose];
          lines.push(`${family.id}的${child}为${genotype(childDoses[0], people[child].sex, mode)}，双亲必须各提供${allele}；${id}若为${names(event.removed)}无法提供${allele}。`);
        }
      }
    }
    const remaining = solved.genotypes[id];
    lines.push(remaining.length > 1
      ? `全图仍允许${names(remaining)}。${data.families.filter(f => f.children.includes(id)).length ? '已知双亲及同胞仍不能唯一决定该个体的基因型。' : '题面没有足够证据排除其中任一项。'}不能给未知基因型等权先验。`
      : `与全图约束一致的基因型为${names(remaining)}。`);
    if (data.id === 'P05' && id === 'II-3') lines.push('F2的III-1表型未知，不能用未知的子代表现推断外来配偶II-3的携带状态；须补题给携带信息或有效的亲子证据。');
    return { id, mode, initial, remaining, source: person.carrier === true ? 'given'
      : carrierEvidence(data, analysis, id, mode)?.source || (remaining.length > 1 ? 'undetermined' : 'inferred'), lines };
  }

  window.MasterLabPedigree = Object.freeze({ modes, validate, fraction, add, multiply, text, genotype, affected,
    isCarrier, gametes, offspring, probability, analyze, carrierEvidence, requestedProbabilities, genotypeDerivation });
})();
