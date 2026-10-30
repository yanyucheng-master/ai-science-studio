/* Unit circle: bounded checked syntax, deterministic values and one shared clock.
   Integer hundredths of a degree decide exact angles; display rounding never does. */
(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit;
  if(!kit)return;
  const {fact,miss,stages}=kit.helpers;
  const number=value=>String(Number(value.toFixed(6))).replace(/-/g,'−');
  const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
  const validDegree=value=>Number.isFinite(value)&&value>=-360&&value<=360&&Math.round(value*100)/100===value;
  function radiansText(degree){
    const cents=Math.round(degree*100);
    if(!cents)return '0';
    const divisor=gcd(Math.abs(cents),18000),n=Math.abs(cents)/divisor,d=18000/divisor;
    return `${cents<0?'−':''}${n===1?'':n}π${d===1?'':`/${d}`}`;
  }
  function degreeToken(raw,unit){
    if(unit==='deg'){
      if((raw.split('.')[1]?.length||0)>2||raw.length>9)return null;
      const value=Number(raw);
      return validDegree(value)?value:null;
    }
    const compact=raw.replace(/\s/g,'');
    if(/^[+-]?0(?:\.0{1,2})?$/.test(compact))return 0;
    const match=compact.match(/^([+-]?)(\d{1,6})?π(?:\/([1-9]\d{0,5}))?$/);
    if(!match)return null;
    const n=BigInt(match[2]||'1')*(match[1]==='-'?-1n:1n),d=BigInt(match[3]||'1'),cents=n*18000n;
    if(cents%d!==0n)return null;
    const value=Number(cents/d)/100;
    return validDegree(value)?value:null;
  }
  const askPatterns={
    sin:/^(?:sin\s*(?:θ|theta)|正弦(?:值|函数值)?|θ的正弦值)$/i,
    cos:/^(?:cos\s*(?:θ|theta)|余弦(?:值|函数值)?|θ的余弦值)$/i,
    point:/^(?:点?P的?坐标|单位圆上点P的?坐标)$/i,
    position:/^(?:象限(?:位置)?|坐标轴位置|象限或坐标轴位置|终边位置)$/,
    periodic:/^(?:周期关系|周期性|范围内相差360°的角的终边及坐标)$/
  };
  const failText='需明确单位圆中的角θ：−360°至360°、最多两位小数，或可精确换算到此精度的整数倍π分数；半径固定1。仅求sinθ、cosθ、P坐标、位置或说明周期关系；不支持额外条件或子问。';
  function parseCircle(source){
    if(!/单位圆/.test(source))return miss(failText);
    let degree,unit,angleCount=0,radiusCount=0,bad=false,angleIssue='';
    const angle=new RegExp(String.raw`(?:角度?\s*(?:θ|theta)?|θ|theta)\s*(?:为|是|=)\s*([+-]?\s*(?:\d{1,6}\s*)?π(?:\s*\/\s*[1-9]\d{0,5})?|[+-]?\d+(?:\.\d+)?)\s*(rad|弧度|°|度)?`,'gi');
    let rest=source.replace(angle,(_,raw,suffix)=>{
      angleCount++;
      const hasPi=raw.includes('π'),asRad=hasPi||/^(rad|弧度)$/i.test(suffix||'');
      if(!suffix&&!hasPi||hasPi&&/^(°|度)$/.test(suffix||'')){bad=true;angleIssue='角的单位缺失或度/弧度冲突；度数须写°/度，π分数表示弧度。';}
      unit=asRad?'rad':'deg';degree=degreeToken(raw.trim(),unit);
      if(degree===null){bad=true;angleIssue=hasPi?'该弧度数不能在−360°至360°、整百分之一度范围内精确表示；不会舍入成另一个角。':'度数须在−360°至360°、最多两位小数；非零小数弧度暂不支持。';}
      return ' ';
    });
    rest=rest.replace(/半径\s*r?\s*(?:固定)?\s*(?:为|是|=)\s*1(?![\d.])/gi,()=>{radiusCount++;return ' ';});
    // Only fixed, non-numeric framing is removed. Every other condition remains
    // for the full-sentence check, even after an initial question or full stop.
    rest=rest.replace(/圆心(?:为|是)(?:坐标)?原点\s*O?|以原点\s*O?为圆心|单位圆\s*O?|已知|一个|在|中|的|请/gi,'');
    const asks=new Set();let askCount=0;
    rest=rest.replace(/(?:求出|求|计算|判断|确定|说明)\s*[:：]?\s*([^。；;:：!?！？]+)/g,(_,body)=>{
      askCount++;
      const parts=body.split(/以及|[、,，和与]/).map(s=>s.trim()).filter(Boolean);
      if(!parts.length)bad=true;
      for(const part of parts){const key=Object.keys(askPatterns).find(k=>askPatterns[k].test(part));if(key)asks.add(key);else bad=true;}
      return ' ';
    });
    const unknown=rest.replace(/[\s，,。；;：:、]/g,'');
    if(bad||angleCount!==1||radiusCount>1||!askCount||!asks.size||unknown||!validDegree(degree))return miss(angleIssue||failText);
    return {ok:true,p1:degree,p2:1,fixed:{unit,asks:[...asks].sort().join(',')}};
  }
  const special={
    0:[1,0,'1','0'],30:[Math.sqrt(3)/2,.5,'√3/2','1/2'],45:[Math.SQRT1_2,Math.SQRT1_2,'√2/2','√2/2'],60:[.5,Math.sqrt(3)/2,'1/2','√3/2'],90:[0,1,'0','1'],
    120:[-.5,Math.sqrt(3)/2,'−1/2','√3/2'],135:[-Math.SQRT1_2,Math.SQRT1_2,'−√2/2','√2/2'],150:[-Math.sqrt(3)/2,.5,'−√3/2','1/2'],180:[-1,0,'−1','0'],
    210:[-Math.sqrt(3)/2,-.5,'−√3/2','−1/2'],225:[-Math.SQRT1_2,-Math.SQRT1_2,'−√2/2','−√2/2'],240:[-.5,-Math.sqrt(3)/2,'−1/2','−√3/2'],270:[0,-1,'0','−1'],
    300:[.5,-Math.sqrt(3)/2,'1/2','−√3/2'],315:[Math.SQRT1_2,-Math.SQRT1_2,'√2/2','−√2/2'],330:[Math.sqrt(3)/2,-.5,'√3/2','−1/2']
  };
  function sampleAt(degree){
    const cents=Math.round(degree*100),terminal=((cents%36000)+36000)%36000;
    // Exact equality is checked before lookup; 89.99° is never an axis angle.
    const exact=degree===cents/100&&Object.hasOwn(special,terminal/100),row=exact?special[terminal/100]:null,radian=degree*Math.PI/180;
    const cos=row?row[0]:Math.cos(radian),sin=row?row[1]:Math.sin(radian);
    const cosText=row?row[2]:`≈ ${number(cos)}`,sinText=row?row[3]:`≈ ${number(sin)}`;
    let position;
    if(exact&&terminal%9000===0)position=['x轴正半轴','y轴正半轴','x轴负半轴','y轴负半轴'][terminal/9000]+'（轴上，不属于象限）';
    else {
      position=`第${cos>0?(sin>0?'Ⅰ':'Ⅳ'):(sin>0?'Ⅱ':'Ⅲ')}象限`;
    }
    return {degree,radian,cos,sin,cosText,sinText,exact,position,terminalDegree:degree===cents/100?terminal/100:((degree%360)+360)%360};
  }
  function fixedIssue(f,degree,radius){
    if(!validDegree(degree)||radius!==1)return '角度必须在−360°至360°且最多两位小数；半径固定1，不能夹取或舍入。';
    if(!['deg','rad'].includes(f.unit)||typeof f.asks!=='string'||!f.asks||f.asks.split(',').some(k=>!Object.hasOwn(askPatterns,k)))return '单位或所问模式无效。';
    return '';
  }
  function model(degree,radius=1,f={unit:'deg',asks:'cos,periodic,point,position,sin'}){
    const issue=fixedIssue(f,degree,radius);if(issue)throw new RangeError(issue);
    const sample=sampleAt(degree),radianExact=radiansText(degree),partner=(Math.round(degree*100)+(degree>0?-36000:36000))/100;
    const coordinate=`P ${sample.exact?'=':'≈'} (${sample.exact?sample.cosText:number(sample.cos)}, ${sample.exact?sample.sinText:number(sample.sin)})`;
    const direction=degree>0?'逆时针':degree<0?'顺时针':'不旋转',turns=Math.abs(degree)/360,turnCount=Math.abs(Math.round(degree*100)),turnDivisor=gcd(turnCount,36000),turnsText=`${turnCount/turnDivisor}${36000/turnDivisor===1?'':`/${36000/turnDivisor}`}`;
    const answers={sin:`sinθ ${sample.exact?'=':''} ${sample.sinText}`,cos:`cosθ ${sample.exact?'=':''} ${sample.cosText}`,point:coordinate,position:sample.position,periodic:`${number(degree)}°与${number(partner)}°终边、坐标相同，但有向旋转量不同；相差360°（2π rad）`};
    return {theta:degree,radius,unit:f.unit,asks:f.asks,...sample,radianExact,partner,direction,turns,turnsText,coordinate,
      metrics:[degree,1,sample.sin],metricUnit:'',facts:[fact('sinθ',sample.sinText),fact('cosθ',sample.cosText),fact('位置',sample.position)],
      formula:'P=(cosθ,sinθ)，sin²θ+cos²θ=1',formulaDetail:`${number(degree)}° = ${radianExact} rad；${coordinate}。横坐标是cosθ，纵坐标是sinθ。`,
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',readout:`目标θ=${number(degree)}° · ${sample.position}`,badge:'单位圆坐标定义 · 半径固定1'};
  }
  const xy=(degree,radius=105)=>[180+radius*Math.cos(degree*Math.PI/180),175-radius*Math.sin(degree*Math.PI/180)];
  function rotationPath(degree){
    if(degree===0)return '';
    const radius=38,sweep=degree>0?0:1,point=xy(degree,radius);
    if(Math.abs(degree)>=360)return `M218 175 A38 38 0 0 ${sweep} 142 175 A38 38 0 0 ${sweep} 218 175`;
    return `M218 175 A38 38 0 ${Math.abs(degree)>180?1:0} ${sweep} ${point[0]} ${point[1]}`;
  }
  function curvePath(fn){
    return Array.from({length:361},(_,i)=>{const rad=-2*Math.PI+i*4*Math.PI/360;return `${i?'L':'M'}${45+i*405/360} ${125-70*fn(rad)}`;}).join(' ');
  }
  const sinePath=curvePath(Math.sin),cosinePath=curvePath(Math.cos);
  function visual(m){
    return `<section class="math-lab-scene math-unit-circle" aria-label="单位圆与正弦余弦同步实验"><div class="math-scene-heading"><strong>单位圆 · 正弦与余弦</strong><span data-uc-phase>目标态</span></div><p class="unit-circle-target">原题采用${m.unit==='rad'?'弧度制':'角度制'}；目标θ = ${number(m.theta)}° = ${m.radianExact} rad，r = 1。</p><div class="unit-circle-panels"><figure><figcaption>等比例单位圆 · 正向逆时针</figcaption><svg class="unit-circle-diagram" viewBox="0 0 360 350" preserveAspectRatio="xMidYMid meet" role="img" aria-label="相同比例的x和y坐标轴，半径1，圆上点P及两条坐标投影"><defs><marker id="uc-rotation-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10Z"/></marker></defs><line x1="30" y1="175" x2="330" y2="175" class="uc-axis"/><line x1="180" y1="325" x2="180" y2="25" class="uc-axis"/><circle cx="180" cy="175" r="105" class="uc-circle" data-uc-circle/><text x="337" y="181">x</text><text x="188" y="27">y</text><text x="165" y="196">O</text><text x="285" y="198" text-anchor="middle">1</text><text x="75" y="198" text-anchor="middle">−1</text><text x="164" y="76" text-anchor="end">1</text><text x="164" y="285" text-anchor="end">−1</text><line class="uc-cos-projection" data-uc-cos-projection/><line class="uc-sin-projection" data-uc-sin-projection/><line class="uc-radius" x1="180" y1="175" data-uc-radius/><path class="uc-rotation" data-uc-rotation marker-end="url(#uc-rotation-arrow)"/><circle r="5" class="uc-point" data-uc-point/><text data-uc-point-label>P</text></svg><p class="unit-circle-legend"><span>蓝：横坐标cosθ</span><span>绿：纵坐标sinθ</span></p></figure><figure><figcaption>同一当前角 → 两条曲线的对应点</figcaption><svg class="unit-circle-curves" viewBox="0 0 480 280" role="img" aria-label="横轴为弧度，从负2π至2π的正弦和余弦曲线"><line x1="45" y1="125" x2="450" y2="125" class="uc-axis"/><line x1="247.5" y1="35" x2="247.5" y2="205" class="uc-axis"/><line x1="45" y1="55" x2="450" y2="55" class="uc-grid"/><line x1="45" y1="195" x2="450" y2="195" class="uc-grid"/>${[-2,-1,0,1,2].map((v,i)=>`<line x1="${45+i*101.25}" y1="121" x2="${45+i*101.25}" y2="129" class="uc-axis"/><text x="${45+i*101.25}" y="232" text-anchor="${i===0?'start':i===4?'end':'middle'}">${v===0?'0':v===1?'π':v===-1?'−π':v===2?'2π':'−2π'}</text>`).join('')}<text x="30" y="61" text-anchor="end">1</text><text x="30" y="201" text-anchor="end">−1</text><path d="${sinePath}" class="uc-sin-curve"/><path d="${cosinePath}" class="uc-cos-curve"/><line y1="40" y2="200" class="uc-cursor" data-uc-cursor/><circle r="5" class="uc-sin-marker" data-uc-sin-point/><circle r="5" class="uc-cos-marker" data-uc-cos-point/></svg><p class="unit-circle-legend"><span>绿：y = sinθ</span><span>蓝：y = cosθ</span></p><p class="unit-circle-axis-note">曲线横轴：θ（rad），不是度数；一整周为2π。</p></figure></div><div class="unit-circle-current" data-uc-current aria-live="off"></div><p class="unit-circle-process" data-uc-process>播放从零按目标角的正负方向旋转；暂停可比较投影与曲线点。</p><div class="math-live-equation"><strong>定义：</strong>P = (cosθ, sinθ)，故单位圆x²+y²=1给出sin²θ+cos²θ=1。<br><strong>周期：</strong>旋转±360°回到同一终边，坐标相同；有向角及旋转过程仍不同。</div><p class="math-model-note">依据人教A版必修第一册5.1、5.2、5.4组织；屏上采样和动画是教学示意，数值核对不替代定义和一般性说明。目标题目结果列于下方，播放中读数对应当前旋转角。</p></section>`;
  }
  function renderFrame(root,m,progress,{reducedMotion=false,playing=false}={}){
    const scene=root.querySelector('.math-unit-circle');if(!scene)return;
    const p=Math.max(0,Math.min(1,progress)),moving=playing||p>0&&p<1,current=m.theta*(moving?p:1),value=sampleAt(current),x=180+105*value.cos,y=175-105*value.sin,graphX=45+(current+360)/720*405;
    const attrs=(selector,values)=>{const e=scene.querySelector(selector);for(const [key,v]of Object.entries(values))e.setAttribute(key,String(v));};
    attrs('[data-uc-point]',{cx:x,cy:y});attrs('[data-uc-radius]',{x2:x,y2:y});attrs('[data-uc-point-label]',{x:x+(value.cos<0?-20:9),y:y-10});
    attrs('[data-uc-cos-projection]',{x1:x,y1:y,x2:x,y2:175});attrs('[data-uc-sin-projection]',{x1:x,y1:y,x2:180,y2:y});
    attrs('[data-uc-rotation]',{d:rotationPath(current)});attrs('[data-uc-cursor]',{x1:graphX,x2:graphX});attrs('[data-uc-sin-point]',{cx:graphX,cy:125-70*value.sin});attrs('[data-uc-cos-point]',{cx:graphX,cy:125-70*value.cos});
    scene.dataset.currentDegree=String(current);scene.dataset.targetDegree=String(m.theta);scene.dataset.sourceUnit=m.unit;
    scene.querySelector('[data-uc-phase]').textContent=moving?(playing?'旋转示意中':'暂停在当前角'):'目标态';
    const angleText=validDegree(current)?`= ${number(current)}° = ${radiansText(current)} rad`:`≈ ${number(current)}° ≈ ${number(value.radian)} rad`;
    const text=`当前θ ${angleText}；P ${value.exact?'=':'≈'} (${value.exact?value.cosText:number(value.cos)}, ${value.exact?value.sinText:number(value.sin)})；${value.position}。`;
    const currentEl=scene.querySelector('[data-uc-current]');
    if(currentEl.dataset.value!==text){currentEl.dataset.value=text;if(window.ScienceFormula)window.ScienceFormula.setHtml(currentEl,text);else currentEl.textContent=text;}
    scene.querySelector('[data-uc-process]').textContent=`目标有向角保留为${number(m.theta)}°（${m.direction}，${m.turnsText}周）；终边对应${number(m.terminalDegree)}°。范围内同终边角${number(m.partner)}°，旋转量不同。${reducedMotion?'已启用减少动态效果；仍可手动拖动进度。':'播放从零示意旋转至目标，不改题目参数。'}`;
  }
  const template={id:'unitCircle',subject:'数学',level:'senior',stage:'高中',block:'三角函数',menuTitle:'单位圆与正弦余弦',menuMeta:'角度/弧度 · 投影 · 同步曲线',title:'单位圆：坐标定义正弦与余弦',defaults:[30,1],keywords:/单位圆/,failMessage:failText,
    params:[{label:'角 θ',desc:'−360°至360°，最多两位小数',unit:'°',min:-360,max:360,step:.01,value:30},{label:'固定半径 r',desc:'单位长度；固定为1，不参与调节',unit:'',min:1,max:1,step:1,value:1}],
    parameter:(param,index,f)=>index===1?{...param,locked:true}:{...param,desc:f.unit==='rad'?'原题弧度制；滑块按度调节，等价弧度同步显示':'−360°至360°，最多两位小数'},
    strict:{sameConditions:true,intent:{require:[/单位圆/]},fixedDefaults:{unit:'deg',asks:'cos,periodic,point,position,sin'},caps:[[-360,360],[1,1]],values:parseCircle,checkFixed:fixedIssue,used:theta=>[{cls:'angle',value:theta}],asks:{supported:/sin|cos|正弦|余弦|坐标|象限|终边|周期/i,unsupported:/tan|cot|正切|余切|反三角|反求|导数|切线|面积|概率|振幅|相位|频率/i}},
    question:(theta,r=1,f={unit:'deg',asks:'cos,periodic,point,position,sin'})=>`在圆心为原点O、半径为1的单位圆中，角θ=${f.unit==='rad'?radiansText(theta).replace(/−/g,'-')+'rad':theta+'°'}，${f.asks.split(',').map(k=>({sin:'求sinθ',cos:'求cosθ',point:'求点P的坐标',position:'判断象限或坐标轴位置',periodic:'说明周期关系'}[k])).join('；')}。`,
    model,visual,renderFrame,sampleAt,radiansText,parseAngle:degreeToken,formatMetric:number,resetToQuestion:true,motion:{duration:10},
    presetFor:()=>({p1:30,p2:1,fixed:{unit:'deg',asks:'cos,periodic,point,position,sin'}}),recognition:m=>`单位圆｜${number(m.theta)}°=${m.radianExact} rad｜${m.position}`,
    copy:m=>({steps:[['明确有向角和固定单位圆',`r=1，θ=${number(m.theta)}°=${m.radianExact} rad；${m.direction}。`,'正角逆时针、负角顺时针，原始角与终边位置分开。'],['用坐标定义正余弦','单位圆终边交点P=(x,y)，cosθ=x，sinθ=y。','坐标轴同尺度，投影与曲线点由同一当前角驱动。'],['从单位圆说明关系','x²+y²=1给sin²θ+cos²θ=1；旋转整周回到同一坐标给周期性。','不是用少量数值相等当作一般性证明；轴上不属于象限。'],['目标题目结果',m.conclusion,'特殊角为精确根式或分数，普通角标≈；曲线横轴单位rad。']],hint:'先从圆上点P读横、纵坐标，再在相同角的曲线上找对应点。',mentor:'330°与−30°终边和坐标相同，为什么不能说两个有向角完全一样？',challenge:'在合法范围内比较θ与相差360°的角；观察坐标相同而曲线横坐标不同。',sceneTip:m.conclusion,generationStages:stages('核对角度单位、精度和完整所问','构造等比例单位圆与两坐标投影','由定义给出精确值或数值近似')})
  };
  kit.register({unitCircle:template});
})();
