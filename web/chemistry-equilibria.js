/* Chemistry v2 numerical core. UI registration is a separate integration step.
   Fixed scope: Issue #5, approved 2026-10-22. No AI, interpolation or defaults
   for missing physical conditions. All volumes are mL and masses are g. */
(() => {
  'use strict';
  const SCALE = 10000;
  const KW = 1e-14; // Classroom approximation, not an exact thermodynamic value.
  const SOLUBILITY = Object.freeze({20:31.6, 30:45.8, 40:63.9, 50:85.5, 60:110});
  function ticks(value, min, max, label) {
    if (!Number.isFinite(value) || value < min || value > max
        || Math.round(value * SCALE) / SCALE !== value) {
      throw new RangeError(`${label}超出范围或超过四位小数；不舍入、不吸附。`);
    }
    return Math.round(value * SCALE);
  }
  // direction: 'baseIntoAcid' (default) starts from 10–50 mL HCl and adds 0–100 mL NaOH;
  // 'acidIntoBase' starts from 10–50 mL NaOH and adds 0–100 mL HCl. The final state only
  // depends on the two volumes; the direction decides which one is the initial solution.
  const DIRECTIONS = Object.freeze(['baseIntoAcid', 'acidIntoBase']);
  function neutralization(input) {
    if (!input || input.temperature !== 25 || input.acidConcentration !== 0.1
        || input.baseConcentration !== 0.1) {
      throw new RangeError('必须明确25°C、HCl与NaOH均为0.100mol/L。');
    }
    const direction = input.direction === undefined ? 'baseIntoAcid' : input.direction;
    if (!DIRECTIONS.includes(direction)) throw new RangeError('加液方向无效。');
    const reverse = direction === 'acidIntoBase';
    const A = reverse ? ticks(input.acidVolume, 0, 100, '累计加入盐酸体积') : ticks(input.acidVolume, 10, 50, '初始盐酸体积');
    const B = reverse ? ticks(input.baseVolume, 10, 50, '初始NaOH溶液体积') : ticks(input.baseVolume, 0, 100, '累计NaOH体积');
    const volumeL = (A + B) / (SCALE * 1000);
    // Integer subtraction preserves the sign next to the equivalence point.
    const delta = 0.1 * (A - B) / (A + B);
    const root = Math.hypot(delta, 2 * Math.sqrt(KW));
    let hydrogen, hydroxide;
    if (delta >= 0) {
      hydrogen = (root + delta) / 2;
      hydroxide = KW / hydrogen;
    } else {
      hydroxide = (root - delta) / 2;
      hydrogen = KW / hydroxide;
    }
    return Object.freeze({
      acidVolume:A / SCALE, baseVolume:B / SCALE, temperature:25,
      acidConcentration:0.1, baseConcentration:0.1, volumeL,
      acidMol:0.1 * A / (SCALE * 1000), baseMol:0.1 * B / (SCALE * 1000),
      chloride:0.1 * A / (A + B), sodium:0.1 * B / (A + B),
      delta, hydrogen, hydroxide, pH:-Math.log10(hydrogen), kw:KW,
      nature:A === B ? '中性' : A > B ? '酸性' : '碱性',
      equivalentBaseVolume:A / SCALE,
      direction, initialVolume:(reverse ? B : A) / SCALE, addedVolume:(reverse ? A : B) / SCALE,
      // Equal concentrations: the added solution reaches equivalence at the initial volume.
      equivalentAddedVolume:(reverse ? B : A) / SCALE
    });
  }
  function cooling(input) {
    if (!input || input.initialTemperature !== 60 || input.saturated !== true
        || input.pure !== true || input.waterLoss !== 0 || input.equilibrium !== true) {
      throw new RangeError('必须明确60°C饱和纯KNO₃水溶液、不失水、终态达到平衡。');
    }
    const W = ticks(input.waterMass, 50, 200, '水质量');
    const T = input.finalTemperature;
    if (typeof T !== 'number' || !Object.hasOwn(SOLUBILITY, T)) {
      throw new RangeError('终温只支持20/30/40/50/60°C；不插值或取近似温度。');
    }
    const S = Math.round(SOLUBILITY[T] * 10);
    const initialSolute = W * 1100 / (SCALE * 1000);
    const dissolved = W * S / (SCALE * 1000);
    // Direct integer difference avoids subtraction noise at no cooling.
    const crystals = W * (1100 - S) / (SCALE * 1000);
    const waterMass = W / SCALE;
    return Object.freeze({
      waterMass, initialTemperature:60, finalTemperature:T,
      solubility:SOLUBILITY[T], initialSolute, dissolved, crystals,
      motherLiquor:waterMass + dissolved, totalMass:waterMass + initialSolute
    });
  }
  window.MasterLabChemistryEquilibria = Object.freeze({
    version:1, KW, SOLUBILITY, DIRECTIONS, neutralization, cooling
  });
})();
