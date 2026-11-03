/* All clauses must be consumed. Missing assumptions never acquire preset values. */
(() => {
  'use strict';
  const C=window.MasterLabPopulation;if(!C)return;
  const ASK=Object.freeze({quantity:'种群模型数量',trend:'数量变化趋势',rate:'瞬时增长速率',peak:'起点后最大增长速率'});
  function issue(f,multiplier,periods){
    if(!f||f.version!==1||!['junior','senior'].includes(f.level)||typeof f.levelLocked!=='boolean')return '模型版本或学段无效。';
    if(f.mode==='logistic'){
      if(f.constantCapacity!==true||f.constantRate!==true||f.timeUnit!=='day')return '连续模型须明确K和r恒定，r单位为每天，时间单位为天。';
      const asks=typeof f.asks==='string'?f.asks.split(','):[];
      if(!asks.length||new Set(asks).size!==asks.length||asks.some(k=>!['quantity','rate','peak'].includes(k)))return '连续模型仅支持数量、瞬时增长速率和起点后最大增长速率。';
      return C.logisticIssue(f.initial,f.capacity,multiplier,periods);
    }
    if(f.mode!==undefined&&f.mode!=='discrete')return '种群模型模式无效。';
    if(f.fixedMultiplier!==true||f.equalPeriods!==true)return '须明确按固定倍数变化，且每期时长相同。';
    if(!['quantity','trend','quantity,trend'].includes(f.asks))return '仅支持正向模型数量与变化趋势。';
    return C.issue(f.initial,multiplier,periods);
  }
  function parse(text,context={}){
    if(typeof text!=='string')return {ok:false,message:'题目须为文本。'};
    let s=text.normalize('NFKC').replace(/\s/g,'');
    const grade=s.match(/^(初中|高中)[:,]?/);if(grade)s=s.slice(grade[0].length);
    const fixed={version:1,level:grade?(grade[1]==='初中'?'junior':'senior'):context.gradeLevel||'senior',levelLocked:Boolean(grade)};
    const given={},asks=new Set();let bad=false,afterAsk=false;
    const put=(key,value)=>{if(Object.hasOwn(given,key))bad=true;given[key]=value;};
    for(const clause of s.split(/[,。;?:]+/).filter(Boolean)){
      const marker=clause.match(/^(?:请)?(?:求|计算|判断)(.+)$/),body=marker?marker[1]:clause;
      const keys=body.split(/、|以及|及/).map(name=>Object.keys(ASK).find(key=>ASK[key]===name));
      if(marker||afterAsk&&keys.every(Boolean)){if(keys.some(k=>!k))bad=true;else keys.forEach(k=>{if(asks.has(k))bad=true;asks.add(k);});afterAsk=true;continue;}
      afterAsk=false;let m;
      if(clause==='种群数量按固定倍数变化')put('fixedMultiplier',true);
      else if(/^采用连续logistic种群模型$/i.test(clause))put('logistic',true);
      else if(clause==='环境容纳量K恒定')put('constantCapacity',true);
      else if(clause==='连续增长参数r恒定')put('constantRate',true);
      else if((m=clause.match(/^环境容纳量K(?:为|是|=)?(\d+)个$/)))put('capacity',Number(m[1]));
      else if((m=clause.match(/^连续增长参数r(?:为|是|=)?(\d+(?:\.\d{1,2})?)每天$/)))put('rate',Number(m[1]));
      else if((m=clause.match(/^经过(\d+(?:\.\d{1,2})?)天$/)))put('time',Number(m[1]));
      else if(clause==='每期时长相同')put('equalPeriods',true);
      else if((m=clause.match(/^初始数量(?:为|是|=)?(\d+)个$/)))put('initial',Number(m[1]));
      else if((m=clause.match(/^每期数量是前一期的(\d+(?:\.\d{1,2})?)倍$/)))put('multiplier',Number(m[1]));
      else if((m=clause.match(/^经过(\d+)期$/)))put('periods',Number(m[1]));
      else bad=true;
    }
    Object.assign(fixed,{initial:given.initial,asks:[...asks].sort().join(',')});
    let p1,p2;
    if(given.logistic){
      Object.assign(fixed,{mode:'logistic',constantCapacity:given.constantCapacity,constantRate:given.constantRate,capacity:given.capacity,timeUnit:'day'});p1=given.rate;p2=given.time;
      if(Object.keys(given).some(k=>!['logistic','constantCapacity','constantRate','initial','capacity','rate','time'].includes(k)))bad=true;
    }else{
      Object.assign(fixed,{mode:'discrete',fixedMultiplier:given.fixedMultiplier,equalPeriods:given.equalPeriods});p1=given.multiplier;p2=given.periods;
      if(Object.keys(given).some(k=>!['fixedMultiplier','equalPeriods','initial','multiplier','periods'].includes(k)))bad=true;
    }
    const error=issue(fixed,p1,p2);
    if(bad||error)return {ok:false,message:bad?'题目包含重复、冲突或不支持的条件/所问；请核对固定倍数、等长期数和正向所问。':error};
    return {ok:true,p1,p2,fixed};
  }
  function question(multiplier,periods,f){
    const error=issue(f,multiplier,periods);if(error)throw new RangeError(error);
    if(f.mode==='logistic')return `${f.levelLocked?(f.level==='junior'?'初中：':'高中：'):''}采用连续logistic种群模型，环境容纳量K恒定，连续增长参数r恒定，初始数量为${f.initial}个，环境容纳量K为${f.capacity}个，连续增长参数r为${multiplier}每天，经过${periods}天，求${f.asks.split(',').map(k=>ASK[k]).join('、')}。`;
    return `${f.levelLocked?(f.level==='junior'?'初中：':'高中：'):''}种群数量按固定倍数变化，每期时长相同，初始数量为${f.initial}个，每期数量是前一期的${multiplier}倍，经过${periods}期，求${f.asks.split(',').map(k=>ASK[k]).join('、')}。`;
  }
  window.MasterLabPopulationQuestions=Object.freeze({parse,question,issue,ASK});
})();
