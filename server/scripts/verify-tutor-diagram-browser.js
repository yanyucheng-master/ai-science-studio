// Mock-only QA for drawing inside the AI conversation; never loads credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inclineQuestion } from './helpers/drawing-browser.js';
const require=createRequire(import.meta.url), { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TUTOR_DIAGRAM_ROOT||fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.TUTOR_QA_OUTPUT||resolve(root,'artifacts/tutor-diagram');
await mkdir(output,{recursive:true});
const question=inclineQuestion;
const unsupported='绘制函数 y=abs(x-1)+0.5 的图像，观察区间为 x=-3 到 x=5。请画出坐标轴和函数曲线。';
const followup=String.raw`若观察区间改为 \(-2\le x\le4\)，图像的端点坐标会怎样变化？`;
const answer={mode:'explain',summary:'绝对值使左右两侧形成两条直线，最低点位于(1,0.5)。',steps:[],formulas:[],finalAnswer:null,checks:[],followUp:'',warnings:[],parameterPatch:null,suggestedQuestions:[followup]};
const mathAnswer=String.raw`{"mode":"explain","summary":"将 \(x=-2\) 和 \(x=4\) 代入 \(y=|x-1|+0.5\)，端点为 \((-2,3.5)\) 和 \((4,3.5)\)。","steps":[],"formulas":["\frac{1}{2}"],"finalAnswer":null}`;
const web=resolve(root,'web'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{
 const file=resolve(web,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');
 if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return;}
 try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const urlIndex=process.argv.indexOf('--url');
const base=urlIndex>=0?new URL(process.argv[urlIndex+1]).origin:'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const report={browser:browser.version(),root,cases:[]};
async function run(name,action,{direct=false,width=1280,height=720,mode='valid'}={}){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(({base,direct})=>{window.MASTER_LAB_API_URL=base;if(direct)localStorage.setItem('masterLab.deepseekApiKey','fixture-only-never-valid');},{base,direct});
 const page=await context.newPage(),row={name,scene:0,chat:0,errors:[],unexpected:[]};
 page.setDefaultTimeout(10000);
 const reply=mode==='long-formula'?{...answer,summary:'由感应电流计算安培力，再用合力求加速度。',
  formulas:[String.raw`a(v)=\frac{F-\frac{B^{2}L^{2}v}{R}}{m}`,String.raw`v_{临界}=\frac{FR}{B^{2}L^{2}}`]}:answer;
 page.on('pageerror',e=>row.errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(url.origin===base&&url.pathname==='/health')return json({ok:true,aiConfigured:true});
  if((url.origin===base&&url.pathname==='/api/v1/scene/generate')||(url.origin==='https://api.deepseek.com'&&url.pathname==='/chat/completions')){
   const body=req.postDataJSON(),scene=url.pathname.includes('/scene/')||body.messages?.[0]?.content.includes('科学可视化设计师');
   if(url.origin!==base)assert.equal(req.headers().authorization,'Bearer fixture-only-never-valid');
   if(!scene){
    row.chat++;row.lastDirectBody=body;
    const changed=mode==='math-followup'&&row.chat===2;
    return json({choices:[{finish_reason:mode==='truncated'?'length':'stop',message:{content:changed?mathAnswer:JSON.stringify(reply)}}]});
   }
   row.scene++;row.sentQuestion=body.question||body.messages?.at(-1)?.content;
   if(direct)assert.equal(req.headers().authorization,'Bearer fixture-only-never-valid');
   return json({error:'UNEXPECTED_COORDINATE_REQUEST'},500);
  }
  if(url.origin===base&&url.pathname==='/api/v1/tutor/chat'){
   assert.equal(req.headers().authorization,undefined);row.chat++;row.lastChatContext=req.postDataJSON().context;return json(reply);
  }
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return route.fulfill({status:200,body:''});
  if(url.origin!==base){row.unexpected.push(req.url());return route.abort();}
  return route.continue();
 });
 try{
  await page.goto(base+'/#/ai-tutor');await page.waitForFunction(()=>window.MasterLabAITutor&&window.MasterLabInstant);
  await action({page,row,context});
  assert.equal(row.scene,0,'all current diagrams must be built locally');
  assert.deepEqual(row.unexpected,[]);assert.deepEqual(row.errors,[]);row.pass=true;console.log('PASS '+name);
 }catch(error){row.pass=false;row.failure=error.stack;process.exitCode=1;console.error('FAIL '+name+': '+error.message);}
 finally{await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});report.cases.push(row);await context.close();}
}
async function send(page,q=question){
 await page.locator('#aiTutorInput').fill(q);await page.locator('#aiTutorSendButton').click();
 await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true');
}
try{
 await run('gateway-inline-drawing-and-restore',async({page,row})=>{
  await send(page);assert.equal(row.scene,0);assert.equal(row.chat,0);
  assert.equal(await page.locator('.ai-message.assistant .ai-diagram-canvas svg').count(),1);
  assert.equal(await page.locator('.ai-message.assistant .ai-suggested-question').count(),3,'drawing offers three relevant directions');
  assert.equal(await page.locator('#instantExperiment').isVisible(),false);
  await page.locator('.ai-diagram').screenshot({path:resolve(output,'gateway-diagram.png')});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1')||'{}').sessions?.some(s=>s.messages.some(m=>m.scene)));await page.reload();
  await page.waitForSelector('.ai-message.assistant .ai-diagram-canvas svg');
  assert.equal(row.scene,0,'restoring must not request another diagram');assert.equal(row.chat,0);
  assert.equal(await page.locator('.ai-message.assistant .ai-suggested-question').count(),3,'questions survive reload');
  const suggested=page.locator('.ai-suggested-question').filter({hasText:'施加'});
  await suggested.click();assert.equal(row.chat,0,'click fills a draft without sending');
  const draft=await page.locator('#aiTutorInput').inputValue();assert.match(draft,/力/);
  await send(page,draft);assert.equal(row.chat,1);assert.equal(row.scene,0);
  assert.equal(row.lastChatContext.originalQuestion,question);assert.equal(row.lastChatContext.subject,'物理');
  await send(page,'为什么静摩擦力沿斜面向上？');assert.equal(row.scene,0);assert.equal(row.chat,2);
  assert.equal(row.lastChatContext.originalQuestion,question);assert.equal(row.lastChatContext.subject,'物理');
 });
 await run('personal-inline-drawing',async({page,row})=>{await send(page);assert.equal(row.scene,0);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),1);},{direct:true});
 await run('suggested-math-followup-personal',async({page,row})=>{
  await send(page,'请解释绝对值函数为什么有折点。');assert.equal(row.chat,1);
  await page.locator('.ai-suggested-question').click();
  assert.equal(await page.locator('#aiTutorInput').inputValue(),followup);assert.equal(row.chat,1);
  await send(page,followup);assert.equal(row.chat,2,'one call per question, no weaker retry');assert.equal(row.scene,0);
  const reply=page.locator('.ai-message.assistant').last();
  assert.equal(await reply.locator('.ai-suggested-question').count(),0);
  assert.match(await reply.innerText(),/3\.5/);assert.doesNotMatch(await reply.innerText(),/已拦截|不符合约定/);
  assert.equal(await reply.locator('.katex-error').count(),0);
  assert.equal(row.lastDirectBody.messages.at(-1).content.includes(followup),true);
  assert.match(row.lastDirectBody.messages.at(-1).content,/originalQuestion: 请解释绝对值/);
 },{direct:true,mode:'math-followup'});
 await run('truncated-followup-stays-blocked',async({page,row})=>{
  await send(page,'请解释绝对值函数为什么有折点。');
  assert.equal(row.scene,0);assert.match(await page.locator('.ai-message.assistant').last().innerText(),/不符合约定|已拦截/);
  assert.equal(await page.locator('.ai-suggested-question').count(),0);
 },{direct:true,mode:'truncated'});
 await run('mobile-inline-drawing',async({page,row})=>{
  await send(page);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),1);
  assert.deepEqual(await page.locator('.instant-force-label').allTextContents(),['G','FN','f']);
  assert.equal(await page.locator('.instant-mobile-legend,.instant-pin').count(),0);
  const box=await page.locator('.ai-diagram-canvas svg').boundingBox();assert(box.height<=320.1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 },{width:390,height:844});
 for(const direct of [false,true])await run('unsupported-keeps-text-'+direct,async({page,row})=>{
  await send(page,unsupported);assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/暂不绘图.*仅支持.*粗糙斜面/s);
 },{direct});
 await run('local-engine-error-keeps-text',async({page,row})=>{
  await page.evaluate(()=>{window.MasterLabInstant={...MasterLabInstant,createScene:async()=>{throw new Error('fixture engine error');}};});
  await send(page);assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/图示.*生成或核查/);
 });
 await run('unsafe-saved-scene-is-rejected',async({page,row,context})=>{
  await send(page);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1')||'{}').sessions?.some(s=>s.messages.some(m=>m.scene)));
  // Mutate at the next document start so pagehide cannot overwrite the fixture
  // with the still-valid in-memory conversation before restoration is tested.
  await context.addInitScript(()=>{
   const saved=JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1'));
   for(const s of saved.sessions)for(const m of s.messages)if(m.scene)m.scene.objects[0].onload='window.__unsafeScene=1';
   localStorage.setItem('masterLab.tutorSessions.v1',JSON.stringify(saved));
  });
  await page.reload();await page.waitForSelector('.ai-message.assistant');
  assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);assert.equal(row.chat,0);
  assert.equal(await page.evaluate(()=>!!window.__unsafeScene),false);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/受力|重力/);
 });
 await run('explicit-no-drawing-keeps-text',async({page,row})=>{await send(page,'不要画图，只解释绝对值函数为什么有折点。');assert.equal(row.scene,0);assert.equal(row.chat,1);});
 await run('hint-preference-keeps-hints',async({page,row})=>{await page.locator('#aiTutorResponseMode').selectOption('hint');await send(page);assert.equal(row.scene,0);assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);});
 await run('stop-diagram-request',async({page,row})=>{
  // Inject only at the public async boundary; exercise the real coordinator's
  // stop logic, then deliver a late valid result to prove it cannot reappear.
  await page.evaluate(()=>{
   const original=MasterLabInstant.createScene;
   window.MasterLabInstant={...MasterLabInstant,createScene:(q,{signal})=>new Promise(resolve=>{
    window.qaDiagram={signal,release:async()=>resolve(await original(q))};
   })};
  });
  await page.locator('#aiTutorInput').fill(question);await page.locator('#aiTutorSendButton').click();await page.waitForFunction(()=>!document.querySelector('#aiTutorStopButton').disabled);
  await page.waitForFunction(()=>!!window.qaDiagram);await page.locator('#aiTutorStopButton').click();
  assert.equal(await page.evaluate(()=>qaDiagram.signal.aborted),true);
  await page.evaluate(()=>qaDiagram.release());
  await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
  assert.equal(row.scene,0);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/停止/);
 });
 await run('diagram-timeout-keeps-text',async({page,row})=>{
  await page.clock.install();
  await page.evaluate(()=>{window.MasterLabInstant={...MasterLabInstant,createScene:(q,{signal})=>new Promise((_,reject)=>{
   signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  })};});
  await page.locator('#aiTutorInput').fill(question);await page.locator('#aiTutorSendButton').click();
  await page.waitForFunction(()=>!document.querySelector('#aiTutorStopButton').disabled);
  await page.clock.runFor(95001);await page.clock.runFor(1500);
  await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
  assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/图示.*核查/);
 });
 await run('reading-long-formula-390',async({page})=>{
  await send(page,'请解释电磁感应中金属棒的加速度如何随速度变化。');
  assert.equal(await page.locator('.ai-formula-line').count(),2);
  assert.equal(await page.locator('.katex-error').count(),0);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('#aiTutorWorkspace,.ai-message.assistant .ai-message-bubble')]
   .some(node=>node.scrollWidth>node.clientWidth+2));
  assert.equal(overflow,false,'long formulas must scroll inside their own area, not overflow the answer');
 },{width:390,height:844,mode:'long-formula'});
 await run('floating-tools-and-reading-space',async({page})=>{
  await send(page,'请解释绝对值函数为什么有折点。');
  await page.locator('#aiTutorMore > summary').click();await page.locator('#aiTutorFloatButton').click();
  await page.waitForSelector('#aiTutorWorkspace.is-floating');
  await page.locator('#aiTutorMore > summary').click();
  assert.equal(await page.locator('#aiTutorHistoryButton').isVisible(),true);
  await page.locator('#aiTutorMore > summary').click();
  assert.equal(await page.locator('#aiTutorResponseMode').isVisible(),true);
  await page.locator('#aiTutorDragHandle').focus();await page.locator('#aiTutorDragHandle').press('ArrowLeft');
  const layout=await page.locator('#aiTutorWorkspace').evaluate(node=>({overflow:node.scrollWidth>node.clientWidth+2,
   composer:node.querySelector('#aiTutorInput').getBoundingClientRect().bottom<=innerHeight}));
  assert.equal(layout.overflow,false);assert.equal(layout.composer,true);
 });
 for(const [width,height] of [[1280,720],[1280,650],[390,844],[320,740]])await run('reading-space-'+width+'x'+height,async({page,row})=>{
  await send(page,'请解释绝对值函数为什么有折点。');
  row.layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
   return{viewport:{width:innerWidth,height:innerHeight},messages:rect('#aiTutorMessages'),input:rect('#aiTutorInput'),logo:rect('.ai-tutor-avatar'),toolbar:rect('.ai-tutor-header'),bodyWidth:document.documentElement.scrollWidth};
  });
  assert(row.layout.messages.height>=height*(width<600?.56:.64),'message area must occupy most of the viewport');
  assert(row.layout.logo.width>0&&row.layout.logo.height>0,'logo remains visible');
  assert(Math.abs(row.layout.logo.x-row.layout.messages.x)<=2,'logo aligns with the centered reading column');
  assert(row.layout.toolbar.height<=(width<760?100:64),'toolbar stays compact');
  const gap=row.layout.messages.y-row.layout.toolbar.y-row.layout.toolbar.height;
  assert(gap>=0&&gap<=16,'conversation starts directly below the toolbar without overlap or wasted space');
  assert(row.layout.input.y+row.layout.input.height<=height,'composer stays in viewport');
  assert(row.layout.bodyWidth<=width,'no horizontal page overflow');
  assert.equal(await page.locator('#aiTutorContext').isVisible(),false);
  await page.locator('#aiTutorContextToggle').click();assert.equal(await page.locator('#aiTutorContext').isVisible(),true);
  await page.locator('#aiTutorContextToggle').click();assert.equal(await page.locator('#aiTutorContext').isVisible(),false);
 },{width,height});
}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
