/* PEP Biology compulsory 1 (2019-audited), printed p105.
   Ordered operations only: this module never predicts floating counts or rates. */
(() => {
  'use strict';
  const STEPS = Object.freeze([
    { title: '制备叶圆片', action: '选生长旺盛的菠菜绿叶，避开大的叶脉，用直径0.6 cm的打孔器制备30片圆形小叶片。', purpose: '取材一致、避开大叶脉，减小材料差异；0.6 cm是直径。' },
    { title: '注射器排气', action: '将叶片装入注射器并吸入清水，先排尽残留空气，再用手指堵住前孔，缓慢拉动活塞，使叶片内气体逸出；必要时重复2–3次，处理后叶片沉底。', purpose: '叶片细胞间隙充水后下沉，为后续观察上浮准备相同初态；不是用活塞给叶片充氧。' },
    { title: '暗处待用', action: '将处理后的叶圆片放在黑暗处盛清水的烧杯中待用。', purpose: '避免待用期间受光产生氧气而影响初态；教材没有规定待用的分钟数。' },
    { title: '准备供碳液', action: '准备3只小烧杯，分别加入富含CO₂的清水；可事先通过吹气补充CO₂。', purpose: '提供光合作用的CO₂来源。本流程选择教材的富CO₂清水方案，不把清水误说成没有CO₂。' },
    { title: '分组与光照', action: '每杯各放10片叶圆片，在其他条件相同且适宜时设置强、中、弱三组光照；用5 W LED灯和米尺，通过距光源远近调节光照。', purpose: '只改变光照强度。保持材料、叶片数、供碳条件、温度和观察时段等可比，不把灯的功率当作叶片实际照度。' },
    { title: '观察与记录', action: '观察并记录同一时间段内，强、中、弱各组圆形小叶片浮起的数量。', purpose: '以浮起数量作间接比较指标；没有实际观察记录，不能给三组排出实测强弱，更不能算出总产氧量。' }
  ].map(Object.freeze));
  const MATERIALS = Object.freeze(['生长旺盛的菠菜绿叶', '直径0.6 cm打孔器', '注射器', '清水', '5 W LED台灯', '米尺', '烧杯']);
  const CONSTANTS = Object.freeze({ diameterCm: 0.6, totalDisks: 30, groups: 3, disksPerGroup: 10, lampPowerW: 5 });
  function frame(progress) {
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError('操作示意进度须在0–1之间。');
    const step = Math.min(5, Math.floor(progress * 6));
    const local = progress === 1 ? 1 : progress * 6 - step;
    return Object.freeze({ step, local,
      cutCount: step === 0 ? Math.floor(local * 30) : 30,
      syringePhase: step === 1 ? Math.min(2, Math.floor(local * 3)) : null,
      submerged: step > 1 || step === 1 && local >= 2 / 3,
      dark: step === 2,
      grouped: step >= 4,
      observationStage: step === 5,
      // The rising disk is an explicitly separate mechanism diagram, not a group result.
      mechanismRise: step === 5 ? local : 0,
      observedCounts: Object.freeze([null, null, null])
    });
  }
  window.MasterLabLeafDisks = Object.freeze({ version: 1, STEPS, MATERIALS, CONSTANTS, frame });
})();
