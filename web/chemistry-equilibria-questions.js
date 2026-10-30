/* Conservative complete-question grammar for the two approved chemistry v2
   models. Unknown clauses never disappear into a keyword-only match. */
(() => {
  'use strict';
  const core = window.MasterLabChemistryEquilibria;
  if (!core) return;
  const N = '[+-]?\\d+(?:\\.\\d+)?';
  const ACID = '(?:盐酸|HCl(?:溶液)?)';
  const BASE = '(?:氢氧化钠(?:溶液)?|NaOH(?:溶液)?)';
  const SALT = '(?:硝酸钾|KNO3)';
  const V = `(${N})(mL|ml|毫升|L|升)`;
  const C = `(${N})mol/L`;
  const concentration=raw=>/^\+?0+\.10*$/.test(raw)?0.1:NaN;
  const fail = message => ({ok:false,message});
  const acidHelp = '请明确25°C、两液均为0.100mol/L、初始盐酸10–50mL和累计加入NaOH 0–100mL；支持当前pH、酸碱性或理论中和所需NaOH总体积。';
  const saltHelp = '请明确60°C饱和的纯KNO₃水溶液、水质量50–200g、终温20/30/40/50/60°C、不蒸发不失水并达到平衡；支持析晶、终态溶解量和母液质量。';
  const acidAsks = {
    ph:/^(?:当前|最终|混合后)?(?:混合液|溶液)?(?:的)?pH(?:值)?$/i,
    nature:/^(?:当前|最终|混合后)?(?:混合液|溶液)?(?:的)?酸碱性$/,
    equivalence:new RegExp(`^(?:理论)?(?:恰好|完全)?中和(?:所需|需要)(?:的)?${BASE}(?:的)?(?:总体积|总加入体积)$`,'i')
  };
  const saltAsks = {
    crystals:new RegExp(`^(?:析出|析出的)(?:${SALT})?(?:晶体|无水晶体)(?:的)?质量$`,'i'),
    dissolved:new RegExp(`^(?:终态|最终)(?:仍)?溶解(?:的)?${SALT}(?:的)?质量$`,'i'),
    mother:/^(?:终态|最终)?母液(?:的)?(?:总)?质量$/
  };
  function scalar(raw, unit) {
    // Exact decimal unit conversion into integer 0.0001 mL/g ticks.
    const power = /^(L|升|kg|千克)$/.test(unit) ? 7 : 4;
    if (!new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${power}})?$`).test(raw) || raw.length > 16) return NaN;
    const [whole, fractional=''] = raw.replace(/^[+-]/,'').split('.');
    const sign = raw.startsWith('-') ? -1n : 1n;
    const ticks = sign * BigInt(whole + fractional.padEnd(power,'0'));
    return ticks <= BigInt(Number.MAX_SAFE_INTEGER) && ticks >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(ticks) / 10000 : NaN;
  }
  function pieces(text, patterns, context={}) {
    let source = window.MasterLabQuestionGuard.normalize(text).replace(/\s/g,'');
    const grade = source.match(/^(初中|高中)[:：,，]?/);
    if (grade) source = source.slice(grade[0].length);
    const level = grade ? (grade[1]==='初中'?'junior':'senior') : context.gradeLevel || 'senior';
    if (!['junior','senior'].includes(level)) return fail('学段无效。');
    source = source.replace(/((?:请)?(?:求出|求|计算|判断|确定))[:：]/g,'$1');
    const givens=[], asks=new Set();let followingAsk=false;
    for (const part of source.split(/[，,。；;！!？?：:]+/).filter(Boolean)) {
      const marker=part.match(/^(?:请)?(?:求出|求|计算|判断|确定)(.+)$/);
      const body=marker?marker[1]:part;
      const names=body.split(/以及|、|及|与|(?<!中)和/);
      const keys=names.map(name=>Object.keys(patterns).find(key=>patterns[key].test(name)));
      if (marker || followingAsk && keys.every(Boolean)) {
        if (!keys.length || keys.some(key=>!key)) return fail('存在未支持的所问，不能省略子问或改换所求量。');
        keys.forEach(key=>asks.add(key));followingAsk=true;
      } else { givens.push(part);followingAsk=false; }
    }
    if (!asks.size) return fail('请明确所求量；理论中和总体积与“还需加入”是不同问题。');
    return {ok:true,givens,fixed:{level,levelLocked:Boolean(grade),asks:[...asks].sort().join(',')}};
  }
  function neutralization(text, context) {
    const p=pieces(text,acidAsks,context);if(!p.ok)return p;
    const values={};let bad=false;
    const put=(key,value)=>{if(Object.hasOwn(values,key))bad=true;values[key]=value;};
    for(const clause of p.givens) {
      let m;
      if((m=clause.match(new RegExp(`^(?:在|温度(?:为|是|=)?)?(${N})℃(?:时|下)?$`))))put('temperature',scalar(m[1],'℃'));
      else if((m=clause.match(new RegExp(`^(?:初始|起始)(?:取|有)?${ACID}(?:的)?(?:体积)?(?:为|是|=)?${V}$`,'i'))))put('acidVolume',scalar(m[1],m[2]));
      else if((m=clause.match(new RegExp(`^(?:初始|起始)(?:取|有)?${V}(?:的)?${ACID}$`,'i'))))put('acidVolume',scalar(m[1],m[2]));
      else if((m=clause.match(new RegExp(`^(?:已)?(?:累计加入|加入)${BASE}(?:的)?(?:总体积|体积)?(?:为|是|=)?${V}$`,'i'))))put('baseVolume',scalar(m[1],m[2]));
      else if((m=clause.match(new RegExp(`^(?:已)?(?:累计加入|加入)${V}(?:的)?${BASE}$`,'i'))))put('baseVolume',scalar(m[1],m[2]));
      else if((m=clause.match(new RegExp(`^${ACID}(?:与|和)${BASE}(?:的)?(?:物质的量)?浓度均(?:为|是|=)${C}$`,'i')))){
        put('acidConcentration',concentration(m[1]));put('baseConcentration',concentration(m[1]));
      } else if((m=clause.match(new RegExp(`^(${ACID}|${BASE})(?:的)?(?:物质的量)?浓度(?:为|是|=)${C}$`,'i'))))put(/盐酸|HCl/i.test(m[1])?'acidConcentration':'baseConcentration',concentration(m[2]));
      else if((m=clause.match(new RegExp(`^向${V}(?:浓度为)?${C}(?:的)?${ACID}中(?:累计)?加入${V}(?:浓度为)?${C}(?:的)?${BASE}$`,'i')))){
        put('acidVolume',scalar(m[1],m[2]));put('acidConcentration',concentration(m[3]));put('baseVolume',scalar(m[4],m[5]));put('baseConcentration',concentration(m[6]));
      } else if(clause==='完全电离且体积可加且忽略活度')put('ideal',true);
      else bad=true;
    }
    if(bad)return fail(`条件重复、冲突或含未支持内容。${acidHelp}`);
    try { core.neutralization(values); } catch { return fail(acidHelp); }
    return {ok:true,p1:values.acidVolume,p2:values.baseVolume,fixed:{...p.fixed,temperature:values.temperature,acidConcentration:values.acidConcentration,baseConcentration:values.baseConcentration}};
  }
  function cooling(text, context) {
    const p=pieces(text,saltAsks,context);if(!p.ok)return p;
    const values={};let bad=false;
    const put=(key,value)=>{if(Object.hasOwn(values,key))bad=true;values[key]=value;};
    for(const clause of p.givens) {
      let m;
      if((m=clause.match(new RegExp(`^(?:初始|起始)(?:为|是)?(${N})℃(?:的)?饱和(?:的)?纯${SALT}水溶液$`,'i')))){
        put('initialTemperature',scalar(m[1],'℃'));put('saturated',true);put('pure',true);
      } else if((m=clause.match(new RegExp(`^(?:溶剂)?水(?:的)?质量(?:为|是|=)?(${N})(kg|千克|g|克)$`,'i'))))put('waterMass',scalar(m[1],m[2]));
      else if((m=clause.match(new RegExp(`^(?:冷却(?:后)?(?:至|到)|终温(?:为|是|=)?)(${N})℃$`))))put('finalTemperature',scalar(m[1],'℃'));
      else if(/^(?:全程)?(?:不蒸发(?:且|并)?不(?:损失|损耗)水|水不蒸发且无损失)$/.test(clause))put('waterLoss',0);
      else if(/^(?:冷却后|终态)?(?:充分)?达到平衡$/.test(clause))put('equilibrium',true);
      else if(clause==='析出无水晶体')put('anhydrous',true);
      else bad=true;
    }
    if(bad)return fail(`条件重复、冲突或含未支持内容。${saltHelp}`);
    try { core.cooling(values); } catch { return fail(saltHelp); }
    return {ok:true,p1:values.waterMass,p2:values.finalTemperature,fixed:{...p.fixed,initialTemperature:60,saturated:true,pure:true,waterLoss:0,equilibrium:true}};
  }
  const acidAskText={ph:'当前混合液pH',nature:'酸碱性',equivalence:'理论恰好中和所需NaOH总体积'};
  const saltAskText={crystals:'析出晶体质量',dissolved:'终态溶解KNO₃质量',mother:'母液质量'};
  const heading=f=>f.levelLocked?(f.level==='junior'?'初中：':'高中：'):'';
  function neutralizationQuestion(a,b,f={asks:'equivalence,nature,ph'}) {
    return `${heading(f)}25°C，初始盐酸体积为${a}mL，累计加入NaOH溶液体积为${b}mL，HCl与NaOH的浓度均为0.100mol/L，完全电离且体积可加且忽略活度，求${f.asks.split(',').map(k=>acidAskText[k]).join('、')}。`;
  }
  function coolingQuestion(w,t,f={asks:'crystals,dissolved,mother'}) {
    return `${heading(f)}初始为60°C饱和的纯KNO₃水溶液，水质量为${w}g，冷却至${t}°C，不蒸发且不损失水，充分达到平衡，求${f.asks.split(',').map(k=>saltAskText[k]).join('、')}。`;
  }
  window.MasterLabEquilibriaQuestions=Object.freeze({neutralization,cooling,neutralizationQuestion,coolingQuestion,acidAsks,saltAsks,acidHelp,saltHelp});
})();
