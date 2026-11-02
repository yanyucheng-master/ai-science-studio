/* Complete-clause microscope questions: magnification, field comparison, inversion. */
(() => {
  'use strict';
  const C=window.MasterLabMicroscope;if(!C)return;
  const ASK=Object.freeze({magnification:'总放大倍数',diameter:'新视野与原视野的直径比',area:'新视野与原视野的面积比',count:'近似细胞数',direction:'物像移动方向'});
  const DEC='(\\d+(?:\\.\\d{1,2})?)';
  const exact=(prefix,suffix)=>new RegExp(`^${prefix}${DEC}${suffix}$`);
  const eyepiece=exact('目镜(?:为|是|=)?','倍'),objective=exact('物镜(?:为|是|=)?','倍');
  const oldObjective=exact('原物镜(?:为|是|=)?','倍'),newObjective=exact('新物镜(?:为|是|=)?','倍');
  const twoDecimals=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n*100-Math.round(n*100))<1e-9;
  function issue(f,p1,p2){
    if(!f||!['junior','senior'].includes(f.level)||typeof f.levelLocked!=='boolean'||f.version!==1)return '学段或模型版本无效。';
    if(typeof f.asks!=='string'||!f.asks||new Set(f.asks.split(',')).size!==f.asks.split(',').length)return '所问无效。';
    const allowed=f.mode==='magnification'?['magnification']:f.mode==='field'?['diameter','area','count']:f.mode==='direction'?['direction']:[];
    if(f.asks.split(',').some(ask=>!allowed.includes(ask)))return '此模式不支持所问。';
    if(f.mode==='magnification'){
      if(f.noAdditionalOptics!==true)return '总倍数模式须明确没有额外放大镜组。';
      if(!twoDecimals(p1)||p1<1||p1>40||!twoDecimals(p2)||p2<1||p2>100)return '目镜支持1–40倍，物镜支持1–100倍，最多两位小数。';
      try{C.magnification(p1,p2);}catch(e){return e.message;}
    }else if(f.mode==='field'){
      if(!twoDecimals(f.eyepiece)||f.eyepiece<1||f.eyepiece>40||!twoDecimals(f.initialObjective)||f.initialObjective<1||f.initialObjective>100||!twoDecimals(p1)||p1<1||p1>100||!Number.isSafeInteger(p2)||p2<0||p2>2000)return '比较模式的镜头倍数或原细胞数超出支持范围。';
      try{C.compareObjectives({...f,targetObjective:p1,initialCount:p2});}catch(e){return e.message;}
    }else if(f.mode==='direction'){
      if(f.invertedImage!==true||f.positiveAxes!==true)return '倒像方向模式须明确倒像与向右、向上为正。';
      if(![p1,p2].every(n=>Number.isSafeInteger(n)&&n>=-5&&n<=5))return '示意移位支持-5至5整数格；不表示实际距离。';
    }else return '模式无效。';
    return '';
  }
  function parse(text,context={}){
    if(typeof text!=='string')return {ok:false,message:'题目须为文本。'};
    let s=text.normalize('NFKC').replace(/\s/g,'').replace(/−/g,'-');
    const grade=s.match(/^(初中|高中)[:,]?/);if(grade)s=s.slice(grade[0].length);
    const fixed={version:1,level:grade?(grade[1]==='初中'?'junior':'senior'):context.gradeLevel||'senior',levelLocked:Boolean(grade)};
    const given={},asks=new Set();let bad=false,afterAsk=false;
    const put=(key,value)=>{if(Object.hasOwn(given,key))bad=true;given[key]=value;};
    for(const clause of s.split(/[,。;?:]+/).filter(Boolean)){
      const marker=clause.match(/^(?:请)?(?:求|计算|比较)(.+)$/),body=marker?marker[1]:clause;
      const keys=body.split(/、|以及|及/).map(name=>Object.keys(ASK).find(key=>ASK[key]===name));
      if(marker||afterAsk&&keys.every(Boolean)){if(keys.some(k=>!k))bad=true;else keys.forEach(k=>asks.add(k));afterAsk=true;continue;}
      afterAsk=false;let m;
      if(clause==='光学显微镜')put('instrument',true);
      else if(clause==='无额外放大镜组')put('noAdditionalOptics',true);
      else if(clause==='同一目镜且视场数不变'){put('sameEyepiece',true);put('sameFieldNumber',true);}
      else if(clause==='中间倍率不变')put('sameIntermediateMagnification',true);
      else if(clause==='同一样本且分布均匀'){put('sameSample',true);put('uniformSample',true);}
      else if(clause==='物像为倒像')put('invertedImage',true);
      else if(clause==='设向右、向上为正')put('positiveAxes',true);
      else if((m=clause.match(/^玻片水平移位(?:为|是|=)?(-?\d+)格$/)))put('horizontal',Number(m[1]));
      else if((m=clause.match(/^竖直移位(?:为|是|=)?(-?\d+)格$/)))put('vertical',Number(m[1]));
      else if((m=clause.match(eyepiece)))put('eyepiece',Number(m[1]));
      else if((m=clause.match(objective)))put('objective',Number(m[1]));
      else if((m=clause.match(oldObjective)))put('initialObjective',Number(m[1]));
      else if((m=clause.match(newObjective)))put('targetObjective',Number(m[1]));
      else if((m=clause.match(/^原视野有(\d{1,4})个细胞$/)))put('initialCount',Number(m[1]));
      else bad=true;
    }
    let p1,p2;
    if(Object.hasOwn(given,'invertedImage')||Object.hasOwn(given,'horizontal')||Object.hasOwn(given,'vertical')){
      fixed.mode='direction';fixed.invertedImage=given.invertedImage;fixed.positiveAxes=given.positiveAxes;p1=given.horizontal;p2=given.vertical;
      if(Object.keys(given).some(k=>!['instrument','invertedImage','positiveAxes','horizontal','vertical'].includes(k)))bad=true;
    }else if(Object.hasOwn(given,'objective')){
      fixed.mode='magnification';fixed.noAdditionalOptics=given.noAdditionalOptics;p1=given.eyepiece;p2=given.objective;
      if(Object.keys(given).some(k=>!['instrument','eyepiece','objective','noAdditionalOptics'].includes(k)))bad=true;
    }else{
      fixed.mode='field';fixed.eyepiece=given.eyepiece;fixed.initialObjective=given.initialObjective;p1=given.targetObjective;p2=given.initialCount;
      for(const key of Object.keys(C.COMPARISON_CONDITIONS))fixed[key]=given[key];
      if(Object.hasOwn(given,'noAdditionalOptics'))bad=true;
    }
    fixed.asks=[...asks].sort().join(',');
    const error=issue(fixed,p1,p2);
    if(bad||!given.instrument||error)return {ok:false,message:error||'题目含缺失、重复或不支持的条件；请核对显微镜模式及所问。'};
    return {ok:true,p1,p2,fixed};
  }
  function question(p1,p2,f){
    const error=issue(f,p1,p2);if(error)throw new RangeError(error);
    const prefix=f.levelLocked?(f.level==='junior'?'初中：':'高中：'):'';
    const facts=f.mode==='direction'?`物像为倒像，设向右、向上为正，玻片水平移位为${p1}格，竖直移位为${p2}格`:
      f.mode==='magnification'?`目镜为${p1}倍，物镜为${p2}倍，无额外放大镜组`:
      `目镜为${f.eyepiece}倍，原物镜为${f.initialObjective}倍，新物镜为${p1}倍，同一目镜且视场数不变，中间倍率不变，同一样本且分布均匀，原视野有${p2}个细胞`;
    return `${prefix}光学显微镜，${facts}，求${f.asks.split(',').map(k=>ASK[k]).join('、')}。`;
  }
  window.MasterLabMicroscopeQuestions=Object.freeze({version:1,ASK,parse,question,issue});
})();
