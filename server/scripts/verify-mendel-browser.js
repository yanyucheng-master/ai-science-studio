// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web'),out=process.env.MENDEL_QA_OUTPUT||resolve(root,'artifacts/biology-e4-20261030/browser');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname.startsWith('/api/')){report.api.push(pathname);res.writeHead(503);res.end();return;}
 if(pathname==='/health'){res.setHeader('Content-Type','application/json');res.end('{"ok":true,"aiConfigured":false}');return;}
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
const browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']}),report={browser:browser.version(),checks:[],errors:[],api:[],screenshots:[],layouts:[]};
let secondary;const contexts=[];
const check=(v,s)=>{assert.ok(v,s);report.checks.push(s);console.log('PASS',s);};
async function context(width=1366,height=1000,{engine=browser,routing=true}={}){const c=await engine.newContext({viewport:{width,height},hasTouch:width<=844,isMobile:width<=844,reducedMotion:'reduce'});contexts.push(c);if(routing)await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')){report.api.push(u.pathname);return r.fulfill({status:503,body:''});}return u.origin===base?r.continue():r.fulfill({status:204,body:''});});await c.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.__copies.push(text)}});window.addEventListener('pageshow',e=>window.__persisted=e.persisted);},base);c.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});});return c;}
async function generate(page,q){await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay').classList.contains('show'),q);await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
async function change(page,i,n){await page.locator('.parameters input[type=range]').nth(i).fill(String(n));}
async function share(page){await page.locator('#shareButton').click();return page.evaluate(()=>window.__copies.at(-1));}
async function layout(page,name,fullscreen=false){
 const geometry=await page.evaluate(()=>{
  const bounds=Object.fromEntries(['#scene','.generic-physics-lab','.biology-mendel-scene','.generic-physics-readout','.parameters'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return[selector,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}];}));
  const root=document.querySelector('.biology-mendel-scene'),r=root.getBoundingClientRect();
  const nodes=[...root.querySelectorAll('table,caption,p,h3,h4,summary,.mendel-prob-row,.mendel-playback')].filter(e=>e.checkVisibility());
  const bad=nodes.filter(e=>{const b=e.getBoundingClientRect();return !(b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&e.scrollWidth<=e.clientWidth+2);}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth}));
  return {bounds,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,childrenInside:bad.length===0,bad,fullscreenButtons:[...document.querySelectorAll('#fullscreenButton,#sceneFullscreenButton')].filter(e=>e.getBoundingClientRect().height).length};
 });report.layouts.push({name,...geometry});const b=geometry.bounds;
 check(geometry.pageWidth<=geometry.viewport+1&&geometry.childrenInside,`${name}: text and tables inside scene`);
 check(geometry.fullscreenButtons===1,`${name}: exactly one fullscreen control`);
 check(b['.generic-physics-lab'].height>=b['.biology-mendel-scene'].height&&b['.generic-physics-readout'].top>=b['.biology-mendel-scene'].bottom-1,`${name}: scene and result flow vertically`);
 if(!fullscreen)check(b['#scene'].height>400&&b['#scene'].bottom>=b['.generic-physics-readout'].bottom-1&&b['.parameters'].top>=b['#scene'].bottom-1,`${name}: scene encloses content before parameters`);
 else{
  const scene=b['#scene'],params=b['.parameters'];check(scene.right<=params.left+1||params.right<=scene.left+1||scene.bottom<=params.top+1||params.bottom<=scene.top+1,`${name}: scene does not overlap parameters`);
  for(const selector of ['.biology-mendel-scene h3','.mendel-playback','.biology-mendel-scene summary','.generic-physics-readout','.parameters']){
   const e=page.locator(selector);await e.scrollIntoViewIfNeeded();check(await e.evaluate(e=>{const r=e.getBoundingClientRect(),card=e.closest('.experiment-card').getBoundingClientRect();const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return r.top>=card.top-1&&r.bottom<=card.bottom+1&&r.top>=-1&&r.bottom<=innerHeight+1&&hit&&(e.contains(hit)||hit.contains(e));}),`${name}: reachable ${selector}`);
  }
 }
 await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000});if(fullscreen)await page.locator('.biology-mendel-scene h3').scrollIntoViewIfNeeded();
 const path=resolve(out,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);
}
try{
 for(const [width,height]of [[1366,1000],[820,1000],[390,900],[360,900],[844,390]]){
  const c=await context(width,height),page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');
  const q=await page.evaluate(()=>{clearTimeout(state.autoDemoTimer);return MASTER_LAB_TEMPLATES.mendel.question(400,1);});await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(()=>state.hasGenerated&&activeGenericId()==='mendel'&&!document.querySelector('#generationOverlay').classList.contains('show'));await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});
  check(await page.evaluate(()=>buildGenericContent().model.expected.aa===100),`${width}: generated independent expectation`);
  const geometry=await page.evaluate(()=>Object.fromEntries(['#scene','.generic-physics-stage','.generic-physics-lab','.biology-mendel-scene','.generic-physics-readout','.parameters'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),s=getComputedStyle(e);return[selector,{top:r.top,bottom:r.bottom,height:r.height,position:s.position,overflow:s.overflow}];})));
  (report.geometry??=[]).push({width,height,geometry});
  check(geometry['#scene'].height>400&&geometry['#scene'].bottom>=geometry['.generic-physics-readout'].bottom-1&&geometry['.parameters'].top>=geometry['#scene'].bottom-1,`${width}: scene encloses content before parameters`);
  await page.locator('#timeline').fill('100');check(await page.locator('.biology-mendel-scene').getAttribute('data-shown')==='400',`${width}: timeline reveals target sample`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.biology-mendel-scene table')].every(e=>e.scrollWidth<=e.clientWidth+1)),`${width}: tables fit viewport`);
  await page.locator('.parameters input[type=range]').nth(0).fill('3');check(await page.evaluate(()=>buildGenericContent().model.expected.aa===.75),`${width}: fractional expectation preserved`);
  await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p1===400&&state.p2===1&&state.time===0),`${width}: original reset`);
  await page.locator('#playButton').click();await page.waitForFunction(()=>state.playing&&state.time>.1);await page.locator('#playButton').click();check(await page.evaluate(()=>!state.playing),`${width}: shared clock play and pause`);
  await page.locator('#timeline').fill('100');await layout(page,`mendel-${width}`);
  if(width===390||width===844){await page.locator('#fullscreenButton').click();await layout(page,`mendel-fullscreen-${width}`,true);await page.locator('#fullscreenButton').click();}
  if(width===1366){await page.locator('.parameters input[type=range]').nth(0).fill('17');await page.locator('.parameters input[type=range]').nth(1).fill('42');await page.locator('#shareButton').click();const url=await page.evaluate(()=>window.__copies.at(-1));const receiver=await context(),p=await receiver.newPage();await p.goto(url);await p.waitForFunction(()=>state.hasGenerated);check(await p.evaluate(()=>activeGenericId()==='mendel'&&state.p1===17&&state.p2===42),'independent share restores N and seed');await p.locator('#resetButton').click();check(await p.evaluate(()=>state.p1===400&&state.p2===1),'share retains original baseline');await receiver.close();await page.locator('#questionInput').fill(q+'其中aa致死。');await page.evaluate(()=>generateExperiment({allowAiFallback:false}));check(await page.locator('#parseFeedback.error.show').isVisible(),'unsupported new condition rejected');check(await page.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'failed question cannot borrow old answer');}
  await c.close();
 }
 const c=await context(),page=await c.newPage();await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));
 const qa=await page.evaluate(()=>MASTER_LAB_TEMPLATES.mendel.question(400,1));await generate(page,qa);await change(page,0,17);await change(page,1,42);const a=await share(page);
 const sampleA=await page.evaluate(()=>JSON.stringify(buildGenericContent().model.samples));
 const qb=await page.evaluate(()=>{const t=MASTER_LAB_TEMPLATES.mendel;return t.question(3,9999,t.fixedWithDefaults({parent1:'AA',parent2:'aa',level:'junior',levelLocked:true}));});await generate(page,qb);await change(page,0,7);const b=await share(page);
 const receiver=await context(),rp=await receiver.newPage();
 for(const [url,n,seed,aa,baseline,label]of [[a,17,42,.25,400,'A'],[b,7,9999,0,3,'B'],[a,17,42,.25,400,'A again']]){
  await rp.goto(url);await rp.waitForFunction(()=>state.hasGenerated);
  check(await rp.evaluate(([n,seed,aa])=>activeGenericId()==='mendel'&&state.p1===n&&state.p2===seed&&buildGenericContent().model.probabilities.aa===aa,[n,seed,aa]),`${label}: share restores parameters and parents`);
  if(n===17)check(await rp.evaluate(()=>JSON.stringify(buildGenericContent().model.samples))===sampleA,`${label}: restored samples match original sequence`);
  await rp.locator('#resetButton').click();check(await rp.evaluate(n=>state.p1===n,baseline),`${label}: share retains original baseline`);
 }
 await page.locator('#favoriteButton').click();await page.locator('.subject-tab[data-subject="数学"]').click();await page.locator('.subject-tab[data-subject="生物"]').click();
 check(await page.evaluate(()=>activeGenericId()==='mendel'&&state.p1===7&&state.p2===9999),'subject roundtrip retains Mendel');
 await page.locator('.subject-tab[data-subject="数学"]').click();await page.locator('.favorite-item').filter({hasText:'孟德尔'}).click();await generate(page,await page.locator('#questionInput').inputValue());
 check(await page.evaluate(()=>state.p1===7&&state.p2===9999&&buildGenericContent().model.probabilities.Aa===1),'favourite restores comparison and parents');
 await change(page,0,9);await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p1===7),'favourite comparison owns reset baseline');
 check(await page.evaluate(()=>buildGenericContent().model.level==='junior'),'explicit junior question retains explanation level');
 await page.evaluate(()=>setGradeLevel('senior',{persist:false,announce:false}));check(await page.evaluate(()=>buildGenericContent().model.level==='junior'),'explicit question grade survives global grade switch');
 await generate(page,qa);await page.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));check(await page.evaluate(()=>buildGenericContent().model.level==='junior'),'unlocked explanation follows selected grade');
 await generate(page,'观察植物细胞，识别细胞壁、细胞膜、细胞质、细胞核、液泡、叶绿体和线粒体。');
 check(await page.evaluate(()=>state.subject==='生物'&&!activeGenericId()),'original cell model still routes');
 check(!await page.locator('.transport').isVisible()&&!await page.locator('.parameters').isVisible(),'cell model retains hidden transport and parameters');
 check(await page.locator('#sceneFullscreenButton').isVisible(),'cell model retains its fullscreen control');
 await page.locator('.cell-structure-tag[data-organelle="vacuole"]').click();check(await page.locator('#cellDetailName').textContent()==='液泡','cell structure selection remains usable');
 const originalPayload=JSON.parse(Buffer.from(new URL(a).hash.slice('#/share/'.length),'base64url').toString('utf8'));
 for(const [label,mutate]of [
  ['fractional N',d=>d.params[0]=3.5],['zero seed',d=>d.params[1]=0],
  ['unsupported parent',d=>d.question=d.question.replace('Aa×Aa','Aa×未知')],
  ['lethal offspring',d=>d.question+='其中aa致死。']
 ]){
  const data=structuredClone(originalPayload);mutate(data);
  const invalid=await context(),ip=await invalid.newPage();await ip.goto(base+'/#/share/'+Buffer.from(JSON.stringify(data)).toString('base64url'));
  await ip.waitForFunction(()=>document.querySelector('#parseFeedback.error.show'));
  check(await ip.evaluate(()=>!state.hasGenerated),'malformed share rejected: '+label);await invalid.close();
 }
 const cache=await context(1366,1000,{routing:false}),cp=await cache.newPage();await cp.goto(a);await cp.waitForFunction(()=>state.hasGenerated);await change(cp,0,23);
 await cp.goto(base+'/away');await cp.evaluate(()=>history.back());await cp.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);
 check(await cp.evaluate(()=>activeGenericId()==='mendel'&&state.p1===23&&state.p2===42),'actual BFCache retains edited Mendel parameters');
 if(process.env.SECONDARY_BROWSER_EXECUTABLE){
  secondary=await chromium.launch({executablePath:process.env.SECONDARY_BROWSER_EXECUTABLE,headless:true});report.secondaryBrowser=secondary.version();
  const cross=await context(1366,1000,{engine:secondary}),xp=await cross.newPage();await xp.goto(a);await xp.waitForFunction(()=>state.hasGenerated);
  check(await xp.evaluate(()=>activeGenericId()==='mendel'&&state.p1===17&&state.p2===42),'independent browser imports comparison');
  check(await xp.evaluate(()=>JSON.stringify(buildGenericContent().model.samples))===sampleA,'independent browser reproduces identical sequence');
  await xp.locator('#resetButton').click();check(await xp.evaluate(()=>state.p1===400&&state.p2===1),'independent browser restores original baseline');
 }else report.crossBrowserNotRun='No secondary executable configured';
 check(!report.errors.length,`no page or console errors: ${report.errors.join('; ')}`);check(!report.api.length,'no AI attempted');
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
