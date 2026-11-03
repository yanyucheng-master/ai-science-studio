/* Fixed-multiplier discrete population model; values are model quantities, not a census. */
(() => {
  'use strict';
  const LIMITS=Object.freeze({initialMin:1,initialMax:1000000,multiplierMin:.1,multiplierMax:3,periodsMax:20});
  function issue(initial,multiplier,periods){
    if(!Number.isSafeInteger(initial)||initial<LIMITS.initialMin||initial>LIMITS.initialMax)return '初始数量支持1–1000000整数。';
    if(typeof multiplier!=='number'||!Number.isFinite(multiplier)||multiplier<LIMITS.multiplierMin||multiplier>LIMITS.multiplierMax||Math.abs(multiplier*100-Math.round(multiplier*100))>1e-9)return '每期倍数支持0.1–3，最多两位小数。';
    if(!Number.isSafeInteger(periods)||periods<0||periods>LIMITS.periodsMax)return '期数支持0–20整数；不计算期内数量。';
    return '';
  }
  function calculate(initial,multiplier,periods){
    const error=issue(initial,multiplier,periods);if(error)throw new RangeError(error);
    const points=Array.from({length:periods+1},(_,period)=>Object.freeze({period,quantity:initial*Math.pow(multiplier,period)}));
    // The declared domain keeps every result finite and strictly positive, including decline.
    return Object.freeze({version:1,initial,multiplier,periods,quantity:points[periods].quantity,
      trend:multiplier>1?'growth':multiplier<1?'decline':'stable',points:Object.freeze(points)});
  }
  const twoDecimals=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n*100-Math.round(n*100))<1e-9;
  function logisticIssue(initial,capacity,rate,time){
    if(!Number.isSafeInteger(initial)||!Number.isSafeInteger(capacity)||initial<1||capacity>1000000||initial>=capacity)return '连续模型支持整数初态和K，须满足1≤初始数量<K≤1000000。';
    if(!twoDecimals(rate)||rate<.01||rate>2)return '连续增长参数r支持0.01–2每天，最多两位小数。';
    if(!twoDecimals(time)||time<0||time>20)return '连续模型时间支持0–20天，最多两位小数。';
    return '';
  }
  function logistic(initial,capacity,rate,time){
    const error=logisticIssue(initial,capacity,rate,time);if(error)throw new RangeError(error);
    const a=(capacity-initial)/initial;
    const pointAt=t=>{
      const z=a*Math.exp(-rate*t),denom=1+z;
      // Equivalent to r*N*(1-N/K), without subtracting two nearly equal values.
      return Object.freeze({time:t,quantity:t===0?initial:capacity/denom,growthRate:rate*capacity*z/(denom*denom)});
    };
    const inflectionTime=Math.log(a)/rate;
    const peakTime=initial>=capacity/2?0:inflectionTime;
    const peakQuantity=initial>=capacity/2?initial:capacity/2;
    const peakRate=initial>=capacity/2?pointAt(0).growthRate:rate*capacity/4;
    const times=time===0?[0]:Array.from({length:121},(_,i)=>time*i/120);
    if(inflectionTime>0&&inflectionTime<time)times.push(inflectionTime);
    const points=[...new Set(times)].sort((a,b)=>a-b).map(pointAt);
    return Object.freeze({version:1,initial,capacity,rate,time,...pointAt(time),inflectionTime,peakTime,peakQuantity,peakRate,
      peakPosition:initial<capacity/2?'future':initial===capacity/2?'initial':'past',
      points:Object.freeze(points),table:Object.freeze((time===0?[0]:[0,time/4,time/2,time*3/4,time]).map(pointAt))});
  }
  window.MasterLabPopulation=Object.freeze({version:1,LIMITS,issue,calculate,logisticIssue,logistic});
})();
