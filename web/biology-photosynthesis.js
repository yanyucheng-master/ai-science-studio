(() => {
  'use strict';
  const kit=window.MasterLabTemplateKit,C=window.MasterLabPhotosynthesis;if(!kit||!C)return;
  const {fact,stages}=kit.helpers;
  const askNames={conclusion:'实验结论',phenomenon:'实验现象',purpose:'操作目的',steps:'实验步骤'};
  const defaults={curriculum:'pep2024-7b-p29-30',protocolVersion:1,level:'junior',asks:'conclusion,phenomenon,purpose,steps'};
  const clauses=[
    '按人教版生物学七年级下册教材','探究绿叶在光下制造有机物','盆栽天竺葵先暗处理一昼夜',
    '同一叶片用黑纸片从上下两面局部遮光','放在阳光下几小时后摘叶并移去黑纸片',
    '酒精水浴脱色','清水漂洗后置于培养皿滴加碘液','稍停片刻用清水冲掉碘液再观察'
  ];
  const norm=s=>window.MasterLabQuestionGuard.normalize(s).replace(/\s/g,'');
  const fail='本模板只演示人教七下的同叶遮光检验淀粉实验。请保留暗处理一昼夜、双面局部遮光、阳光照射、摘叶去纸、酒精水浴脱色、漂洗滴碘和冲洗观察；支持步骤、现象、结论、操作目的，不计算产量或速率。';
  function issue(f,p1,p2){
    if(p1!==1||p2!==1)return '本实验按教材固定流程演示，不接受光强、温度、时间或产量参数。';
    if(Object.keys(f).some(k=>!Object.hasOwn(defaults,k))||f.curriculum!==defaults.curriculum||f.protocolVersion!==1||f.level!=='junior'||typeof f.asks!=='string')return '教材版本、实验模式或学段无效。';
    const asks=f.asks.split(',');
    return !asks.length||new Set(asks).size!==asks.length||asks.some(k=>!Object.hasOwn(askNames,k))?'所问超出当前教材实验范围。':'';
  }

  // Bounded semantic grammar, not a keyword recognizer: every condition and ask must be consumed.
  const RULES=[
    ['人教七下教材范围',/^(?:按|依据)(?:人教版|人民教育出版社)(?:生物学)?七年级下册教材/],
    ['探究绿叶在光下制造有机物',/^(?:探究|研究)绿叶在光下(?:制造|产生)有机物/],
    ['盆栽天竺葵暗处理一昼夜',/^盆栽天竺葵(?:先)?(?:暗处理|在黑暗处处理|置于黑暗处|放在黑暗处)(?:一昼夜|1昼夜|24小时|一天一夜)/],
    ['同一叶片黑纸双面局部遮光',/^同一(?:片)?叶片(?:用黑纸片)?(?:从上下两面局部遮光|局部用黑纸(?:片)?遮住(?:叶片的)?上下两面|(?:的)?局部上下两面(?:均|都)用黑纸(?:片)?遮住)/],
    ['阳光下几小时后摘叶去纸',/^(?:放|置)在阳光下(?:几|数)小时后(?:摘叶|摘下叶片)并(?:移去|去掉|除去)黑纸(?:片)?/],
    ['酒精水浴脱色',/^(?:用)?酒精(?:水浴脱色|隔水加热脱色|在水浴中加热脱色)/],
    ['先清水漂洗再培养皿滴碘',/^(?:用)?清水(?:漂洗|冲洗)(?:后|再)(?:置于|放入|放在)培养皿(?:中)?(?:滴加|滴上|滴入)碘液/],
    ['稍停后清水冲碘再观察',/^(?:稍停片刻|稍等片刻|稍停一会)(?:后)?(?:用)?清水(?:冲掉|冲去|洗去)碘液(?:再|后)(?:观察|进行观察)/]
  ];
  const ASK_RULES={conclusion:/^(?:本实验的)?(?:实验结论|所得结论)/,phenomenon:/^(?:本实验的)?(?:实验现象|观察现象|预期现象)/,purpose:/^(?:本实验的)?(?:操作目的|各步骤的目的|各步操作的目的)/,steps:/^(?:本实验的)?(?:实验步骤|操作步骤|实验操作顺序|操作流程)/};

  function parse(text) {
    if (typeof text !== 'string' || !text.trim()) return {ok:false,message:'请输入完整实验条件和所问。'};
    let rest = norm(text).replace(/[，,。；;：:！？?、]/g,'').replace(/(?<!\d)\.|\.(?!\d)/g,'');
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
        if (marker) return reject('无法确认所问的类型：'+rest.slice(0,38)+'。本流程仅支持'+Object.values(askNames).join('、')+'。');
      }
      const found=RULES.map(([name,re],index)=>({name,index,match:rest.match(re)})).find(x=>x.match);
      if (!found) return reject('无法确认这段条件或子问：'+rest.slice(0,42)+'。请核对操作、数值角色与所问；不会自动补条件。');
      if (seen.has(found.index)) return reject('条件重复或可能矛盾：'+found.name+'。请只给出一致条件。');
      seen.add(found.index); rest=rest.slice(found.match[0].length); askMode=false;
    }
    const missing=RULES.filter((_,i)=>!seen.has(i)).map(([name])=>name);
    if (missing.length) return reject('缺少可核对条件：'+missing.join('；')+'。');
    if (!asks.size) return reject('尚未明确所问。本流程支持'+Object.values(askNames).join('、')+'。');
    return {ok:true,p1:1,p2:1,fixed:{...defaults,asks:[...asks].sort().join(',')}};
  }
  function question(p1=1,p2=1,f=defaults){
    const problem=issue(f,p1,p2);if(problem)throw new RangeError(problem);
    return clauses.join('，')+'，说明'+f.asks.split(',').map(k=>askNames[k]).join('、')+'。';
  }
  function model(p1,p2,f=defaults){
    const problem=issue(f,p1,p2);if(problem)throw new RangeError(problem);
    const answers={steps:'暗处理→双面局部遮光并光照→摘叶去纸→酒精水浴脱色→漂洗、滴碘→稍停、冲洗、观察',
      phenomenon:'完成教材操作后，原见光区遇碘液变蓝，原遮光区不变蓝',
      conclusion:'淀粉是光合作用的产物，光是绿叶制造淀粉不可缺少的条件',
      purpose:'暗处理减少原有淀粉干扰；同叶局部遮光作对照；酒精脱色便于观察；碘液检验淀粉'};
    return {asks:f.asks,level:'junior',metrics:[1,1,6],metricUnit:'',facts:[fact('对照变量','是否见光'),fact('原见光区','遇碘变蓝'),fact('原遮光区','不变蓝')],
      formula:'光照对照 + 碘液检验 → 由现象得出结论',formulaDetail:'这是定性实验，没有用光强、时间推算淀粉质量的计算公式。',
      conclusion:f.asks.split(',').map(k=>answers[k]).join('；')+'。',readout:'教材预期：见光区变蓝，遮光区不变蓝',badge:'同叶对照 · 淀粉检验',
      contextParameters:'固定人教2024审核体系七下p29–30的完整六步流程；一昼夜暗处理、阳光下几小时、酒精水浴。内部参数1/1只是固定标识，不代表光强、产量或实际操作时长。页面播放位置是操作顺序示意，所列结论为完成全部操作后的教材预期。'};
  }
  const leafPath='M0 -90 C20 -110 42 -84 38 -66 C65 -82 85 -52 66 -35 C95 -22 87 12 61 17 C76 45 50 67 30 54 C24 82 -3 96 -15 68 C-44 85 -65 60 -53 40 C-85 40 -95 6 -69 -9 C-96 -34 -68 -61 -48 -51 C-49 -82 -17 -105 0 -90Z';
  const leaf=(x,y,scale,color,masked=false,final=false)=>`<g transform="translate(${x} ${y}) scale(${scale})"><defs><clipPath id="photoLeafClip"><path d="${leafPath}"/></clipPath></defs><path d="${leafPath}" fill="${color}" stroke="#457056" stroke-width="2"/>${final?'<rect x="-100" y="-28" width="200" height="58" fill="#eee4a8" clip-path="url(#photoLeafClip)"/>':''}<path d="M0 90V-75M0 0 -45 -40M0 15 45 -20M0 40 -40 40" stroke="#7b916c" fill="none" stroke-width="2" opacity=".65"/>${masked?'<rect x="-90" y="-30" width="180" height="60" rx="3" fill="#273443"/><path d="M-40 -30v30q0 12 12 12h24q12 0 12-12v-38q0-12-12-12h-18q-10 0-10 10v31" fill="none" stroke="#b6c2cd" stroke-width="4"/>':''}</g>`;
  function plant(dark=false,masked=false){return `<g>${dark?'<rect x="60" y="15" width="570" height="305" rx="18" fill="#26354b"/><text x="90" y="52" class="photo-dark-label">黑暗处 · 一昼夜</text>':'<circle cx="570" cy="55" r="28" fill="#f7d783"/><path d="M533 78 460 125M550 90 500 167" stroke="#e6c36e" stroke-width="3"/><text x="405" y="33">阳光照射几小时</text>'}<path d="M305 285 300 130M304 244 216 155M302 202 386 134" fill="none" stroke="#558652" stroke-width="10"/><g transform="translate(208 153) scale(.5)"><path d="${leafPath}" fill="#71a565" stroke="#457056" stroke-width="3"/></g><g transform="translate(390 132) scale(.5)"><path d="${leafPath}" fill="#71a565" stroke="#457056" stroke-width="3"/></g>${leaf(300,112,.73,'#76aa65',masked)}<path d="M235 260h135l-20 69h-95Z" fill="#d4bfa9" stroke="#9b806d" stroke-width="3"/>${masked?'<g transform="translate(470 245)"><path d="M-40 -14H55M-40 14H55" stroke="#273443" stroke-width="8"/><path d="M-40 0H55" stroke="#76aa65" stroke-width="7"/><text x="-65" y="52">上下两面均有黑纸</text></g>':''}</g>`;}
  function scene(f){
    const green='#78a967',yellow='#eee4a8',blue='#274c9b',iodine='#a78250';
    const color=f.exposed==='blue'?blue:f.exposed==='iodine'?iodine:f.exposed==='yellowWhite'?yellow:green;
    if(f.step<2)return plant(f.dark,f.paper);
    if(f.step===2)return `<path d="M180 40 270 90 255 105 165 55" fill="none" stroke="#8898ab" stroke-width="6"/>${leaf(310,175,1,green)}<rect x="465" y="105" width="120" height="60" rx="3" fill="#273443"/><path d="M425 140H458" stroke="#7d8ca2" stroke-width="3"/><text x="438" y="200">移去的双面黑纸</text><text x="210" y="320">已摘叶 · 此时仍是绿色</text>`;
    if(f.step===3)return `<rect x="95" y="125" width="500" height="195" rx="16" fill="#e3eaf2" stroke="#7c92ad" stroke-width="3"/><ellipse cx="345" cy="160" rx="205" ry="65" fill="#d5e9f2" stroke="#7c92ad" stroke-width="3"/><path d="M265 65v145q0 30 80 30t80-30V65" fill="#f8fbff" stroke="#7c92ad" stroke-width="3"/><path d="M269 105v105q0 26 76 26t76-26V105Z" fill="${f.local>.3?'#c4dca8':'#eff5f0'}"/>${leaf(345,161,.5,f.decolorized?yellow:green)}<path class="photo-callout" d="M428 95 482 63M558 178 610 211" stroke="#7d8ca2" stroke-width="2"/><text x="460" y="49">小烧杯 · 酒精</text><text x="517" y="238">水</text><text x="245" y="298">水浴锅 · 隔水加热</text><text x="210" y="347">叶绿素溶入酒精 · 叶片变黄白</text>`;
    if(f.step===4){const rinse=f.local<.4;return `<path d="M65 128v145q0 18 100 18t100-18V128" fill="#e4f2f7" stroke="#8ca3ba" stroke-width="3"/><ellipse cx="490" cy="228" rx="145" ry="75" fill="#f9fcff" stroke="#8ca3ba" stroke-width="3"/>${leaf(rinse?165:490,rinse?198:225,.6,color)}<path d="M290 190H330m-12-10 12 10-12 10" stroke="#7d8ca2" stroke-width="3" fill="none"/><text x="84" y="326">① 清水漂洗</text><text x="376" y="326">② 培养皿中滴碘液</text>${!rinse?'<path d="M557 57 512 135" stroke="#829bb2" stroke-width="14"/><path d="M512 135 500 156" stroke="#7d8ca2" stroke-width="5"/><path d="M498 170q-13 20 0 20t0-20" fill="#99764d"/>':''}`;}
    return `<ellipse cx="330" cy="205" rx="220" ry="117" fill="#f9fcff" stroke="#8ca3ba" stroke-width="3"/>${leaf(330,198,.95,color,false,f.observationReady)}${f.waterRinse?'<path d="M270 15 290 78M325 10 332 74M375 15 369 78" stroke="#84bdd3" stroke-width="6"/>':''}<text x="60" y="50">${f.observationReady?'冲去碘液后的预期现象':f.local<.3?'滴碘后稍停片刻':'用清水冲掉碘液'}</text>${f.observationReady?'<path class="photo-callout" d="M405 133 504 95M405 201H545" stroke="#7d8ca2" stroke-width="2"/><text x="476" y="80">原见光区：蓝色</text><text x="460" y="237">原遮光区：不变蓝</text>':''}`;
  }
  function visual(){return `<section class="biology-photosynthesis-scene" aria-label="探究绿叶在光下制造有机物"><div class="photo-heading"><h3>绿叶在光下制造有机物</h3><span>人教七下 · 定性对照实验</span></div><nav class="photo-steps" aria-label="教材六步，使用同一演示时间轴">${C.STEPS.map((s,i)=>`<button type="button" data-photosynthesis-step="${i}" aria-label="查看教材第${i+1}步：${s.title}"><span>${i+1}</span>${s.title}</button>`).join('')}</nav><div class="photo-stage-layout"><div class="photo-illustration"><svg data-photo-svg viewBox="0 0 690 365" role="img" aria-label="教材步骤的操作示意"></svg><p class="photo-caption" data-photo-caption></p></div><div class="photo-explanation"><h4 data-photo-title></h4><p data-photo-action></p><div class="photo-purpose"><strong>为什么这样做</strong><p data-photo-purpose></p></div><p data-photo-observation aria-live="polite"></p></div></div><p class="photo-caution">酒精易燃，只能水浴加热。此处按教材呈现操作，不能直接加热酒精。</p><p class="photo-note">演示压缩的是操作顺序，不是真实生理速率；时间轴不能把“一昼夜”“几小时”“稍停片刻”换算为动画秒数。步骤按钮用于回看，各画面均以前面的教材操作已经完成为前提。</p><details><summary>教材器材与结论边界</summary><p>${C.MATERIALS.join('、')}。</p><p>人教版《生物学》七年级下册，2024审核体系，正文29–30页。器材、六步顺序与定性现象逐项对照；图形为原创交互示意，非教材照片，颜色和器皿尺寸不作测量依据。</p><p>本实验检验淀粉与光照条件。不能单独据此证明二氧化碳原料、氧气释放或计算光合速率。</p></details></section>`;}
  function renderFrame(root,m,p){
    const el=root.querySelector('.biology-photosynthesis-scene');if(!el)return;
    const f=C.frame(p),s=C.STEPS[f.step];el.dataset.step=String(f.step+1);el.dataset.observationReady=String(f.observationReady);el.dataset.exposed=f.exposed;el.dataset.covered=f.covered;
    el.querySelector('[data-photo-svg]').innerHTML=scene(f);
    el.querySelector('[data-photo-title]').textContent=`第${f.step+1}步 · ${s.title}`;
    el.querySelector('[data-photo-action]').textContent=s.action;
    el.querySelector('[data-photo-purpose]').textContent=s.purpose;
    const legends=['整株暗处理一昼夜。','同一叶片上下两面均有黑纸，其余区域见光。','用镊子取叶，撤去两面的黑纸片。','水浴锅中是水，小烧杯内的酒精浸着叶片。','先在左侧清水中漂洗，再移到右侧培养皿滴碘。',f.observationReady?'蓝色区域是原见光区，黄白色带是原遮光区。':'稍停片刻后用清水冲洗，准备比较同一叶片的两个区域。'];
    el.querySelector('[data-photo-caption]').textContent=legends[f.step]+'（器材与色彩示意）';
    el.querySelector('[data-photo-svg]').setAttribute('aria-label',s.title+'：'+legends[f.step]);
    el.querySelector('[data-photo-observation]').textContent=f.observationReady?'教材预期：同一叶片的原见光区呈蓝色，原遮光区不变蓝。':'当前步骤尚未完成最终显色观察；不能把绿色、脱色或碘液本身的颜色当作淀粉检验结果。';
    el.querySelectorAll('[data-photosynthesis-step]').forEach((b,i)=>{b.classList.toggle('active',i===f.step);b.setAttribute('aria-current',i===f.step?'step':'false');});
  }
  kit.register({photosynthesis:{id:'photosynthesis',subject:'生物',level:'junior',block:'植物生理',stage:'光合作用',title:'光合作用：绿叶在光下制造有机物',menuTitle:'绿叶在光下制造有机物',menuMeta:'同叶遮光 · 酒精水浴 · 碘液检验',defaults:[1,1],resetToQuestion:true,motion:{duration:12},formatMetric:String,keywords:/光合作用|绿叶.*有机物|天竺葵/,
    params:[{label:'教材固定流程',desc:'按人教七下六步操作',unit:'',min:1,max:1,step:1,value:1},{label:'同叶遮光对照',desc:'上下两面局部遮光',unit:'',min:1,max:1,step:1,value:1}],parameter:param=>({...param,locked:true,lockText:'教材固定设置'}),
    strict:{sameConditions:true,caps:[[1,1],[1,1]],fixedDefaults:defaults,intent:{require:[/绿叶/,/有机物/]},values:parse,checkFixed:issue,used:()=>[{cls:"time",value:86400}],asks:{supported:/实验步骤|操作步骤|实验操作顺序|操作流程|实验现象|观察现象|预期现象|实验结论|所得结论|操作目的|各步骤的目的|各步操作的目的/,unsupported:/速率|产量|体积|质量|氧气|二氧化碳|光强|温度/}},
    question,model,visual,renderFrame,presetFor:()=>({p1:1,p2:1,fixed:{...defaults}}),recognition:m=>m.readout,
    stepContext:p=>{const f=C.frame(p),s=C.STEPS[f.step];return `当前教材第${f.step+1}步：${s.title}。${s.action}${f.observationReady?'冲洗后已可观察原见光区与原遮光区的显色。':'当前还不能把最终显色当作已经观察到的结果。'}确定性结果区列的是完整教材流程完成后的预期，非实测。`;},
    copy:m=>({steps:C.STEPS.map((s,i)=>[`${i+1} ${s.title}`,s.action,s.purpose]),hint:'先区分原见光区和原遮光区，再判断淀粉检验完成之前能否得出显色结论。',mentor:'同一叶片的两部分主要差别是什么？为什么暗处理和脱色都不能替代最后的碘液检验？',challenge:'用上方同一时间轴回看六步，说明暗处理、双面遮光、脱色和滴碘的目的。',sceneTip:'本实验的预期结论只涉及淀粉与光照条件；先完成全部操作，再根据对照现象解释。',generationStages:stages('核对完整教材流程与所问','建立同叶遮光的定性对照','准备教材六步的交互示意')})}});
})();
