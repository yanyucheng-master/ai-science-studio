// Isolated local Chromium QA. Never reads .env, uses credentials, or calls an AI provider.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=resolve(root,'outputs/animation-upgrade/verification');
await mkdir(output,{recursive:true});
const files=new Set(['index.html','app.js','styles.css','science-motion.js','physics-extra.js','ai-tutor.js']);
const server=createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!files.has(name)){res.writeHead(204);res.end();return;}
  const body=await readFile(resolve(root,'web',name));
  res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const launch={channel:process.env.BROWSER_CHANNEL||'msedge',headless:true};
const browser=await chromium.launch(launch);
const report={browser:browser.version(),variants:[],background:null};
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
const projectileQuestion='小球以 12m/s 的水平速度从 20m 高的平台水平抛出，不计空气阻力。求落地时间和水平位移。';

async function prepare(context){
  // Restrict requests to loopback. No profiles/storage from the user's browser are loaded.
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(base))return route.continue();
    return route.fulfill({status:204,body:''});
  });
  await context.addInitScript(()=>{
    const pending=new Set(), timers=new Set(), intervals=new Set();
    window.motionAudit={pending,maxPending:0,frames:0,costs:[],times:[],timers,intervals,longTasks:[]};
    const raf=requestAnimationFrame,cancel=cancelAnimationFrame,st=setTimeout,ct=clearTimeout,si=setInterval,ci=clearInterval;
    window.requestAnimationFrame=cb=>{let id=raf(t=>{pending.delete(id);const start=performance.now();cb(t);motionAudit.costs.push(performance.now()-start);motionAudit.times.push(t);motionAudit.frames++;});pending.add(id);motionAudit.maxPending=Math.max(motionAudit.maxPending,pending.size);return id;};
    window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};
    window.setTimeout=(cb,ms,...args)=>{let id=st(()=>{timers.delete(id);cb(...args);},ms);timers.add(id);return id;};
    window.clearTimeout=id=>{timers.delete(id);ct(id);};
    window.setInterval=(...args)=>{const id=si(...args);intervals.add(id);return id;};
    window.clearInterval=id=>{intervals.delete(id);ci(id);};
    new PerformanceObserver(list=>motionAudit.longTasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration})))).observe({type:'longtask',buffered:true});
  });
}
async function generate(page,question){
  await page.locator('#questionInput').fill(question);
  await page.locator('#generateButton').click();
  await page.waitForFunction(q=>state.hasGenerated && state.generatedQuestion===q && !document.querySelector('#generateButton').classList.contains('loading'),question);
  assert.equal(await page.locator('.generation-overlay.show').count(),0);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#generationOverlay')).opacity==='0');
  await page.evaluate(()=>{clearReasoningTimers();clearDemoTimers();});
}
async function subjectTab(page,subject){
  const tab=page.locator(`.subject-tab[data-subject="${subject}"]`);
  if(await tab.isVisible()) await tab.click();
  else if(subject==='数学') await generate(page,'已知函数 y=x²，求 x=3 处的切线斜率。');
  // Demo intentionally hides subject tabs; the following prompt selects its subject.
}
async function choose(page,id){
  await page.evaluate(id=>{
    if(['化学','数学','生物'].includes(id)){applySubject(id,true);return;}
    state.physicsTemplate=id;
    const defaults={brake:[20,5],boardSlider:[4,2],solenoid:[.5,200],projectile:[12,20],circuit:[6,10]};
    [state.p1,state.p2]=defaults[id]||EXTRA_PHYSICS_TEMPLATES[id].defaults;
    const sync={brake:syncPhysicsBrakeContent,boardSlider:()=>syncPhysicsBoardSliderContent(state.boardSliderParams),solenoid:syncPhysicsSolenoidContent,projectile:syncPhysicsProjectileContent,circuit:syncPhysicsCircuitContent};
    (sync[id]||(()=>syncExtraPhysicsContent(id)))();applySubject('物理',false);
  },id);
}
async function screenshot(page,name){await page.locator('#scene').screenshot({path:resolve(output,`${name}.png`)});}
async function drag(page,selector,from=.25,to=.7){
  const slider=page.locator(selector);await slider.scrollIntoViewIfNeeded();
  const b=await slider.boundingBox();await page.mouse.move(b.x+b.width*from,b.y+b.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width*to,b.y+b.height/2,{steps:24});await page.mouse.up();
}
async function perf(page){
  await page.evaluate(()=>{motionAudit.costs=[];motionAudit.times=[];motionAudit.longTasks=[];motionAudit.measureStart=performance.now();});
  await page.waitForTimeout(800);
  return page.evaluate(()=>{
    const costs=[...motionAudit.costs].sort((a,b)=>a-b),times=motionAudit.times;
    return {frames:times.length,callbackP95ms:costs[Math.floor(costs.length*.95)]||0,
      observedHz:times.length>1?Math.round(1000*(times.length-1)/(times.at(-1)-times[0])):0,
      maxFrameGapMs:times.length>1?Math.max(...times.slice(1).map((t,i)=>t-times[i])):0,
      longTasks:motionAudit.longTasks.filter(x=>x.start>=motionAudit.measureStart).map(x=>x.duration),
      precedingLongTasks:motionAudit.longTasks.filter(x=>x.start<motionAudit.measureStart).map(x=>x.duration),maxPending:motionAudit.maxPending};
  });
}

try{
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080}])for(const demo of [false,true]){
  const tag=`${viewport.width}-${demo?'demo':'normal'}`;
  const context=await browser.newContext({viewport});await prepare(context);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+(demo?'?demo=1':''));
  await page.evaluate(()=>{if(state.autoDemoTimer)clearTimeout(state.autoDemoTimer);});
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  // Use the actual prompt/generation controls twice, then scrub and play the result.
  await generate(page,projectileQuestion);await generate(page,projectileQuestion);
  await page.locator('#timeline').fill('50');
  const middle=await page.evaluate(()=>({v:valuesAt(state.time),g:ScienceMotion.projectileGeometry(projectileModel(),state.time),ballY:Number(elements.projectileBall.getAttribute('cy'))}));
  near(middle.ballY,middle.g.point.y);near(middle.v.projectile.x,12*middle.v.projectile.t);
  await screenshot(page,`${tag}-projectile`);
  await page.screenshot({path:resolve(output,`${tag}-page.png`),fullPage:true});
  await page.locator('#playButton').click();await page.waitForTimeout(150);
  await page.locator('#playButton').click();
  const paused=await page.evaluate(()=>state.time);await page.waitForTimeout(100);near(await page.evaluate(()=>state.time),paused);
  await page.locator('#timeline').fill('100');
  near(await page.evaluate(()=>Number(elements.projectileBall.getAttribute('cy'))),200);
  assert.equal(await page.evaluate(()=>state.playing),false);
  await drag(page,'#speedRange');
  assert.equal(await page.evaluate(()=>state.time),0);
  assert.ok(await page.evaluate(()=>valuesAt(0).projectile.speed===Number(elements.ranges[0].value)));
  // Cell point/label selection and drag use actual pointer events.
  await subjectTab(page,'生物');
  await generate(page,'观察植物细胞，识别细胞壁、细胞膜、细胞质、细胞核、液泡、叶绿体和线粒体。');
  await page.locator('.cell-structure-tag[data-organelle="vacuole"]').click();
  assert.equal(await page.locator('#cellDetailName').textContent(),'液泡');
  const cell=await page.locator('#plantCellViewport').boundingBox();
  await page.mouse.move(cell.x+cell.width*.45,cell.y+50);await page.mouse.down();await page.mouse.move(cell.x+cell.width*.75,cell.y+70,{steps:20});await page.mouse.up();
  assert.ok(await page.evaluate(()=>Math.abs(state.cellRotateY)<=45));
  await screenshot(page,`${tag}-plant`);
  await page.locator('#cellAutoButton').click();const angle=await page.evaluate(()=>state.cellRotateY);
  await page.waitForTimeout(150);assert.notEqual(await page.evaluate(()=>state.cellRotateY),angle);
  await subjectTab(page,'数学');
  assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  await subjectTab(page,'生物');
  await generate(page,'观察动物细胞，识别细胞膜、细胞质、细胞核、线粒体、内质网、高尔基体和核糖体。');
  await page.locator('.cell-structure-tag[data-organelle="ribosome"]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#cellDetailName').textContent(),'核糖体');
  assert.equal(await page.locator('.cell-structure-tag:not(.unavailable)').count(),7);
  await screenshot(page,`${tag}-animal`);
  // Verify limiting cases with the actual rendered amount and residue readouts.
  await subjectTab(page,'化学');
  await generate(page,'将 5.6g 铁粉加入含有 0.20mol 硫酸铜的溶液中，充分反应。求生成铜的物质的量和质量。');
  const chemistry=[];
  for(const [fe,cu] of [[5.6,.2],[11.2,.1],[11.2,.2]]){
    chemistry.push(await page.evaluate(({fe,cu})=>{
      state.p1=fe;state.p2=cu;state.time=duration();updateScene();
      return {reaction:valuesAt(state.time).reaction,percent:document.querySelector('#chemRate').textContent,metrics:[...elements.metricValues].map(n=>n.textContent)};
    },{fe,cu}));
  }
  near(chemistry[0].reaction.producedMass,6.4);near(chemistry[0].reaction.cuso4Left,.1);
  near(chemistry[1].reaction.feLeftMol,.1);near(chemistry[2].reaction.producedMass,12.8);
  assert.ok(chemistry.every(x=>x.percent==='100%'));
  await screenshot(page,`${tag}-chemistry`);
  const circuits=[];
  for(const id of ['circuit','lampPower','seriesCircuit']){
    await choose(page,id);await page.waitForTimeout(70);
    const result=await page.evaluate(()=>{
      const svg=circuitMotion.svg,path=svg.querySelector('.current-loop'),len=path.getTotalLength();
      const start=path.getPointAtLength(0),end=path.getPointAtLength(len);
      return {template:state.physicsTemplate,current:circuitMotion.current,phase:circuitMotion.phase,closedDistance:Math.hypot(start.x-end.x,start.y-end.y),dots:svg.querySelectorAll('.circuit-current-pulse').length,branchDots:svg.querySelector('.edu-voltmeter-branch').querySelectorAll('.circuit-current-pulse').length,smil:svg.querySelectorAll('animateMotion').length};
    });
    assert.equal(result.dots,8);assert.equal(result.branchDots,0);assert.equal(result.smil,0);near(result.closedDistance,0);
    await page.waitForTimeout(70);assert.notEqual(await page.evaluate(()=>circuitMotion.phase),result.phase);
    await drag(page,'#accelRange');
    assert.ok(await page.evaluate(()=>Number.isFinite(circuitMotion.phase)&&circuitMotion.current>0));
    // Existing schematic has a fixed closed switch; also exercise the renderer's open/zero guards.
    await page.evaluate(()=>{circuitMotion.current=0;circuitMotion.render();animationClock.reconcile();});
    assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
    assert.equal(await page.locator('.subject-stage:visible .circuit-current-pulse:visible').count(),0);
    await page.evaluate(()=>{updateScene();circuitMotion.svg.querySelector('.edu-switch').classList.remove('edu-switch-closed');circuitMotion.render();animationClock.reconcile();});
    assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
    await page.evaluate(()=>{circuitMotion.svg.querySelector('.edu-switch').classList.add('edu-switch-closed');updateScene();});
    await screenshot(page,`${tag}-${id}`);circuits.push(result);
  }
  await choose(page,'solenoid');
  await page.evaluate(()=>{window.solenoidDraws=0;const draw=drawSolenoidCanvas;drawSolenoidCanvas=(...args)=>{solenoidDraws++;return draw(...args);};});
  const performance=await perf(page);
  await page.locator('[data-solenoid-action="pause"]').click();
  const drawCount=await page.evaluate(()=>solenoidDraws);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>solenoidDraws),drawCount);assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  await page.locator('#speedRange').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>solenoidDraws),drawCount+1);
  const poles=await page.evaluate(()=>solenoidModel());
  const fieldGeometry=await page.evaluate(()=>JSON.stringify(solenoidFieldGeometry));
  await page.locator('[data-solenoid-action="reverse"]').click();
  assert.notEqual(await page.evaluate(()=>solenoidModel().leftPole),poles.leftPole);
  await page.locator('[data-solenoid-action="core"]').click();
  assert.notEqual(await page.evaluate(()=>solenoidModel().leftPole),poles.leftPole);
  assert.equal(await page.evaluate(()=>JSON.stringify(solenoidFieldGeometry)),fieldGeometry);
  const dipole=await page.evaluate(()=>{const a=solenoidDipoleField({x:100,y:100,z:0},{reversed:false}),b=solenoidDipoleField({x:100,y:100,z:0},{reversed:true});return {a,b};});
  near(dipole.a.x,-dipole.b.x);near(dipole.a.y,-dipole.b.y);
  await screenshot(page,`${tag}-solenoid`);
  await page.locator('[data-solenoid-action="pause"]').click();
  await page.evaluate(()=>location.hash='/ai-tutor');await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  await page.evaluate(()=>location.hash='');await page.waitForTimeout(80);
  assert.equal(await page.evaluate(()=>motionAudit.pending.size),1);
  // Stress leave/return and preserve one clock and one circuit visual tree.
  for(let i=0;i<8;i++){await choose(page,'seriesCircuit');await choose(page,'solenoid');await choose(page,'数学');}
  assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  assert.equal(await page.locator('#genericPhysicsVisual .edu-circuit-svg').count(),1);
  // Mature models: boundary checks without changing the scientific equations.
  await choose(page,'boardSlider');
  const board=await page.evaluate(()=>[2,4,5].map(v=>{
    state.boardSliderParams={...BOARD_SLIDER_DEFAULTS,initialSpeed:v,boardLength:2,gravity:10,frictionCoefficient:.2};
    const model=boardSliderModel();const end=boardSliderValuesAt(model.endTime);renderBoardSliderScene(end);
    return {model,end:end.boardSlider,text:elements.boardSliderFrictionText.textContent};
  }));
  near(board[0].end.blockSpeed,board[0].end.boardSpeed);near(board[2].end.relativePosition,2);
  assert.equal(board[2].text,'接触结束：f = 0');assert.equal(board[1].model.outcome,'critical');
  await choose(page,'brake');
  const brake=await page.evaluate(()=>{state.time=duration();updateScene();const v=valuesAt(state.time);return {speed:v.metrics[0],nose:parseFloat(elements.car.style.left)+carNoseOffsetPx(),stop:physicsStopLeftPx(),angle:elements.car.style.getPropertyValue('--wheel-angle')};});
  near(brake.speed,0);near(brake.nose,brake.stop);assert.ok(brake.angle.endsWith('rad'));
  const lockedWheel=await page.evaluate(()=>{state.brakeMode='friction';state.p2=.5;state.time=1;updateScene();return elements.car.style.getPropertyValue('--wheel-angle');});
  assert.equal(lockedWheel,'0rad');
  await page.evaluate(()=>{applyWaitingState('物理');clearDemoTimers();clearReasoningTimers();});
  await page.waitForTimeout(2300);
  const lifecycle=await page.evaluate(()=>({pending:motionAudit.pending.size,max:motionAudit.maxPending,timers:motionAudit.timers.size,intervals:motionAudit.intervals.size}));
  assert.equal(lifecycle.pending,0);assert.equal(lifecycle.max,1);assert.equal(lifecycle.intervals,0);assert.equal(lifecycle.timers,0);
  assert.deepEqual(errors,[]);
  report.variants.push({tag,viewport,demo,errors,chemistry,circuits,performance,lifecycle,board:board.map(x=>({outcome:x.model.outcome,relativePosition:x.end.relativePosition})),brake,dipole});
  console.log(`${tag}: passed`);await context.close();
 }
 // Runtime preference change as well as initial reduced-motion mode.
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});await prepare(context);const page=await context.newPage();
  await page.goto(base+'?demo=1');await page.evaluate(()=>{clearTimeout(state.autoDemoTimer);});
  await choose(page,'solenoid');await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  await choose(page,'seriesCircuit');assert.equal(await page.locator('.subject-stage:visible .circuit-current-pulse:visible').count(),0);
  assert.equal(await page.locator('.subject-stage:visible .current-direction:visible').count(),2);
  await choose(page,'生物');assert.equal(await page.locator('#cellAutoButton').isDisabled(),true);
  await page.locator('.cell-structure-tag[data-organelle="chloroplast"]').click();assert.equal(await page.locator('#cellDetailName').textContent(),'叶绿体');
  await choose(page,'projectile');await page.locator('#timeline').fill('70');assert.ok(await page.evaluate(()=>Number(elements.projectileBall.getAttribute('cy'))>70));
  await screenshot(page,`${viewport.width}-reduced`);
  await choose(page,'solenoid');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>motionAudit.pending.size),1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>motionAudit.pending.size),0);
  report.variants.push({tag:`${viewport.width}-reduced`,manualControls:true,staticDirections:true,preferenceChange:true});await context.close();
 }
 // Additional layout and frame-budget samples, including a slower CPU simulation.
 const performanceContext=await browser.newContext({viewport:{width:1366,height:768}});await prepare(performanceContext);
 const performancePage=await performanceContext.newPage();await performancePage.goto(base);
 report.motionPerformance=[];
 for(const id of ['projectile','化学','生物','seriesCircuit']){
  await choose(performancePage,id);
  await performancePage.evaluate(()=>{if(state.subject==='生物')setCellAutoRotate(true);else if(state.subject==='化学'||state.physicsTemplate==='projectile')playExperiment();});
  report.motionPerformance.push({id,...await perf(performancePage)});
 }
 const cdp=await performanceContext.newCDPSession(performancePage);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await choose(performancePage,'solenoid');
 report.motionPerformance.push({id:'solenoid-4x-cpu',...await perf(performancePage)});
 await performanceContext.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});await prepare(mobile);
 const mobilePage=await mobile.newPage();await mobilePage.goto(base);await choose(mobilePage,'生物');
 await mobilePage.locator('.cell-structure-tag[data-organelle="vacuole"]').tap();
 assert.equal(await mobilePage.locator('#cellDetailName').textContent(),'液泡');
 assert.ok(await mobilePage.locator('#cellDetailCard').evaluate(n=>[...n.querySelectorAll('dd')].every(d=>d.getBoundingClientRect().right<=n.getBoundingClientRect().right-10)));
 await screenshot(mobilePage,'390-mobile-plant');
 await choose(mobilePage,'projectile');await mobilePage.locator('#timeline').fill('100');await screenshot(mobilePage,'390-mobile-projectile');
 assert.ok(await mobilePage.locator('.projectile-readout').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 await choose(mobilePage,'化学');
 assert.ok(await mobilePage.evaluate(()=>document.querySelector('.iron-powder').getBoundingClientRect().bottom<document.querySelector('#cuso4Solution').getBoundingClientRect().top));
 await screenshot(mobilePage,'390-mobile-chemistry');
 report.mobile={width:390,structureTap:true,manualTimeline:true};await mobile.close();
 // Real background tab transition, not a mocked document.hidden property.
 // Off-screen isolated window keeps the user's browser/profile untouched.
 // Playwright normally forces every page to be focused/visible. A fresh native
 // browser + noDefaults keeps actual tab visibility semantics (no mocked property).
 const profile=await mkdtemp(resolve(tmpdir(),'master-lab-visibility-'));
 const executable=process.env.BROWSER_EXECUTABLE || (process.platform==='win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : chromium.executablePath());
 const child=spawn(executable,['--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-sandbox','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion,msEdgeFirstRunExperience','--window-position=-32000,-32000','about:blank'],{windowsHide:true,stdio:'ignore'});
 let headed;
 try{
  let port;
  for(let i=0;i<100;i++){
    try{port=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}
    catch{await new Promise(r=>setTimeout(r,100));}
  }
  assert.ok(port,'isolated browser debugging port is ready');
  headed=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{noDefaults:true,timeout:10000});
  const context=headed.contexts()[0];await prepare(context);
  const page=await context.newPage();await page.goto(base);await choose(page,'solenoid');await page.bringToFront();await page.waitForFunction(()=>solenoidMotionTime>=150);
  const background=await context.newPage();await background.goto('about:blank');await background.bringToFront();
  await page.waitForFunction(()=>document.hidden);
  const hidden=await page.evaluate(()=>({visibility:document.visibilityState,time:solenoidMotionTime,pending:motionAudit.pending.size}));
  await page.waitForTimeout(350);near(await page.evaluate(()=>solenoidMotionTime),hidden.time);assert.equal(hidden.pending,0);
  await page.bringToFront();await page.waitForFunction(()=>!document.hidden);await page.waitForTimeout(150);
  const restored=await page.evaluate(()=>({visibility:document.visibilityState,time:solenoidMotionTime,pending:motionAudit.pending.size}));
  assert.ok(restored.time>hidden.time);assert.ok(restored.time-hidden.time<300);assert.equal(restored.pending,1);
  report.background={hidden,restored,realTabSwitch:true};console.log('real background/restore: passed');
 }finally{
  if(headed){await (await headed.newBrowserCDPSession()).send('Browser.close').catch(()=>{});await headed.close();}
  child.kill();
 }
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({variants:report.variants.length,background:report.background,report:resolve(output,'report.json')}));
}catch(error){
 report.failure=error.stack;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));throw error;
}finally{await browser.close();server.close();}
