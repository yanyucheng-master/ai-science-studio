// Focused local acceptance: no real AI calls, credentials or existing browser profile.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.WEEK1_QA_OUTPUT || resolve(root,'artifacts/week1-2026-10-13');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(name.includes('..')){res.writeHead(400);res.end();return;}
  try{const data=await readFile(resolve(root,'web',name));res.writeHead(200,{'Content-Type':`${mime[extname(name)]||'application/octet-stream'}; charset=utf-8`,'Cache-Control':'no-store'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const report={browser:browser.version(),layouts:[],favorites:[],motion:[],failures:[]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const check=(condition,message)=>{if(!condition) report.failures.push(message);};
const key='master-lab-favorites-v1';
async function fresh(width=1366,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion});
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.fulfill({status:503,body:''}));
  await context.addInitScript(()=>{
    const audit=window.week1Audit={pending:new Set(),maxPending:0,costs:[],times:[],errors:[]};
    const raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
    window.requestAnimationFrame=cb=>{let id=raf(t=>{audit.pending.delete(id);const start=performance.now();cb(t);audit.costs.push(performance.now()-start);audit.times.push(t);});audit.pending.add(id);audit.maxPending=Math.max(audit.maxPending,audit.pending.size);return id;};
    window.cancelAnimationFrame=id=>{audit.pending.delete(id);cancel(id);};
    window.addEventListener('error',event=>audit.errors.push(event.message));
  });
  const page=await context.newPage();await page.goto(base);
  await page.waitForFunction(()=>typeof planLocalExperiment==='function');
  return {context,page};
}
async function generate(page,q){
  await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();
  await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay').classList.contains('show'),q);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#generationOverlay')).opacity==='0');
  await page.evaluate(()=>{clearReasoningTimers();clearDemoTimers();});
}
async function preset(page,id){
  // The actual menu handler resets fixed conditions before generation.
  await page.locator('#physicsPresetToggle').click();
  // Since week 2 the menu lists the selected grade level first; the other level is a folded group.
  const folded=page.locator(`#physicsPresetDropdown details.preset-other:not([open]):has([data-preset="${id}"]) > summary`);
  if(await folded.count())await folded.click();
  await page.locator(`[data-preset="${id}"]`).click();
  await generate(page,await page.locator('#questionInput').inputValue());
  assert.equal(await page.evaluate(()=>state.physicsTemplate),id);
}
async function geometry(page,label){
  const result=await page.evaluate(()=>{
    const svg=document.querySelector('#genericPhysicsVisual svg');
    const texts=[...svg.querySelectorAll('text')].map(n=>({text:n.textContent,b:n.getBBox()})).map(({text,b})=>({text,x:b.x,y:b.y,w:b.width,h:b.height}));
    const overlap=[];
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
      const a=texts[i],b=texts[j];
      if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)overlap.push([a.text,b.text]);
    }
    const vb=svg.viewBox.baseVal;
    const minDiagramFont=Math.min(...[...svg.querySelectorAll('text')].map(n=>parseFloat(getComputedStyle(n).fontSize)*Math.abs(n.getScreenCTM().a)));
    const minReadoutFont=Math.min(...[...document.querySelectorAll('.generic-physics-readout > p, .generic-physics-readout .stage-facts dt, .generic-physics-readout .stage-facts dd')].map(n=>parseFloat(getComputedStyle(n).fontSize)));
    const clipping=texts.filter(t=>t.x<-.5||t.y<-.5||t.x+t.w>vb.width+.5||t.y+t.h>vb.height+.5).map(t=>t.text);
    const card=document.querySelector('.generic-physics-readout'), visual=document.querySelector('#genericPhysicsVisual'),scene=document.querySelector('#scene');
    const box=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};
    const parameterProblems=[...document.querySelectorAll('.parameters .parameter')].filter(n=>{
      const label=box(n.querySelector('.parameter-label')),control=box(n.querySelector('.number-control')),range=box(n.querySelector('input'));
      return label.bottom>control.y+1||control.bottom>range.y+1||control.right>box(n).right+1;
    }).length;
    const minParameterFont=Math.min(...[...document.querySelectorAll('.parameter-label strong,.number-control strong,.number-control small')].map(n=>parseFloat(getComputedStyle(n).fontSize)));
    return {texts:texts.length,overlap,clipping,minDiagramFont,minReadoutFont,minParameterFont,parameterProblems,explanationFootnotes:svg.querySelectorAll('.compact-note, .dg-note').length,card:box(card),visual:box(visual),scene:box(scene),cardOverflow:card.scrollHeight-card.clientHeight,
      pageOverflow:document.documentElement.scrollWidth-innerWidth,svgWidth:svg.getBoundingClientRect().width,
      errors:week1Audit.errors,invalid:/NaN|undefined|Infinity/.test(scene.innerText)};
  });
  report.layouts.push({label,...result});
  check(!result.overlap.length,`${label}: labels overlap ${JSON.stringify(result.overlap)}`);
  check(!result.clipping.length,`${label}: SVG text clipped ${result.clipping}`);
  check(result.minDiagramFont>=15.5,`${label}: diagram font too small ${result.minDiagramFont}`);
  check(result.minReadoutFont>=16,`${label}: readout font too small ${result.minReadoutFont}`);
  check(result.minParameterFont>=16&&!result.parameterProblems,`${label}: parameter text size or layout`);
  check(result.explanationFootnotes===0,`${label}: explanations should be in reasoning, not diagram footnotes`);
  check(result.pageOverflow<=1,`${label}: horizontal page overflow ${result.pageOverflow}`);
  check(result.card.bottom<=result.scene.bottom+1 && result.cardOverflow<=1,`${label}: readout clipped`);
  check(result.visual.bottom<=result.card.y+1,`${label}: figure overlaps readout`);
  check(!result.invalid&&!result.errors.length,`${label}: runtime errors ${result.errors}`);
}

try {
  for(const width of [320,390,768,1366,1920]){
    const {context,page}=await fresh(width);
    for(const id of ['parallelCircuit','planeMirror']){
      await preset(page,id);
      await geometry(page,`${width}-${id}`);
      await page.locator('#scene').screenshot({path:resolve(output,`${width}-${id}.png`)});
      if(width===390) await page.screenshot({path:resolve(output,`${width}-${id}-page.png`),fullPage:true});
      // Sweep the range using real input events and verify SVG identity is preserved.
      await page.evaluate(()=>{window.originalWeek1Svg=document.querySelector('#genericPhysicsVisual svg');});
      for(const pair of [[1,1],[30,30],[6,3]]){
        await page.locator('#speedRange').fill(String(pair[0]));await page.locator('#accelRange').fill(String(pair[1]));
        await geometry(page,`${width}-${id}-${pair.join('-')}`);
        check(await page.evaluate(()=>originalWeek1Svg===document.querySelector('#genericPhysicsVisual svg')),`${id}: SVG replaced while dragging`);
      }
      if(id==='planeMirror') {
        await page.waitForTimeout(130);
        const symmetry=await page.evaluate(()=>{
          const svg=document.querySelector('.plane-mirror-diagram'),a=new DOMMatrix(getComputedStyle(svg.querySelector('.mirror-object')).transform),b=new DOMMatrix(getComputedStyle(svg.querySelector('.mirror-image')).transform);
          return {sum:a.e+b.e,width:svg.viewBox.baseVal.width,leftScale:a.d,rightScale:b.d,leftY:a.f,rightY:b.f};
        });
        near(symmetry.sum,symmetry.width);near(symmetry.leftScale,symmetry.rightScale);near(symmetry.leftY,symmetry.rightY);
      }
      if(width===390){
        await page.locator('.diagram-zoom-toggle').click();await geometry(page,`${width}-${id}-zoom`);
        check(await page.locator('.diagram-pan-viewport').evaluate(n=>n.scrollWidth>n.clientWidth),'mobile zoom can pan');
        await page.locator('#scene').screenshot({path:resolve(output,`${width}-${id}-zoom.png`)});
      }
    }
    await context.close();
  }

  const {context,page}=await fresh();
  assert.equal(await page.locator('#favoritesTitle').textContent(),'推荐实验');
  assert.equal(await page.locator('[data-recommended="true"]').count(),2);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
  await page.locator('.favorite-item').first().click();
  await generate(page,await page.locator('#questionInput').inputValue());
  assert.equal(await page.locator('#favoriteButton').getAttribute('aria-pressed'),'false');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
  await page.locator('#favoriteButton').click();
  assert.equal(await page.locator('#favoritesTitle').textContent(),'已收藏的实验');
  assert.equal(await page.locator('.favorite-item').count(),1);
  assert.equal(await page.locator('[data-recommended="true"]').count(),0);
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  assert.equal(stored.length,1);
  await page.reload();assert.equal(await page.locator('.favorite-item').count(),1);
  await page.locator('.favorite-item').click();
  await generate(page,await page.locator('#questionInput').inputValue());
  await page.locator('#favoriteButton').click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'[]');
  await page.reload();assert.equal(await page.locator('.favorite-item').count(),0);
  assert.equal(await page.locator('#favoritesTitle').textContent(),'已收藏的实验');
  assert.ok(await page.locator('#favoriteEmpty').isVisible());
  // Pre-existing saved defaults remain the user's saved records.
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify(RECOMMENDED_EXPERIMENTS)),key);await page.reload();
  assert.equal(await page.locator('.favorite-item').count(),2);
  assert.equal(await page.locator('[data-recommended="true"]').count(),0);
  await page.evaluate(key=>localStorage.setItem(key,'{broken'),key);await page.reload();
  assert.equal(await page.locator('#favoritesTitle').textContent(),'推荐实验');
  report.favorites.push('new visitor, unstarred recommendation, first save, persistence, last removal, legacy records, corrupt storage');

  await preset(page,'parallelCircuit');
  await page.evaluate(()=>{week1Audit.costs=[];week1Audit.times=[];week1Audit.maxPending=week1Audit.pending.size;});
  const phase=await page.evaluate(()=>circuitMotion.phase);
  await page.waitForTimeout(1200);
  const perf=await page.evaluate(()=>{
    const costs=week1Audit.costs.slice().sort((a,b)=>a-b),t=week1Audit.times;
    return {phase:circuitMotion.phase,frames:t.length,maxPending:week1Audit.maxPending,p95CallbackMs:costs[Math.floor(costs.length*.95)],observedHz:1000*(t.length-1)/(t.at(-1)-t[0]),maxGapMs:Math.max(...t.slice(1).map((v,i)=>v-t[i]))};
  });
  check(perf.phase>phase&&perf.frames>20,'current animation advances');check(perf.maxPending<=1,'one RAF owner');check(perf.p95CallbackMs<16.7,'animation work fits a 60 Hz frame');report.motion.push(perf);
  const continuous=await page.evaluate(()=>{
    const positions=()=>[...document.querySelectorAll('.parallel-dot')].map(n=>n.getAttribute('transform'));
    const before=positions(),input=document.querySelector('#speedRange');
    input.value='12';input.dispatchEvent(new Event('input',{bubbles:true}));
    return JSON.stringify(before)===JSON.stringify(positions());
  });
  check(continuous,'changing resistance preserves particle positions at the input event');
  report.motion.push({parameterContinuity:continuous?'passed':'failed'});
  const currents=await page.evaluate(()=>({model:buildExtraPhysicsContent().model,streams:[...document.querySelectorAll('.parallel-stream')].map(n=>Number(n.dataset.current))}));
  near(currents.model.i1,.5);near(currents.model.i2,2);near(currents.streams[0],2.5);
  // Pointer dragging, not just synthetic value assignments, must keep a single SVG and clock.
  const slider=page.locator('#accelRange');await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();
  await page.mouse.move(box.x+box.width*.2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.85,box.y+box.height/2,{steps:45});await page.mouse.up();
  check(await page.evaluate(()=>Number.isFinite(circuitMotion.current)&&circuitMotion.current>0),'drag keeps finite current');
  await page.evaluate(()=>{location.hash='#/ai-tutor';});await page.waitForTimeout(100);
  check(await page.evaluate(()=>week1Audit.pending.size===0),'clock stops away from experiment');
  await page.evaluate(()=>{location.hash='';});await page.waitForTimeout(100);
  await generate(page,'电源电压为 0V，R1=6Ω 与 R2=3Ω 并联，求干路电流。');
  check(await page.evaluate(()=>week1Audit.pending.size===0),'zero current stops clock');
  check(await page.locator('.parallel-dot:visible').count()===0,'zero current hides particles');
  await generate(page,'平面镜成像，物体距镜面 20cm，像距镜面多远？');
  assert.match(await page.locator('#genericPhysicsVisual').textContent(),/物高未给出/);
  assert.equal(await page.locator('#accelRange').evaluate(n=>n.closest('.parameter')?.innerText.includes('示意高度')??document.querySelector('.parameters').innerText.includes('示意高度')),true);
  check(await page.evaluate(()=>week1Audit.pending.size===0),'mirror does not spin an idle RAF');
  await page.locator('#accelRange').fill('10');
  assert.doesNotMatch(await page.locator('#genericPhysicsDescription').textContent(),/像高.*10/);
  assert.doesNotMatch(await page.locator('#questionInput').inputValue(),/物高.*10/);
  assert.doesNotMatch(await page.evaluate(()=>JSON.stringify(buildMasterLabAIContext().deterministicResult)),/像高[^｜]*10/);
  await generate(page,'物体高8cm，放在平面镜前，求像高。');
  const mirrorContext=await page.evaluate(()=>buildMasterLabAIContext().deterministicResult);
  assert.match(mirrorContext.metrics,/像距：未给出物距/);
  assert.doesNotMatch(mirrorContext.metrics,/像距：0/);
  for(const [q,label] of [
    ['R1=0.1Ω 与 R2=1000Ω 并联接在1000V电源上，求支路电流。','large-current'],
    ['物体距平面镜1000cm，物高300cm，求像距及像高。','large-mirror'],
    ['R1=0.1234Ω 与 R2=3.2Ω 并联接在6.1234V电源上，求干路电流。','precise-parallel'],
    ['平面镜前物距 u=12.1234cm，物高 h=2.5cm，求像距和像高。','precise-mirror']
  ]) {
    await generate(page,q);await geometry(page,label);
    // Measure the compact layout only after the resize handler has redrawn the 360-wide diagram.
    await page.setViewportSize({width:390,height:1000});
    await page.waitForFunction(()=>document.querySelector('#genericPhysicsVisual svg')?.viewBox.baseVal.width===360);
    await geometry(page,`${label}-compact`);
    await page.setViewportSize({width:1366,height:1000});
    await page.waitForFunction(()=>document.querySelector('#genericPhysicsVisual svg')?.viewBox.baseVal.width!==360);
  }
  await context.close();

  const reduced=await fresh(390,'reduce');await preset(reduced.page,'parallelCircuit');
  check(await reduced.page.evaluate(()=>week1Audit.pending.size===0),'reduced motion has no RAF');
  check(await reduced.page.locator('.parallel-dot:visible').count()===0,'reduced motion hides flowing particles');
  await preset(reduced.page,'planeMirror');
  assert.equal(await reduced.page.locator('.mirror-object').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
  report.motion.push({reducedMotion:'passed'});await reduced.context.close();

  const unavailable=await fresh(390,'reduce');
  await unavailable.context.addInitScript(()=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(key){if(key==='master-lab-favorites-v1')throw new DOMException('blocked','SecurityError');return get.call(this,key);};
    Storage.prototype.setItem=function(key,value){if(key==='master-lab-favorites-v1')throw new DOMException('blocked','QuotaExceededError');return set.call(this,key,value);};
  });
  await unavailable.page.reload();assert.equal(await unavailable.page.locator('#favoritesTitle').textContent(),'推荐实验');
  await preset(unavailable.page,'parallelCircuit');await unavailable.page.locator('#favoriteButton').click();
  assert.equal(await unavailable.page.locator('#favoritesTitle').textContent(),'已收藏的实验');
  assert.equal(await unavailable.page.locator('.favorite-item').count(),1);
  await unavailable.page.locator('#favoriteButton').click();assert.equal(await unavailable.page.locator('.favorite-item').count(),0);
  report.favorites.push('storage unavailable: recommendation stays separate, in-page favorite and removal work');
  await unavailable.context.close();
} catch(error) {report.failures.push(error.stack||String(error));}
finally {
  await writeFile(resolve(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();server.close();
}
console.log(`Week 1: ${report.layouts.length} layout checks; ${report.favorites.length} favorite flows; ${report.motion.length} motion checks.`);
if(report.failures.length){console.error(report.failures.join('\n'));process.exitCode=1;}else console.log('All checks passed.');
