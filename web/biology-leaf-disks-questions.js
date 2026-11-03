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

  const RULES=[
    ['人教必修1教材范围',/^(?:按|依据)(?:人教版|人民教育出版社)高中生物学必修1教材/],
    ['探究光照强度对光合作用强度的影响',/^(?:探究|研究)光照强度对光合作用强度的影响/],
    ['生长旺盛的菠菜绿叶',/^(?:选取|取用|取|选用)生长旺盛的菠菜(?:绿叶|绿色叶片)/],
    ['直径0.6cm避开大叶脉制备30片',/^用直径(?:0\.6(?:0)*cm|6(?:\.0+)?mm)的打孔器(?:避开|避让)大叶脉(?:制备|打出)30片(?:圆形小叶片|叶圆片)/],
    ['先排尽残气再堵孔缓拉使叶片沉底',/^注射器(?:吸入|吸取)清水并(?:排尽|排净)残留空气后(?:堵住|封住)前孔(?:缓拉|缓慢拉动)活塞使叶片内气体(?:逸出|排出)并(?:沉底|下沉至底部)/],
    ['处理后暗处清水待用',/^处理后的(?:叶片|叶圆片)(?:在|置于)黑暗处清水中(?:待用|备用)/],
    ['三只烧杯富CO2清水',/^三(?:只|个)小?烧杯(?:中)?(?:加入|装入)富含CO2的清水/],
    ['每杯投入10片',/^每(?:只小烧杯|个小烧杯|只烧杯|个烧杯|杯)(?:中)?(?:放入|加入|投入)10片(?:叶圆片|圆形小叶片)/],
    ['5W LED及米尺形成强中弱三组光照',/^(?:以|用)5(?:\.0+)?W的?LED(?:台灯|灯)(?:作|作为)光源并(?:用|使用)米尺(?:比较|调节)距灯远近(?:形成|设置)强中弱三组光照/],
    ['其他条件相同且适宜',/^(?:其他|其余)条件(?:相同|一致)且适宜/],
    ['同一时段记录各组浮起数',/^(?:观察并记录|记录并观察)同一(?:时间段|时段)内各组叶片(?:浮起数量|浮起的数量|上浮数量)/],
    ['没有实测数据',/^(?:未提供|未给出|没有提供)实际观察数据/]
  ];
  const ASK_RULES={steps:/^(?:本实验的)?(?:实验步骤|操作步骤|操作流程)/,purpose:/^(?:本实验的)?(?:操作目的|各步骤的目的|各步操作的目的)/,variables:/^(?:本实验的)?(?:实验变量|自变量与因变量)/,indicator:/^(?:本实验的)?(?:观察指标|观测指标)/,limits:/^(?:本实验的)?(?:结果分析边界|分析结果的限制)/};

  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) return {ok:false,message:'请输入完整实验条件和所问。'};
    let rest = normalize(text).replace(/[，,。；;：:！？?、]/g,'').replace(/(?<!\d)\.|\.(?!\d)/g,'');
    const seen = new Set(), asks = new Set();
    let askMode = false;
    const reject = message => ({ok:false,message});
    while (rest) {
      const marker = rest.match(/^(?:请)?(?:说明|解释|比较|说出|指出|描述|列出)/);
      if (marker) { rest=rest.slice(marker[0].length); askMode=true; }
      if (askMode) {
        const found = Object.entries(ASK_RULES).map(([key,re])=>({key,match:rest.match(re)})).find(x=>x.match);
        if (found) {
          asks.add(found.key); rest=rest.slice(found.match[0].length);
          const connector=rest.match(/^(?:以及|和|及|与)/);
          if (connector) { rest=rest.slice(connector[0].length); if (!Object.values(ASK_RULES).some(re=>re.test(rest))) return reject('所问含未支持或不完整的子问：'+rest.slice(0,38)+'。'); }
          continue;
        }
        if (marker) return reject('无法确认所问的类型：'+rest.slice(0,38)+'。本流程仅支持'+Object.values(ASK).join('、')+'。');
      }
      const found=RULES.map(([name,re],index)=>({name,index,match:rest.match(re)})).find(x=>x.match);
      if (!found) return reject('无法确认这段条件或子问：'+rest.slice(0,42)+'。请核对操作、数值角色与所问；不会自动补条件。');
      if (seen.has(found.index)) return reject('条件重复或可能矛盾：'+found.name+'。请只给出一致条件。');
      seen.add(found.index); rest=rest.slice(found.match[0].length); askMode=false;
    }
    const missing=RULES.filter((_,i)=>!seen.has(i)).map(([name])=>name);
    if (missing.length) return reject('缺少可核对条件：'+missing.join('；')+'。');
    if (!asks.size) return reject('尚未明确所问。本流程支持'+Object.values(ASK).join('、')+'。');
    return {ok:true,p1:1,p2:1,fixed:{...DEFAULTS,asks:[...asks].sort().join(',')}};
  }
  function question(p1 = 1, p2 = 1, fixed = DEFAULTS) {
    const error = issue(fixed, p1, p2); if (error) throw new RangeError(error);
    return CLAUSES.join('，') + '，说明' + fixed.asks.split(',').map(key => ASK[key]).join('、') + '。';
  }
  window.MasterLabLeafDiskQuestions = Object.freeze({ version: 1, ASK, DEFAULTS, CLAUSES, parse, question, issue });
})();
