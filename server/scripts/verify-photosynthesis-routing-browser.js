// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const harnessRoot=fileURLToPath(new URL('../../',import.meta.url)),root=process.env.PROTOCOL_SOURCE_ROOT||harnessRoot,web=resolve(root,'web'),out=process.env.PROTOCOL_QA_OUTPUT||resolve(root,'artifacts/protocol-review');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname.startsWith('/api/')){report.api.push(pathname);res.writeHead(503);res.end();return;}
 if(pathname==='/health'){res.setHeader('Content-Type','application/json');res.end('{"ok":true,"aiConfigured":true,"configured":true,"aiAvailable":true}');return;}
 if(pathname==='/away'){res.setHeader('Content-Type','text/html');res.end('<title>Local away</title>BFCache navigation');return;}
 const p=resolve(web,pathname.slice(1)||'index.html');if(!p.startsWith(web+sep)){res.writeHead(400);res.end();return;}
 try{
  let data=await readFile(p);
  if(extname(p)==='.html')data=data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>/g,'');
  if(extname(p)==='.html'){
   const settings=new URL(req.url,'http://local').searchParams;
   if(settings.get('noTutor')==='1')data=data.toString().replace(/<script src="ai-tutor\.js[^"\n]*"><\/script>/g,'');
   if(settings.get('order')){
    const tags=data.toString().match(/  <script src="biology-(?:photosynthesis|leaf-disks)[^"\n]*"><\/script>\r?\n/g)||[];
    if(tags.some(x=>x.includes('photosynthesis.js'))&&tags.some(x=>x.includes('leaf-disks.js'))){
     let text=data.toString();for(const tag of tags)text=text.replace(tag,'');
     const first=settings.get('order')==='senior'?'leaf-disks':'photosynthesis';tags.sort((a,b)=>Number(!a.includes(first))-Number(!b.includes(first)));
     data=text.replace(/(  <script src="app\.js)/,tags.join('')+'$1');
    }
   }
  }
  if(extname(p)==='.css')data=data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g,'');
  res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'})[extname(p)]||'application/octet-stream','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'"});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']}),report={browser:browser.version(),checks:[],errors:[],api:[],screenshots:[],layouts:[]};
let secondary;const contexts=[];
const check=(v,s)=>{assert.ok(v,s);report.checks.push(s);console.log('PASS',s);};
async function context(width=1366,height=1000,{engine=browser,routing=true}={}){const c=await engine.newContext({viewport:{width,height},hasTouch:width<=844,isMobile:width<=844,reducedMotion:'reduce'});contexts.push(c);if(routing)await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')){report.api.push(u.pathname);return r.fulfill({status:503,body:''});}return u.origin===base?r.continue():r.fulfill({status:204,body:''});});await c.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copies.push(text)}});window.addEventListener('pageshow',e=>window.__persisted=e.persisted);},base);c.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});});return c;}
async function generate(page,q){await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!experimentConditionsPending&&!document.querySelector('#generationOverlay').classList.contains('show'),q);await page.waitForTimeout(120); // Let the existing 80ms post-generation focus finish before another click.
 await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
async function share(page){await page.locator('#shareButton').click();return page.evaluate(()=>window.__copies.at(-1));}

// No API calls replace the real button. The plan below is a labelled supplementary observation.
const fixtures=JSON.parse(await readFile(resolve(harnessRoot,'server/eval/photosynthesis-routing-cases.json'),'utf8'));
const repro=process.env.ROUTING_REPRO==='1';
const snapshot=p=>p.evaluate(()=>({question:state.generatedQuestion,input:document.querySelector('#questionInput').value,subject:state.subject,grade:state.gradeLevel,template:activeGenericId(),hasGenerated:state.hasGenerated,time:state.time,playing:state.playing,feedback:document.querySelector('#parseFeedback strong')?.textContent||'',result:buildMasterLabAIContext().deterministicResult,context:buildMasterLabAIContext(),hash:location.hash}));
const seed=async(p,subject)=>{
 if(await p.locator('#aiTutorBackButton').isVisible())await p.locator('#aiTutorBackButton').click();
 await p.locator('.subject-tab[data-subject="'+subject+'"]').click();
 const q=subject==='物理'?'一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，求刹车距离。':fixtures.find(x=>x.id===({数学:'math-control',化学:'chemistry-control',生物:'biology-control'}[subject])).question;const current=await snapshot(p);if(!current.hasGenerated||current.question!==q||current.subject!==subject)await generate(p,q);
 if(subject==='物理')await p.locator('#timeline').fill('31');else if(await p.locator('#timeline').isVisible())await p.locator('#timeline').fill('31');
};
report.sourceSha=process.env.PROTOCOL_SOURCE_SHA||'working-tree';report.method='normal generate button';report.cases=[];report.failures=[];report.registry=[];report.api=[];
try{
 const probe=await context(),pp=await probe.newPage();await pp.goto(base);await pp.waitForFunction(()=>typeof planLocalExperiment==='function');await pp.evaluate(()=>clearTimeout(state.autoDemoTimer));
 const ids=await pp.evaluate(()=>['photosynthesis','leafDisks'].filter(id=>MASTER_LAB_TEMPLATES[id]));await probe.close();report.templates=ids;
 for(const noTutor of repro?[false]:[false,true])for(const order of ids.length===2&&!repro?['junior','senior']:['single'])for(const grade of repro?['senior']:['junior','senior']){
  const width=!noTutor&&grade==='senior'?390:1366,c=await context(width,950),p=await c.newPage(),requests=[];
  await c.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;requests.push({path,body:req.postDataJSON(),status:503});return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'local routing mock unavailable',code:'UNAVAILABLE'}})});});
  await p.goto(base+'/?noTutor='+(noTutor?'1':'0')+'&order='+order);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>clearTimeout(state.autoDemoTimer));
  const registry=await p.evaluate(()=>Object.keys(MASTER_LAB_TEMPLATES).filter(id=>['photosynthesis','leafDisks'].includes(id)));report.registry.push({noTutor,grade,order,registry});
  if(ids.length===2&&order!=='single')assert.deepEqual(registry,order==='junior'?['photosynthesis','leafDisks']:['leafDisks','photosynthesis']);
  await p.locator('.grade-switch:visible [data-grade="'+grade+'"]').first().click();
  let rows=fixtures.filter(row=>row.scope==='shared'||ids.includes(row.templateId));
  if(repro)rows=rows.filter(row=>(process.env.ROUTING_CASE_IDS?process.env.ROUTING_CASE_IDS.split(','):['mirror-control','mirror-light','mirror-zone','general-photosynthesis','general-light']).includes(row.id));
  else if(noTutor||order==='senior'||grade==='junior')rows=rows.filter(row=>['mirror-control','mirror-light','mirror-zone','general-photosynthesis','general-light','math-control','chemistry-control','biology-control'].includes(row.id)||row.id.endsWith('-without-book')||row.id.endsWith('-unsupported-extra'));
  for(const row of rows){
   const subject=row.subject||(row.scope==='shared'?'物理':grade==='junior'?'化学':'数学');await seed(p,subject);const start=await snapshot(p),requestIndex=requests.length;
   const observation={id:row.id,question:row.question,expected:row.expected,selectedSubject:subject,selectedGrade:grade,noTutor,order,viewportWidth:width,before:start};
   try{
    await p.locator('#questionInput').fill(row.question);await p.locator('#generateButton').click();
    await p.waitForFunction(()=>!experimentConditionsPending&&!aiHandoffPending&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay').classList.contains('show'));
    if(row.expected==='local')await p.waitForFunction(q=>state.generatedQuestion===q||Boolean(document.querySelector('#parseFeedback.error.show')),row.question);
    await p.waitForTimeout(120); // Existing delayed focus must finish before a subsequent action.
    // The click itself is awaited; transient generation must have settled before observing.
    const actual=await snapshot(p),sent=requests.slice(requestIndex);observation.actual=actual;observation.requests=sent;
    observation.supplementaryPlan=await p.evaluate(q=>{const r=planLocalExperiment(q);return {ok:r.ok,subject:r.subject,localOnly:Boolean(r.localOnly),template:r.templateId||r.kind,diagnostic:r.diagnosticTemplateId,message:r.parse?.message};},row.question);
    assert.equal(actual.input,row.question,'input preserved');
    if(row.expected==='local'){
     assert.equal(actual.question,row.question,'actual generation');assert.equal(actual.hasGenerated,true);assert.equal(actual.template||'cell',row.templateId);assert.equal(sent.length,0,'local success sends no request');
     if(row.templateId==='planeMirror'){assert.match(JSON.stringify(actual.result),/像距[^；]{0,25}20/);assert.match(JSON.stringify(actual.result),/物像距离[^；]{0,30}40/);assert.match(JSON.stringify(actual.result),/像高[^；]{0,25}5/);}
    }else{
     assert.equal(actual.question,start.question,'original experiment preserved');assert.equal(actual.template,start.template);assert.equal(actual.time,start.time,'paused position preserved');assert.equal(actual.playing,start.playing);assert.equal(actual.context.originalQuestion,row.question);assert.ok(!actual.context.deterministicResult.resultText&&!actual.context.currentStep,'no old answer in new question tutor');
     if(row.expected==='protocol-refusal'){assert.equal(sent.length,0,'fixed procedure never silently sent');assert.match(actual.feedback,/请|无法|缺少|所问|条件/);assert.equal(observation.supplementaryPlan.localOnly,true);assert.equal(observation.supplementaryPlan.diagnostic,row.templateId);}
     else{assert.equal(sent.length,noTutor?0:1,'normal fallback availability preserved');if(!noTutor){assert.equal(sent[0].path,'/api/v1/experiment/generate');assert.equal(sent[0].body.question,row.question);}assert.equal(observation.supplementaryPlan.localOnly,false);assert.doesNotMatch(actual.feedback,/同叶遮光还是叶圆片|当前固定教材流程/);}
    }
    observation.passed=true;report.checks.push(row.id+'/'+noTutor+'/'+grade+'/'+order);
    if(!noTutor&&grade==='senior'&&order!=='senior'&&['mirror-light','junior-unsupported-extra','senior-unsupported-extra'].includes(row.id)){
     const file=row.id+'-'+width+'.png';await p.locator('.experiment-card').screenshot({path:resolve(out,file),animations:'disabled'});report.screenshots.push(file);
    }
   }catch(e){observation.passed=false;observation.failure=e.message;observation.actual||=await snapshot(p);observation.requests||=requests.slice(requestIndex);report.failures.push({id:row.id,noTutor,grade,order,message:e.message});}
   report.cases.push(observation);console.log((observation.passed?'PASS ':'FAIL ')+row.id+'/'+noTutor+'/'+grade+'/'+order);await writeFile(resolve(out,'progress.json'),JSON.stringify({completed:report.cases.length,failures:report.failures}));
  }
  await c.close();
 }
 if(!repro){
  report.playingRefusals=[];
  for(const id of ids){const c=await context(),p=await c.newPage(),sent=[];await c.route('**/api/**',route=>{sent.push(new URL(route.request().url()).pathname);return route.fulfill({status:503,body:''});});await p.goto(base);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>clearTimeout(state.autoDemoTimer));await seed(p,'物理');await p.locator('#playButton').click();await p.waitForFunction(()=>state.playing);const row=fixtures.find(x=>x.templateId===id&&x.id.endsWith('-unsupported-extra'));const beforeEdit=await snapshot(p);await p.locator('#questionInput').fill(row.question);const afterEdit=await snapshot(p);assert.equal(afterEdit.playing,false,'editing retains the existing automatic pause contract');await p.locator('#playButton').click();await p.waitForFunction(()=>state.playing);const before=await snapshot(p);assert.equal(before.playing,true);await p.locator('#generateButton').click();await p.locator('#parseFeedback.error.show').waitFor();const after=await snapshot(p);assert.equal(after.question,before.question);assert.equal(after.playing,true);assert.ok(after.time>=before.time);assert.equal(sent.length,0);assert.ok(!after.context.deterministicResult.resultText&&!after.context.currentStep);report.playingRefusals.push({template:id,beforeEdit,afterEdit,before,after,requests:sent});await p.locator('#playButton').click();await c.close();}
  // A successful local mock transport is a separate normal-button fallback scenario.
  const c=await context(),p=await c.newPage(),sent=[];
  await c.route('**/api/**',route=>{const req=route.request(),path=new URL(req.url()).pathname;sent.push({path,body:req.postDataJSON()});const payload=path==='/api/v1/experiment/generate'?{mode:'explanation',source:'local_mock'}:path==='/api/v1/tutor/chat'?{mode:'steps',summary:'本地模拟讲解',steps:['此处仅核对普通概念问答回退路径。'],formulas:[],finalAnswer:'本地模拟回答，不代表真实AI验证。',checks:[],followUp:'',warnings:[],source:'fixture'}:{mode:'declined',code:'DECLINED',reason:'Local mock does not draw.'};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});});
  await p.goto(base);await p.waitForFunction(()=>window.MasterLabAITutor);await p.evaluate(()=>clearTimeout(state.autoDemoTimer));await seed(p,'生物');const before=await snapshot(p),question='光合作用的原料和产物是什么？';await p.locator('#questionInput').fill(question);await p.locator('#generateButton').click();await p.waitForFunction(()=>!aiHandoffPending&&!document.querySelector('#generateButton').classList.contains('loading'));await p.locator('.ai-message.assistant').filter({hasText:'本地模拟回答'}).waitFor();const after=await snapshot(p);assert.equal(after.question,before.question);assert.equal(after.time,before.time);assert.equal(sent[0].path,'/api/v1/experiment/generate');assert.ok(sent.some(x=>x.path==='/api/v1/tutor/chat'));assert.ok(sent.filter(x=>x.path==='/api/v1/tutor/chat').every(x=>x.body.context.originalQuestion===question&&!x.body.context.deterministicResult.resultText));report.successfulMockFallback={before,after,requests:sent};await c.close();
 }
 if(report.failures.length)process.exitCode=1;
 check(report.errors.every(x=>x.includes('status of 503')),'only expected mock503 console messages, no other page errors');
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();console.log(JSON.stringify({cases:report.cases.length,passed:report.cases.filter(x=>x.passed).length,failed:report.failures.length,fatal:report.failure||null}));}
