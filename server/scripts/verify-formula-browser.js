// Real browser/DOM acceptance, isolated profile and local response fixtures.
// No personal credentials or upstream AI request. --quick is for repair iterations.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web');
const output=process.env.FORMULA_QA_OUTPUT||resolve(root,'artifacts/formula-closeout-2026-10-14');await mkdir(output,{recursive:true});
const quick=process.argv.includes('--quick');
const aiOnly=process.argv.includes('--ai-only');
const variantsOnly=process.argv.includes('--variants');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html',file=resolve(web,name);
 if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return}
 try{res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const report={browser:browser.version(),layouts:[],dom:[],ai:[],zoom:[],requests:[],errors:[],failures:[]};
const check=(ok,message)=>{if(!ok)report.failures.push(message)};
async function generate(page,q){
 await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();
 await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay').classList.contains('show'),q);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#generationOverlay')).opacity==='0');
 await page.evaluate(()=>{clearReasoningTimers();clearDemoTimers();});
}
async function preset(page,id){
 await page.locator('.subject-tab[data-subject="物理"]').click();
 await page.locator('#physicsPresetToggle').click();
 // Since week 2 the menu lists the selected grade level first; the other level is a folded group.
 const folded=page.locator(`#physicsPresetDropdown details.preset-other:not([open]):has([data-preset="${id}"]) > summary`);
 if(await folded.count())await folded.click();
 if(await page.locator(`[data-preset="${id}"]`).getAttribute('hidden')!==null)await page.locator('#physicsPresetToggle').click();
 else await page.locator(`[data-preset="${id}"]`).click();
 const q=await page.locator('#questionInput').inputValue();await generate(page,q);
 assert.equal(await page.evaluate(()=>state.physicsTemplate),id);return q;
}
async function geometry(page,label){
 const info=await page.evaluate(()=>{
  const visible=n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'};
  const box=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
  const roots=[...document.querySelectorAll('.reason-step p,.formula-spotlight strong,.formula-spotlight p,#parseFeedback strong,#mentorMessage,#sceneTip')].filter(visible);
  const overflow=roots.filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>({text:n.textContent.slice(0,100),client:n.clientWidth,scroll:n.scrollWidth}));
  const fractions=[...document.querySelectorAll('.science-math.vfrac')].filter(visible).map(n=>{
   const num=n.querySelector(':scope > .vfrac-num'),den=n.querySelector(':scope > .vfrac-den');return{source:n.dataset.mathSource,num:box(num),den:box(den),line:parseFloat(getComputedStyle(num).borderBottomWidth)};
  });
  const scripts=[...document.querySelectorAll('.science-scripts > sub')].filter(visible).map(n=>({text:n.textContent,ratio:parseFloat(getComputedStyle(n).fontSize)/parseFloat(getComputedStyle(n.parentElement.parentElement).fontSize),b:box(n),base:box(n.parentElement.parentElement)}));
  const svgText=[...document.querySelectorAll('#scene svg text')].filter(visible).map(n=>({text:n.getAttribute('aria-label')||n.textContent,b:box(n),svg:box(n.ownerSVGElement)}));
  const svgClipping=svgText.filter(n=>n.b.x<n.svg.x-2||n.b.right>n.svg.right+2||n.b.y<n.svg.y-2||n.b.bottom>n.svg.bottom+2);
  const svgOverlap=[];for(let i=0;i<svgText.length;i++)for(let j=i+1;j<svgText.length;j++){
   const a=svgText[i],b=svgText[j];if(Math.min(a.b.right,b.b.right)-Math.max(a.b.x,b.b.x)>2&&Math.min(a.b.bottom,b.b.bottom)-Math.max(a.b.y,b.b.y)>2)svgOverlap.push([a.text,b.text]);
  }
  const slashText=[];for(const root of document.querySelectorAll('#scene,.reasoning-card,#mentorMessage,#sceneTip,#parseFeedback,#physicsPresetDropdown')){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
   while(n=walker.nextNode())if(n.data.includes('/')&&!n.parentElement.closest('[data-math-source],.katex,script,style'))slashText.push(n.data.trim());
  }
  return {pageOverflow:document.documentElement.scrollWidth-innerWidth,overflow,fractions,scripts,svgClipping,svgOverlap,slashText:[...new Set(slashText)],rawQuestion:document.querySelector('#problemText').textContent,questionMarkup:document.querySelector('#problemText').children.length,scienceCount:document.querySelectorAll('.science-math').length,svgRules:document.querySelectorAll('.science-formula-rule').length};
 });
 report.layouts.push({label,...info});check(info.pageOverflow<=1,label+': page overflow');
 check(!info.overflow.length,label+': formula overflow '+JSON.stringify(info.overflow));
 check(info.fractions.every(f=>f.line>0&&f.num.bottom<=f.den.y+.5&&Math.abs((f.num.x+f.num.w/2)-(f.den.x+f.den.w/2))<1),label+': fraction geometry');
 check(info.scripts.every(s=>s.ratio>=.60&&s.ratio<=.70),label+': script size');
 check(!info.svgClipping.length,label+': SVG clipping '+JSON.stringify(info.svgClipping.map(n=>n.text)));
 check(!info.svgOverlap.length,label+': SVG overlap '+JSON.stringify(info.svgOverlap));
 check(info.questionMarkup===0,label+': original question was formatted');
 return info;
}
async function domChecks(page){
 const results=await page.evaluate(async()=>{
  const fixture=document.createElement('div');fixture.style.cssText='position:fixed;left:0;top:0;background:white;font-size:20px';document.body.append(fixture);
  const input='η = W有/W总；x = v₀²/(2a)；t = √(2h/g)；m/s²；kg/m³；J/(kg·℃)；https://example.com/a/b';
  ScienceFormula.appendText(fixture,input);const once=fixture.innerHTML;ScienceFormula.enhance(fixture);ScienceFormula.enhance(fixture);
  const result={idempotent:fixture.innerHTML===once,htmlIdempotent:ScienceFormula.html(ScienceFormula.html(once))===ScienceFormula.html(once),copy:ScienceFormula.sourceText(fixture),fractions:fixture.querySelectorAll('.vfrac').length,radicals:fixture.querySelectorAll('.sqrt-radicand').length,subs:[...fixture.querySelectorAll('sub')].map(n=>n.textContent),unitText:fixture.textContent};
  result.radicalGeometry=[...fixture.querySelectorAll('.sqrt-radicand')].every(n=>{
   const b=n.getBoundingClientRect(),sign=n.previousElementSibling.getBoundingClientRect();
   return parseFloat(getComputedStyle(n).borderTopWidth)>0&&Math.abs(sign.y-b.y)<1&&Math.abs(sign.height-b.height)<1&&[...n.children].every(c=>c.getBoundingClientRect().right<=b.right+1);
  });
  result.scripts=[...fixture.querySelectorAll('.science-scripts')].map(n=>{
   const range=document.createRange();range.selectNodeContents(n.parentElement.firstChild);const b=range.getBoundingClientRect();
   const sub=n.querySelector('sub')?.getBoundingClientRect(),sup=n.querySelector('sup')?.getBoundingClientRect();
   return {baseTop:b.y,baseBottom:b.bottom,subTop:sub?.y,subBottom:sub?.bottom,supTop:sup?.y,source:n.parentElement.dataset.mathSource,subBelow:!sub||(sub.y>b.y&&sub.bottom>b.bottom),supAbove:!sup||(sup.bottom<b.bottom-b.height*.25&&(sup.y+sup.bottom)<(b.y+b.bottom))};
  });
  const quantity=document.createElement('div');quantity.style.cssText='width:34px;overflow-wrap:anywhere';ScienceFormula.appendText(quantity,'电阻 2 Ω');fixture.append(quantity);
  const unitGroup=quantity.querySelector('.science-quantity');result.quantityTogether=!!unitGroup&&unitGroup.getBoundingClientRect().height<30&&ScienceFormula.sourceText(unitGroup)==='2 Ω';quantity.remove();
  const selected=fixture.querySelector('.vfrac .science-scripted');
  const range=document.createRange();range.selectNodeContents(selected);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  const data=new DataTransfer();const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:data});document.dispatchEvent(event);
  result.copyEvent=event.defaultPrevented&&data.getData('text/plain')==='W有/W总';selection.removeAllRanges();
  ScienceFormula.setHtml(fixture,'<p>ignored</p><strong>第一行 W有/W总</strong><br>第二行 √(2h/g)');
  result.copyNewlines=ScienceFormula.sourceText(fixture).includes('W有/W总\n第二行');
  const legacy='<span class="vfrac"><span class="vfrac-num">v₀²</span><span class="vfrac-den">2a<sub>相</sub></span></span>';
  ScienceFormula.setHtml(fixture,legacy);result.legacyAccessible=fixture.querySelector('.vfrac')?.getAttribute('role')==='math'&&ScienceFormula.sourceText(fixture).includes('/');
  const hostile='<img src=x onerror="window.formulaUnsafe=1"><svg onload="window.formulaUnsafe=1">x</svg><strong onclick="window.formulaUnsafe=1">1/2</strong>';
  ScienceFormula.setHtml(fixture,hostile);result.safe=!fixture.querySelector('img,svg,[onclick],[onerror],[onload]')&&!window.formulaUnsafe;
  fixture.remove();
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','300');svg.setAttribute('height','160');
  const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x','30');label.setAttribute('y','50');label.textContent='1/R并';svg.append(label);document.body.append(svg);const observer=ScienceFormula.observe(svg);
  const oldX=Number(label.querySelector('tspan').getAttribute('x')),oldLine=svg.querySelector('path').getAttribute('d');
  label.setAttribute('x','100');label.setAttribute('y','100');await new Promise(requestAnimationFrame);
  result.svgMoves=Number(label.querySelector('tspan').getAttribute('x'))===oldX+70&&svg.querySelector('path').getAttribute('d')!==oldLine&&label.dataset.mathSource==='1/R并';
  label.setAttribute('visibility','hidden');await new Promise(requestAnimationFrame);result.svgHidden=svg.querySelector('path').getAttribute('visibility')==='hidden';
  label.textContent='普通标签';await new Promise(requestAnimationFrame);result.svgReset=!svg.querySelector('path')&&!label.hasAttribute('data-math-source');
  observer.disconnect();svg.remove();return result;
 });
 report.dom.push(results);check(results.idempotent,'DOM: repeat formatting');check(results.fractions===3&&results.radicals===1,'DOM: nested fraction/root coverage');check(results.safe,'DOM: HTML injection');
 check(results.copy.includes('W有/W总')&&results.copy.includes('m/s²')&&results.copy.includes('https://example.com/a/b'),'DOM: copy source/units/URL');
 for(const key of ['htmlIdempotent','radicalGeometry','quantityTogether','copyEvent','copyNewlines','legacyAccessible','svgMoves','svgHidden','svgReset'])check(results[key],'DOM: '+key);
 check(results.scripts.every(s=>s.subBelow&&s.supAbove),'DOM: script baselines '+JSON.stringify(results.scripts));
}
async function zoomCheck(page,width,id){
 if(width!==390||id!=='efficiency')return;
 await page.locator('.diagram-zoom-toggle').click();
 const info=await page.evaluate(()=>{
  const svg=document.querySelector('#scene .edu-diagram'),pan=document.querySelector('.diagram-pan-viewport');pan.scrollLeft=pan.scrollWidth;
  return {font:parseFloat(getComputedStyle(svg.querySelector('.dg-table text')).fontSize)*svg.getScreenCTM().a,scrollable:pan.scrollWidth>pan.clientWidth,pageOverflow:document.documentElement.scrollWidth-innerWidth};
 });
 report.zoom.push(info);check(info.font>=14&&info.scrollable&&info.pageOverflow<=1,'phone zoom readability '+JSON.stringify(info));
 await page.locator('#scene').screenshot({path:resolve(output,'390-efficiency-zoom.png')});
 await page.locator('.diagram-zoom-toggle').click();
}
const fixtureAnswer={mode:'steps',summary:'',steps:[
 '列式：η = W有/W总 = Gh/(Fs)。承担物重的绳子有3段，所以 s = 3h。',
 '代入：\\(η=\\frac{W_{\\text{有}}}{W_{\\text{总}}}=\\frac{G}{3F}=\\frac{30}{36}\\)。',
 '结论：机械效率约为83.3%。'
],formulas:['η=W有/W总=G/(3F)','x=\\sqrt{\\frac{2h}{g}}','\\left(W有/W总\\right)','\\begin{aligned}η&=W有/W总\\\\s&=3h\\end{aligned}'],finalAnswer:'机械效率约为83.3%。',checks:[],followUp:'如果 W额 减少，W有/W总 如何变化？',suggestedQuestions:['为什么 W有/W总 小于1？'],warnings:[]};
try{
 const sizes=quick?[[390,844],[1366,768]]:[[390,844],[768,1024],[1024,768],[1366,768],[1920,1080]];
 for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await context.addInitScript(base=>window.MASTER_LAB_API_URL=base,base);
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/health'||url.pathname==='/api/v1/health')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,configured:true})});
   if(url.pathname==='/api/v1/tutor/chat'){
    const request=route.request().postDataJSON();report.requests.push({width,formula:request.context?.formula,originalQuestion:request.context?.originalQuestion});
    check(/W有\s*\/\s*W总/.test(request.context?.formula||''),`${width}: AI context lost original fraction`);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixtureAnswer)});
   }
   return url.origin===base?route.continue():route.fulfill({status:204,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text()+' '+m.location().url)});
  await page.goto(base);await page.waitForFunction(()=>typeof ScienceFormula==='object'&&typeof katex==='object');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));
  if(width===sizes[0][0])await domChecks(page);
  if(process.argv.includes('--dom')){await context.close();break;}
  if(variantsOnly){
   for(const [id,q] of [
    ['friction-brake','一辆汽车以 20m/s 的速度在水平路面行驶，紧急刹车后车轮发生滑动，轮胎与路面的动摩擦因数为 0.5，取 g = 9.8m/s²。求刹车距离。'],
    ['linear-drag','质量为 800kg 的物体以 15m/s 的速度进入水平减速区，所受阻力 f = kv，方向与速度相反，其中 k = 200kg/s，求物体的极限位移。'],
    ['ohm-resistance','电压表示数为 4.5V，电流表示数为 0.3A，求待测电阻的阻值。'],
    ['ohm-voltage','通过某导体的电流为 0.3A，导体的电阻为 20Ω，求导体两端的电压。']
   ]){await generate(page,q);await geometry(page,`${width}-${id}`);await page.locator('#toast.show').waitFor({state:'hidden'});await page.locator('.content-grid').screenshot({path:resolve(output,`${width}-${id}.png`)});console.log(`variant ${width} ${id}`);}
   await context.close();continue;
  }
  const ids=aiOnly?[]:quick?['projectile','parallelCircuit','efficiency']:(width===1366?['brake','solenoid','boardSlider','projectile','circuit','lever','lens','buoyancy','friction','lampPower','parallelCircuit','planeMirror','seriesCircuit','heatBalance','liquidPressure','efficiency','sound']:['projectile','boardSlider','parallelCircuit','seriesCircuit','efficiency','buoyancy','heatBalance','lens']);
  for(const id of ids){
   await preset(page,id);await geometry(page,`${width}-${id}`);
   if(id==='brake')check(await page.evaluate(()=>buildMasterLabAIContext().formula==='v² − v₀² = 2ax'),'AI context: simultaneous scripts must retain source order');
   await page.locator('#toast.show').waitFor({state:'hidden'});
   await page.locator('.content-grid').screenshot({path:resolve(output,`${width}-${id}.png`)});
   await zoomCheck(page,width,id);
   console.log(`layout ${width} ${id}`);
  }
  for(const expression of aiOnly?[]:quick?['√x']:width===1366?['√x','ln x','e^x','sin x','cos x','x^2+2x+1']:['√x']){
   await generate(page,`函数 y=${expression}，当x=${expression==='√x'?4:1}时求切线斜率。`);await geometry(page,`${width}-math-${expression}`);
   await page.locator('#toast.show').waitFor({state:'hidden'});
   await page.locator('.content-grid').screenshot({path:resolve(output,`${width}-math-${expression.replace(/[^a-z0-9]/gi,'_')}.png`)});
  }
  if(!quick&&!aiOnly){
   await generate(page,'将5.6g铁粉加入含0.2mol硫酸铜的溶液中，求生成铜的质量。');await geometry(page,`${width}-chemistry`);await page.locator('#toast.show').waitFor({state:'hidden'});await page.locator('.content-grid').screenshot({path:resolve(output,`${width}-chemistry.png`)});
   await generate(page,'观察植物细胞的结构，指出细胞壁、细胞膜、细胞质、细胞核、叶绿体、线粒体和液泡。');await geometry(page,`${width}-biology`);
  }
  if(aiOnly&&width===1366){await preset(page,'brake');check(await page.evaluate(()=>buildMasterLabAIContext().formula==='v² − v₀² = 2ax'),'AI context: simultaneous scripts must retain source order');}
  await preset(page,'efficiency');await page.locator('#mentorExpandButton:visible,#mentorOpenPageButton:visible').first().click();await page.locator('#aiTutorInput').fill('请完整解答机械效率，写出分式和必要步骤。');await page.locator('#aiTutorSendButton').click();
  await page.waitForFunction(()=>document.querySelector('.ai-message.assistant:not(.pending):not(.error) .solution-section'));
  await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true');
  const ai=await page.evaluate(()=>({fractions:document.querySelectorAll('.ai-message.assistant .vfrac,.ai-message.assistant .mfrac').length,subscripts:document.querySelectorAll('.ai-message.assistant sub,.ai-message.assistant msub').length,katexErrors:document.querySelectorAll('.katex-error').length,follow:document.querySelector('.ai-follow-up')?.textContent,pageOverflow:document.documentElement.scrollWidth-innerWidth,errors:document.querySelectorAll('.ai-message.error').length,
   clipped:[...document.querySelectorAll('.ai-inline-math,.ai-display-math')].filter(n=>{const b=n.getBoundingClientRect(),m=n.querySelector('.katex-html')?.getBoundingClientRect();return m&&(m.top<b.top-1||m.bottom>b.bottom+1);}).map(n=>n.dataset.mathSource)}));
  report.ai.push({width,...ai});check(ai.fractions>=5&&!ai.katexErrors&&!ai.errors&&ai.pageOverflow<=1,`${width}: AI notation ${JSON.stringify(ai)}`);
  check(!ai.clipped.length,`${width}: clipped AI math `+JSON.stringify(ai.clipped));
  await page.locator('#toast.show').waitFor({state:'hidden'});
  await page.locator('#aiTutorMessages').evaluate(n=>{const answer=n.querySelector('.ai-message.assistant');n.scrollTop+=answer.getBoundingClientRect().top-n.getBoundingClientRect().top;});
  await page.locator('#aiTutorMessages').screenshot({path:resolve(output,`${width}-ai.png`)});
  await page.locator('#aiTutorMessages').evaluate(n=>{n.scrollTop=n.scrollHeight;});
  await page.locator('#aiTutorMessages').screenshot({path:resolve(output,`${width}-ai-end.png`)});
  await page.reload();await page.waitForFunction(()=>document.querySelector('.ai-message.assistant .mfrac'));check(await page.locator('.ai-message.assistant .vfrac,.ai-message.assistant .mfrac').count()>=5,`${width}: restored AI history`);
  await context.close();
 }
 check(!report.errors.length,'browser errors: '+JSON.stringify(report.errors));
}catch(error){report.failures.push(error.stack)}finally{
 await writeFile(resolve(output,variantsOnly?'browser-variants.json':aiOnly?'browser-ai-final.json':quick?'browser-quick.json':'browser-report.json'),JSON.stringify(report,null,2));await browser.close();server.close();
}
console.log(JSON.stringify({layouts:report.layouts.length,ai:report.ai.length,failures:report.failures},null,2));
if(report.failures.length)process.exitCode=1;
