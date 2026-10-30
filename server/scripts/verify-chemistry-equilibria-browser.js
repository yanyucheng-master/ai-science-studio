// Local-only isolated browser verification; external requests are blocked.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web');
const output=process.env.EQUILIBRIA_QA_OUTPUT||resolve(root,'artifacts/chemistry-equilibria');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"aiConfigured":false}');return;}
 if(path==='/away'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Local away</title>BFCache navigation');return;}
 const file=resolve(web,path.slice(1)||'index.html');if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return;}
 try{let data=await readFile(file);if(extname(file)==='.html')data=data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>/g,'');if(extname(file)==='.css')data=data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g,'');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'"});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
let secondary;
const contexts=[],report={started:new Date().toISOString(),browser:browser.version(),checks:[],screenshots:[],layouts:[],errors:[],apiRequests:[],crossBrowser:[]};
const check=(value,message)=>{assert.ok(value,message);report.checks.push(message);console.log('PASS',message);};
async function fresh(width=1366,height=1000,{routing=true,engine=browser}={}){
 const context=await engine.newContext({viewport:{width,height},reducedMotion:'reduce'});contexts.push(context);
 if(routing)await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(/\/api\//.test(url.pathname)){report.apiRequests.push(url.pathname);await route.fulfill({status:503,body:'blocked'});}
  else if(url.origin!==base)await route.fulfill({status:204,body:''});else await route.continue();
 });
 await context.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.__copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copies.push(text)}});window.addEventListener('pageshow',event=>window.__persisted=event.persisted);},base);
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));return {context,page};
}
async function generate(page,q){await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay').classList.contains('show'),q);await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
async function question(page,id,a,b,level='senior'){return page.evaluate(([id,a,b,level])=>{const t=MASTER_LAB_TEMPLATES[id];return t.question(a,b,t.fixedWithDefaults({level,levelLocked:true}));},[id,a,b,level]);}
async function change(page,index,value){await page.locator('.parameters input[type=range]').nth(index).fill(String(value));}
async function share(page){await page.locator('#shareButton').click();return page.evaluate(()=>window.__copies.at(-1));}
async function layout(page,name){
 const v=await page.evaluate(()=>{
  const root=document.querySelector('.chemistry-v2-scene'),r=root.getBoundingClientRect();
  const kids=[...root.children].filter(e=>e.getBoundingClientRect().height>0);
  const labels=[...root.querySelectorAll('svg text')].map(e=>{const b=e.getBBox(),m=e.getScreenCTM(),p=new DOMPoint(b.x,b.y).matrixTransform(m),q=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m),s=e.closest('svg').getBoundingClientRect();return {text:e.textContent,inside:p.x>=s.left-1&&q.x<=s.right+1&&p.y>=s.top-1&&q.y<=s.bottom+1};});
  return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,inside:kids.every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1;}),labels,controls:[...document.querySelectorAll('.parameters input[type=range],#playButton,#resetButton,#shareButton')].every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0;}),bad:[...root.querySelectorAll('p,strong,summary')].filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent)};
 });report.layouts.push({name,...v});check(v.pageWidth<=v.viewport+1&&v.inside&&v.bad.length===0,`${name}: text/scene fit`);check(v.labels.every(x=>x.inside),`${name}: actual SVG labels fit`);check(v.controls,`${name}: controls have usable geometry`);
 await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000});const path=resolve(output,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);
}
try{
 for(const [width,height]of [[1366,1000],[820,1000],[390,900],[360,900],[844,390]]){
  const {context,page}=await fresh(width,height);
  for(const [id,a,b]of [['hclNaohNeutralization',20,10],['kno3Cooling',100,20]]){
   const q=await question(page,id,a,b);await generate(page,q);
   check(await page.evaluate(id=>activeGenericId()===id,id),`${width}: ${id} actual question routing`);
   check(await page.evaluate(id=>{const m=buildGenericContent().model;return id==='kno3Cooling'?m.crystals===78.4&&m.motherLiquor===131.6:Math.abs(m.pH-1.47712125472)<1e-10;},id),`${width}: independent numeric result`);
   await page.locator('#timeline').fill('100');check(await page.evaluate(id=>{const s=document.querySelector('.chemistry-v2-scene');return id==='kno3Cooling'?s.dataset.currentTemperature==='20'&&s.dataset.crystalMass==='78.4':s.dataset.currentBaseVolume==='10'&&Math.abs(Number(s.dataset.currentPh)-1.47712125472)<1e-10;},id),`${width}: terminal drawing and model agree`);
   await layout(page,`${id}-${width}`);
   if(width===390||width===844){await page.locator('#fullscreenButton').click();check(await page.evaluate(()=>Boolean(document.fullscreenElement)||document.querySelector('.experiment-card').classList.contains('immersive-mode')),`${width}: fullscreen entered`);await layout(page,`${id}-fullscreen-${width}`);await page.locator('.parameters').scrollIntoViewIfNeeded();check(await page.locator('.parameters').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1;}),`${width}: fullscreen parameters reachable`);await page.locator('#fullscreenButton').click();}
   await change(page,0,id==='kno3Cooling'?200:30);await change(page,1,id==='kno3Cooling'?30:30);
   check(await page.evaluate(id=>{const m=buildGenericContent().model;return id==='kno3Cooling'?m.crystals===128.4&&m.motherLiquor===291.6:m.pH===7&&m.nature==='中性';},id),`${width}: parameter comparison recalculates`);
   check(await page.evaluate(q=>buildMasterLabAIContext().originalQuestion===q&&Boolean(buildMasterLabAIContext().deterministicResult.resultText),q),`${width}: tutor separates original question and comparison result`);
   await page.locator('#resetButton').click();check(await page.evaluate(([a,b])=>state.p1===a&&state.p2===b&&!state.playing&&state.time===0,[a,b]),`${width}: reset restores original parameters`);
  }
  await context.close();
 }
 const {context,page}=await fresh();
 const qa=await question(page,'hclNaohNeutralization',20,19.9999),qb=await question(page,'kno3Cooling',100.0001,20,'junior');
 await generate(page,qa);check(await page.evaluate(()=>state.p2===19.9999&&Math.abs(buildGenericContent().model.pH-6.545035287507)<1e-10),'four-decimal original volume retains near-equivalence result');
 await change(page,1,20.0001);const a=await share(page);await generate(page,qb);await change(page,1,30);const b=await share(page);
 const receiver=await fresh();await receiver.page.goto(a);await receiver.page.waitForFunction(()=>activeGenericId()==='hclNaohNeutralization');check(await receiver.page.evaluate(()=>state.p2===20.0001),'independent share restores four-decimal comparison');await receiver.page.locator('#resetButton').click();check(await receiver.page.evaluate(()=>state.p2===19.9999),'shared neutral reset retains original precision');
 await receiver.page.goto(b);await receiver.page.waitForFunction(()=>activeGenericId()==='kno3Cooling');check(await receiver.page.evaluate(()=>state.p1===100.0001&&state.p2===30&&state.extraFixed.kno3Cooling.level==='junior'),'B restores water precision, final temperature and locked grade');
 await receiver.page.goto(a);await receiver.page.waitForFunction(()=>activeGenericId()==='hclNaohNeutralization'&&state.p2===20.0001);check(true,'A to B to A restores matching template and parameters');
 await page.locator('#favoriteButton').click();await page.locator('.subject-tab[data-subject="数学"]').click();await page.locator('.subject-tab[data-subject="化学"]').click();check(await page.evaluate(()=>activeGenericId()==='kno3Cooling'&&state.p2===30),'subject roundtrip preserves chemistry selection');
 await page.locator('.subject-tab[data-subject="数学"]').click();await page.locator('.favorite-item').filter({hasText:'硝酸钾'}).click();await generate(page,await page.locator('#questionInput').inputValue());check(await page.evaluate(()=>state.p1===100.0001&&state.p2===30),'favourite restores current comparison');await change(page,1,40);await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p2===30),'favourite comparison owns reset baseline');
 await page.locator('#playButton').click();await page.waitForFunction(()=>state.playing&&state.time>.2);await page.locator('#playButton').click();const time=await page.evaluate(()=>state.time);await page.waitForTimeout(200);check(await page.evaluate(t=>!state.playing&&state.time===t,time),'pause stops shared clock');
 await page.locator('#playButton').click();await page.waitForFunction(t=>state.time>t+.1,time);await page.locator('#playButton').click();check(true,'continue resumes shared clock');
 for(const [q,invalid]of [[qa,qa.replace('25°C','26°C')],[qb,qb.replace('水质量','溶液总质量')],[qb,qb.replace('冷却至20°C','冷却至25°C')]]){
  await generate(page,q);const before=await page.evaluate(()=>JSON.stringify({id:activeGenericId(),p1:state.p1,p2:state.p2,question:state.generatedQuestion}));await page.locator('#questionInput').fill(invalid);await page.evaluate(()=>generateExperiment({allowAiFallback:false}));check(before===await page.evaluate(()=>JSON.stringify({id:activeGenericId(),p1:state.p1,p2:state.p2,question:state.generatedQuestion}))&&await page.locator('#parseFeedback.error.show').isVisible(),'unsupported question rejected without replacing valid experiment');check(await page.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'invalid new question does not borrow previous answer');
 }
 for(const [url,id]of [[a,'hclNaohNeutralization'],[b,'kno3Cooling']]){
  const cache=await fresh(1366,1000,{routing:false});await cache.page.goto(url);await cache.page.waitForFunction(()=>state.hasGenerated);await change(cache.page,0,id==='kno3Cooling'?120:25);await cache.page.goto(base+'/away');await cache.page.evaluate(()=>history.back());await cache.page.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);check(await cache.page.evaluate(id=>activeGenericId()===id&&state.p1===(id==='kno3Cooling'?120:25),id),`${id}: actual BFCache retains edited parameters`);await cache.context.close();
 }
 if(process.env.SECONDARY_BROWSER_EXECUTABLE){
  secondary=await chromium.launch({executablePath:process.env.SECONDARY_BROWSER_EXECUTABLE,headless:true});report.secondaryBrowser=secondary.version();
  for(const [url,id,expected]of [[a,'hclNaohNeutralization',20.0001],[b,'kno3Cooling',30]]){const cross=await fresh(1366,1000,{engine:secondary});await cross.page.goto(url);await cross.page.waitForFunction(()=>state.hasGenerated);check(await cross.page.evaluate(([id,p])=>activeGenericId()===id&&state.p2===p,[id,expected]),`${id}: independent browser import`);await cross.page.locator('#resetButton').click();check(await cross.page.evaluate(id=>state.p2===(id==='kno3Cooling'?20:19.9999),id),`${id}: independent browser original reset`);report.crossBrowser.push(id);await cross.context.close();}
 }else report.crossBrowserNotRun='No secondary executable configured';
 check(report.errors.length===0,`no page/console errors: ${report.errors.join(';')}`);check(report.apiRequests.length===0,'no real AI requests or AI fallback attempted');await context.close();
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;report.debug=[];for(const c of contexts)for(const page of c.pages())report.debug.push(await page.evaluate(()=>({question:state.generatedQuestion,id:activeGenericId(),p1:state.p1,p2:state.p2,text:document.body.innerText.slice(-1800)})).catch(()=>null));}
finally{report.finished=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
