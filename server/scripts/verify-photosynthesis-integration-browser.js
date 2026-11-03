// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web'),out=process.env.PHOTOSYNTHESIS_INTEGRATION_OUTPUT||resolve(root,'artifacts/photosynthesis-integration');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname.startsWith('/api/')){report.api.push(pathname);res.writeHead(503);res.end();return;}
 if(pathname==='/health'){res.setHeader('Content-Type','application/json');res.end('{"ok":true,"aiConfigured":true,"configured":true,"aiAvailable":true}');return;}
 if(pathname==='/away'){res.setHeader('Content-Type','text/html');res.end('<title>Local away</title>BFCache navigation');return;}
 const p=resolve(web,pathname.slice(1)||'index.html');if(!p.startsWith(web+sep)){res.writeHead(400);res.end();return;}
 try{
  let data=await readFile(p);
  if(extname(p)==='.html')data=data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>/g,'');
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

try {
 report.mockTutor=[];
 const samples={photosynthesis:JSON.parse(await readFile(resolve(root,'server/eval/photosynthesis-paraphrases.json'),'utf8'))[1].question,leafDisks:JSON.parse(await readFile(resolve(root,'server/eval/leaf-disks-paraphrases.json'),'utf8'))[1].question};
 for(const width of [1366,360]){
  const c=await context(width,900),p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>MASTER_LAB_TEMPLATES.photosynthesis&&MASTER_LAB_TEMPLATES.leafDisks);await p.evaluate(()=>clearTimeout(state.autoDemoTimer));
  await c.route('**/api/v1/tutor/chat',route=>{report.mockTutor.push(route.request().postDataJSON().context);return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'explain',summary:'本地模拟教材追问，固定流程保持。',steps:[],formulas:[],finalAnswer:null,checks:[],warnings:[],followUp:'',parameterPatch:null})});});
  const urls={};
  for(const [id,q] of Object.entries(samples)){
   await generate(p,q);check(await p.evaluate(id=>activeGenericId()===id,id),width+': complete question selects '+id);
   const selector=id==='photosynthesis'?'[data-photosynthesis-step="3"]':'[data-leaf-step="3"]';await p.locator(selector).click();check(await p.evaluate(()=>buildMasterLabAIContext().currentStep.includes('第4步')),width+': own step context '+id);
   await p.locator('#favoriteButton').click();urls[id]=await share(p);
   await p.locator('#challengeButton').click();await p.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true'&&document.querySelector('.ai-message.assistant:not(.pending):not(.error)'));check(await p.evaluate(id=>activeGenericId()===id,id),width+': fixed challenge keeps own experiment '+id);
   check(await p.locator('#playButton:visible').count()===1&&await p.locator('#fullscreenButton:visible,#sceneFullscreenButton:visible').count()===1,width+': unique shared controls '+id);
  }
  const rp=await c.newPage();await rp.goto(urls.photosynthesis);await rp.waitForFunction(()=>state.hasGenerated&&activeGenericId()==='photosynthesis');
  for(const id of ['leafDisks','photosynthesis','leafDisks']){
   await rp.evaluate(async url=>{location.hash=new URL(url).hash;await MasterLabShare.restoreRoute();},urls[id]);await rp.waitForFunction(id=>state.hasGenerated&&activeGenericId()===id,id);
   const x=await rp.evaluate(()=>({id:activeGenericId(),step:buildMasterLabAIContext().currentStep,level:buildGenericContent().level,q:state.generatedQuestion,players:document.querySelectorAll('.transport').length}));
   check(x.step.includes('第1步')&&x.q===samples[id]&&x.level===(id==='photosynthesis'?'junior':'senior')&&x.players===1,width+': cross-template A-B-A preserves question/level/reset '+id);
  }
  await rp.locator('[data-leaf-step="3"]').click();await rp.evaluate(async()=>{location.hash='/ai-tutor';await MasterLabShare.restoreRoute();});await rp.evaluate(async url=>{location.hash=new URL(url).hash;await MasterLabShare.restoreRoute();},urls.leafDisks);check(await rp.evaluate(()=>buildMasterLabAIContext().currentStep.includes('第4步')),width+': active senior AI return preserves step');
  const before=await p.evaluate(()=>({q:state.generatedQuestion,time:state.time}));await p.locator('#questionInput').fill(samples.photosynthesis+' '+samples.leafDisks);await p.evaluate(()=>generateExperiment({allowAiFallback:false}));check(await p.evaluate(b=>state.generatedQuestion===b.q&&state.time===b.time&&!buildMasterLabAIContext().deterministicResult.resultText,before),width+': mixed protocols rejected, original retained, tutor answer cleared');
  check(await p.locator('#photoFileButton').isVisible()&&await p.locator('#photoCameraButton').isVisible(),width+': current master camera/upload controls retained');
  const beforePhoto=await p.evaluate(()=>state.generatedQuestion);let calls=0;
  await c.route('**/api/v1/question/recognize',route=>{calls++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({isQuestion:true,text:samples.photosynthesis,unclear:false,multiple:false,truncated:false})});});
  const data=await p.evaluate(()=>{const x=document.createElement('canvas');x.width=240;x.height=80;const g=x.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,240,80);g.fillStyle='#111';g.fillText('LOCAL MOCK ONLY',10,35);return x.toDataURL('image/png').split(',')[1];});
  await p.locator('#photoFileInput').setInputFiles({name:'local-mock-question.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});await p.waitForFunction(q=>document.querySelector('#questionInput').value===q,samples.photosynthesis);
  check(calls===1&&await p.evaluate(q=>state.generatedQuestion===q,beforePhoto),width+': local mocked OCR only fills question, never auto generates');
  for(const id of ['microscope','population']){const q=await p.evaluate(id=>{const t=MASTER_LAB_TEMPLATES[id],v=t.presetFor('senior');return t.question(v.p1,v.p2,v.fixed);},id);await generate(p,q);check(await p.evaluate(id=>activeGenericId()===id,id),width+': master '+id+' still recognized after both experiments');}
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': integration viewport has no horizontal overflow');
  await c.close();
 }
 check(report.mockTutor.length===4&&report.mockTutor.every(x=>x.currentStep.includes('第4步')&&x.deterministicResult.resultText),'four explicit mocked challenge requests retain matching protocol and step');
 check(!report.errors.length,'no page or console errors');check(!report.api.length,'no unexpected AI attempts');
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
