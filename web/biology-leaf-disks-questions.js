/* Whole-question whitelist: conditions and asks are inspected independently of order. */
(() => {
  'use strict';
  const ASK = Object.freeze({ steps: '实验步骤', purpose: '操作目的', variables: '实验变量', indicator: '观察指标', limits: '结果分析边界' });
  const DEFAULTS = Object.freeze({ curriculum: 'pep2019-biology1-p105', version: 1, level: 'senior', asks: 'indicator,limits,purpose,steps,variables' });
  const CLAUSES = Object.freeze([
    '按人教版高中生物学必修1教材',
    '探究光照强度对光合作用强度的影响',
    '取生长旺盛的菠菜绿叶',
    '用直径0.6cm的打孔器避开大叶脉制备30片圆形小叶片',
    '注射器吸入清水并排尽残留空气后堵住前孔缓拉活塞使叶片内气体逸出并沉底',
    '处理后的叶片在黑暗处清水中待用',
    '三只小烧杯加入富含CO2的清水',
    '每杯放入10片叶圆片',
    '以5W的LED灯作光源并用米尺比较距灯远近形成强中弱三组光照',
    '其他条件相同且适宜',
    '观察并记录同一时间段内各组叶片浮起数量',
    '未提供实际观察数据'
  ]);
  const normalize = text => String(text).normalize('NFKC').replace(/\s/g, '').replace(/厘米/g, 'cm').replace(/毫米/g, 'mm').replace(/瓦特|瓦/g, 'W');
  function issue(f, p1, p2) {
    if (!f || Object.keys(f).some(key => !Object.hasOwn(DEFAULTS, key)) || f.curriculum !== DEFAULTS.curriculum || f.version !== 1 || f.level !== 'senior') return '教材流程、版本或学段无效。';
    if (p1 !== 1 || p2 !== 1) return '本教材流程不接受自设光强、距离、产氧量或浮片数参数。';
    if (typeof f.asks !== 'string' || !f.asks) return '请明确本流程支持的所问。';
    const asks = f.asks.split(',');
    return new Set(asks).size !== asks.length || asks.some(key => !Object.hasOwn(ASK, key)) ? '存在范围外子问。' : '';
  }
  const failure = '请保留人教必修1第105页的完整叶圆片流程与条件。本流程支持步骤、目的、变量、观察指标和分析边界；没有实测数据，不预测浮起数量、产氧量或光合速率。';
  function parse(text) {
    if (typeof text !== 'string') return { ok: false, message: failure };
    const seen = new Set(), asks = new Set();
    let bad = false, afterAsk = false;
    const canonical = CLAUSES.map(normalize);
    for (let clause of normalize(text).split(/[,，。;；?:：？]+/).filter(Boolean)) {
      const marker = clause.match(/^(?:请)?(?:说明|解释|指出)(.+)$/);
      const keys = (marker ? marker[1] : clause).split(/以及|、|及|和/).map(name => Object.keys(ASK).find(key => ASK[key] === name));
      if (marker || afterAsk && keys.every(Boolean)) {
        if (keys.some(key => !key)) bad = true;
        else keys.forEach(key => asks.add(key));
        afterAsk = true; continue;
      }
      afterAsk = false;
      // Exact equivalent units only; never snap another diameter to the textbook value.
      clause = clause.replace(/^用直径(?:0\.60cm|6(?:\.0)?mm)的打孔器/, '用直径0.6cm的打孔器');
      const index = canonical.indexOf(clause);
      if (index < 0 || seen.has(index)) bad = true;
      else seen.add(index);
    }
    if (bad || seen.size !== CLAUSES.length || !asks.size) return { ok: false, message: failure };
    const fixed = { ...DEFAULTS, asks: [...asks].sort().join(',') };
    return { ok: true, p1: 1, p2: 1, fixed };
  }
  function question(p1 = 1, p2 = 1, fixed = DEFAULTS) {
    const error = issue(fixed, p1, p2); if (error) throw new RangeError(error);
    return CLAUSES.join('，') + '，说明' + fixed.asks.split(',').map(key => ASK[key]).join('、') + '。';
  }
  window.MasterLabLeafDiskQuestions = Object.freeze({ version: 1, ASK, DEFAULTS, CLAUSES, parse, question, issue });
})();
