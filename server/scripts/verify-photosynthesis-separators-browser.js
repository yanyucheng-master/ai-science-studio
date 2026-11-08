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

const data=JSON.parse(await readFile(resolve(harnessRoot,'server/eval/photosynthesis-separator-cases.json'),'utf8'));
const repro=process.env.SEPARATOR_REPRO==='1',boundariesOnly=process.env.SEPARATOR_BOUNDARIES_ONLY==='1';report.boundariesOnly=boundariesOnly;
const snapshot=p=>p.evaluate(()=>({question:state.generatedQuestion,input:document.querySelector('#questionInput').value,subject:state.subject,grade:state.gradeLevel,id:activeGenericId(),time:state.time,playing:state.playing,feedback:document.querySelector('#parseFeedback strong')?.textContent||'',context:buildMasterLabAIContext()}));
report.sourceSha=process.env.PROTOCOL_SOURCE_SHA||'unspecified';report.method='normal generate button';report.templateApi=[];report.cases=[];report.failures=[];report.registry=[];
try{
 const c0=await context(),p0=await c0.newPage();await p0.goto(base);await p0.waitForFunction(()=>typeof planLocalExperiment==='function');await p0.evaluate(()=>clearTimeout(state.autoDemoTimer));const ids=await p0.evaluate(()=>['photosynthesis','leafDisks'].filter(id=>MASTER_LAB_TEMPLATES[id]));report.templates=ids;
 for(const[kind,f]of Object.entries(data.families))if(ids.includes(f.id)){const built=await p0.evaluate(id=>{const t=MASTER_LAB_TEMPLATES[id],p=t.presetFor(t.level);return t.question(p.p1,p.p2,p.fixed);},f.id);assert.equal(built,data.cases.find(x=>x.kind===kind&&x.separator==='comma'&&x.mutation==='complete').question,'literal reference equals actual built-in question');}
 const rows=boundariesOnly?[]:data.cases.filter(x=>ids.includes(x.templateId)&&(!repro||['comma','space'].includes(x.separator)&&['complete','missing'].includes(x.mutation)));
 for(const row of rows){const a=await p0.evaluate(row=>{const t=MASTER_LAB_TEMPLATES[row.templateId],p=t.parseQuestion(row.question),a=t.protocolAssessment?.(row.question);return{parseOk:p.ok,message:p.message,candidate:t.protocolCandidate(row.question),ownership:a?.ownership,conditions:a?.evidence?.conditions};},row);report.templateApi.push({id:row.id,expected:row.expected,...a});if(!repro){assert.equal(a.parseOk,row.expected,row.id);assert.equal(a.candidate,true,row.id);}}
 await c0.close();
 const scenarios=repro?[{noTutor:false,status:503,first:'junior',grade:'senior'}]:[{noTutor:false,status:503,first:'junior',grade:'junior'},{noTutor:false,status:200,first:'senior',grade:'senior'},{noTutor:true,status:503,first:'junior',grade:'senior'},{noTutor:true,status:200,first:'senior',grade:'junior'}];
 for(const scenario of scenarios){
  const order=ids.length===2?scenario.first:'single',width=scenario.noTutor?1366:390,c=await context(width,950),p=await c.newPage(),requests=[];
  await c.route('**/api/**',route=>{const req=route.request(),path=new URL(req.url()).pathname;requests.push({path,status:scenario.status,body:req.postDataJSON()});const payload=scenario.status===503?{error:{message:'local separator mock failure',code:'UNAVAILABLE'}}:path==='/api/v1/experiment/generate'?{mode:'explanation',source:'local_mock'}:path==='/api/v1/tutor/chat'?{mode:'steps',summary:'本地模拟',steps:['仅用于核对错误回退是否发生。'],formulas:[],finalAnswer:'local mock only',checks:[],warnings:[],followUp:'',source:'fixture'}:{mode:'declined',code:'DECLINED'};return route.fulfill({status:scenario.status,contentType:'application/json',body:JSON.stringify(payload)});});
  await p.goto(base+'/?noTutor='+(scenario.noTutor?'1':'0')+'&order='+order);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>clearTimeout(state.autoDemoTimer));await p.locator('.grade-switch:visible [data-grade="'+scenario.grade+'"]').first().click();const registered=await p.evaluate(()=>Object.keys(MASTER_LAB_TEMPLATES).filter(id=>['photosynthesis','leafDisks'].includes(id)));if(ids.length===2)assert.deepEqual(registered,order==='junior'?['photosynthesis','leafDisks']:['leafDisks','photosynthesis']);report.registry.push({...scenario,order,registered});
  for(const row of rows){
   if(await p.locator('#aiTutorBackButton').isVisible())await p.locator('#aiTutorBackButton').click();await p.locator('.subject-tab[data-subject="物理"]').click();const seed='一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，求刹车距离。';if((await snapshot(p)).question!==seed)await generate(p,seed);await p.locator('#timeline').fill('31');
   await p.locator('#questionInput').fill(row.question);const before=await snapshot(p),start=requests.length,o={id:row.id,question:row.question,expected:row.expected,...scenario,order,width,before};
   try{
    await p.locator('#generateButton').click();await p.waitForFunction(({q,feedback})=>!experimentConditionsPending&&!aiHandoffPending&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay').classList.contains('show')&&(state.generatedQuestion===q||document.querySelector('#parseFeedback').classList.contains('error')||(document.querySelector('#parseFeedback strong')?.textContent||'')!==feedback),{q:row.question,feedback:before.feedback});await p.waitForTimeout(120);
    const actual=await snapshot(p),sent=requests.slice(start);o.actual=actual;o.requests=sent;assert.equal(actual.input,row.question);assert.equal(sent.length,0,'fixed-flow success/failure must never automatically sendAI');
    if(row.expected){assert.equal(actual.question,row.question);assert.equal(actual.subject,'生物');assert.equal(actual.id,row.templateId);}else{assert.equal(actual.question,before.question);assert.equal(actual.id,before.id);assert.equal(actual.time,before.time);assert.equal(actual.playing,before.playing);assert.ok(!actual.context.deterministicResult.resultText&&!actual.context.currentStep);assert.equal(actual.context.originalQuestion,row.question);assert.ok(await p.locator('#parseFeedback.error.show').isVisible());if(row.requiredMissing)assert.ok(actual.feedback.includes(row.requiredMissing),actual.feedback);}
    o.passed=true;report.checks.push(row.id+'/'+scenario.noTutor+'/'+scenario.status+'/'+order);
    if(!scenario.noTutor&&scenario.status===503&&row.separator==='space'&&['complete','missing'].includes(row.mutation)){await p.waitForFunction(()=>!document.querySelector('.toast.show'));const file=row.id+'-'+width+'.png';await(row.expected?p.locator('.experiment-card'):p.locator('#parseFeedback')).screenshot({path:resolve(out,file),animations:'disabled'});report.screenshots.push(file);}
   }catch(e){o.passed=false;o.failure=e.message;o.actual||=await snapshot(p);o.requests||=requests.slice(start);report.failures.push({id:row.id,...scenario,order,message:e.message});}
   report.cases.push(o);await writeFile(resolve(out,'progress.json'),JSON.stringify({completed:report.cases.length,failures:report.failures}));console.log((o.passed?'PASS ':'FAIL ')+row.id+'/'+scenario.noTutor+'/'+scenario.status+'/'+order);
  }
  await c.close();
 }
 report.boundaries=[];
 if(!repro)for(const noTutor of [false,true]){const c=await context(390,950),p=await c.newPage(),sent=[];await c.route('**/api/**',r=>{sent.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,body:''});});await p.goto(base+'/?noTutor='+(noTutor?'1':'0'));await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>clearTimeout(state.autoDemoTimer));
  for(const row of JSON.parse(await readFile(resolve(harnessRoot,'server/eval/photosynthesis-separator-boundaries.json'),'utf8')).filter(x=>x.scope==='shared'||ids.includes(x.scope))){if((await snapshot(p)).question!=='一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，求刹车距离。'){await p.locator('.subject-tab[data-subject="物理"]').click();await generate(p,'一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，求刹车距离。');}await p.locator('#timeline').fill('31');await p.locator('#questionInput').fill(row.question);const before=await snapshot(p),start=sent.length;await p.locator('#generateButton').click();if(row.expected==='local')await p.waitForFunction(q=>state.generatedQuestion===q,row.question);else await p.locator('#parseFeedback.error.show').waitFor();await p.waitForTimeout(120);const actual=await snapshot(p);assert.equal(sent.length,start);if(row.expected==='local'){assert.equal(actual.id,'planeMirror');assert.equal(actual.subject,'物理');}else{assert.equal(actual.question,before.question);assert.equal(actual.time,before.time);assert.match(actual.feedback,/尚不能确认完整流程/);assert.ok(!actual.context.deterministicResult.resultText);}report.boundaries.push({id:row.id,noTutor,before,actual,requests:sent.slice(start)});}
  await c.close();
 }
 const unexpected=report.errors.filter(x=>!x.includes('status of 503'));assert.deepEqual(unexpected,[]);if(report.failures.length)process.exitCode=1;
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();console.log(JSON.stringify({apiCases:report.templateApi.length,buttonCases:report.cases.length,failures:report.failures.length,fatal:report.failure||null}));}
