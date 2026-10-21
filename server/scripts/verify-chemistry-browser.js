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
 if(pathname==='/qa-away'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Away</title><p>Local BFCache navigation</p>');return;}
 const baseline=pathname.startsWith('/baseline/');
 const dir=baseline&&process.env.CHEMISTRY_BASELINE_ROOT?resolve(process.env.CHEMISTRY_BASELINE_ROOT,'web'):web;
 const file=resolve(dir,(baseline?pathname.slice('/baseline/'.length):pathname.slice(1))||'index.html');
 if(!file.startsWith(dir+sep)){res.writeHead(400);res.end();return;}
 try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
const report={browser:browser.version(),started:new Date().toISOString(),checks:[],screenshots:[],layouts:[],pageErrors:[],consoleErrors:[],blockedRequests:[],mockRequests:[],baselineComparison:process.env.CHEMISTRY_BASELINE_ROOT||'not supplied',realAIRequests:0};
const contexts=[];
const check=(value,message)=>{assert.ok(value,message);report.checks.push(message);console.log('PASS',message);};
const near=(a,b)=>Math.abs(a-b)<1e-8;
const acidQ='10g纯碳酸钙与含HCl溶质3.65g的稀盐酸充分反应，求生成二氧化碳的质量和剩余碳酸钙的质量。';
const excessQ='10g纯碳酸钙与足量稀盐酸充分反应，求生成二氧化碳的质量。';
const feQ='铁粉质量为5.6g，与足量硫酸铜溶液充分反应，求生成铜的质量。';
async function fresh(width=1366,{reduced='reduce',baseline=false}={}){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced});contexts.push(context);
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/health'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,configured:false})});return;}
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
async function capture(page,name){const path=resolve(output,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);}
async function layout(page,name){
 const actual=await page.evaluate(()=>{
  const root=document.querySelector('.chemistry-lab-scene'),r=root.getBoundingClientRect();
  const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
  const nodes=[...root.querySelectorAll('.chemistry-scene-heading,.chemistry-apparatus,.chemistry-live-readouts,.chemistry-model-note')];
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
 check(await page.evaluate(()=>localStorage.getItem('master-lab-favorites-v1').includes('保留的数学收藏')),'unrelated saved favourite retained');
 await context.close();await receiver.context.close();
 check(report.pageErrors.length===0,'no page exceptions');check(report.consoleErrors.length===0,'no console errors');check(report.realAIRequests===0,'no real AI requests');
}catch(error){report.failure={message:error.message,stack:error.stack};process.exitCode=1;console.error(error);for(const c of contexts)for(const p of c.pages()){report.debug=await p.evaluate(()=>({body:document.body.innerText.slice(-5000),question:document.querySelector('#questionInput')?.value,generatedQuestion:state.generatedQuestion,template:activeGenericId(),hasGenerated:state.hasGenerated})).catch(()=>null);}}
finally{report.finished=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();}
