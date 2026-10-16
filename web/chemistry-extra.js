/* 化学计算工具（2026-10-16）
   初中“利用化学方程式的简单计算”按教材步骤：设未知数 → 写出化学方程式 → 找出相关量（化学计量数 × 相对分子质量）
   与已知量、未知量 → 列比例式 → 求解 → 简明地写出答案。
   铁 + 硫酸铜的初中讲法先用；第 3 周的化学反应表与引擎（碳酸钙 + 稀盐酸等）复用同一套函数。 */
(() => {
  // 相对原子质量（初中教材附录的取整值；Cl 按 35.5）
  const ATOMIC_MASS = Object.freeze({ H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, S: 32, Cl: 35.5, K: 39, Ca: 40, Mn: 55, Fe: 56, Cu: 64, Zn: 65, Ag: 108 });
  const SUBSCRIPT = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };

  // 能用 3 位以内小数精确写出的质量原样写，除不尽的保留 2 位并写“≈”
  const exactPlaces = (value, max = 3) => {
    for (let places = 0; places <= max; places += 1) {
      if (Math.abs(value - Number(value.toFixed(places))) <= 1e-9 * Math.max(1, Math.abs(value))) return places;
    }
    return null;
  };
  function massText(value) {
    const places = exactPlaces(Number(value));
    const text = places === null ? Number(value).toFixed(2) : String(Number(Number(value).toFixed(places)));
    return { text, exact: places !== null, eq: places === null ? "≈" : "=" };
  }

  // 化学式（CuSO4、Ca(OH)2）→ 相对分子质量；不认识的元素返回 NaN
  function relativeMass(formula) {
    const tokens = String(formula).match(/[A-Z][a-z]?|\d+|\(|\)/g) || [];
    const stack = [0];
    let last = 0;
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (token === "(") {
        stack.push(0);
        last = 0;
      } else if (token === ")") {
        const group = stack.pop();
        const count = /^\d+$/.test(tokens[i + 1] || "") ? Number(tokens[(i += 1)]) : 1;
        last = group * count;
        stack[stack.length - 1] += last;
      } else if (/^\d+$/.test(token)) {
        stack[stack.length - 1] += last * (Number(token) - 1);
      } else {
        const mass = ATOMIC_MASS[token];
        if (!Number.isFinite(mass)) return NaN;
        last = mass;
        stack[stack.length - 1] += mass;
      }
    }
    return stack.length === 1 ? Number(stack[0].toFixed(6)) : NaN;
  }
  const formulaText = formula => String(formula).replace(/\d/g, digit => SUBSCRIPT[digit]);

  // 列比例式求未知物质的质量。
  // known / unknown：{ formula, coefficient = 1, name }；known.mass 为已知质量（g）；ask：所求（如“生成铜的质量”）
  function proportion({ equation, known, unknown, ask, symbol = "x" }) {
    const relative = species => (species.coefficient || 1) * relativeMass(species.formula);
    const relativeLabel = species => (species.coefficient > 1 ? `${species.coefficient} × ${relativeMass(species.formula)}` : String(relativeMass(species.formula)));
    const knownRelative = relative(known);
    const unknownRelative = relative(unknown);
    const value = (known.mass * unknownRelative) / knownRelative;
    const knownMass = massText(known.mass).text;
    const result = massText(value);
    const unknownName = unknown.name || formulaText(unknown.formula);
    return {
      knownRelative,
      unknownRelative,
      value,
      valueText: result.text,
      exact: result.exact,
      set: `设${ask}为 ${symbol}`,
      equation,
      relation: `${formulaText(known.formula)} ${relativeLabel(known)}，${formulaText(unknown.formula)} ${relativeLabel(unknown)}；已知 ${knownMass} g，未知 ${symbol}`,
      // “5.6g/x”数值与单位相连：排版时整体作分子（写成“5.6 g/x”会被排成 5.6 × g/x）
      ratio: `${knownRelative}/${unknownRelative} = ${knownMass}g/${symbol}`,
      solve: `${symbol} = ${unknownRelative} × ${knownMass} g ÷ ${knownRelative} ${result.eq} ${result.text} g`,
      answer: `答：${ask}${result.exact ? "为" : "约为"} ${result.text} g。`,
      unknownName
    };
  }

  window.MasterLabChemistry = Object.freeze({ ATOMIC_MASS, relativeMass, formulaText, massText, proportion });
})();
