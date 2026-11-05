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
  function issue(f, p1, p2) {
    if (!f || Object.keys(f).some(key => !Object.hasOwn(DEFAULTS, key)) || f.curriculum !== DEFAULTS.curriculum || f.version !== 1 || f.level !== 'senior') return '教材流程、版本或学段无效。';
    if (p1 !== 1 || p2 !== 1) return '本教材流程不接受自设光强、距离、产氧量或浮片数参数。';
    if (typeof f.asks !== 'string' || !f.asks) return '请明确本流程支持的所问。';
    const asks = f.asks.split(',');
    return new Set(asks).size !== asks.length || asks.some(key => !Object.hasOwn(ASK, key)) ? '存在范围外子问。' : '';
  }


  const Q=window.MasterLabProtocolQuestions,R=Q.rule;
  const diameter='(?:0\\.6(?:0)*cm|6(?:\\.0+)?mm)';
  const tool='用直径(?:为)?'+diameter+'的打孔器',disks='(?:圆形小叶片|叶圆片)';
  const RULES=[
    R('人教必修1教材说明','(?:按|依据)(?:人教版|人民教育出版社)高中生物学必修1教材',true),
    R('探究光照强度对光合作用强度的影响','(?:探究|研究)光照强度对光合作用强度的影响'),
    R('生长旺盛的菠菜绿叶','(?:选取|选择|选用|取用|取|选)生长旺盛的菠菜(?:绿叶|绿色叶片)'),
    R('直径0.6cm避开大叶脉制备30片','(?:'+tool+'避开大叶脉|避开大叶脉'+tool+')(?:制备|打出)(?:30|三十)片'+disks),
    R('先排尽残气再堵孔缓拉使叶片沉底','注射器(?:吸入|吸取)清水并(?:排尽|排净)残留空气后(?:堵住|封住)前孔(?:缓拉|缓慢拉动)活塞使叶片内气体(?:逸出|排出)并(?:沉底|下沉至底部)'),
    R('处理后暗处清水待用','处理后的(?:叶片|叶圆片)(?:在|置于)黑暗处清水中(?:待用|备用)'),
    R('三只烧杯富CO2清水','(?:三|3)(?:只|个)小?烧杯(?:中)?(?:加入|装入)富含CO2的清水'),
    R('每杯投入10片','(?:每(?:一个|一只|个|只|一)?(?:小?烧杯|杯子|杯)|各(?:小?烧杯|杯子|杯))(?:中)?(?:各)?(?:放入|加入|投入)(?:10|十)片'+disks),
    R('5W LED及米尺形成强中弱三组光照','(?:以|用)5(?:\\.0+)?W的?(?:LED|led)(?:台灯|灯)(?:作|作为)光源并(?:用|使用)米尺(?:比较|调节)距灯远近(?:形成|设置)强中弱三组光照'),
    R('其他条件相同且适宜','(?:其他|其余)条件(?:相同|一致)且适宜'),
    R('同一时段记录各组浮起数','(?:观察并记录|记录并观察)同一(?:时间段|时段)内各组叶片(?:浮起数量|浮起的数量|上浮数量)'),
    R('没有实测数据的说明','(?:未提供|未给出|没有提供)实际观察数据',true)
  ];
  const ASK_RULES={steps:/^(?:本实验的)?(?:实验步骤|操作步骤|操作流程)/u,purpose:/^(?:本实验的)?(?:操作目的|各步骤的目的|各步操作的目的)/u,variables:/^(?:本实验的)?(?:实验变量|自变量与因变量)/u,indicator:/^(?:本实验的)?(?:观察指标|观测指标)/u,limits:/^(?:本实验的)?(?:结果分析边界|分析结果的限制)/u};
  const parse=text=>Q.parse(text,{rules:RULES,askRules:ASK_RULES,askNames:ASK,defaults:DEFAULTS});
  const diagnosticPriority=text=>[ [/菠菜/u,8], [/叶圆片|圆形小叶片/u,8], [/注射器/u,5], [/打孔器/u,5], [/强中弱/u,3], [/光照强度.*光合作用强度/u,3], [/高中|必修1/u,1] ].reduce((n,[re,w])=>n+(re.test(text)?w:0),0);
  function question(p1 = 1, p2 = 1, fixed = DEFAULTS) {
    const error = issue(fixed, p1, p2); if (error) throw new RangeError(error);
    return CLAUSES.join('，') + '，说明' + fixed.asks.split(',').map(key => ASK[key]).join('、') + '。';
  }
  window.MasterLabLeafDiskQuestions = Object.freeze({ version: 1, ASK, DEFAULTS, CLAUSES, parse, question, issue, diagnosticPriority });
})();
