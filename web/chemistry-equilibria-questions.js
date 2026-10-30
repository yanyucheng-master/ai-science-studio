/* Conservative complete-question grammar for the two approved chemistry v2
   models. Unknown clauses never disappear into a keyword-only match. */
(() => {
  'use strict';
  const core = window.MasterLabChemistryEquilibria;
  if (!core) return;
  const N = '[+-]?\\d+(?:\\.\\d+)?';
  const ACID = '(?:稀?盐酸(?:溶液)?|HCl(?:溶液)?)';
  const BASE = '(?:稀?氢氧化钠(?:溶液)?|NaOH(?:溶液)?)';
  const SALT = '(?:硝酸钾|KNO3)';
  const V = `(${N})(mL|ml|毫升|L|升)`;
  const C = `(${N})mol/L`;
  const concentration=raw=>/^\+?0+\.10*$/.test(raw)?0.1:NaN;
  const fail = message => ({ok:false,message});
  const acidHelp = '请明确两液均为0.100mol/L、初始溶液10–50mL和累计加入另一溶液0–100mL（盐酸中加NaOH，或NaOH溶液中加盐酸）；温度可写25°C、常温或不写（按25°C）。支持当前pH、酸碱性或理论中和所需加入液总体积。';
  const saltHelp = '请明确60°C饱和的纯KNO₃水溶液、水质量50–200g、终温20/30/40/50/60°C、不蒸发不失水并达到平衡；支持析晶、终态溶解量和母液质量。';
  const acidAsks = {
    ph:/^(?:当前|最终|混合后)?(?:混合液|溶液)?(?:的)?pH(?:值)?$/i,
    nature:/^(?:当前|最终|混合后)?(?:混合液|溶液)?(?:的)?酸碱性$/,
    // The reagent must be the added solution; neutralization() checks it against the direction.
    equivalence:new RegExp(`^(?:理论)?(?:恰好|完全)?中和(?:所需|需要)(?:的)?(?:${ACID}|${BASE})(?:的)?(?:总体积|总加入体积)$`,'i')
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
    // "并判断…" "再求…" open a new ask clause, like a comma before the verb.
    source = source.replace(/(?:并且|并|再|同时|然后)(?=(?:请)?(?:求出|求|计算|判断|确定))/g,'，');
    const givens=[], asks=new Set(), askNames={};let followingAsk=false;
    for (const part of source.split(/[，,。；;！!？?：:]+/).filter(Boolean)) {
      const marker=part.match(/^(?:请)?(?:求出|求|计算|判断|确定)(.+)$/);
      const body=marker?marker[1]:part;
      const names=body.split(/以及|、|及|与|(?<!中)和/);
      const keys=names.map(name=>Object.keys(patterns).find(key=>patterns[key].test(name)));
      if (marker || followingAsk && keys.every(Boolean)) {
        if (!keys.length || keys.some(key=>!key)) return fail('存在未支持的所问，不能省略子问或改换所求量。');
        keys.forEach((key,i)=>{asks.add(key);(askNames[key]||=[]).push(names[i]);});followingAsk=true;
      } else { givens.push(part);followingAsk=false; }
    }
    if (!asks.size) return fail('请明确所求量；理论中和总体积与“还需加入”是不同问题。');
    return {ok:true,givens,askNames,fixed:{level,levelLocked:Boolean(grade),asks:[...asks].sort().join(',')}};
  }
  const isAcid=name=>/盐酸|HCl/i.test(name);
  const DROP='(?:逐滴|慢慢|缓慢|缓缓)?(?:累计)?';
  const ADD='(?:加入|滴入|滴加|滴加入)';
  function neutralization(text, context) {
    const p=pieces(text,acidAsks,context);if(!p.ok)return p;
    const values={};let bad=false,direction;
    const put=(key,value)=>{if(Object.hasOwn(values,key))bad=true;values[key]=value;};
    // Each volume clause also fixes which solution is in the beaker; mixed roles are a conflict.
    const role=(initialIsAcid)=>{const d=initialIsAcid?'baseIntoAcid':'acidIntoBase';if(direction&&direction!==d)bad=true;direction=d;};
    const volume=(name,value,unit)=>put(isAcid(name)?'acidVolume':'baseVolume',scalar(value,unit));
    const strength=(name,raw)=>{if(raw!==undefined)put(isAcid(name)?'acidConcentration':'baseConcentration',concentration(raw));};
    const roomTemperature=()=>put('temperature',25);
    for(let clause of p.givens) {
      let m;
      // A leading "25°C时" / "常温下" may introduce the mixing sentence itself.
      const lead=clause.match(new RegExp(`^(?:在)?(?:(${N})℃|常温|室温)(?:时|下|条件下)(?=.)`));
      if(lead&&!new RegExp(`^(?:在)?(?:(${N})℃|常温|室温)(?:时|下|条件下)$`).test(clause)){
        if(lead[1]!==undefined)put('temperature',scalar(lead[1],'℃'));else roomTemperature();
        clause=clause.slice(lead[0].length);
      }
      if((m=clause.match(new RegExp(`^(?:在|温度(?:为|是|=)?)?(${N})℃(?:时|下)?$`))))put('temperature',scalar(m[1],'℃'));
      else if(/^(?:在)?(?:常温|室温)(?:时|下|条件下)?$/.test(clause))roomTemperature();
      else if((m=clause.match(new RegExp(`^(?:初始|起始)(?:取|有)?(${ACID}|${BASE})(?:的)?(?:体积)?(?:为|是|=)?${V}$`,'i')))){role(isAcid(m[1]));volume(m[1],m[2],m[3]);}
      else if((m=clause.match(new RegExp(`^(?:初始|起始)(?:取|有)?${V}(?:的)?(${ACID}|${BASE})$`,'i')))){role(isAcid(m[3]));volume(m[3],m[1],m[2]);}
      else if((m=clause.match(new RegExp(`^(?:已)?(?:累计)?${ADD}(${ACID}|${BASE})(?:的)?(?:总体积|体积)?(?:为|是|=)?${V}$`,'i')))){role(!isAcid(m[1]));volume(m[1],m[2],m[3]);}
      else if((m=clause.match(new RegExp(`^(?:已)?(?:累计)?${ADD}${V}(?:的)?(${ACID}|${BASE})$`,'i')))){role(!isAcid(m[3]));volume(m[3],m[1],m[2]);}
      else if((m=clause.match(new RegExp(`^(?:${ACID}(?:与|和)${BASE}|${BASE}(?:与|和)${ACID}|两(?:种)?溶液|两液|二者|两者)?(?:的)?(?:物质的量)?浓度均(?:为|是|=)${C}$`,'i')))){
        put('acidConcentration',concentration(m[1]));put('baseConcentration',concentration(m[1]));
      } else if((m=clause.match(new RegExp(`^(${ACID}|${BASE})(?:的)?(?:物质的量)?浓度(?:为|是|=)${C}$`,'i'))))strength(m[1],m[2]);
      // "向20mL…盐酸中加入15mL…NaOH溶液" (beaker first) and "将20mL…盐酸滴入30mL…NaOH溶液中" (added first).
      else if((m=clause.match(new RegExp(`^向${V}(?:浓度为)?(?:${C})?(?:的)?(${ACID}|${BASE})中${DROP}${ADD}${V}(?:浓度为)?(?:${C})?(?:的)?(${ACID}|${BASE})$`,'i')))){
        const [,v1,u1,c1,r1,v2,u2,c2,r2]=m;
        if(isAcid(r1)===isAcid(r2))bad=true;else{role(isAcid(r1));volume(r1,v1,u1);strength(r1,c1);volume(r2,v2,u2);strength(r2,c2);}
      } else if((m=clause.match(new RegExp(`^(?:将|把)?${V}(?:浓度为)?(?:${C})?(?:的)?(${ACID}|${BASE})${DROP}(?:加入|滴入|滴加|加到|滴到|加入到|滴加到)${V}(?:浓度为)?(?:${C})?(?:的)?(${ACID}|${BASE})中$`,'i')))){
        const [,v1,u1,c1,r1,v2,u2,c2,r2]=m;
        if(isAcid(r1)===isAcid(r2))bad=true;else{role(isAcid(r2));volume(r1,v1,u1);strength(r1,c1);volume(r2,v2,u2);strength(r2,c2);}
      } else if(clause==='完全电离且体积可加且忽略活度')put('ideal',true);
      else bad=true;
    }
    if(bad)return fail(`条件重复、冲突或含未支持内容。${acidHelp}`);
    direction=direction||'baseIntoAcid';
    // "理论中和所需…总体积" must name the solution that is being added.
    if((p.askNames.equivalence||[]).some(name=>isAcid(name)!==(direction==='acidIntoBase')))
      return fail(`理论中和所需体积应针对正在加入的${direction==='acidIntoBase'?'盐酸':'NaOH溶液'}。${acidHelp}`);
    // Textbook pH questions without a stated temperature mean room temperature (25°C, Kw≈1×10⁻¹⁴); the page says so.
    const temperatureAssumed=!Object.hasOwn(values,'temperature');
    if(temperatureAssumed)values.temperature=25;
    try { core.neutralization({...values,direction}); } catch { return fail(acidHelp); }
    const reverse=direction==='acidIntoBase';
    return {ok:true,p1:reverse?values.baseVolume:values.acidVolume,p2:reverse?values.acidVolume:values.baseVolume,
      fixed:{...p.fixed,temperature:values.temperature,acidConcentration:values.acidConcentration,baseConcentration:values.baseConcentration,direction,temperatureAssumed}};
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
  const acidAskTextReverse={...acidAskText,equivalence:'理论恰好中和所需盐酸总体积'};
  const saltAskText={crystals:'析出晶体质量',dissolved:'终态溶解KNO₃质量',mother:'母液质量'};
  const heading=f=>f.levelLocked?(f.level==='junior'?'初中：':'高中：'):'';
  function neutralizationQuestion(a,b,f={asks:'equivalence,nature,ph'}) {
    // Mirror the original wording: an unstated temperature stays unstated, and the beaker solution comes first.
    const temperature=f.temperatureAssumed?'':'25°C，';
    if(f.direction==='acidIntoBase')return `${heading(f)}${temperature}初始NaOH溶液体积为${a}mL，累计加入盐酸体积为${b}mL，HCl与NaOH的浓度均为0.100mol/L，完全电离且体积可加且忽略活度，求${f.asks.split(',').map(k=>acidAskTextReverse[k]).join('、')}。`;
    return `${heading(f)}${temperature}初始盐酸体积为${a}mL，累计加入NaOH溶液体积为${b}mL，HCl与NaOH的浓度均为0.100mol/L，完全电离且体积可加且忽略活度，求${f.asks.split(',').map(k=>acidAskText[k]).join('、')}。`;
  }
  function coolingQuestion(w,t,f={asks:'crystals,dissolved,mother'}) {
    return `${heading(f)}初始为60°C饱和的纯KNO₃水溶液，水质量为${w}g，冷却至${t}°C，不蒸发且不损失水，充分达到平衡，求${f.asks.split(',').map(k=>saltAskText[k]).join('、')}。`;
  }
  window.MasterLabEquilibriaQuestions=Object.freeze({neutralization,cooling,neutralizationQuestion,coolingQuestion,acidAsks,saltAsks,acidHelp,saltHelp});
})();
