/* Classroom compound light microscope model. Pure calculations; no rendering or AI.
   Two-lens total magnification assumes no additional magnifying optics.
   Relative field size compares objectives under explicitly unchanged conditions. */
(() => {
  'use strict';
  const COMPARISON_CONDITIONS=Object.freeze({
    sameEyepiece:true,
    sameFieldNumber:true,
    sameIntermediateMagnification:true,
    sameSample:true,
    uniformSample:true
  });
  const OPPOSITE=Object.freeze({up:'down',down:'up',left:'right',right:'left'});
  function positive(value,label){
    if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new RangeError(`${label}必须为有限正数。`);
    return value;
  }
  function finitePositiveResult(value,label){
    if(!Number.isFinite(value)||value<=0)throw new RangeError(`${label}超出可计算范围。`);
    return value;
  }
  function magnification(eyepiece,objective){
    positive(eyepiece,'目镜倍数');positive(objective,'物镜倍数');
    return finitePositiveResult(eyepiece*objective,'总放大倍数');
  }
  function compareObjectives(input){
    if(!input||Object.keys(COMPARISON_CONDITIONS).some(key=>input[key]!==true)){
      throw new RangeError('须明确同一目镜、同一视场数、中间倍率不变、同一样本且分布均匀。');
    }
    const {eyepiece,initialObjective,targetObjective,initialCount}=input;
    positive(eyepiece,'目镜倍数');positive(initialObjective,'原物镜倍数');positive(targetObjective,'新物镜倍数');
    if(!Number.isSafeInteger(initialCount)||initialCount<0)throw new RangeError('原视野细胞数必须为非负安全整数。');
    // Field diameter = field number / (objective * intermediate factor).
    // The unchanged field number and intermediate factor cancel in this ratio.
    const diameterRatio=finitePositiveResult(initialObjective/targetObjective,'视野直径比例');
    const areaRatio=finitePositiveResult(diameterRatio*diameterRatio,'视野面积比例');
    const approximateCount=initialCount*areaRatio;
    if(!Number.isFinite(approximateCount)||(initialCount>0&&approximateCount===0))throw new RangeError('近似细胞数超出可计算范围。');
    return Object.freeze({
      version:1,eyepiece,initialObjective,targetObjective,initialCount,
      // Unchanged intermediate optics cancel in a ratio, but their unknown
      // value does not justify reporting an absolute total magnification.
      diameterRatio,areaRatio,
      // An area-based estimate, not a predicted exact integer cell count.
      approximateCount,countIsApproximate:true
    });
  }
  function invertedImageDirection(slideDirection){
    if(!Object.hasOwn(OPPOSITE,slideDirection))throw new RangeError('玻片移动方向仅支持上、下、左、右。');
    return OPPOSITE[slideDirection];
  }
  // Offsets are normalized diagram coordinates, not physical slide/image lengths.
  function invertedImageOffset(horizontal,vertical){
    if(!Number.isFinite(horizontal)||!Number.isFinite(vertical))throw new RangeError('示意坐标必须为有限数。');
    const x=horizontal===0?0:-horizontal,y=vertical===0?0:-vertical;
    const direction=(x<0?'左':x>0?'右':'')+(y<0?'下':y>0?'上':'');
    return Object.freeze({x,y,direction:direction||'不移动'});
  }
  window.MasterLabMicroscope=Object.freeze({version:1,COMPARISON_CONDITIONS,magnification,compareObjectives,invertedImageDirection,invertedImageOffset});
})();
