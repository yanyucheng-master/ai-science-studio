// Isolated local acceptance. No personal profile, API key or real AI request.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web');
const output=process.env.MATH_QA_OUTPUT||resolve(root,'artifacts/math-experiments');await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"aiConfigured":false}');return;}
 if(path==='/away'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Away</title>Local navigation');return;}
 const file=resolve(web,path.slice(1)||'index.html');if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return;}
 try{let data=await readFile(file);if(extname(file)==='.css')data=data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g,'');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'"});res.end(data);}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
const report={started:new Date().toISOString(),browser:browser.version(),checks:[],layouts:[],screenshots:[],errors:[],apiRequests:[]},contexts=[];
const check=(v,m)=>{assert.ok(v,m);report.checks.push(m);console.log('PASS',m);};
const questions={pythagoras:'直角三角形的两条直角边分别为3cm和4cm，求斜边长度、三角形面积和周长，验证勾股关系。',arithmeticSum:'等差数列首项a₁=1，公差d=2，项数n=10，求第n项和前n项和，说明首尾配对。'};
async function fresh(width=1366,{routing=true,reduced='reduce'}={}){
 const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced});contexts.push(c);
 if(routing)await c.route('**/*',async r=>{const url=new URL(r.request().url());if(/\/api\//.test(url.pathname)){report.apiRequests.push(url.pathname);await r.fulfill({status:503,body:'blocked'});}else if(url.origin!==base)await r.fulfill({status:204,body:''});else await r.continue();});
 await c.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.__copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.__copies.push(t)}});window.addEventListener('pageshow',e=>window.__persisted=e.persisted);localStorage.setItem('masterLab.gradeLevel.v1','junior');},base);
 const page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));return {c,page};
}
async function generate(page,q){await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay').classList.contains('show'),q);await page.evaluate(()=>{clearReasoningTimers();clearDemoTimers();});}
async function change(page,i,v){await page.locator('.parameters input[type=range]').nth(i).fill(String(v));}
async function share(page){await page.locator('#shareButton').click();return page.evaluate(()=>window.__copies.at(-1));}
async function layout(page,name){
 const value=await page.evaluate(()=>{
  const root=document.querySelector('.math-lab-scene'),r=root.getBoundingClientRect(),rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
  const parts=[...root.children].filter(e=>e.getBoundingClientRect().height>0),transport=document.querySelector('.transport').getBoundingClientRect(),scene=document.querySelector('.scene').getBoundingClientRect(),parameters=document.querySelector('.parameters').getBoundingClientRect();
  return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,root:rect(root),parts:parts.map(rect),inside:parts.every(e=>{const b=e.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1;}),textOverflow:[...root.querySelectorAll('p,strong,b,span')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),controls:[...document.querySelectorAll('.parameters input[type=range],#playButton,#resetButton,#shareButton')].every(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0;}),order:transport.bottom<=scene.top+1&&scene.bottom<=parameters.top+1};
 });
 report.layouts.push({name,...value});check(value.pageWidth<=value.viewport+1&&value.inside&&!value.textOverflow.length,`${name}: labels and scene fit without horizontal overflow`);check(value.parts.every((p,i)=>!i||p.y>=value.parts[i-1].bottom-1),`${name}: regions do not overlap`);check(value.controls&&value.order,`${name}: controls usable; public UI playback/scene/parameters order`);
 await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000});const path=resolve(output,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);
}
try{
 for(const width of [1366,820,390]){
  const {c,page}=await fresh(width);
  for(const [id,q]of Object.entries(questions)){
   await generate(page,q);check(await page.evaluate(id=>activeGenericId()===id,id),`${width}: ${id} enters local template`);
   check(await page.evaluate(id=>{const m=buildGenericContent().model;return id==='pythagoras'?m.c===5&&m.area===6&&m.perimeter===12:m.an===19&&m.sum===100;},id),`${width}: ${id} hand-calculated result`);
   await page.locator('#timeline').fill('100');check((await page.locator('[data-math-progress]').innerText()).includes('100%'),`${width}: ${id} shared timeline renders final state`);await layout(page,`${id}-${width}`);
   await change(page,0,id==='pythagoras'?6:-2);await change(page,1,id==='pythagoras'?8:5);
   check(await page.evaluate(id=>{const m=buildGenericContent().model;return id==='pythagoras'?m.c===10&&m.area===24:m.an===-7&&m.sum===-15;},id),`${width}: ${id} parameter comparison`);
   const ai=await page.evaluate(()=>buildMasterLabAIContext());check(ai.originalQuestion===q&&ai.deterministicResult.resultText.replace(/−/g,'-').includes(id==='pythagoras'?'10':'-15'),`${width}: ${id} tutor keeps original and current result`);
   await page.locator('#resetButton').click();check(await page.evaluate(id=>state.time===0&&!state.playing&&state.p1===(id==='pythagoras'?3:2)&&state.p2===(id==='pythagoras'?4:10),id),`${width}: ${id} reset uses original baseline`);
  }
  await generate(page,'20°C时，配制100g质量分数为10%的氯化钠溶液，求所需盐和水的质量、配制步骤。');check(await page.evaluate(()=>activeGenericId()==='naclSolution'&&buildGenericContent().model.waterMass===90),`${width}: NaCl recognition retained`);
  await generate(page,'10g纯碳酸钙与足量稀盐酸充分反应，求生成二氧化碳的质量。');check(await page.evaluate(()=>activeGenericId()==='caco3Hcl'&&buildGenericContent().model.co2Mass===4.4),`${width}: CaCO3 recognition retained`);
  await c.close();
 }
 const {c,page}=await fresh(1366,{reduced:'no-preference'});
 await page.locator('.subject-tab[data-subject="数学"]').click();await page.locator('#physicsPresetToggle').click();await page.locator('#physicsPresetDropdown [data-preset="pythagoras"]').click();
 check((await page.locator('#questionInput').inputValue())===questions.pythagoras,'junior math menu creates checked Pythagoras preset');
 await page.locator('.grade-switch-header [data-grade="senior"]').click();await page.locator('#physicsPresetToggle').click();await page.locator('#physicsPresetDropdown [data-preset="arithmeticSum"]').click();
 check((await page.locator('#questionInput').inputValue())===questions.arithmeticSum,'senior math menu creates checked arithmetic preset');
 await generate(page,questions.pythagoras);await change(page,0,6);const a=await share(page);
 const receiver=await fresh();await receiver.page.goto(a);await receiver.page.waitForFunction(()=>activeGenericId()==='pythagoras'&&state.p1===6);
 check(await receiver.page.evaluate(()=>state.p2===4),'independent context imports current triangle and original baseline');await change(receiver.page,0,7);
 await receiver.page.evaluate(()=>MasterLabAITutor.openStandalone());await receiver.page.goto(a);await receiver.page.waitForFunction(()=>!location.hash.startsWith('#/ai-tutor'));
 check(await receiver.page.evaluate(()=>state.p1===7),'AI page return preserves edits in the active math share');
 const payload=JSON.parse(Buffer.from(new URL(a).hash.slice('#/share/'.length),'base64url').toString()),equivalent=base+'/#/share/'+Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(payload).reverse()))).toString('base64url');
 await receiver.page.goto(equivalent);check(await receiver.page.evaluate(()=>state.p1===7),'equivalent math payload ordering preserves edits');
 await generate(page,questions.arithmeticSum.replace('a₁=1','a₁=-4'));await change(page,0,-3);await change(page,1,5);const b=await share(page);
 await receiver.page.goto(b);await receiver.page.waitForFunction(()=>activeGenericId()==='arithmeticSum'&&state.p1===-3&&state.p2===5);check(await receiver.page.evaluate(()=>state.extraFixed.arithmeticSum.a1===-4&&buildGenericContent().model.sum===-50),'share reconstructs locked first term and current sliders');
 await receiver.page.goto(a);await receiver.page.waitForFunction(()=>activeGenericId()==='pythagoras'&&state.p1===6);check(true,'A to B to A restores address-matching experiment');
 await receiver.page.evaluate(()=>{location.hash='#物理';});await receiver.page.waitForFunction(()=>!state.hasGenerated&&state.subject==='物理');await receiver.page.goto(a);await receiver.page.waitForFunction(()=>activeGenericId()==='pythagoras'&&state.hasGenerated&&state.p1===6);check(true,'waiting subject to A restores old share');
 await receiver.page.locator('#resetButton').click();check(await receiver.page.evaluate(()=>state.p1===3&&state.p2===4),'imported triangle reset restores original 3/4');
 await receiver.page.reload();await receiver.page.waitForFunction(()=>state.hasGenerated&&state.p1===6);check(true,'refresh reimports shared current parameters');
 await page.locator('#favoriteButton').click();await page.locator('.subject-tab[data-subject="化学"]').click();await page.locator('.subject-tab[data-subject="数学"]').click();check(await page.evaluate(()=>activeGenericId()==='arithmeticSum'&&state.p1===-3&&state.p2===5),'math subject snapshot retains selected template, parameters and fixed first term');
 check(await page.evaluate(()=>localStorage.getItem('master-lab-favorites-v1').includes('等差数列')),'new math favourite is saved');
 await page.locator('.subject-tab[data-subject="化学"]').click();await page.locator('.favorite-item').filter({hasText:'等差数列'}).click();await generate(page,await page.locator('#questionInput').inputValue());
 check(await page.evaluate(()=>state.extraFixed.arithmeticSum.a1===-4&&state.p1===-3&&state.p2===5),'favourite restores saved comparison with locked first term');
 await change(page,0,3);await page.locator('#resetButton').click();check(await page.evaluate(()=>state.p1===-3&&state.p2===5),'favourite comparison establishes its own reset baseline');
 await page.locator('#playButton').click();await page.waitForFunction(()=>state.playing&&state.time>.3);await page.locator('#playButton').click();const t=await page.evaluate(()=>state.time);await page.waitForTimeout(150);check(await page.evaluate(t=>!state.playing&&state.time===t,t),'pause stops shared clock');
 await page.locator('#playButton').click();await page.waitForFunction(t=>state.time>t+.1,t);await page.locator('#playButton').click();check(true,'continue advances same clock');
 await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Space');await page.waitForFunction(()=>state.playing);await page.keyboard.press('Space');check(await page.evaluate(()=>!state.playing),'Space toggles shared playback for animated math');
 for(const [id,q,bad]of [
  ['pythagoras',questions.pythagoras,['求斜边长度。直角三角形两条直角边分别为3cm和4cm（周长）。','直角三角形两条直角边分别为3cm和4cm，求斜边面积。','直角三角形两条直角边分别为3cm和4cm，求斜边长度和温度。']],
  ['arithmeticSum',questions.arithmeticSum,['求前n项和。等差数列首项为1，公差为2（末项），项数为10。','等差数列首项为1，公差为2，项数为10，求前n项和及概率。','等差数列首项为1，公差为2，项数为10.1，求前n项和。']]
 ]){
  await generate(page,q);await change(page,0,id==='pythagoras'?5:-2);const before=await page.evaluate(()=>JSON.stringify({id:activeGenericId(),p1:state.p1,p2:state.p2,f:state.extraFixed,question:state.generatedQuestion}));
  for(const question of bad){await page.locator('#questionInput').fill(question);await page.evaluate(()=>generateExperiment({allowAiFallback:false}));const after=await page.evaluate(()=>JSON.stringify({id:activeGenericId(),p1:state.p1,p2:state.p2,f:state.extraFixed,question:state.generatedQuestion}));check(before===after&&await page.locator('#parseFeedback.error.show').isVisible(),`${id}: invalid new question visibly rejected and original adjusted experiment retained`);check(await page.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'new invalid question does not borrow previous answer');}
 }
 // Real BFCache: contexts have no request routing; local CSP blocks remote resources.
 for(const [url,id,edited]of [[a,'pythagoras',8],[b,'arithmeticSum',-5]]){
  const cache=await fresh(1366,{routing:false});await cache.page.goto(url);await cache.page.waitForFunction(()=>state.hasGenerated);await change(cache.page,0,edited);await cache.page.goto(base+'/away');await cache.page.evaluate(()=>history.back());await cache.page.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);check(await cache.page.evaluate(([id,p])=>activeGenericId()===id&&state.p1===p,[id,edited]),`${id}: actual BFCache preserves current adjusted state`);await cache.c.close();
 }
 check(report.errors.length===0,`no page or console errors: ${report.errors.join(';')}`);check(report.apiRequests.length===0,'no AI requests attempted');await c.close();
}catch(error){report.failure={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;for(const c of contexts)for(const p of c.pages()){report.debug??=[];report.debug.push(await p.evaluate(()=>({text:document.body.innerText.slice(-3000),question:state.generatedQuestion,id:activeGenericId(),p1:state.p1,p2:state.p2})).catch(()=>null));}}
finally{report.finished=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();}
