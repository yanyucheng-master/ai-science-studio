// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PROTOCOL_SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web'),out=process.env.PROTOCOL_QA_OUTPUT||resolve(root,'artifacts/protocol-review');await mkdir(out,{recursive:true});
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
async function generate(page,q){await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay').classList.contains('show'),q);await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
async function share(page){await page.locator('#shareButton').click();return page.evaluate(()=>window.__copies.at(-1));}

const tap=async(locator,width=1366)=>width<=390?locator.tap():locator.click();
const info=page=>page.evaluate(()=>({question:state.generatedQuestion,input:document.querySelector('#questionInput').value,id:activeGenericId(),time:state.time,playing:state.playing,icon:document.querySelector('#playButton').classList.contains('playing'),label:document.querySelector('#playButton').getAttribute('aria-label'),pressed:document.querySelector('#playButton').getAttribute('aria-pressed'),feedback:document.querySelector('#parseFeedback strong')?.textContent,generated:state.hasGenerated,tutor:buildMasterLabAIContext()}));
async function submit(page,text,expected,width=1366){await page.locator('#questionInput').fill(text);await tap(page.locator('#generateButton'),width);if(expected)await page.waitForFunction(q=>state.generatedQuestion===q&&!document.querySelector('#generationOverlay').classList.contains('show'),text);else await page.locator('#parseFeedback.error.show').waitFor();}
const noInjectedDOM=page=>page.locator('#parseFeedback strong').evaluate(e=>!e.querySelector('b,img,svg,iframe,script,a,input,button,[onerror],[onload]')&&window.__unexpectedEvent!==1);
try{
 const probe=await context(),probePage=await probe.newPage();await probePage.goto(base);await probePage.waitForFunction(()=>typeof setRecognitionFeedback==='function');await probePage.evaluate(()=>clearTimeout(state.autoDemoTimer));
 const ids=await probePage.evaluate(()=>['photosynthesis','leafDisks'].filter(id=>MASTER_LAB_TEMPLATES[id]));report.templates=ids;report.sinks=[];
 for(const mode of ['error','pending','success'])for(const text of ['<b data-probe="plain">中文 & "双引号" \'单引号\'</b>','＜b＞全角＜/b＞','<img src=x onerror="window.__unexpectedEvent=1">','比较 a < b & c > d，普通中文']){
  await probePage.evaluate(({mode,text})=>{window.__unexpectedEvent=0;if(mode==='pending')setRecognitionPending(text);else setRecognitionFeedback(mode==='error'?{message:text}:{recognitionText:text},mode==='error');},{mode,text});
  const actual=await probePage.locator('#parseFeedback strong').evaluate(e=>({text:ScienceFormula.sourceText(e),elements:[...e.querySelectorAll('b,img,svg,iframe,script,a,input,button,[onerror],[onload]')].map(x=>x.tagName),event:window.__unexpectedEvent}));
  report.sinks.push({mode,input:text,...actual});
  if(ids.length)check(actual.text===text&&!actual.elements.length&&actual.event===0,'literal shared sink '+mode+' '+text.slice(0,12));
 }
 if(!ids.length){report.baselineSharedSinkObservation=true;report.observedUnsafeCases=report.sinks.filter(x=>x.elements.length||x.event).length;await probe.close();}
 else{
 await probe.close();const cases=[...JSON.parse(await readFile(resolve(root,'server/eval/photosynthesis-review-cases.json'),'utf8')),...JSON.parse(await readFile(resolve(root,'server/eval/photosynthesis-numeric-boundary-cases.json'),'utf8'))];report.normalButtonCases=[];report.requestScenarios=[];
 for(const noTutor of [false,true])for(const order of ids.length===2?['junior','senior']:['single']){
  const c=await context(),p=await c.newPage();await p.goto(base+'/?noTutor='+(noTutor?'1':'0')+'&order='+order);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>{clearTimeout(state.autoDemoTimer);window.__unexpectedEvent=0;});
  check(await p.evaluate(m=>Boolean(window.MasterLabAITutor)!==m,noTutor),'tutor availability scenario '+noTutor+'/'+order);
  const apiBefore=report.api.length;
  for(const id of ids){
   const kind=id==='photosynthesis'?'junior':'senior';const own=cases.filter(x=>x.kind===kind);const control=own.find(x=>x.expected);await submit(p,control.question,true);
   const rows=!noTutor&&(order==='junior'||order==='single')?own:own.filter(x=>x.id.startsWith('review-')||x.id==='unsupported-extra'||x.id.startsWith('unsafe-'));
   for(const row of rows){
    const selector=id==='photosynthesis'?'[data-photosynthesis-step="1"]':'[data-leaf-step="1"]';await p.locator(selector).click();const before=await info(p);
    if(row.expected&&row.id.startsWith('without-'))await p.locator('.subject-tab[data-subject="数学"]').click();
    await submit(p,row.question,row.expected);const actual=await info(p);const plan=await p.evaluate(q=>{const x=planLocalExperiment(q);return {ok:x.ok,localOnly:x.localOnly,id:x.diagnosticTemplateId,reason:x.parse?.message};},row.question);
    check((actual.question===row.question)===row.expected,'normal button accepted/refused '+kind+'/'+row.id+'/'+noTutor+'/'+order);
    if(!row.expected){check(actual.question===before.question&&actual.time===before.time&&actual.id===before.id,'refusal retains original experiment/time '+row.id);check(!actual.tutor.deterministicResult.resultText&&!actual.tutor.currentStep&&actual.tutor.originalQuestion===row.question,'refused question context has no old answer '+row.id);check(plan.localOnly&&plan.id===id&&actual.feedback.startsWith(plan.reason),'diagnostic belongs to correct protocol '+row.id);check(await noInjectedDOM(p),'raw failure contains no injected DOM/event '+row.id);}
    report.normalButtonCases.push({...row,noTutor,order,method:'normal generate button',actual:{id:actual.id,question:actual.question,time:actual.time,feedback:actual.feedback,diagnostic:plan.id,kept:row.expected||actual.question===before.question&&actual.time===before.time,tutorHasResult:Boolean(actual.tutor.deterministicResult.resultText)}});
   }
  }
  check(report.api.length===apiBefore,'normal protocol success/refusal makes no request '+noTutor+'/'+order);
  // Explicit API-disabled fallback is supplementary; default-button results above are never substituted.
  const invalid=cases.find(x=>ids.includes(x.kind==='junior'?'photosynthesis':'leafDisks')&&!x.expected).question;
  await p.locator('#questionInput').fill(invalid);await p.evaluate(()=>generateExperiment({allowAiFallback:false}));check(await p.locator('#parseFeedback.error.show').isVisible()&&await noInjectedDOM(p),'disabled fallback API remains text safe '+noTutor+'/'+order);
  report.requestScenarios.push({noTutor,order,defaultButtonRequests:report.api.length-apiBefore,disabledFallbackRequests:0});await c.close();
 }
 // Real transport failure only after the student explicitly submits a tutor request.
 report.explicitTutor=[];const c=await context(),p=await c.newPage();await c.route('**/api/v1/tutor/chat',route=>{report.explicitTutor.push(route.request().postDataJSON().context);return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'local mock failure',code:'UNAVAILABLE'}})});});await p.goto(base);await p.waitForFunction(()=>window.MasterLabAITutor);await p.evaluate(()=>clearTimeout(state.autoDemoTimer));const row=cases.find(x=>!x.expected&&ids.includes(x.kind==='junior'?'photosynthesis':'leafDisks'));const good=cases.find(x=>x.expected&&x.kind===row.kind);await submit(p,good.question,true);await submit(p,row.question,false);const before=await info(p);await p.locator('#mentorExpandButton:visible,#mentorOpenPageButton:visible').first().click();await p.locator('#aiTutorInput').fill('请解释这道待确认题，不能使用旧实验答案');await p.locator('#aiTutorSendButton').click();await p.waitForFunction(()=>document.querySelector('.ai-message.assistant.error'));check(report.explicitTutor.length>=1&&report.explicitTutor.every(x=>x.originalQuestion===row.question&&!x.deterministicResult.resultText&&!x.currentStep),'explicit local service failure receives new question only');check((await info(p)).feedback===before.feedback,'explicit tutor failure keeps specific local refusal');await c.close();
 report.playback=[];
 for(const width of [1366,360])for(const id of ids){const c=await context(width,900),p=await c.newPage();await p.goto(base);await p.waitForFunction(id=>MASTER_LAB_TEMPLATES[id],id);await p.evaluate(()=>clearTimeout(state.autoDemoTimer));const row=cases.find(x=>x.expected&&x.kind===(id==='photosynthesis'?'junior':'senior'));await submit(p,row.question,true,width);
  const stepSelector=i=>id==='photosynthesis'?`[data-photosynthesis-step="${i}"]`:`[data-leaf-step="${i}"]`;
  for(let i=0;i<6;i++){
   await tap(p.locator('#playButton'),width);await p.waitForFunction(()=>state.playing);await tap(p.locator(stepSelector(i)),width);const stopped=await info(p);const d=await p.evaluate(()=>duration());check(!stopped.playing&&!stopped.icon&&stopped.label==='播放实验'&&stopped.pressed==='false'&&Math.abs(stopped.time-d*i/6)<1e-8,width+': playing-step switch pauses clock/icon/name '+id+'/'+i);check((await p.locator(stepSelector(i)).getAttribute('aria-label')).includes('步骤开头'),width+': step announces start/resume '+id+'/'+i);
   const t=stopped.time;await tap(p.locator('#playButton'),width);await p.waitForFunction(t=>state.playing&&state.time>t,t);const playing=await info(p);check(playing.icon&&playing.label==='暂停实验'&&playing.pressed==='true',width+': resume advances current step '+id+'/'+i);await tap(p.locator('#playButton'),width);await tap(p.locator(stepSelector(i)),width);check(!(await info(p)).playing,width+': paused step stays paused '+id+'/'+i);
  }
  await tap(p.locator(stepSelector(5)),width);const frames=[];
  for(const percent of [84,90,96,100]){await p.locator('#timeline').fill(String(percent));const actual=await p.evaluate(()=>{const id=activeGenericId(),f=id==='photosynthesis'?MasterLabPhotosynthesis.frame(state.time/duration()):MasterLabLeafDisks.frame(state.time/duration());return {id,...f,counts:[...document.querySelectorAll('[data-observed-count]')].map(x=>x.textContent),label:document.querySelector('#playButton').getAttribute('aria-label')};});if(id==='photosynthesis')check(actual.observationReady===(percent>=96)&&(!actual.observationReady?actual.exposed!=='blue':actual.exposed==='blue'),width+': sixth rinse frames '+percent);else check(actual.observedCounts.every(x=>x===null)&&actual.counts.every(x=>x==='待观察')&&actual.mechanismRise>=0,width+': sixth mechanism remains unmeasured '+percent);frames.push({percent,...actual});}
  await tap(p.locator('#resetButton'),width);check((await info(p)).time===0&&!(await info(p)).playing&&await p.locator('#playButton').getAttribute('aria-label')==='播放实验',width+': reset restores clock and accessible play '+id);
  await tap(p.locator(stepSelector(5)),width);await p.waitForFunction(()=>!document.querySelector('.toast.show'));const file=id+'-sixth-start-'+width+'.png';await p.locator('.experiment-card').screenshot({path:resolve(out,file),animations:'disabled'});report.screenshots.push(file);report.playback.push({width,id,frames});await c.close();
 }
 check(report.errors.length===report.explicitTutor.length&&report.errors.every(x=>x.includes('status of 503')),'only explicitly requested local 503 failures appear in console');check(!report.api.length,'no automatic API attempts in protocol scenarios');
 }
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
