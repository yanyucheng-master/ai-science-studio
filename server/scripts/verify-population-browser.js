// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web'),out=process.env.POPULATION_QA_OUTPUT||resolve(root,'artifacts/population-20261101/browser');await mkdir(out,{recursive:true});
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
  const bounds=Object.fromEntries(['#scene','.generic-physics-lab','.biology-population-scene','.generic-physics-readout','.parameters'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return[selector,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}];}));
  const root=document.querySelector('.biology-population-scene'),r=root.getBoundingClientRect();
  const nodes=[...root.querySelectorAll('table,caption,p,h3,h4,summary,figure,.population-results,.population-product')].filter(e=>e.checkVisibility());
  const bad=nodes.filter(e=>{const b=e.getBoundingClientRect();return !(b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&e.scrollWidth<=e.clientWidth+2);}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth}));
  return {bounds,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,childrenInside:bad.length===0,bad,fullscreenButtons:[...document.querySelectorAll('#fullscreenButton,#sceneFullscreenButton')].filter(e=>e.getBoundingClientRect().height).length};
 });report.layouts.push({name,...geometry});const b=geometry.bounds;
 check(geometry.pageWidth<=geometry.viewport+1&&geometry.childrenInside,`${name}: text and tables inside scene`);
 check(geometry.fullscreenButtons===1,`${name}: exactly one fullscreen control`);
 check(b['.generic-physics-lab'].height>=b['.biology-population-scene'].height&&b['.generic-physics-readout'].top>=b['.biology-population-scene'].bottom-1,`${name}: scene and result flow vertically`);
 if(!fullscreen)check(b['#scene'].height>150&&b['#scene'].bottom>=b['.generic-physics-readout'].bottom-1&&b['.parameters'].top>=b['#scene'].bottom-1,`${name}: scene encloses content before parameters`);
 else{
  const scene=b['#scene'],params=b['.parameters'];check(scene.right<=params.left+1||params.right<=scene.left+1||scene.bottom<=params.top+1||params.bottom<=scene.top+1,`${name}: scene does not overlap parameters`);
  for(const selector of ['.biology-population-scene h3','.population-table summary','.population-conditions > summary','.generic-physics-readout','.parameters']){
   const e=page.locator(selector);await e.scrollIntoViewIfNeeded();check(await e.evaluate(e=>{const r=e.getBoundingClientRect(),card=e.closest('.experiment-card').getBoundingClientRect();const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return r.top>=card.top-1&&r.bottom<=card.bottom+1&&r.top>=-1&&r.bottom<=innerHeight+1&&hit&&(e.contains(hit)||hit.contains(e));}),`${name}: reachable ${selector}`);
  }
 }
 await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000});if(fullscreen)await page.locator('.biology-population-scene h3').scrollIntoViewIfNeeded();
 const path=resolve(out,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);
}

// The local server and geometry helpers are shared in structure with microscope QA.
const sample='种群数量按固定倍数变化，每期时长相同，初始数量为100个，每期数量是前一期的1.5倍，经过4期，求种群模型数量、数量变化趋势。';
const logisticSample='采用连续logistic种群模型，环境容纳量K恒定，连续增长参数r恒定，初始数量为100个，环境容纳量K为1000个，连续增长参数r为0.5每天，经过10天，求种群模型数量、瞬时增长速率、起点后最大增长速率。';
async function ready(p){await p.waitForFunction(()=>state.hasGenerated&&activeGenericId()==='population'&&!document.querySelector('#generationOverlay.show'));await p.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
try{
 for(const [width,height]of [[1366,1000],[820,1000],[390,900],[360,900],[844,390]]){
  const c=await context(width,height),p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>typeof planLocalExperiment==='function');
  await p.evaluate(()=>clearTimeout(state.autoDemoTimer));await generate(p,sample);await ready(p);
  check(await p.evaluate(()=>state.subject==='生物'&&buildGenericContent().model.quantity===506.25),`${width}: routed model and independent result`);
  check(await p.locator('[data-population-quantity]').innerText()==='≈ 506.25 个',`${width}: visible noninteger model amount`);
  const geometry=await p.locator('.population-chart').evaluate(e=>[...e.querySelectorAll('[data-population-point]')].map(n=>({t:Number(n.dataset.populationPoint),q:Number(n.dataset.quantity),x:Number(n.getAttribute('cx')),y:Number(n.getAttribute('cy'))})));
  check(geometry.length===5&&geometry.every((v,i)=>v.t===i&&v.q===[100,150,225,337.5,506.25][i]&&Math.abs(v.x-(128+326*i/4))<1e-10&&Math.abs(v.y-(228-193*v.q/(506.25*1.15)))<1e-10),`${width}: independently scaled plotted points`);
  await change(p,0,.5);check(await p.locator('[data-population-trend]').innerText()==='指数下降'&&await p.locator('[data-population-quantity]').innerText()==='≈ 6.25 个',`${width}: decline and decimal control`);
  await change(p,0,1);check(await p.locator('[data-population-quantity]').innerText()==='≈ 100 个'&&await p.locator('[data-population-trend]').innerText()==='数量稳定',`${width}: unit multiplier stable`);
  await change(p,1,0);check(await p.locator('[data-population-point]').count()===1&&await p.locator('.biology-population-scene').innerText().then(t=>t.includes('尚未经过任何一期')),`${width}: zero period is initial state`);
  await p.locator('#resetButton').click();check(await p.evaluate(()=>state.p1===1.5&&state.p2===4),`${width}: original reset`);
  check(!await p.locator('#playButton').isVisible()&&await p.locator('#resetButton').isVisible(),`${width}: static reset controls`);
  await p.locator('.population-table summary').click();check(await p.locator('.population-table tbody tr').count()===5,`${width}: all table points available`);
  await layout(p,`population-${width}`);
  await p.locator('.population-table summary').click();
  if(width===390||width===844){await p.locator('#fullscreenButton').click();await layout(p,`population-fullscreen-${width}`,true);await p.locator('#fullscreenButton').click();}
  await p.locator('[data-population-example="logistic"]').click();await p.waitForFunction(()=>buildGenericContent().model.mode==='logistic'&&!document.querySelector('#generationOverlay.show'));await ready(p);
  check(await p.evaluate(()=>state.p1===.5&&state.p2===10&&state.extraFixed.population.capacity===1000),`${width}: explicit S example and fixed conditions`);
  check(await p.locator('[data-population-quantity]').innerText()==='≈ 942.82562 个'&&await p.locator('[data-population-rate]').innerText()==='瞬时增长速率 ≈ 26.952736 个/天',`${width}: independent continuous quantity and rate`);
  const plots=await p.evaluate(()=>[...document.querySelectorAll('[data-population-current]')].map(n=>({key:n.dataset.populationCurrent,x:+n.getAttribute('cx'),y:+n.getAttribute('cy')})));
  check(plots.length===2&&plots.every(n=>n.x===454&&Math.abs(n.y-(230-188*(n.key==='quantity'?942.8256185740149/1150:26.952735767270554/143.75)))<1e-10),`${width}: both plots independently scaled`);
  check(await p.locator('[data-population-peak="quantity"]').evaluate(n=>Math.abs(Number(n.getAttribute('cx'))-(128+326*4.394449154672439/10))<1e-10),`${width}: half-capacity peak placed at correct time`);
  const badLabels=await p.locator('.population-chart').evaluateAll(charts=>charts.flatMap(svg=>[...svg.querySelectorAll('text')].map(n=>{const {x,y,width,height}=n.getBBox();return {text:n.textContent,box:{x,y,width,height}};}).filter(n=>n.box.x<0||n.box.x+n.box.width>480||n.box.y<0||n.box.y+n.box.height>285)));
  check(!badLabels.length,`${width}: graph labels inside SVG ${JSON.stringify(badLabels)}`);
  await change(p,0,.25);await change(p,1,1.25);check(await p.evaluate(()=>state.p1===.25&&state.p2===1.25),`${width}: fractional r and time remain exact inputs`);
  await change(p,1,0);check(await p.evaluate(()=>buildGenericContent().model.quantity===100)&&await p.locator('[data-population-current]').count()===2,`${width}: continuous initial state`);
  await p.locator('#resetButton').click();check(await p.evaluate(()=>state.p1===.5&&state.p2===10),`${width}: continuous original reset`);
  await p.locator('.population-table summary').click();check(await p.locator('.population-table tbody tr').count()===5,`${width}: continuous sample table`);
  await layout(p,`logistic-${width}`);await p.locator('.population-table summary').click();
  if(width===390||width===844){await p.locator('#fullscreenButton').click();await layout(p,`logistic-fullscreen-${width}`,true);await p.locator('#fullscreenButton').click();}
  if(width===360){
    for(const [name,q]of [['high-initial',logisticSample.replace('初始数量为100个','初始数量为750个')],['near-capacity',logisticSample.replace('初始数量为100个','初始数量为999999个').replace('K为1000个','K为1000000个').replace('0.5每天','2每天').replace('10天','20天')]]){
      await generate(p,q);await p.locator('.population-table summary').click();await layout(p,`logistic-${name}-360`);
      check(await p.locator('[data-population-peak-note]').innerText().then(t=>t.includes('最大值在第0天')),`${name}: no false future maximum`);
      if(name==='near-capacity')check(await p.evaluate(()=>buildGenericContent().model.growthRate>0),'near capacity rate does not cancel to zero');
    }
  }
  await p.locator('[data-population-example="discrete"]').click();await p.waitForFunction(()=>buildGenericContent().model.mode==='discrete'&&!document.querySelector('#generationOverlay.show'));check(await p.evaluate(()=>state.p1===1.5&&state.p2===4),`${width}: mode example returns to discrete values`);
  await c.close();
 }
 const c=await context(),p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await generate(p,sample);await ready(p);
 await change(p,0,.83);await change(p,1,12);const url=await share(p);
 check(await p.evaluate(q=>buildMasterLabAIContext().originalQuestion===q&&Boolean(buildMasterLabAIContext().deterministicResult.resultText),sample),'tutor keeps original and current result separate');
 const receiver=await context(),rp=await receiver.newPage();await rp.goto(url);await ready(rp);
 check(await rp.evaluate(()=>state.p1===.83&&state.p2===12&&state.extraFixed.population.initial===100),'share restores fixed and edited parameters');
 await rp.locator('#resetButton').click();check(await rp.evaluate(()=>state.p1===1.5&&state.p2===4),'share reset retains original question');
 await p.locator('#favoriteButton').click();await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.subject-tab[data-subject="生物"]').click();
 check(await p.evaluate(()=>activeGenericId()==='population'&&state.p1===.83&&state.p2===12),'subject roundtrip');
 await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.favorite-item').filter({hasText:'种群数量'}).click();await generate(p,await p.locator('#questionInput').inputValue());await ready(p);
 check(await p.evaluate(()=>state.p1===.83&&state.p2===12),'favorite retains edited model');await change(p,0,2);await p.locator('#resetButton').click();check(await p.evaluate(()=>state.p1===.83),'favorite owns comparison reset baseline');
 await generate(p,'高中：'+sample);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));check(await p.evaluate(()=>buildGenericContent().model.level==='senior'&&state.p1===1.5&&state.p2===4),'explicit grade preserved');
 await generate(p,sample);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));check(await p.evaluate(()=>buildGenericContent().model.level==='junior'),'unlocked grade follows choice');
 await generate(p,sample.replace('100个','1个').replace('1.5倍','0.1倍').replace('4期','20期'));
 check(await p.locator('[data-population-quantity]').innerText()==='≈ 1e-20 个','tiny positive quantity never becomes zero');
 await p.locator('#questionInput').fill(sample+'环境容纳量为1000个。');await p.evaluate(()=>generateExperiment({allowAiFallback:false}));
 check(await p.locator('#parseFeedback.error.show').isVisible()&&await p.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'unsupported condition clears stale deterministic answer');
 const originalS=logisticSample.replace('初始数量为100个','初始数量为750个').replace('10天','2天');await generate(p,originalS);await change(p,0,.75);await change(p,1,3.25);const sUrl=await share(p);
 check(await p.evaluate(q=>buildMasterLabAIContext().originalQuestion===q&&Boolean(buildMasterLabAIContext().deterministicResult.resultText),originalS),'S tutor retains original and current separately');
 for(const [u,mode]of [[sUrl,'logistic'],[url,'discrete'],[sUrl,'logistic']]){await rp.goto(u);await ready(rp);check(await rp.evaluate(mode=>buildGenericContent().model.mode===mode,mode),'share mode roundtrip '+mode);}
 check(await rp.evaluate(()=>state.p1===.75&&state.p2===3.25&&state.extraFixed.population.initial===750&&state.extraFixed.population.capacity===1000),'S share restores fixed state and decimal controls');
 await rp.locator('#resetButton').click();check(await rp.evaluate(()=>state.p1===.5&&state.p2===2),'S share preserves original baseline');
 await p.locator('#favoriteButton').click();await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.subject-tab[data-subject="生物"]').click();check(await p.evaluate(()=>buildGenericContent().model.mode==='logistic'&&state.p2===3.25),'S subject roundtrip');
 await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.favorite-item').filter({hasText:'种群数量'}).first().click();await generate(p,await p.locator('#questionInput').inputValue());await ready(p);check(await p.evaluate(()=>state.p1===.75&&state.p2===3.25&&state.extraFixed.population.capacity===1000),'S favorite comparison preserved');
 await generate(p,'高中：'+logisticSample);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));check(await p.evaluate(()=>buildGenericContent().model.mode==='logistic'&&buildGenericContent().model.level==='senior'),'S explicit grade preserves mode');
 await generate(p,logisticSample);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));check(await p.evaluate(()=>buildGenericContent().model.mode==='logistic'&&buildGenericContent().model.level==='junior'),'S unlocked grade preserves mode');
 await p.locator('#questionInput').fill(logisticSample+'每天捕捞10个。');await p.evaluate(()=>generateExperiment({allowAiFallback:false}));check(await p.locator('#parseFeedback.error.show').isVisible()&&await p.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'invalid S condition clears stale answer');
 const data=JSON.parse(Buffer.from(new URL(url).hash.slice('#/share/'.length),'base64url').toString('utf8'));data.params[1]=1.5;
 const ic=await context(),ip=await ic.newPage();await ip.goto(base+'/#/share/'+Buffer.from(JSON.stringify(data)).toString('base64url'));await ip.waitForFunction(()=>document.querySelector('#parseFeedback.error.show'));check(await ip.evaluate(()=>!state.hasGenerated),'invalid fractional period share rejected');await ic.close();
 const cache=await context(1366,1000,{routing:false}),cp=await cache.newPage();await cp.goto(url);await ready(cp);await change(cp,0,.5);await cp.goto(base+'/away');await cp.evaluate(()=>history.back());await cp.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);check(await cp.evaluate(()=>state.p1===.5&&state.p2===12),'actual BFCache retains edited parameters');await cache.close();
 const scache=await context(1366,1000,{routing:false}),sp=await scache.newPage();await sp.goto(sUrl);await ready(sp);await change(sp,1,7.25);await sp.goto(base+'/away');await sp.evaluate(()=>history.back());await sp.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);check(await sp.evaluate(()=>state.p1===.75&&state.p2===7.25&&buildGenericContent().model.mode==='logistic'),'actual S BFCache');await scache.close();
 const badS=JSON.parse(Buffer.from(new URL(sUrl).hash.slice('#/share/'.length),'base64url').toString('utf8'));badS.params[0]=0;
 const bc=await context(),bp=await bc.newPage();await bp.goto(base+'/#/share/'+Buffer.from(JSON.stringify(badS)).toString('base64url'));await bp.waitForFunction(()=>document.querySelector('#parseFeedback.error.show'));check(await bp.evaluate(()=>!state.hasGenerated),'S share invalid r rejected');await bc.close();
 if(process.env.SECONDARY_BROWSER_EXECUTABLE){secondary=await chromium.launch({executablePath:process.env.SECONDARY_BROWSER_EXECUTABLE,headless:true});report.secondaryBrowser=secondary.version();const xc=await context(1366,1000,{engine:secondary}),xp=await xc.newPage();await xp.goto(url);await ready(xp);check(await xp.evaluate(()=>state.p1===.83&&state.p2===12),'independent Chrome share import');await xp.locator('#resetButton').click();check(await xp.evaluate(()=>state.p1===1.5&&state.p2===4),'independent Chrome original reset');await xc.close();}
 if(secondary){const xc=await context(1366,1000,{engine:secondary}),xp=await xc.newPage();await xp.goto(sUrl);await ready(xp);check(await xp.evaluate(()=>state.p1===.75&&state.p2===3.25&&buildGenericContent().model.mode==='logistic'),'independent Chrome S import');await xp.locator('#resetButton').click();check(await xp.evaluate(()=>state.p1===.5&&state.p2===2),'independent Chrome S original reset');await xc.close();}
 await generate(p,await p.evaluate(()=>MASTER_LAB_TEMPLATES.mendel.question(400,1)));check(await p.locator('#playButton').isVisible(),'Mendel transport preserved');
 await generate(p,'观察植物细胞，识别细胞壁、细胞膜、细胞质、细胞核、液泡、叶绿体和线粒体。');check(await p.locator('#sceneFullscreenButton').isVisible(),'cell controls preserved');
 check(!report.errors.length,`no page or console errors: ${report.errors.join('; ')}`);check(!report.api.length,'no AI attempted');
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
