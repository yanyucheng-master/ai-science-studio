// 2026-11-07 界面交互缺陷回归（docs/ui-fix-plan-2026-11-07.md）：
// UI-01 命令面板跨学科载入预设 / 收藏；UI-02 弹层打开时全局快捷键与 Ctrl+K 不作用于后面的实验；
// UI-03 倍速按钮改倍速后时间轴步骤刻度与快捷键（setRate）路径一致。另含减少动效、鸿蒙兼容模式与多视口抽查。
// 第二轮：时间轴滑块在刻度处（含生成后的 0%）可直接拖动、刻度照常点击；拖动与生成时背景光斑暂停；
// 只有亮起卡片的边缘光单独成层，拖动滑块时边缘光不跟随。
// 第三轮：手机（触屏为主的设备）拖时间轴不显示数值气泡、滑块不放大（保留光环）；参数滑块、电脑端、鸿蒙兼容模式不变。
// 只跑某一组检查：UI_QA_ONLY=touchSimplify（逗号分隔多组）。
// 只用本地静态服务；外网与 /api/ 请求全部拦截（AI 接口返回 503，页面走本地规划），不调用真实 AI，不读写真实密钥。
// 用法（server 目录）：node scripts/verify-ui-interactions-browser.js
//   PLAYWRIGHT_MODULE 指向已安装的 Playwright；BROWSER_CHANNEL 默认 msedge；
//   UI_QA_WEB_ROOT 可指向另一份 web 目录做修复前后对比；UI_QA_OUTPUT 指定截图与报告目录。
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const web=resolve(process.env.UI_QA_WEB_ROOT||resolve(root,'web'));
const output=resolve(process.env.UI_QA_OUTPUT||resolve(root,'artifacts/ui-fix-20261107'));
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"aiConfigured":false}');return;}
  const file=resolve(web,path.slice(1)||'index.html');
  if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return;}
  try{
    let data=await readFile(file);
    if(extname(file)==='.html')data=data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>/g,'');
    res.writeHead(200,{'Content-Type':`${mime[extname(file)]||'application/octet-stream'}; charset=utf-8`,'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const report={started:new Date().toISOString(),web,browser:browser.version(),checks:[],failures:[],errors:[],apiRequests:[],screenshots:[],data:{}};
const check=(value,message,detail)=>{
  if(value){report.checks.push(message);console.log('PASS',message);}
  else{report.failures.push(detail===undefined?message:`${message} :: ${JSON.stringify(detail)}`);console.log('FAIL',message,detail===undefined?'':JSON.stringify(detail));}
};
const MOBILE={width:390,height:844,mobile:true},DESKTOP={width:1366,height:768,mobile:false};

async function fresh({width,height,mobile},{reducedMotion='no-preference',compat=false}={}){
  const context=await browser.newContext({viewport:{width,height},reducedMotion,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(/\/api\//.test(url.pathname)){report.apiRequests.push(url.pathname);await route.fulfill({status:503,body:'blocked'});}
    else if(url.origin!==base)await route.fulfill({status:204,body:''});else await route.continue();
  });
  await context.addInitScript(({base,compat})=>{
    window.MASTER_LAB_API_URL=base;
    // 鸿蒙包由外壳在页面脚本运行前给 body 加类；这里在 body 出现时立即加上
    if(compat)new MutationObserver((_,observer)=>{if(document.body){document.body.classList.add('harmony-compat-mode');observer.disconnect();}}).observe(document,{childList:true,subtree:true});
  },{base,compat});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);report.errors.push(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());report.errors.push(m.text());}});
  await page.goto(base);await page.waitForFunction(()=>typeof applyPhysicsPresetChoice==='function'&&typeof state!=='undefined');
  await page.evaluate(()=>clearTimeout(state.autoDemoTimer));
  return {context,page,errors};
}
async function generate(page,question){
  await page.locator('#questionInput').fill(question);await page.locator('#generateButton').click();
  await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay')?.classList.contains('show'),question,{timeout:20000});
  await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();pauseExperiment();});
}
const blur=page=>page.evaluate(()=>document.activeElement?.blur?.());
async function shot(page,name,locator=null){
  const path=resolve(output,`${name}.png`);
  if(locator)await locator.screenshot({path});else await page.screenshot({path});
  report.screenshots.push(path);
}

/* ---------- UI-01 ---------- */
async function menuExpectation(subject,key){
  // 参照路径：在目标学科里由预设菜单的委托点击载入（修复前后都正常的老路径）
  const {context,page}=await fresh(DESKTOP);
  await page.locator(`.subject-tab[data-subject="${subject}"]`).click();
  const defaultQuestion=await page.locator('#questionInput').inputValue();
  await page.locator('#physicsPresetToggle').click();
  await page.evaluate(key=>document.querySelector(`#physicsPresetDropdown [data-preset="${key}"]`).click(),key);
  const question=await page.locator('#questionInput').inputValue();
  const presetKey=await page.evaluate(()=>state.presetKey);
  await context.close();
  return {defaultQuestion,question,presetKey};
}
async function openPalette(page){
  await blur(page);await page.keyboard.press('Control+k');
  await page.waitForSelector('dialog.um-palette[open]',{timeout:3000});
}
async function runPaletteItem(page,matcher){
  await openPalette(page);
  await page.locator('.um-palette-input').fill(matcher.query);
  const index=await page.evaluate(({name,meta})=>[...document.querySelectorAll('.um-pal-item')].findIndex(li=>li.querySelector('.um-pal-name').textContent.trim()===name&&li.querySelector('.um-pal-meta').textContent.includes(meta)),matcher);
  assert.ok(index>=0,`palette item ${JSON.stringify(matcher)}`);
  await page.locator('.um-pal-item').nth(index).click();
}
async function ui01(variant,options){
  const {context,page,errors}=await fresh(DESKTOP,options);
  const tag=`${variant}`;
  for(const [from,to,key] of [['物理','数学','pythagoras'],['物理','化学','kno3Cooling'],['生物','物理','projectile']]){
    const expected=await menuExpectation(to,key);
    check(expected.question&&expected.question!==expected.defaultQuestion,`${tag} UI-01 参照：${to}的 ${key} 题与该学科默认题不同（断言有意义）`);
    await page.locator(`.subject-tab[data-subject="${from}"]`).click();
    const name=await page.evaluate(key=>PRESET_OPTIONS.find(o=>o.dataset.preset===key).querySelector(':scope > span').textContent.trim(),key);
    await runPaletteItem(page,{query:name,name,meta:to});
    const after=await page.evaluate(()=>({question:document.querySelector('#questionInput').value,subject:state.subject,presetKey:state.presetKey,palette:Boolean(document.querySelector('dialog.um-palette[open]'))}));
    check(after.subject===to&&after.presetKey===key&&after.question===expected.question&&!after.palette,
      `${tag} UI-01 命令面板 ${from}→${to}「${name}」：题目框等于所选实验的题，不是${to}默认题`,{after,expected:expected.question});
    if(key==='kno3Cooling'&&variant==='desktop')await shot(page,'ui-01-after-palette-cross-subject',page.locator('.prompt-panel'));
  }
  // 同学科老路径不变：菜单里点预设、命令面板选同学科预设
  await page.locator('.subject-tab[data-subject="物理"]').click();
  await page.locator('#physicsPresetToggle').click();
  await page.evaluate(()=>document.querySelector('#physicsPresetDropdown [data-preset="lever"]').click());
  const menuSame=await page.evaluate(()=>({key:state.presetKey,q:document.querySelector('#questionInput').value,open:document.querySelector('#physicsPresetDropdown').classList.contains('show')}));
  const expectLever=await menuExpectation('物理','lever');
  check(menuSame.key==='lever'&&menuSame.q===expectLever.question&&!menuSame.open,`${tag} UI-01 同学科菜单点预设行为不变`);
  const solenoidName=await page.evaluate(()=>PRESET_OPTIONS.find(o=>o.dataset.preset==='solenoid').querySelector(':scope > span').textContent.trim());
  await runPaletteItem(page,{query:solenoidName,name:solenoidName,meta:'物理'});
  const expectSolenoid=await menuExpectation('物理','solenoid');
  check(await page.evaluate(()=>state.presetKey)==='solenoid'&&await page.locator('#questionInput').inputValue()===expectSolenoid.question,`${tag} UI-01 命令面板同学科选预设`);
  // 收藏：生成一个物理实验并收藏，切到生物后从命令面板载入
  const question=await page.evaluate(()=>SUBJECTS['物理'].question);
  await generate(page,question);
  await page.locator('#favoriteButton').click();
  const favName=await page.evaluate(()=>document.querySelector('#favoriteList .favorite-item strong')?.textContent.trim());
  check(Boolean(favName),`${tag} UI-01 收藏已出现在收藏列表`);
  await page.locator('.subject-tab[data-subject="生物"]').click();
  await runPaletteItem(page,{query:'收藏',name:favName,meta:'收藏'});
  const fav=await page.evaluate(()=>({subject:state.subject,q:document.querySelector('#questionInput').value}));
  check(fav.subject==='物理'&&fav.q===question,`${tag} UI-01 命令面板跨学科载入收藏`,fav);
  check(errors.length===0,`${tag} UI-01 无控制台错误`,errors);
  await context.close();
}

/* ---------- UI-02 ---------- */
const snapshot=page=>page.evaluate(()=>({time:+state.time.toFixed(4),rate:state.playbackRate,step:state.reasonStep,playing:state.playing,
  fullscreen:document.body.classList.contains('fullscreen-lock')||document.querySelector('.experiment-card').classList.contains('immersive-mode'),
  keysPanel:Boolean(document.querySelector('.um-keys:not([hidden])')),palette:Boolean(document.querySelector('dialog.um-palette[open]')),
  questionFocused:document.activeElement===document.querySelector('#questionInput')}));
const GUARDED_KEYS=['f','r','/','[',']','ArrowLeft','ArrowRight','?','Control+k'];
async function ui02(viewport,variant,options){
  const {context,page,errors}=await fresh(viewport,options);
  await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
  await page.evaluate(()=>{activateReasoningStep(2,{manual:true});});
  await page.locator('#timeline').fill('50');
  await page.evaluate(()=>pauseExperiment());
  const before=await snapshot(page);
  // 个人密钥弹窗：右键 AI 导师标识打开（.modal-backdrop.show）
  await page.locator('.mentor-mark').first().dispatchEvent('contextmenu');
  await page.waitForSelector('#apiKeyModal.show');await page.waitForTimeout(80);
  for(const focus of ['close-button','body']){
    if(focus==='body')await blur(page);else await page.locator('#apiKeyModalClose').focus();
    for(const key of GUARDED_KEYS){
      await page.keyboard.press(key);
      const now=await snapshot(page);
      check(JSON.stringify(now)===JSON.stringify(before),`${variant} UI-02 个人密钥弹窗打开（焦点 ${focus}）时按 ${key}：实验状态不变、命令面板与快捷键一览不弹出`,{before,now});
    }
    check(await page.locator('#apiKeyModal.show').count()===1,`${variant} UI-02 按键后个人密钥弹窗仍打开（焦点 ${focus}）`);
  }
  if(variant==='desktop')await shot(page,'ui-02-after-key-modal-shortcuts');
  await page.locator('#apiKeyModalClose').click();
  await page.waitForSelector('#apiKeyModal:not(.show)',{state:'attached'});
  await blur(page);
  await page.keyboard.press(']');
  check(await page.evaluate(()=>state.playbackRate)===1.5,`${variant} UI-02 关闭弹窗后 ] 恢复提速`);
  await page.keyboard.press('[');
  await page.keyboard.press('ArrowRight');
  check(await page.evaluate(s=>state.reasonStep===s+1,before.step),`${variant} UI-02 关闭弹窗后 → 恢复下一步`);
  await page.keyboard.press('?');
  check(await page.locator('.um-keys:not([hidden])').count()===1,`${variant} UI-02 关闭弹窗后 ? 恢复快捷键一览`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  check(await page.locator('dialog.um-palette[open]').count()===1,`${variant} UI-02 关闭弹窗后 Ctrl+K 恢复命令面板`);
  await page.keyboard.press('Control+k');
  check(await page.locator('dialog.um-palette[open]').count()===0,`${variant} UI-02 命令面板打开时 Ctrl+K 关闭它`);
  // 命令面板之外的原生弹层：公告
  await page.locator('#announcementsButton').click();
  await page.waitForSelector('#announcementsDialog[open]');
  await page.keyboard.press('Control+k');
  check(await page.locator('dialog.um-palette[open]').count()===0,`${variant} UI-02 公告打开时 Ctrl+K 不在其上方弹出命令面板`);
  check(errors.length===0,`${variant} UI-02 无控制台错误`,errors);
  await context.close();
}

/* ---------- UI-03 ---------- */
const readMarks=page=>page.evaluate(()=>{
  const host=document.querySelector('.um-tl-marks');
  if(!host||host.hidden||!host.isConnected)return null;
  return [...host.querySelectorAll('.um-tl-mark')].map(b=>{const r=b.getBoundingClientRect();return {step:+b.dataset.step,at:+(+b.dataset.at).toFixed(4),x:+(r.left+r.width/2).toFixed(2)};});
});
const sameMarks=(a,b)=>Boolean(a&&b)&&a.length===b.length&&a.every((m,i)=>m.step===b[i].step&&Math.abs(m.at-b[i].at)<1e-4&&Math.abs(m.x-b[i].x)<0.5);
async function viaShortcut(page,rate){
  // 先用快捷键离开再回到目标倍速：两次都走 setRate
  await page.locator('#playbackButton').focus();
  if(rate===2){await page.keyboard.press('[');await page.keyboard.press(']');}
  else{await page.keyboard.press(']');await page.keyboard.press('[');}
  assert.equal(await page.evaluate(()=>state.playbackRate),rate);
  return readMarks(page);
}
async function ui03(viewport,variant,options){
  const {context,page,errors}=await fresh(viewport,options);
  await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
  const info=await page.evaluate(()=>({template:currentPhysicsPresetKey(),duration:duration(),rate:state.playbackRate}));
  const one=await readMarks(page);
  check(info.template==='brake'&&info.rate===1&&Array.isArray(one)&&one.length===3,`${variant} UI-03 刹车实验显示 3 个步骤刻度`,{info,one});
  // 断言有意义：1× 与 2× 的刻度位置确实不同（时长 ${duration}s，下限 1.2s / 2.4s 在 2× 时起作用）
  await page.locator('#playbackButton').focus();
  await page.keyboard.press(']');await page.keyboard.press(']');
  const two=await readMarks(page);
  check(await page.evaluate(()=>state.playbackRate)===2&&!sameMarks(one,two),`${variant} UI-03 1× 与 2× 的刻度位置不同（时长 ${info.duration}s）`,{one,two});
  await page.keyboard.press('[');await page.keyboard.press('[');
  report.data[`${variant}-marks`]={duration:info.duration,one,two,steps:[]};
  for(const rate of [1.5,2,0.5,1]){
    await page.locator('#playbackButton').click();
    const rateNow=await page.evaluate(()=>state.playbackRate);
    const button=await readMarks(page);
    if(rate===2&&variant==='desktop')await shot(page,'ui-03-after-playback-button-2x',page.locator('.experiment-card .transport'));
    if(rate===2&&variant==='mobile')await shot(page,'ui-03-after-playback-button-2x-mobile',page.locator('.experiment-card .transport'));
    const shortcut=await viaShortcut(page,rate);
    report.data[`${variant}-marks`].steps.push({rate,button,shortcut});
    check(rateNow===rate&&sameMarks(button,shortcut),`${variant} UI-03 倍速按钮到 ${rate}× 后刻度与快捷键路径一致`,{rateNow,button,shortcut});
  }
  check(errors.length===0,`${variant} UI-03 无控制台错误`,errors);
  await context.close();
}

/* ---------- 第二轮（2026-11-07）：时间轴起点可拖、刻度点击 ---------- */
async function timelineThumb(viewport,variant,options){
  const {context,page,errors}=await fresh(viewport,options);
  await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
  const cdp=await context.newCDPSession(page);
  // 生成后进度在 0%，第 1 步刻度与滑块重叠：按下应命中滑块
  const geo=await page.evaluate(()=>{const t=document.querySelector('#timeline');t.scrollIntoView({block:'center'});const r=t.getBoundingClientRect();const thumb=parseFloat(getComputedStyle(t).getPropertyValue('--um-thumb'))||14;return {x:r.left+thumb/2,y:r.top+r.height/2,value:+t.value};});
  const hit=await page.evaluate(({x,y})=>{const el=document.elementFromPoint(x,y);return {timeline:el===document.querySelector('#timeline'),target:String(el?.className||el?.tagName),covered:[...document.querySelectorAll('.um-tl-mark.is-covered')].map(b=>+b.dataset.step)};},geo);
  check(geo.value===0&&hit.timeline&&hit.covered.includes(1),`${variant} 时间轴在 0% 时按下命中滑块（第 1 步刻度让开指针）`,{geo,hit});
  await page.evaluate(()=>{window.__tlInputs=0;document.querySelector('#timeline').addEventListener('input',()=>window.__tlInputs++);});
  if(viewport.mobile){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:geo.x,y:geo.y}]});
    for(let s=1;s<=6;s++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:geo.x+s*5,y:geo.y}]});await page.waitForTimeout(16);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await page.mouse.move(geo.x,geo.y);await page.mouse.down();
    for(let s=1;s<=6;s++){await page.mouse.move(geo.x+s*5,geo.y);await page.waitForTimeout(16);}
    await page.mouse.up();
  }
  const moved=await page.evaluate(()=>({inputs:window.__tlInputs,value:+document.querySelector('#timeline').value}));
  check(moved.inputs>0&&moved.value>0,`${variant} 从 0% 按住滑块可以拖动时间轴`,moved);
  // 没被盖住的刻度照常点击跳转；跳过去后改由这一个刻度让开指针
  const mark3=await page.evaluate(()=>{const b=document.querySelector('.um-tl-mark[data-step="3"]');const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,at:+b.dataset.at,covered:b.classList.contains('is-covered')};});
  if(viewport.mobile)await page.touchscreen.tap(mark3.x,mark3.y);else await page.mouse.click(mark3.x,mark3.y);
  const jumped=await page.evaluate(()=>({value:+document.querySelector('#timeline').value,step:state.reasonStep,covered:[...document.querySelectorAll('.um-tl-mark.is-covered')].map(b=>+b.dataset.step)}));
  check(!mark3.covered&&Math.abs(jumped.value-mark3.at*100)<0.6&&jumped.step===3&&jumped.covered.includes(3)&&!jumped.covered.includes(1),
    `${variant} 点击第 3 步刻度跳到对应进度并切换步骤，之后由第 3 步刻度让开指针`,{mark3,jumped});
  if(variant==='mobile')await shot(page,'ui-04-timeline-thumb-mobile',page.locator('.experiment-card .transport'));
  check(errors.length===0,`${variant} 时间轴拖动无控制台错误`,errors);
  await context.close();
}

/* ---------- 第二轮（2026-11-07）：背景光斑暂停、卡片边缘光的合成层与拖动时静止（仅鼠标设备） ---------- */
async function ambientAndSpotlight(){
  const {context,page,errors}=await fresh(DESKTOP);
  // 用脚本点击生成（不产生指针事件），只检验“生成遮罩”这一个暂停原因；在遮罩类名变化时记录（页面自己的观察器先运行）
  await page.evaluate(()=>{window.__still=[];const overlay=document.querySelector('#generationOverlay');new MutationObserver(()=>{window.__still.push({still:document.documentElement.classList.contains('um-still'),overlay:overlay.classList.contains('show'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState});}).observe(overlay,{attributes:true,attributeFilter:['class']});});
  const question=await page.evaluate(()=>SUBJECTS['物理'].question);
  await page.locator('#questionInput').fill(question);
  await page.evaluate(()=>document.querySelector('#generateButton').click());
  await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generationOverlay')?.classList.contains('show'),question,{timeout:20000});
  await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();pauseExperiment();});
  const seen=await page.evaluate(()=>window.__still);
  const stillAfterGenerate=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  check(seen.some(x=>x.still&&x.overlay&&x.amb==='paused')&&!stillAfterGenerate.still&&stillAfterGenerate.amb==='running','desktop 生成遮罩显示期间背景光斑暂停，结束后恢复',{seen,stillAfterGenerate});
  // 只有亮起的卡片的边缘光单独成层
  const box=await page.locator('.experiment-card').boundingBox();
  await page.mouse.move(box.x+40,box.y+40);await page.waitForTimeout(40);await page.mouse.move(box.x+70,box.y+60);await page.waitForTimeout(40);
  const layers=await page.evaluate(()=>({lit:document.querySelector('.experiment-card').classList.contains('um-lit'),experiment:getComputedStyle(document.querySelector('.experiment-card'),'::before').willChange,reasoning:getComputedStyle(document.querySelector('.reasoning-card'),'::before').willChange}));
  check(layers.lit&&layers.experiment==='opacity'&&layers.reasoning==='auto','desktop 只有亮起的卡片边缘光单独成层',layers);
  // 拖动参数滑块：背景光斑暂停、边缘光停在按下处；松手后都恢复
  const range=await page.evaluate(()=>{const el=document.querySelector('#speedRange');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.left+8+((+el.value-+el.min)/(+el.max-+el.min))*(r.width-16),y:r.top+r.height/2};});
  await page.mouse.move(range.x,range.y);await page.waitForTimeout(40);
  const mx=()=>page.evaluate(()=>document.querySelector('.experiment-card').style.getPropertyValue('--um-mx'));
  const mx0=await mx();
  await page.mouse.down();
  const during=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  for(let s=1;s<=8;s++){await page.mouse.move(range.x+s*7,range.y);await page.waitForTimeout(24);}
  const mxDrag=await mx();
  await page.mouse.up();
  // 松手后拖动原因解除；按下时触发的“交互后 1.5 秒暂停”结束后完全恢复
  await page.waitForTimeout(1700);
  const after=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  await page.mouse.move(range.x-40,range.y-24);await page.waitForTimeout(40);
  const mxAfter=await mx();
  check(during.still&&during.amb==='paused'&&!after.still&&after.amb==='running','desktop 拖动滑块时背景光斑暂停，松手后恢复',{during,after});
  check(Boolean(mx0)&&mxDrag===mx0&&mxAfter!==mx0,'desktop 拖动滑块时卡片边缘光停在按下处，松手后继续跟随',{mx0,mxDrag,mxAfter});
  check(errors.length===0,'desktop 背景光斑与边缘光检查无控制台错误',errors);
  await context.close();
}

/* ---------- 第二轮（2026-11-07）：题目框光圈只认文本框；交互后背景光斑短暂暂停 ---------- */
async function ringAndInputPause(){
  const {context,page,errors}=await fresh(DESKTOP);
  const ring=()=>page.evaluate(()=>{const w=document.querySelector('.prompt-input-wrap');const s=getComputedStyle(w,'::after');return {typing:w.classList.contains('um-typing'),content:s.content,animation:s.animationName};});
  await page.locator('#questionInput').focus();
  const typing=await ring();
  await page.locator('#physicsPresetToggle').click();
  const toggle=await ring();
  await page.locator('#physicsPresetToggle').click();
  await page.locator('#generateButton').focus();
  const generateFocused=await ring();
  check(typing.typing&&typing.content!=='none'&&/um-ring-spin/.test(typing.animation)&&!toggle.typing&&toggle.content==='none'&&!generateFocused.typing&&generateFocused.content==='none',
    'desktop 题目输入框光圈只在文本框聚焦时出现（实验库、生成按钮获得焦点时不转）',{typing,toggle,generateFocused});
  await page.waitForTimeout(1700);
  const idle=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  await page.keyboard.press('Shift');
  const pressed=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  await page.waitForTimeout(1700);
  const resumed=await page.evaluate(()=>({still:document.documentElement.classList.contains('um-still'),amb:getComputedStyle(document.querySelector('.ambient-one')).animationPlayState}));
  check(!idle.still&&idle.amb==='running'&&pressed.still&&pressed.amb==='paused'&&!resumed.still&&resumed.amb==='running','desktop 按键后背景光斑暂停，停手 1.5 秒后恢复',{idle,pressed,resumed});
  check(errors.length===0,'desktop 光圈与光斑暂停检查无控制台错误',errors);
  await context.close();
}

/* ---------- 第三轮（2026-11-08）：手机端拖时间轴不显示气泡、滑块不放大；参数滑块与电脑端不变；鸿蒙兼容模式保留气泡 ---------- */
// 滑块圆钮在 range 的内置影子 DOM 里，getComputedStyle 取不到伪元素样式，改用调试协议读圆钮节点的计算样式
async function thumbStyle(cdp,id){
  const {root}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
  const attr=(n,name)=>{const a=n.attributes||[];for(let i=0;i<a.length;i+=2)if(a[i]===name)return a[i+1];return null;};
  const find=(n,pred)=>{if(pred(n))return n;for(const c of [...(n.children||[]),...(n.shadowRoots||[])]){const r=find(c,pred);if(r)return r;}return null;};
  const input=find(root,n=>n.nodeName==='INPUT'&&attr(n,'id')===id);
  const thumb=input&&find(input,n=>n!==input&&(attr(n,'pseudo')==='-webkit-slider-thumb'||(n.nodeName==='DIV'&&attr(n,'id')==='thumb')));
  if(!thumb)return null;
  const {computedStyle}=await cdp.send('CSS.getComputedStyleForNode',{nodeId:thumb.nodeId});
  const get=name=>computedStyle.find(p=>p.name===name)?.value;
  return {transform:get('transform'),boxShadow:get('box-shadow')};
}
async function dragProbe(page,cdp,id,touch){
  // 先滚动再等滚动停稳，之后才量位置（页面有平滑滚动）
  await page.evaluate(id=>document.getElementById(id).scrollIntoView({block:'center'}),id);
  await page.waitForTimeout(500);
  const box=await page.evaluate(id=>{const el=document.getElementById(id);const r=el.getBoundingClientRect();const thumb=parseFloat(getComputedStyle(el).getPropertyValue('--um-thumb'))||16;return {x:r.left+thumb/2+((+el.value-+el.min)/((+el.max-+el.min)||1))*(r.width-thumb),y:r.top+r.height/2,hit:document.elementFromPoint(r.left+thumb/2+((+el.value-+el.min)/((+el.max-+el.min)||1))*(r.width-thumb),r.top+r.height/2)===el};},id);
  if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x,y:box.y}]});for(let s=1;s<=3;s++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+s*6,y:box.y}]});await page.waitForTimeout(30);}}
  else{await page.mouse.move(box.x,box.y);await page.mouse.down();for(let s=1;s<=3;s++){await page.mouse.move(box.x+s*6,box.y);await page.waitForTimeout(30);}}
  const state=await page.evaluate(id=>({dragging:document.getElementById(id).classList.contains('um-dragging'),bubble:Boolean(document.querySelector('.um-bubble.is-on'))}),id);
  const thumb=await thumbStyle(cdp,id);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await page.waitForTimeout(250);
  return {...state,thumb,hit:box.hit};
}
async function touchSimplify(){
  for(const [viewport,variant,touch] of [[MOBILE,'mobile',true],[DESKTOP,'desktop',false]]){
    const {context,page,errors}=await fresh(viewport);
    await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
    const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const tl=await dragProbe(page,cdp,'timeline',touch);
    const param=await dragProbe(page,cdp,'speedRange',touch);
    report.data[`${variant}-drag-effects`]={tl,param};
    const scaled=t=>Boolean(t)&&/^matrix\(1\.28/.test(t.transform||'');
    const ringed=t=>Boolean(t)&&/rgba?\(/.test(t.boxShadow||'')&&(t.boxShadow||'').split('rgb').length>=3;
    if(touch){
      check(tl.dragging&&!tl.bubble&&tl.thumb&&tl.thumb.transform==='none'&&ringed(tl.thumb),'mobile 拖时间轴：不显示数值气泡，滑块不放大但保留光环',tl);
      check(param.dragging&&param.bubble&&scaled(param.thumb),'mobile 拖参数滑块：数值气泡与滑块放大保持不变',param);
    }else{
      check(tl.dragging&&tl.bubble&&scaled(tl.thumb)&&ringed(tl.thumb),'desktop 拖时间轴：数值气泡、滑块放大与光环保持不变',tl);
      check(param.dragging&&param.bubble&&scaled(param.thumb),'desktop 拖参数滑块：数值气泡与滑块放大保持不变',param);
    }
    check(errors.length===0,`${variant} 拖动特效检查无控制台错误`,errors);
    await context.close();
  }
  // 鸿蒙兼容模式（手机）：拖时间轴仍显示数值气泡
  const {context,page,errors}=await fresh(MOBILE,{compat:true});
  await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
  const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const compatTl=await dragProbe(page,cdp,'timeline',true);
  check(compatTl.bubble,'compat 手机拖时间轴仍显示数值气泡（鸿蒙兼容模式不变）',compatTl);
  check(errors.length===0,'compat 拖动检查无控制台错误',errors);
  await context.close();
}

/* ---------- 鸿蒙兼容模式：修复不引入新行为 ---------- */
async function compatMode(){
  const {context,page,errors}=await fresh(DESKTOP,{compat:true});
  await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
  await page.locator('#playbackButton').click();
  check(await page.evaluate(()=>state.playbackRate)===1.5&&(await readMarks(page))===null,'compat 倍速按钮照常切换，且不显示步骤刻度');
  await blur(page);
  await page.keyboard.press('Control+k');
  check(await page.locator('dialog.um-palette[open]').count()===0,'compat Ctrl+K 不打开命令面板');
  const before=await snapshot(page);
  for(const key of ['f','r','[',']','ArrowRight','?'])await page.keyboard.press(key);
  const after=await snapshot(page);
  check(JSON.stringify(after)===JSON.stringify(before),'compat ui-motion 快捷键不生效（与修复前一致）',{before,after});
  check(errors.length===0,'compat 无控制台错误',errors);
  await context.close();
}

/* ---------- 视口抽查 ---------- */
async function viewports(){
  for(const [width,height] of [[1366,768],[820,900],[390,844],[320,568],[844,390]]){
    const mobile=width<=844&&width!==820;
    const {context,page,errors}=await fresh({width,height,mobile});
    await generate(page,await page.evaluate(()=>SUBJECTS['物理'].question));
    await page.locator('#playbackButton').click();
    await page.locator('.mentor-mark').first().dispatchEvent('contextmenu');await page.waitForSelector('#apiKeyModal.show');
    await page.keyboard.press('Escape');await page.waitForSelector('#apiKeyModal:not(.show)',{state:'attached'});
    await openPalette(page);await page.keyboard.press('Escape');
    const audit=await page.evaluate(()=>{
      const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);const dup=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
      return {scrollWidth:document.documentElement.scrollWidth,innerWidth,duplicates:dup};
    });
    check(audit.scrollWidth<=audit.innerWidth+1,`${width}×${height} 无横向溢出`,audit);
    check(audit.duplicates.length===0,`${width}×${height} 无重复 ID`,audit.duplicates);
    check(errors.length===0,`${width}×${height} 无控制台错误`,errors);
    await context.close();
  }
}

try{
  if(process.env.UI_QA_ONLY){
    const groups={timelineThumbDesktop:()=>timelineThumb(DESKTOP,'desktop'),timelineThumbMobile:()=>timelineThumb(MOBILE,'mobile'),ambientAndSpotlight,ringAndInputPause,touchSimplify,compatMode,viewports};
    for(const name of process.env.UI_QA_ONLY.split(','))await groups[name.trim()]();
  }else{
  await ui01('desktop');
  await ui01('desktop-reduced',{reducedMotion:'reduce'});
  for(const [viewport,variant] of [[DESKTOP,'desktop'],[MOBILE,'mobile']]){
    await ui02(viewport,variant);
    await ui03(viewport,variant);
  }
  await ui02(DESKTOP,'desktop-reduced',{reducedMotion:'reduce'});
  await ui03(DESKTOP,'desktop-reduced',{reducedMotion:'reduce'});
  await ui03(MOBILE,'mobile-reduced',{reducedMotion:'reduce'});
  await timelineThumb(DESKTOP,'desktop');
  await timelineThumb(MOBILE,'mobile');
  await ambientAndSpotlight();
  await ringAndInputPause();
  await touchSimplify();
  await compatMode();
  await viewports();
  }
}catch(error){
  report.failures.push(`aborted: ${error.stack||error}`);console.log('ABORT',error.stack||error);
}finally{
  report.finished=new Date().toISOString();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();server.close();
}
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,apiRequests:report.apiRequests.length,report:resolve(output,'report.json')}));
if(report.failures.length)process.exitCode=1;
