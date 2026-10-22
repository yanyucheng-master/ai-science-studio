// Local-only acceptance: isolated browser contexts, fixture replies, no personal profile or AI keys.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web');
const output=process.env.CHEMISTRY_QA_OUTPUT||resolve(root,'artifacts/chemistry-v1');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,aiConfigured:false}));return;}
 if(pathname==='/qa-away'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Away</title><p>Local BFCache navigation</p>');return;}
 const baseline=pathname.startsWith('/baseline/');
 const dir=baseline&&process.env.CHEMISTRY_BASELINE_ROOT?resolve(process.env.CHEMISTRY_BASELINE_ROOT,'web'):web;
 const file=resolve(dir,(baseline?pathname.slice('/baseline/'.length):pathname.slice(1))||'index.html');
 if(!file.startsWith(dir+sep)){res.writeHead(400);res.end();return;}
 try{let data=await readFile(file);if(extname(file)==='.css')data=data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g,'');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'"});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
const report={browser:browser.version(),started:new Date().toISOString(),checks:[],screenshots:[],layouts:[],pageErrors:[],consoleErrors:[],blockedRequests:[],mockRequests:[],baselineComparison:process.env.CHEMISTRY_BASELINE_ROOT||'not supplied',realAIRequests:0};
const contexts=[];
const check=(value,message)=>{assert.ok(value,message);report.checks.push(message);console.log('PASS',message);};
const near=(a,b)=>Math.abs(a-b)<1e-8;
const acidQ='10g纯碳酸钙与含HCl溶质3.65g的稀盐酸充分反应，求生成二氧化碳的质量和剩余碳酸钙的质量。';
const excessQ='10g纯碳酸钙与足量稀盐酸充分反应，求生成二氧化碳的质量。';
const solutionQ='20°C时，配制100g质量分数为10%的氯化钠溶液，求所需盐和水的质量、配制步骤。';
const feQ='铁粉质量为5.6g，与足量硫酸铜溶液充分反应，求生成铜的质量。';
async function fresh(width=1366,{reduced='reduce',baseline=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced});contexts.push(context);
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/health'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,aiConfigured:true})});return;}
  if(/\/api\/v1\//.test(url.pathname)){
   report.mockRequests.push({path:url.pathname,body:req.postDataJSON()});
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'steps',summary:'',steps:['明确溶质质量，用方程式质量比判断限量。'],formulas:[],finalAnswer:'结果由本地化学模型核对。',checks:[],followUp:'',warnings:[],source:'fixture'})});return;
  }
  if(url.origin!==base){report.blockedRequests.push(url.origin+url.pathname);await route.fulfill({status:204,body:''});return;}
  await route.continue();
 });
 await context.addInitScript(url=>{
  window.MASTER_LAB_API_URL=url;window.__qaClipboard=[];
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__qaClipboard.push(text)}});
  window.addEventListener('pageshow',e=>window.__qaPersisted=e.persisted);
  if(!localStorage.getItem('chemistry-qa-seed')){
   localStorage.setItem('chemistry-qa-seed','1');localStorage.setItem('masterLab.gradeLevel.v1','junior');
   localStorage.setItem('master-lab-favorites-v1',JSON.stringify([{subject:'数学',question:'二次函数y=x²-4x+3，求顶点。',title:'保留的数学收藏',detail:'原有详情',visual:'math'}]));
   localStorage.setItem('masterLab.tutorSessions.v1',JSON.stringify({version:1,activeId:'prior-chemistry-qa',sessions:[{id:'prior-chemistry-qa',context:null,messages:[{role:'user',text:'保留的聊天消息',id:'prior-message'}],draft:'保留的聊天草稿',quotes:[],updatedAt:1}]}));
  }
 },base);
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.consoleErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
 await page.goto(base+(baseline?'/baseline/':'/'));await page.waitForFunction(()=>typeof planLocalExperiment==='function');
 await page.evaluate(()=>{clearTimeout(state.autoDemoTimer);});
 return {context,page};
}
async function generate(page,q){
 await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();
 await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay').classList.contains('show'),q,{timeout:15000});
 await page.evaluate(()=>{clearReasoningTimers();clearDemoTimers();});
}
async function change(page,index,value){await page.locator('.parameters input[type=range]').nth(index).fill(String(value));}
async function capture(page,name){await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:5000});const path=resolve(output,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);}
async function layout(page,name){
 const actual=await page.evaluate(()=>{
  const root=document.querySelector('.chemistry-lab-scene'),r=root.getBoundingClientRect();
  const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
  const nodes=[...root.querySelectorAll('.chemistry-scene-heading,.chemistry-apparatus,.solution-step-list,.solution-stations,.chemistry-live-readouts,.chemistry-model-note')];
  return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,root:rect(root),boxes:nodes.map(rect),
   textOverflow:[...root.querySelectorAll('strong,span,p')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
   rootOverflow:root.scrollWidth>root.clientWidth+1,
   childrenInside:nodes.every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1;}),
   controls:[...document.querySelectorAll('.parameters input[type=range],#playButton,#resetButton')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,disabled:e.disabled}))};
 });
 report.layouts.push({name,...actual});check(actual.pageWidth<=actual.viewport+1,`${name}: no horizontal page overflow`);check(!actual.rootOverflow&&actual.childrenInside,`${name}: apparatus, labels and notes inside scene`);check(actual.textOverflow.length===0,`${name}: no clipped text`);check(actual.controls.every(c=>c.width>0&&c.height>0),`${name}: controls have usable geometry`);
 for(let i=1;i<actual.boxes.length;i++)check(actual.boxes[i].y>=actual.boxes[i-1].bottom-1,`${name}: scene regions do not overlap ${i}`);
}
try{
 for(const width of [1366,820,390]){
  const {context,page}=await fresh(width);await generate(page,acidQ);
  await page.locator('#timeline').fill('50');check(await page.locator('[data-chem-bubble]').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).opacity==='0')),`${width}: reduced-motion suppresses moving gas bubbles`);
  check(await page.evaluate(()=>activeGenericId()==='caco3Hcl'&&Math.abs(buildGenericContent().model.co2Mass-2.2)<1e-8),`${width}: generated expected local model`);
  await page.locator('#timeline').fill('100');
  check(await page.locator('[data-chem-gas]').innerText()==='2.2 g',`${width}: final gas readout`);
  check(await page.locator('[data-chem-ca]').innerText()==='5 g',`${width}: remaining solid readout`);
  await layout(page,`caco3-${width}`);await capture(page,`caco3-${width}`);
  check(await page.locator('#shareButton').isVisible(),`${width}: share control visible`);
  await page.locator('#shareButton').click();check(await page.evaluate(()=>window.__qaClipboard.length===1),`${width}: share control copies URL`);
  await generate(page,excessQ);check(await page.locator('.parameters input[type=range]').nth(1).isDisabled(),`${width}: excess acid parameter locked`);
  await page.locator('#timeline').fill('100');check((await page.locator('[data-chem-hcl]').innerText()).includes('未定量'),`${width}: excess remainder never fabricated`);
  await capture(page,`caco3-excess-${width}`);
  const ai=await page.evaluate(()=>buildMasterLabAIContext());check(ai.mode==='question'&&ai.templateId===''&&ai.subject==='化学'&&ai.deterministicResult.resultText.includes('4.4'),`${width}: tutor uses local deterministic question context`);
  await context.close();
  const comparison=await fresh(width,{baseline:Boolean(process.env.CHEMISTRY_BASELINE_ROOT)});await generate(comparison.page,feQ);await capture(comparison.page,`reference-fe-${width}`);await comparison.context.close();
 }
 for(const width of [1366,820,390]){
  const {page,context}=await fresh(width);await generate(page,solutionQ);
  check(await page.evaluate(()=>activeGenericId()==='naclSolution'&&buildGenericContent().model.saltMass===10&&buildGenericContent().model.waterMass===90),`${width}: NaCl independent 100g/10% result`);
  for(const [p,salt,water,mixture]of [[20,10,0,0],[45,10,90,0],[60,0,90,10],[80,0,0,100],[100,0,0,100]]){
   await page.locator('#timeline').fill(String(p));
   const masses=await page.locator('[data-solution-salt-readout],[data-solution-water-readout],[data-solution-mixture-readout]').allInnerTexts();
   check(near(parseFloat(masses[0]),salt)&&near(parseFloat(masses[1]),water)&&near(parseFloat(masses[2]),mixture),`${width}: staged masses at ${p}%`);
   if(p===60)check(await page.locator('[data-solution-mixture]').evaluate(e=>Number(e.getAttribute('height'))===0),`${width}: dry salt before adding water is not drawn as liquid`);
  }
  check(await page.locator('[data-solution-crystals]').evaluate(e=>getComputedStyle(e).opacity==='0'),`${width}: mixed solution has no remaining solid`);
  await page.locator('#timeline').fill('90');check(await page.locator('[data-solution-stirrer]').getAttribute('transform')==='translate(0 0)',`${width}: reduced-motion suppresses stirring motion`);await page.locator('#timeline').fill('100');
  await layout(page,`nacl-${width}`);await capture(page,`nacl-${width}`);
  const pure=solutionQ.replace('为10%','为0%');await generate(page,pure);await page.locator('#timeline').fill('100');
  check((await page.locator('[data-solution-salt-readout]').innerText())==='无需称盐'&&await page.locator('[data-solution-mixture-readout]').innerText()==='100 g',`${width}: pure water skips salt and has 100g water`);
  check(await page.locator('[data-solution-crystals]').evaluate(e=>getComputedStyle(e).opacity==='0'),`${width}: pure water never shows salt particles`);await capture(page,`nacl-pure-water-${width}`);
  await page.locator('#shareButton').click();check(await page.evaluate(()=>window.__qaClipboard.at(-1).includes('#/share/')),`${width}: solution share button works`);
  await context.close();
 }
 const {page,context}=await fresh(1366,{reduced:'no-preference'});await generate(page,acidQ);
 await page.locator('#playButton').click();await page.waitForFunction(()=>state.playing&&state.time>.4);await page.locator('#playButton').click();
 const t=await page.evaluate(()=>state.time);await page.waitForTimeout(180);check(await page.evaluate(t=>!state.playing&&state.time===t,t),'pause stops owned clock');
 await page.locator('#playButton').click();await page.waitForFunction(t=>state.time>t+.1,t);await page.locator('#playButton').click();check(true,'continue advances the same experiment');
 await change(page,0,20);await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p1===10&&state.p2===3.65&&state.time===0&&!state.playing),'reset restores original question parameters and paused stage');
 await generate(page,excessQ);await change(page,0,20);
 await page.evaluate(()=>MasterLabShare.copy());const share=await page.evaluate(()=>window.__qaClipboard.at(-1));
 const receiver=await fresh();await receiver.page.goto(share);await receiver.page.waitForFunction(()=>activeGenericId()==='caco3Hcl'&&state.hasGenerated&&state.p1===20);
 check(await receiver.page.evaluate(()=>state.p2===0&&state.extraFixed.caco3Hcl.excess==='hcl'),'independent context restores current slider and excess mode');
 await receiver.page.locator('#resetButton').click();check(await receiver.page.evaluate(()=>state.p1===10&&state.p2===0),'shared reset uses question baseline, not comparison slider');
 const caComparisonContext=await page.evaluate(()=>buildMasterLabAIContext());
 check(caComparisonContext.originalQuestion===excessQ&&caComparisonContext.deterministicResult.metrics.includes('CaCO₃ 20 g')&&caComparisonContext.deterministicResult.metrics.includes('HCl 溶质 足量')&&caComparisonContext.deterministicResult.resultText.includes('8.8'),'tutor distinguishes original 10g question from current 20g comparison and excess mode');
 check(await page.evaluate(()=>localStorage.getItem('master-lab-favorites-v1').includes('保留的数学收藏')),'unrelated saved favourite retained');
 check(await receiver.page.evaluate(()=>localStorage.getItem('masterLab.tutorSessions.v1').includes('保留的聊天消息')&&localStorage.getItem('masterLab.tutorSessions.v1').includes('保留的聊天草稿')),'sharing keeps unrelated tutor messages and draft');
 await generate(page,solutionQ);await page.locator('#playButton').click();await page.waitForFunction(()=>state.playing&&state.time>.3);await page.locator('#playButton').click();
 const solutionTime=await page.evaluate(()=>state.time);await page.waitForTimeout(150);check(await page.evaluate(t=>!state.playing&&state.time===t,solutionTime),'solution play and pause use the shared clock');
 await change(page,0,150);await change(page,1,6);
 check(await page.evaluate(()=>state.generatedQuestion===state.genericQuestionBaseline.question&&buildGenericContent().model.saltMass===9&&buildGenericContent().model.waterMass===141),'comparison leaves question/reset baseline intact');
 await page.locator('.grade-switch [data-grade="senior"]').first().click();check(await page.evaluate(()=>state.p1===150&&state.p2===6&&state.extraFixed.naclSolution.level==='senior'),'grade UI preserves solution parameters and fixed temperature');
 await page.locator('#favoriteButton').click();
 await page.locator('.subject-tab[data-subject="物理"]').click();await page.locator('.subject-tab[data-subject="化学"]').click();
 check(await page.evaluate(()=>activeGenericId()==='naclSolution'&&state.p1===150&&state.p2===6),'subject snapshot restores adjusted solution');
 await page.evaluate(()=>MasterLabShare.copy());const shareB=await page.evaluate(()=>window.__qaClipboard.at(-1));
 await page.locator('.favorite-item[data-subject="化学"]').filter({hasText:'氯化钠'}).click();await generate(page,await page.locator('#questionInput').inputValue());
 check(await page.evaluate(()=>state.p1===150&&state.p2===6),'favourite load followed by Generate restores saved parameters');
 await change(page,0,200);await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p1===150&&state.p2===6),'favourite saves comparison configuration and establishes its own reset baseline');
 const nav=receiver.page;await nav.goto(share);check(await nav.evaluate(()=>state.p1===10&&activeGenericId()==='caco3Hcl'),'reopening same active share preserves explicit reset');await change(nav,0,25);
 await nav.evaluate(()=>MasterLabAITutor.openStandalone());await nav.evaluate(url=>{location.href=url;},share);await nav.waitForFunction(()=>!location.hash.startsWith('#/ai-tutor'));
 check(await nav.evaluate(()=>state.p1===25),'AI route return preserves adjustments in same active share');
 const equivalentData=JSON.parse(Buffer.from(new URL(share).hash.slice('#/share/'.length),'base64url').toString());
 const equivalentURL=base+'/#/share/'+Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(equivalentData).reverse()))).toString('base64url');await nav.goto(equivalentURL);
 check(await nav.evaluate(()=>state.p1===25),'equivalent payload property ordering preserves active adjustments');
 await nav.goto(shareB);await nav.waitForFunction(()=>activeGenericId()==='naclSolution'&&state.p1===150&&state.p2===6);
 check(await nav.evaluate(()=>state.extraFixed.naclSolution.temperature===20&&buildGenericContent().model.waterMass===141),'independent share restores solution comparison and fixed 20C');
 await nav.goto(share);await nav.waitForFunction(()=>activeGenericId()==='caco3Hcl'&&state.p1===20);check(true,'A to B to A restores A after leaving context');
 await nav.evaluate(()=>{location.hash='#物理';});await nav.waitForFunction(()=>!state.hasGenerated&&state.subject==='物理');await nav.goto(share);await nav.waitForFunction(()=>activeGenericId()==='caco3Hcl'&&state.p1===20);check(true,'legacy waiting route to old share restores A');
 await change(nav,0,25);await nav.goto(base+'/qa-away');await nav.evaluate(()=>history.back());await nav.waitForFunction(()=>state.hasGenerated&&activeGenericId()==='caco3Hcl');
 report.routedBFCache={persisted:await nav.evaluate(()=>window.__qaPersisted),p1:await nav.evaluate(()=>state.p1),note:'CDP request routing may disable BFCache; verified separately without routing below.'};
 await nav.reload();await nav.waitForFunction(()=>state.hasGenerated&&state.p1===20);check(true,'reload imports payload configuration once');
 const bad=JSON.parse(Buffer.from(new URL(share).hash.slice('#/share/'.length),'base64url').toString());bad.params[1]=1;
 const badURL=base+'/#/share/'+Buffer.from(JSON.stringify(bad)).toString('base64url');await nav.goto(badURL);await nav.waitForFunction(()=>document.querySelector('#parseFeedback')?.classList.contains('error'));
 check(await nav.evaluate(()=>state.p1===20&&state.p2===0&&state.extraFixed.caco3Hcl.excess==='hcl'),'forged locked parameter rejects without replacing active experiment');
 await generate(page,solutionQ);await change(page,0,150);await change(page,1,6);await page.locator('#mentorExpandButton').click();await page.locator('#aiTutorMore > summary').click();await page.locator('#aiTutorPageButton').click();await page.locator('#aiTutorInput').fill('请解释这组配料怎样保持总质量。');await page.locator('#aiTutorSendButton').click();await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
 const request=report.mockRequests.findLast(x=>x.path==='/api/v1/tutor/chat'),sentContext=request?.body.context;
 check(sentContext?.originalQuestion===solutionQ&&sentContext.deterministicResult.metrics.includes('目标溶液总质量 150 g')&&sentContext.deterministicResult.metrics.includes('质量分数 6%')&&sentContext.deterministicResult.resultText.includes('9 g')&&sentContext.deterministicResult.resultText.includes('141 g'),'tutor request carries current 150g/6% configuration and 9g/141g result alongside original 100g/10% question');
 await page.locator('#aiTutorBackButton').click();
 await context.close();await receiver.context.close();
 const menu=await fresh();await menu.page.locator('.subject-tab[data-subject="化学"]').click();
 for(const id of ['caco3Hcl','naclSolution']){
  await menu.page.locator('#physicsPresetToggle').click();await menu.page.locator(`.preset-option[data-preset="${id}"]`).click();
  const q=await menu.page.locator('#questionInput').inputValue();await generate(menu.page,q);check(await menu.page.evaluate(id=>activeGenericId()===id,id),`menu preset generates ${id}`);
 }
 await menu.context.close();
 const semantic=await fresh();await generate(semantic.page,acidQ);
 for(const q of [
  '10g纯碳酸钙与稀盐酸充分反应后，剩余HCl溶质质量为3.65g，求生成二氧化碳的质量。',
  '纯碳酸钙与足量稀盐酸充分反应后，剩余碳酸钙的质量为10g，求生成二氧化碳的质量。',
  '消耗5g纯碳酸钙与足量稀盐酸反应，求二氧化碳的质量。',
  '10g纯碳酸钙与稀盐酸反应，HCl溶质质量为3.65g（剩余质量），求二氧化碳的质量。',
  '碳酸钙质量为5g，为消耗质量，与足量稀盐酸反应，求二氧化碳的质量。',
  '10g纯碳酸钙与稀盐酸反应，HCl溶质质量为3.65g（反应后），求二氧化碳的质量。'
 ]){
  await semantic.page.locator('#questionInput').fill(q);await semantic.page.evaluate(()=>generateExperiment({allowAiFallback:false}));
  check(await semantic.page.evaluate(original=>!planLocalExperiment(document.querySelector('#questionInput').value).ok&&state.generatedQuestion===original&&state.p1===10&&state.p2===3.65,acidQ),'outcome condition rejected in actual page without rebinding or replacing retained experiment');
 }
 for(const grade of ['junior','senior'])for(const [given,asks,expected]of [
  ['10g纯碳酸钙与足量稀盐酸','消耗HCl溶质的质量',{consumedHcl:7.3}],
  ['足量纯碳酸钙与含HCl溶质3.65g的稀盐酸','消耗碳酸钙的质量',{consumedCa:5}],
  ['10g纯碳酸钙与含HCl溶质3.65g的稀盐酸','生成二氧化碳的质量、消耗碳酸钙的质量、消耗HCl溶质的质量、剩余碳酸钙的质量',{co2:2.2,consumedCa:5,consumedHcl:3.65,remainingCa:5}]
 ]){
  await generate(semantic.page,`${grade==='junior'?'初中':'高中'}：${given}充分反应，求${asks}。`);
  const actual=await semantic.page.evaluate(()=>({m:buildGenericContent().model,step:ScienceFormula.sourceText(document.querySelector('.reason-step[data-step="3"]')),context:buildMasterLabAIContext()}));
  check(Object.keys(expected).every(key=>actual.m.answers.some(a=>a.key===key&&near(a.value,expected[key]))),`${grade}: consumed quantities independently match hand calculations`);
  check(actual.m.answers.every(a=>actual.step.includes(a.label)&&actual.context.deterministicResult.resultText.includes(a.label)),`${grade}: steps and tutor result name every actual ask`);
 }
 // Review 5608954415: execute real page rejection with a previously adjusted
 // experiment on screen. Preserve the entire model, original/reset question,
 // parameters, fixed mode and readout, rather than only its ID. Tutor context
 // follows the input question; a rejected new question must not borrow old results.
 report.semanticReview={review:'https://github.com/yanyucheng-master/ai-science-studio/pull/4#pullrequestreview-5608954415',cases:[]};
 for(const id of ['caco3Hcl','naclSolution']){
  const original=id==='caco3Hcl'?acidQ:solutionQ;
  await generate(semantic.page,original);await change(semantic.page,0,id==='caco3Hcl'?20:150);
  const snapshot=()=>semantic.page.evaluate(()=>JSON.stringify({id:activeGenericId(),original:state.generatedQuestion,baseline:state.genericQuestionBaseline,p1:state.p1,p2:state.p2,fixed:state.extraFixed[activeGenericId()],model:buildGenericContent().model,readout:document.querySelector('#stopDistanceLabel').textContent}));
  const before=await snapshot();
  const tutorBefore=await semantic.page.evaluate(()=>JSON.stringify(buildMasterLabAIContext().deterministicResult));
  const negatives=id==='caco3Hcl'?[
   ...['（反应后）','（剩余质量）','，为消耗质量'].flatMap(note=>{
    const given=`10g纯碳酸钙与稀盐酸充分反应，HCl溶质质量为3.65g${note}`;
    return [`求生成二氧化碳的质量。${given}。`,`求：生成二氧化碳的质量：${given}。`,`${given}。求生成二氧化碳的质量。`];
   }),
   '求生成二氧化碳的质量。消耗5g纯碳酸钙，与足量稀盐酸反应。',
   '求生成二氧化碳的质量。10g纯碳酸钙与稀盐酸反应，反应后HCl溶质质量为3.65g。',
   ...['消耗二氧化碳的质量','剩余二氧化碳的质量','生成碳酸钙的质量','生成HCl溶质的质量','生成二氧化碳的质量和消耗二氧化碳的质量'].flatMap(ask=>[`10g纯碳酸钙与足量稀盐酸反应，求${ask}。`,`求：${ask}。10g纯碳酸钙与足量稀盐酸反应。`])
  ]:[
   ...['水的质量分数','水的温度','盐和水的质量分数','盐的质量和水的温度','配制步骤和水的温度','生成水的质量','消耗盐的质量','剩余水的质量'].flatMap(ask=>[`20°C时，配制200g质量分数为10%的氯化钠溶液，求${ask}。`,`求：${ask}。20°C时，配制200g质量分数为10%的氯化钠溶液。`])
  ];
  for(const question of negatives){
   await semantic.page.locator('#questionInput').fill(question);await semantic.page.evaluate(()=>generateExperiment({allowAiFallback:false}));
   const refused=await semantic.page.evaluate(()=>!planLocalExperiment(document.querySelector('#questionInput').value).ok);
   const after=await snapshot(),retained=after===before;
   const newContext=await semantic.page.evaluate(()=>buildMasterLabAIContext());
   const noBorrowedAnswer=newContext.originalQuestion===question&&!newContext.deterministicResult.resultText;
   const feedback=await semantic.page.locator('#parseFeedback').innerText();
   const visibleRejection=Boolean(feedback.trim())&&await semantic.page.locator('#parseFeedback.error.show').isVisible();
   if(question===negatives[0]){const path=resolve(output,`${id}-review-rejection.png`);await semantic.page.screenshot({path,fullPage:true});report.screenshots.push(path);}
   await semantic.page.locator('#questionInput').fill(original);
   const tutorRetained=await semantic.page.evaluate(()=>JSON.stringify(buildMasterLabAIContext().deterministicResult))===tutorBefore;
   const passed=refused&&retained&&noBorrowedAnswer&&tutorRetained&&visibleRejection;
   report.semanticReview.cases.push({question,expected:'reject-and-retain',actual:passed?'reject-and-retain':'failed',feedback,...passed?{}:{refused,retained,noBorrowedAnswer,tutorRetained,visibleRejection,before:JSON.parse(before),after:JSON.parse(after)}});
   if(!passed)console.log(JSON.stringify(report.semanticReview.cases.at(-1)));
   check(passed,`${id}: review counterexample rejected and original adjusted experiment retained: ${question}`);
  }
 }
 for(const [question,key,value]of [
  ['求：生成二氧化碳的质量。10g纯碳酸钙与含HCl溶质3.65g的稀盐酸反应。','co2',2.2],
  ['求消耗HCl溶质的质量：10g纯碳酸钙与足量稀盐酸反应。','consumedHcl',7.3],
  ['求剩余碳酸钙的质量。10g纯碳酸钙与含HCl溶质3.65g的稀盐酸充分反应后。','remainingCa',5]
 ]){
  await generate(semantic.page,question);const actual=await semantic.page.evaluate(()=>buildGenericContent().model.answers);
  check(actual.length===1&&actual[0].key===key&&near(actual[0].value,value),`front-loaded valid ask preserves action and hand-calculated ${key}`);
  report.semanticReview.cases.push({question,expected:{key,value},actual:actual[0]});
 }
 const frontSolution='求：所需盐和水的质量。20°C时，配制200g质量分数为10%的氯化钠溶液。';
 await generate(semantic.page,frontSolution);
 check(await semantic.page.evaluate(()=>state.extraFixed.naclSolution.asks==='salt,water'&&buildGenericContent().model.saltMass===20&&buildGenericContent().model.waterMass===180),'front-loaded NaCl mass question gives salt 20g / water 180g without substituting another type');
 report.semanticReview.cases.push({question:frontSolution,expected:{saltMass:20,waterMass:180},actual:await semantic.page.evaluate(()=>{const m=buildGenericContent().model;return {saltMass:m.saltMass,waterMass:m.waterMass};})});
 await semantic.context.close();
 const preservation=await fresh();
 await generate(preservation.page,'一辆汽车以20m/s的速度行驶，刹车加速度大小为5m/s²，求刹车距离。');await change(preservation.page,0,25);
 await generate(preservation.page,solutionQ);await preservation.page.locator('.subject-tab[data-subject="物理"]').click();
 check(await preservation.page.evaluate(()=>state.physicsTemplate==='brake'&&state.p1===25&&state.p2===5),'new chemistry generation preserves existing physics snapshot');await preservation.context.close();
 // No CDP routing in these contexts. CSP + local server fixtures enforce offline
 // connections without disabling the browser's real back/forward document cache.
 report.bfcache=[];
 for(const [url,edited]of [[share,25],[shareB,200]]){
  const cacheContext=await browser.newContext({viewport:{width:1366,height:1000},reducedMotion:'reduce'});contexts.push(cacheContext);
  await cacheContext.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.addEventListener('pageshow',e=>window.__actualCachePersisted=e.persisted);},base);
  const cachePage=await cacheContext.newPage();cachePage.on('pageerror',e=>report.pageErrors.push(e.stack||e.message));
  await cachePage.goto(url);await cachePage.waitForFunction(()=>state.hasGenerated);const initial=await cachePage.evaluate(()=>state.p1);
  await change(cachePage,0,edited);await cachePage.goto(base+'/qa-away');await cachePage.evaluate(()=>history.back());
  await cachePage.waitForFunction(()=>window.__actualCachePersisted===true&&state.hasGenerated);
  check(await cachePage.evaluate(n=>state.p1===n,edited),'real BFCache keeps adjusted chemistry share');
  const id=await cachePage.evaluate(()=>activeGenericId());await cachePage.evaluate(()=>applyWaitingState('物理',{presetQuestion:true}));await cachePage.goto(base+'/qa-away');await cachePage.evaluate(()=>history.back());
  await cachePage.waitForFunction(n=>window.__actualCachePersisted===true&&state.hasGenerated&&state.p1===n,initial);
  check(await cachePage.evaluate(n=>state.p1===n,initial),'real BFCache reimports chemistry share after context was left');report.bfcache.push({template:id,persisted:true,initial,edited,reimported:initial});await cacheContext.close();
 }
 check(report.pageErrors.length===0,'no page exceptions');check(report.consoleErrors.length===0,'no console errors');check(report.realAIRequests===0,'no real AI requests');
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;console.error(error);report.debug=[];for(const c of contexts)for(const p of c.pages()){report.debug.push(await p.evaluate(()=>({url:location.href,body:document.body.innerText.slice(-5000),question:document.querySelector('#questionInput')?.value,generatedQuestion:state.generatedQuestion,template:activeGenericId(),hasGenerated:state.hasGenerated,p1:state.p1,p2:state.p2})).catch(()=>null));}}
finally{report.finished=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();}
