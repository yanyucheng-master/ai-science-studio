// Mock-only QA for drawing inside the AI conversation; never loads credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url), { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.TUTOR_DIAGRAM_ROOT||fileURLToPath(new URL('../../',import.meta.url));
const output=process.env.TUTOR_QA_OUTPUT||resolve(root,'artifacts/tutor-diagram');
await mkdir(output,{recursive:true});
const question='绘制函数 y=abs(x-1)+0.5 的图像，观察区间为 x=-3 到 x=5。请画出坐标轴和函数曲线，标注函数表达式，并说明图像的折线形状。不需要动画。';
function fixture(q=question){
 const frame={x:65,y:60,width:450,height:325,xMin:-3,xMax:5,yMin:-1,yMax:6};
 return {version:1,status:'scene',subject:'数学',title:'绝对值函数图像',givens:[q],basis:['按题目给出的表达式计算函数值。'],assumptions:['观察窗口仅用于展示，不代表完整定义域。'],explanation:['图像呈开口向上的V形，折点在(1,0.5)，整条曲线位于横轴上方。'],objects:[{id:'axes',type:'axes',...frame},{id:'curve',type:'curve',...frame,expression:'abs(x-1)+0.5',quote:'y=abs(x-1)+0.5'}],labels:[{target:'curve',text:'y=abs(x-1)+0.5'}],relations:[],calculations:[]};
}
const answer={mode:'explain',summary:'绝对值使左右两侧形成两条直线，最低点位于(1,0.5)。',steps:[],formulas:[],finalAnswer:null,checks:[],followUp:'',warnings:[],parameterPatch:null};
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
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 await context.addInitScript(({base,direct})=>{window.MASTER_LAB_API_URL=base;if(direct)localStorage.setItem('masterLab.deepseekApiKey','fixture-only-never-valid');},{base,direct});
 const page=await context.newPage(),row={name,scene:0,chat:0,errors:[]};
 page.on('pageerror',e=>row.errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  if(url.pathname==='/health')return json({ok:true,aiConfigured:true});
  if(url.pathname==='/api/v1/scene/generate'||url.pathname==='/chat/completions'){
   const body=req.postDataJSON(),scene=url.pathname.includes('/scene/')||body.messages?.[0]?.content.includes('科学可视化设计师');
   if(!scene){row.chat++;return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]});}
   row.scene++;row.sentQuestion=body.question||body.messages?.at(-1)?.content;
   if(direct)assert.equal(req.headers().authorization,'Bearer fixture-only-never-valid');
   if(mode==='hang')return;
   let sceneBody=fixture();
   if(mode==='decline')sceneBody={version:1,status:'declined',reason:'缺少题图，无法确定位置关系。'};
   if(mode==='unsafe'){sceneBody.objects[1].expression='x.constructor()';}
   if(direct)return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(sceneBody)}}]});
   return json(mode==='decline'?{mode:'explanation',code:'DECLINED',reason:sceneBody.reason}:{mode:'instant',scene:sceneBody});
  }
  if(url.pathname==='/api/v1/tutor/chat'){row.chat++;row.lastChatContext=req.postDataJSON().context;return json(answer);}
  if(url.origin!==base)return route.fulfill({status:204,body:''});
  return route.continue();
 });
 try{
  await page.goto(base+'/#/ai-tutor');await page.waitForFunction(()=>window.MasterLabAITutor&&window.MasterLabInstant);
  await action({page,row,context});
  assert.deepEqual(row.errors,[]);row.pass=true;console.log('PASS '+name);
 }catch(error){row.pass=false;row.failure=error.stack;process.exitCode=1;console.error('FAIL '+name+': '+error.message);}
 finally{await page.screenshot({path:resolve(output,name+'.png'),fullPage:true});report.cases.push(row);await context.close();}
}
async function send(page,q=question){
 await page.locator('#aiTutorInput').fill(q);await page.locator('#aiTutorSendButton').click();
 await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true');
}
try{
 await run('gateway-inline-drawing-and-restore',async({page,row})=>{
  await send(page);assert.equal(row.scene,1);assert.equal(row.chat,0);assert.equal(row.sentQuestion,question);
  assert.equal(await page.locator('.ai-message.assistant .ai-diagram-canvas svg').count(),1);
  assert.equal(await page.locator('#instantExperiment').isVisible(),false);
  await page.locator('.ai-diagram').screenshot({path:resolve(output,'gateway-diagram.png')});
  await page.waitForTimeout(400);await page.reload();
  await page.waitForSelector('.ai-message.assistant .ai-diagram-canvas svg');
  assert.equal(row.scene,1,'restoring must not request another diagram');assert.equal(row.chat,0);
  await send(page,'为什么最低点不在原点？');assert.equal(row.scene,1);assert.equal(row.chat,1);
  assert.equal(row.lastChatContext.originalQuestion,question);assert.equal(row.lastChatContext.subject,'数学');
 });
 await run('personal-inline-drawing',async({page,row})=>{await send(page);assert.equal(row.scene,1);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),1);},{direct:true});
 await run('mobile-inline-drawing',async({page,row})=>{await send(page);assert.equal(row.scene,1);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),1);assert.equal(await page.locator('.ai-diagram-canvas .instant-mobile-legend').isVisible(),true);},{width:390,height:844});
 for(const mode of ['decline','unsafe'])await run(mode+'-keeps-text-fallback',async({page,row})=>{
  await send(page);assert.equal(row.scene,1);assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),mode==='decline'?/缺少题图，无法确定位置关系/:/图示.*核查|图示.*生成/);
 },{mode});
 await run('explicit-no-drawing-keeps-text',async({page,row})=>{await send(page,'不要画图，只解释绝对值函数为什么有折点。');assert.equal(row.scene,0);assert.equal(row.chat,1);});
 await run('hint-preference-keeps-hints',async({page,row})=>{await page.locator('#aiTutorResponseMode').selectOption('hint');await send(page);assert.equal(row.scene,0);assert.equal(row.chat,1);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);});
 await run('stop-diagram-request',async({page,row})=>{
  await page.locator('#aiTutorInput').fill(question);await page.locator('#aiTutorSendButton').click();await page.waitForFunction(()=>!document.querySelector('#aiTutorStopButton').disabled);
  await page.waitForTimeout(150);await page.locator('#aiTutorStopButton').click();await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
  assert.equal(row.scene,1);assert.equal(row.chat,0);assert.equal(await page.locator('.ai-diagram-canvas svg').count(),0);
  assert.match(await page.locator('.ai-message.assistant').innerText(),/停止/);
 },{mode:'hang'});
 for(const [width,height] of [[1280,720],[1280,650],[390,844]])await run('reading-space-'+width+'x'+height,async({page,row})=>{
  await send(page,'请解释绝对值函数为什么有折点。');
  row.layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
   return{viewport:{width:innerWidth,height:innerHeight},messages:rect('#aiTutorMessages'),input:rect('#aiTutorInput'),logo:rect('.ai-tutor-avatar'),bodyWidth:document.documentElement.scrollWidth};
  });
  assert(row.layout.messages.height>=height*(width<600?.56:.64),'message area must occupy most of the viewport');
  assert(row.layout.logo.width>0&&row.layout.logo.height>0,'logo remains visible');
  assert(row.layout.input.y+row.layout.input.height<=height,'composer stays in viewport');
  assert(row.layout.bodyWidth<=width,'no horizontal page overflow');
  assert.equal(await page.locator('#aiTutorContext').isVisible(),false);
  await page.locator('#aiTutorContextToggle').click();assert.equal(await page.locator('#aiTutorContext').isVisible(),true);
  await page.locator('#aiTutorContextToggle').click();assert.equal(await page.locator('#aiTutorContext').isVisible(),false);
 },{width,height});
}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
