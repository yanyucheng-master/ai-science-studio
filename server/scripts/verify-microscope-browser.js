// Local-only smoke and state checks. No profiles, credentials or AI providers.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),web=resolve(root,'web'),out=process.env.MICROSCOPE_QA_OUTPUT||resolve(root,'artifacts/microscope-20261031/browser');await mkdir(out,{recursive:true});
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
  const bounds=Object.fromEntries(['#scene','.generic-physics-lab','.biology-microscope-scene','.generic-physics-readout','.parameters'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return[selector,{top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}];}));
  const root=document.querySelector('.biology-microscope-scene'),r=root.getBoundingClientRect();
  const nodes=[...root.querySelectorAll('table,caption,p,h3,h4,summary,figure,.microscope-results,.microscope-product')].filter(e=>e.checkVisibility());
  const bad=nodes.filter(e=>{const b=e.getBoundingClientRect();return !(b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1&&e.scrollWidth<=e.clientWidth+2);}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth}));
  return {bounds,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,childrenInside:bad.length===0,bad,fullscreenButtons:[...document.querySelectorAll('#fullscreenButton,#sceneFullscreenButton')].filter(e=>e.getBoundingClientRect().height).length};
 });report.layouts.push({name,...geometry});const b=geometry.bounds;
 check(geometry.pageWidth<=geometry.viewport+1&&geometry.childrenInside,`${name}: text and tables inside scene`);
 check(geometry.fullscreenButtons===1,`${name}: exactly one fullscreen control`);
 check(b['.generic-physics-lab'].height>=b['.biology-microscope-scene'].height&&b['.generic-physics-readout'].top>=b['.biology-microscope-scene'].bottom-1,`${name}: scene and result flow vertically`);
 if(!fullscreen)check(b['#scene'].height>150&&b['#scene'].bottom>=b['.generic-physics-readout'].bottom-1&&b['.parameters'].top>=b['#scene'].bottom-1,`${name}: scene encloses content before parameters`);
 else{
  const scene=b['#scene'],params=b['.parameters'];check(scene.right<=params.left+1||params.right<=scene.left+1||scene.bottom<=params.top+1||params.bottom<=scene.top+1,`${name}: scene does not overlap parameters`);
  for(const selector of ['.biology-microscope-scene h3','.microscope-examples','.biology-microscope-scene summary','.generic-physics-readout','.parameters']){
   const e=page.locator(selector);await e.scrollIntoViewIfNeeded();check(await e.evaluate(e=>{const r=e.getBoundingClientRect(),card=e.closest('.experiment-card').getBoundingClientRect();const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return r.top>=card.top-1&&r.bottom<=card.bottom+1&&r.top>=-1&&r.bottom<=innerHeight+1&&hit&&(e.contains(hit)||hit.contains(e));}),`${name}: reachable ${selector}`);
  }
 }
 await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000});if(fullscreen)await page.locator('.biology-microscope-scene h3').scrollIntoViewIfNeeded();
 const path=resolve(out,`${name}.png`);await page.locator('.experiment-card').screenshot({path,animations:'disabled'});report.screenshots.push(path);
}

async function sample(page,mode,level='senior'){
 return page.evaluate(([mode,level])=>{const t=MASTER_LAB_TEMPLATES.microscope,p=t.presetFor(level,mode);return t.question(p.p1,p.p2,p.fixed);},[mode,level]);
}
async function modeIs(page,mode){await page.waitForFunction(mode=>state.hasGenerated&&activeGenericId()==='microscope'&&buildGenericContent().model.mode===mode&&!document.querySelector('#generationOverlay.show'),mode);await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});}
try{
 for(const [width,height]of [[1366,1000],[820,1000],[390,900],[360,900],[844,390]]){
  const c=await context(width,height),page=await c.newPage();await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));
  for(const mode of ['field','magnification','direction']){
   await generate(page,await sample(page,mode));await modeIs(page,mode);
   check(await page.evaluate(()=>state.subject==='生物'),'biology routing '+mode+' '+width);
   check(!await page.locator('#playButton').isVisible()&&await page.locator('#resetButton').isVisible(),'static controls retain reset '+mode+' '+width);
   if(mode==='field'){
    const result=await page.evaluate(()=>{const m=buildGenericContent().model;return {count:m.approximateCount,radius:Number(document.querySelector('[data-microscope-radius="target"]').getAttribute('r'))/Number(document.querySelector('[data-microscope-radius="original"]').getAttribute('r')),total:m.totalMagnification};});
    check(result.count===12.5&&result.radius===.25&&result.total===undefined,`${width}: independent area estimate and drawn diameter ratio`);
    check(await page.locator('[data-microscope-count]').innerText()==='≈ 12.5 个',`${width}: fraction stays visibly approximate`);
    await change(page,0,20);check(await page.evaluate(()=>buildGenericContent().model.approximateCount===50),`${width}: changing objective uses square ratio`);
    await change(page,1,3);check(await page.evaluate(()=>buildGenericContent().model.approximateCount===.75),`${width}: cell estimate not rounded`);
   }else if(mode==='magnification'){
    check(await page.evaluate(()=>buildGenericContent().model.totalMagnification===400),`${width}: independent magnification product`);
    await change(page,0,12.5);check(await page.locator('[data-microscope-total]').innerText()==='500 倍',`${width}: decimal eyepiece survives control`);
   }else{
    check(await page.locator('[data-microscope-direction]').innerText()==='物像向左下移动。',`${width}: initial opposite direction`);
    await page.locator('[data-microscope-move="left"]').click();check(await page.evaluate(()=>state.p1===1&&state.p2===1&&buildGenericContent().model.image.x===-1),`${width}: slide button uses shared parameters`);
    await change(page,0,-3);await change(page,1,0);check(await page.locator('[data-microscope-direction]').innerText()==='物像向右移动。',`${width}: changing sign updates direction`);
    check(await page.locator('[data-microscope-position="image"]').getAttribute('data-x')==='3',`${width}: diagram sign agrees with model`);
   }
   await page.locator('#resetButton').click();check(await page.evaluate(mode=>state.p1===(mode==='field'?40:mode==='magnification'?10:2)&&state.p2===(mode==='field'?200:mode==='magnification'?40:1)&&state.time===0&&!state.playing,mode),`${width}: ${mode} original reset`);
   await layout(page,`${mode}-${width}`);
   if(width===390||width===844){await page.locator('#fullscreenButton').click();await layout(page,`${mode}-fullscreen-${width}`,true);await page.locator('#fullscreenButton').click();}
  }
  await page.locator('[data-microscope-example="magnification"]').click();await modeIs(page,'magnification');check(await page.evaluate(()=>state.p1===10&&state.p2===40),'example button generates explicit magnification question '+width);
  await c.close();
 }
 const c=await context(),p=await c.newPage();await p.goto(base);await p.waitForFunction(()=>typeof planLocalExperiment==='function');await p.evaluate(()=>clearTimeout(state.autoDemoTimer));
 const urls={};
 for(const mode of ['field','magnification','direction']){
  const q=await sample(p,mode,'junior');await generate(p,q);await change(p,0,mode==='field'?20.25:mode==='magnification'?12.5:-3);await change(p,1,mode==='field'?3:mode==='magnification'?20.25:4);
  check(await p.evaluate(q=>buildMasterLabAIContext().originalQuestion===q&&Boolean(buildMasterLabAIContext().deterministicResult.resultText),q),'tutor separates original and current '+mode);
  urls[mode]=await share(p);
 }
 const receiver=await context(),rp=await receiver.newPage();
 for(const mode of ['field','magnification','direction','field']){
  await rp.goto(urls[mode]);await modeIs(rp,mode);
  check(await rp.evaluate(mode=>state.p1===(mode==='field'?20.25:mode==='magnification'?12.5:-3)&&state.p2===(mode==='field'?3:mode==='magnification'?20.25:4),mode),'share restores mode and current parameters '+mode);
  await rp.locator('#resetButton').click();check(await rp.evaluate(mode=>state.p1===(mode==='field'?40:mode==='magnification'?10:2)&&state.p2===(mode==='field'?200:mode==='magnification'?40:1),mode),'share retains original baseline '+mode);
 }
 await p.locator('#favoriteButton').click();await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.subject-tab[data-subject="生物"]').click();
 check(await p.evaluate(()=>activeGenericId()==='microscope'&&state.p1===-3&&state.p2===4&&state.extraFixed.microscope.mode==='direction'),'subject roundtrip retains mode');
 await p.locator('.subject-tab[data-subject="数学"]').click();await p.locator('.favorite-item').filter({hasText:'显微镜'}).click();await generate(p,await p.locator('#questionInput').inputValue());
 check(await p.evaluate(()=>state.p1===-3&&state.p2===4&&buildGenericContent().model.mode==='direction'),'favourite restores direction comparison');
 await change(p,0,0);await p.locator('#resetButton').click();check(await p.evaluate(()=>state.p1===-3&&state.p2===4),'favourite comparison owns its reset baseline');
 await generate(p,await sample(p,'magnification'));await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));
 check(await p.evaluate(()=>buildGenericContent().model.level==='junior'&&buildGenericContent().model.mode==='magnification'),'unlocked grade change retains microscope mode');
 const locked='高中：'+await sample(p,'direction');await generate(p,locked);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));
 check(await p.evaluate(()=>buildGenericContent().model.level==='senior'&&buildGenericContent().model.mode==='direction'&&state.p1===2&&state.p2===1),'explicit grade retains original mode before any edit');
 await change(p,0,-2);await p.evaluate(()=>setGradeLevel('junior',{persist:false,announce:false}));
 check(await p.evaluate(()=>buildGenericContent().model.level==='senior'&&state.p1===-2),'explicit grade does not change edited experiment');
 await p.locator('#questionInput').fill(locked+'求物像实际距离。');await p.evaluate(()=>generateExperiment({allowAiFallback:false}));
 check(await p.locator('#parseFeedback.error.show').isVisible(),'unsupported condition rejected');check(await p.evaluate(()=>!buildMasterLabAIContext().deterministicResult.resultText),'failed input does not borrow old answer');
 for(const [mode,mutate]of [['field',d=>d.params[1]=1.5],['magnification',d=>d.params[0]=0],['direction',d=>d.params[0]=6]]){
  const data=JSON.parse(Buffer.from(new URL(urls[mode]).hash.slice('#/share/'.length),'base64url').toString('utf8'));mutate(data);
  const ic=await context(),ip=await ic.newPage();await ip.goto(base+'/#/share/'+Buffer.from(JSON.stringify(data)).toString('base64url'));await ip.waitForFunction(()=>document.querySelector('#parseFeedback.error.show'));
  check(await ip.evaluate(()=>!state.hasGenerated),'invalid share rejected '+mode);await ic.close();
 }
 for(const mode of ['field','magnification','direction']){
  const cache=await context(1366,1000,{routing:false}),cp=await cache.newPage();await cp.goto(urls[mode]);await modeIs(cp,mode);await change(cp,0,mode==='direction'?1:25);
  await cp.goto(base+'/away');await cp.evaluate(()=>history.back());await cp.waitForFunction(()=>window.__persisted===true&&state.hasGenerated);
  check(await cp.evaluate(mode=>buildGenericContent().model.mode===mode&&state.p1===(mode==='direction'?1:25),mode),'actual BFCache retains edited mode '+mode);await cache.close();
 }
 if(process.env.SECONDARY_BROWSER_EXECUTABLE){
  secondary=await chromium.launch({executablePath:process.env.SECONDARY_BROWSER_EXECUTABLE,headless:true});report.secondaryBrowser=secondary.version();
  for(const mode of ['field','magnification','direction']){
   const xc=await context(1366,1000,{engine:secondary}),xp=await xc.newPage();await xp.goto(urls[mode]);await modeIs(xp,mode);
   check(await xp.evaluate(mode=>state.p1===(mode==='field'?20.25:mode==='magnification'?12.5:-3),mode),'independent Chrome import '+mode);
   await xp.locator('#resetButton').click();check(await xp.evaluate(mode=>state.p1===(mode==='field'?40:mode==='magnification'?10:2),mode),'independent Chrome original reset '+mode);await xc.close();
  }
 }
 await generate(p,await p.evaluate(()=>MASTER_LAB_TEMPLATES.mendel.question(400,1)));check(await p.locator('#playButton').isVisible(),'Mendel transport survives microscope switch');
 await generate(p,'观察植物细胞，识别细胞壁、细胞膜、细胞质、细胞核、液泡、叶绿体和线粒体。');
 check(!await p.locator('.transport').isVisible()&&await p.locator('#sceneFullscreenButton').isVisible(),'cell controls survive microscope switch');
 check(!report.errors.length,`no page or console errors: ${report.errors.join('; ')}`);check(!report.api.length,'no AI attempted');
}catch(e){report.failure=e.stack;process.exitCode=1;console.error(e);}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));if(secondary)await secondary.close();await browser.close();server.close();}
