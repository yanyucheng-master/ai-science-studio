/* Fixed PEP 2024-audited Grade 7 lower-volume protocol, pp29–30.
   This is an ordered qualitative demonstration, never a kinetics/yield model. */
(() => {
  'use strict';
  const STEPS = Object.freeze([
    {title:'暗处理',time:'一昼夜',action:'将盆栽天竺葵放在黑暗处一昼夜。',purpose:'让叶片原有的淀粉运走、耗尽，减少原有淀粉对检验的干扰。'},
    {title:'双面遮光与光照',time:'阳光下几小时',action:'同一叶片局部用黑纸从上下两面遮住，用曲别针固定，再放到阳光下。',purpose:'同一叶片的见光区与遮光区作对照，比较是否见光。'},
    {title:'摘叶并去纸',time:'光照几小时后',action:'摘取处理过的叶片，撤去黑纸片。',purpose:'保留同一叶片原来的两个区域，准备检验；去纸后两区都仍是绿色。'},
    {title:'酒精水浴脱色',time:'观察到叶片黄白',action:'将叶片放入装有酒精的小烧杯，再将小烧杯放入水浴锅中加热。',purpose:'叶绿素溶入酒精，使叶片呈黄白色，便于观察后面的显色。'},
    {title:'漂洗与滴碘',time:'先漂洗，再滴加',action:'先用清水漂洗叶片，再移入培养皿，向叶片滴加碘液。',purpose:'漂去酒精后，用碘液检验淀粉；不能把脱色当成淀粉检验。'},
    {title:'冲洗并观察',time:'稍停片刻后冲洗',action:'稍停片刻，用清水冲掉碘液，再比较叶片两个区域的颜色。',purpose:'原见光区变蓝，原遮光区不变蓝；联系碘液检验与同叶对照解释结果。'}
  ].map(Object.freeze));
  const MATERIALS = Object.freeze(['盆栽天竺葵','黑纸片','曲别针','酒精','清水','小烧杯','水浴锅','培养皿','碘液','镊子']);
  function frame(progress) {
    if (!Number.isFinite(progress)||progress<0||progress>1) throw new RangeError('演示进度须在0–1之间。');
    const step=Math.min(5,Math.floor(progress*6)),local=progress===1?1:progress*6-step;
    const rinsed=step===5&&local>=.65;
    return Object.freeze({step,local,completed:progress===1?6:step,
      dark:step===0,paper:step===1,detached:step>=2,paperRemoved:step>=2,
      decolorized:step>=4||step===3&&local>=.8,
      iodine:step>4||step===4&&local>=.55,
      waterRinse:step===4&&local<.4||step===5&&local>=.3&&local<.65,
      observationReady:rinsed,
      exposed:rinsed?'blue':step===5||step===4&&local>=.55?'iodine':step>=4||step===3&&local>=.8?'yellowWhite':'green',
      covered:rinsed?'yellowWhite':step===5||step===4&&local>=.55?'iodine':step>=4||step===3&&local>=.8?'yellowWhite':'green'});
  }
  window.MasterLabPhotosynthesis=Object.freeze({version:1,STEPS,MATERIALS,frame});
})();
