// Native, isolated tab visibility check. No spoofed document.hidden, credentials or AI.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const web=fileURLToPath(new URL('../../web/',import.meta.url)),out=process.env.POPULATION_BACKGROUND_OUTPUT||fileURLToPath(new URL('../../artifacts/population-20261101/background/',import.meta.url));await mkdir(out,{recursive:true});
const report={checks:[],errors:[],api:[]};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path.startsWith('/api/')){report.api.push(path);res.writeHead(503);res.end();return;}
 if(path==='/health'){res.setHeader('Content-Type','application/json');res.end('{"ok":true,"aiConfigured":false}');return;}
 const p=resolve(web,path.slice(1)||'index.html');if(!p.startsWith(resolve(web)+sep)){res.writeHead(400);res.end();return;}
 try{let data=await readFile(p);if(extname(p)==='.html')data=data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>/g,'');if(extname(p)==='.css')data=data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g,'');res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[extname(p)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(resolve(tmpdir(),'master-lab-population-visibility-'));
const executable=process.env.BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const child=spawn(executable,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-sandbox','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion,msEdgeFirstRunExperience','--window-position=-32000,-32000','about:blank'],{windowsHide:true,stdio:'ignore'});
let browser;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(port,'isolated browser ready');
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true,timeout:10000});report.browser=browser.version();const context=browser.contexts()[0];
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.fulfill({status:204,body:''}));
 await context.addInitScript(base=>{
  window.MASTER_LAB_API_URL=base;const pending=new Set();window.populationMotionAudit={pending,frames:0};const raf=requestAnimationFrame,cancel=cancelAnimationFrame;
  window.requestAnimationFrame=cb=>{if(cb.name==='captureSelection')return raf(cb);let id=raf(time=>{pending.delete(id);populationMotionAudit.frames++;cb(time);});pending.add(id);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};
 },base);
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.goto(base);await page.waitForFunction(()=>typeof MASTER_LAB_TEMPLATES==='object',null,{polling:20});await page.evaluate(()=>clearDemoTimers());
 const background=await context.newPage();await background.goto('about:blank');
 for(const mode of ['discrete','logistic']){
  await page.bringToFront();await page.waitForFunction(()=>!document.hidden,null,{polling:20});
  const q=await page.evaluate(mode=>{const t=MASTER_LAB_TEMPLATES.population,p=t.presetFor('senior',mode);return t.question(p.p1,p.p2,p.fixed);},mode);
  await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay.show'),q,{polling:20});await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});
  await page.locator('.parameters input[type=range]').nth(0).fill('0.75');await page.locator('.parameters input[type=range]').nth(1).fill(mode==='logistic'?'3.25':'8');await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Space');await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>state.playing),false);assert.equal(await page.evaluate(()=>populationMotionAudit.pending.size),0);
  const snapshot=()=>page.evaluate(()=>({state:JSON.stringify({p1:state.p1,p2:state.p2,fixed:state.extraFixed.population,time:state.time,quantity:buildGenericContent().model.quantity}),pending:populationMotionAudit.pending.size,frames:populationMotionAudit.frames,hidden:document.hidden}));
  const before=await snapshot();await background.bringToFront();await page.waitForFunction(()=>document.hidden,null,{polling:20});await page.waitForTimeout(300);const hidden=await snapshot();
  await page.bringToFront();await page.waitForFunction(()=>!document.hidden,null,{polling:20});await page.waitForTimeout(200);const after=await snapshot();
  assert.equal(hidden.pending,0);assert.equal(after.pending,0);assert.equal(hidden.state,before.state);assert.equal(after.state,before.state);assert.equal(hidden.frames,before.frames);assert.equal(after.frames,before.frames);
  report.checks.push({mode,before,hidden,after,realTabSwitch:true});console.log('PASS actual background, foreground, no ongoing RAF:',mode);
 }
 assert.equal(report.errors.length,0,report.errors.join(';'));assert.equal(report.api.length,0);console.log('PASS no errors or AI calls');
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));if(browser){await (await browser.newBrowserCDPSession()).send('Browser.close').catch(()=>{});await browser.close();}child.kill();server.close();}
