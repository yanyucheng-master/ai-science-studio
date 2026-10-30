// 2026-10-30 公网验收问题修复的浏览器专项：碱液中加酸的中和实验、未写温度按常温、
// 初始体积滑块的曲线采样、生成遮罩单位高亮、AI 分析期间重复点击与改题。
// 只用本地静态服务；外网与 /api/ 请求全部拦截，AI 导师接口用页面内的模拟函数代替，不调用真实 AI。
// 用法：node scripts/verify-acceptance-fixes-browser.js（BROWSER_CHANNEL 默认 msedge，可设为 chromium；
// ACCEPTANCE_WEB_ROOT 可指向另一份 web 目录做修复前后对比；ACCEPTANCE_QA_OUTPUT 指定截图与报告目录）
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
const web=resolve(process.env.ACCEPTANCE_WEB_ROOT||resolve(root,'web'));
const output=resolve(process.env.ACCEPTANCE_QA_OUTPUT||resolve(root,'artifacts/acceptance-fixes-20261030'));
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
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
const report={started:new Date().toISOString(),web,browser:browser.version(),checks:[],failures:[],errors:[],apiRequests:[],screenshots:[]};
const check=(value,message)=>{if(value){report.checks.push(message);console.log('PASS',message);}else{report.failures.push(message);console.log('FAIL',message);}};
const contexts=[];
async function fresh(width=1366,height=1000,mobile=false){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});contexts.push(context);
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(/\/api\//.test(url.pathname)){report.apiRequests.push(url.pathname);await route.fulfill({status:503,body:'blocked'});}
    else if(url.origin!==base)await route.fulfill({status:204,body:''});else await route.continue();
  });
  await context.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.__copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copies.push(text)}});},base);
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);report.errors.push(e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());report.errors.push(m.text());}});
  await page.goto(base);await page.waitForFunction(()=>typeof planLocalExperiment==='function');await page.evaluate(()=>clearTimeout(state.autoDemoTimer));
  return {context,page,errors};
}
async function generate(page,q){
  await page.locator('#questionInput').fill(q);await page.locator('#generateButton').click();
  await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading')&&!document.querySelector('#generationOverlay')?.classList.contains('show'),q,{timeout:15000});
  await page.evaluate(()=>{clearDemoTimers();clearReasoningTimers();});
}
const change=(page,index,value)=>page.locator('.parameters input[type=range]').nth(index).fill(String(value));
const near=(a,b,e=1e-9)=>Number.isFinite(a)&&Math.abs(a-b)<=e;
async function sceneLayout(page){
  return page.evaluate(()=>{
    const root=document.querySelector('.chemistry-v2-scene');
    const labels=[...root.querySelectorAll('svg text')].map(e=>{const b=e.getBBox(),m=e.getScreenCTM(),p=new DOMPoint(b.x,b.y).matrixTransform(m),q=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m),s=e.closest('svg').getBoundingClientRect();return p.x>=s.left-1&&q.x<=s.right+1&&p.y>=s.top-1&&q.y<=s.bottom+1;});
    const card=document.querySelector('.experiment-card').getBoundingClientRect();
    return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,labelsInside:labels.every(Boolean),labels:labels.length,cardInside:card.left>=-1&&card.right<=innerWidth+1};
  });
}

const REVERSE='25°C，将20mL 0.1mol/L盐酸滴入30mL 0.1mol/L NaOH溶液中，求混合液的pH。';
const NO_TEMPERATURE='向20mL 0.100mol/L的盐酸中加入15mL 0.100mol/L的NaOH溶液，求混合液的pH。';
const FORWARD='25°C，初始盐酸体积为20mL，累计加入NaOH溶液体积为10mL，HCl与NaOH的浓度均为0.100mol/L，求当前混合液pH。';
try{
  // A. 碱液中加酸：参数名、曲线方向、终点读数、改参、重置、布局
  for(const [width,height,mobile]of [[1366,1000,false],[390,900,true],[375,812,true]]){
    const {page,errors}=await fresh(width,height,mobile);
    await generate(page,REVERSE);
    check(await page.evaluate(()=>activeGenericId()==='hclNaohNeutralization'&&state.p1===30&&state.p2===20&&state.extraFixed.hclNaohNeutralization?.direction==='acidIntoBase'),`${width}: 盐酸滴入NaOH识别为碱液中加酸（初始NaOH 30mL，加酸20mL）`);
    const labels=await page.locator('.parameters').innerText();
    check(/初始NaOH溶液体积/.test(labels)&&/累计加入盐酸/.test(labels)&&!/初始盐酸体积/.test(labels),`${width}: 参数名跟随加液方向`);
    const sceneText=await page.locator('.chemistry-v2-scene').innerText();
    check(/碱液中加酸/.test(sceneText)&&/累计加入 HCl/.test(sceneText)&&/目标累计加酸 20 mL/.test(sceneText),`${width}: 场景标题、坐标轴和说明为加酸`);
    await page.locator('#timeline').fill('0');
    check(await page.evaluate(()=>{const s=document.querySelector('.chemistry-v2-scene');return s.dataset.currentAddedVolume==='0'&&Math.abs(Number(s.dataset.currentPh)-13)<1e-9;}),`${width}: 演示初态为 0.1mol/L NaOH，pH 13`);
    await page.locator('#timeline').fill('100');
    check(await page.evaluate(()=>{const s=document.querySelector('.chemistry-v2-scene'),d=s.querySelector('[data-eq-point]');return s.dataset.currentAddedVolume==='20'&&Math.abs(Number(s.dataset.currentPh)-12.30102999566)<1e-9&&Math.abs(Number(d.getAttribute('cx'))-(48+3.72*20))<1e-9;}),`${width}: 终点加酸20mL，pH≈12.30103，曲线点位置一致`);
    check(await page.evaluate(()=>{const path=document.querySelector('.eq-curve').getAttribute('d').split(/[ML]/).filter(Boolean).map(p=>Number(p.split(',')[1]));return path[0]<path.at(-1);}),`${width}: pH 曲线从高到低（SVG y 由小到大）`);
    await change(page,1,30);
    check(await page.evaluate(()=>{const m=buildGenericContent().model;return m.pH===7&&m.nature==='中性'&&m.addedVolume===30;}),`${width}: 加酸量改为30mL（等量）为中性`);
    await page.locator('#resetButton').click();
    check(await page.evaluate(()=>state.p1===30&&state.p2===20),`${width}: 重置回原题参数`);
    await page.locator('#timeline').fill('100');
    const v=await sceneLayout(page);
    check(v.pageWidth<=v.viewport+1&&v.cardInside,`${width}: 无横向溢出（页面宽 ${v.pageWidth}）`);
    check(v.labelsInside&&v.labels>0,`${width}: 曲线图内 ${v.labels} 个文字均未出框`);
    await page.waitForFunction(()=>!document.querySelector('.toast.show'),null,{timeout:6000}).catch(()=>{});
    const shot=resolve(output,`reverse-neutralization-${width}.png`);await page.locator('.experiment-card').screenshot({path:shot,animations:'disabled'});report.screenshots.push(shot);
    check(errors.length===0,`${width}: 无页面错误`);
  }

  // B. 分享恢复加液方向
  {
    const {page}=await fresh();await generate(page,REVERSE);await change(page,1,25.5);
    await page.locator('#shareButton').click();const url=await page.evaluate(()=>window.__copies.at(-1));
    const receiver=await fresh();await receiver.page.goto(url);
    await receiver.page.waitForFunction(()=>activeGenericId()==='hclNaohNeutralization'&&state.hasGenerated,null,{timeout:15000});
    check(await receiver.page.evaluate(()=>state.p1===30&&state.p2===25.5&&state.extraFixed.hclNaohNeutralization.direction==='acidIntoBase'),'分享链接恢复加液方向与比较参数');
    await receiver.page.locator('#resetButton').click();
    check(await receiver.page.evaluate(()=>state.p2===20),'分享后重置回原题加酸量');
  }

  // C. 未写温度按常温25°C，并在识别结果和场景中注明
  {
    const {page,errors}=await fresh();await generate(page,NO_TEMPERATURE);
    const feedback=await page.locator('#parseFeedback').innerText();
    check(/未注明温度，按常温25°C计算/.test(feedback),'识别结果注明“未注明温度，按常温25°C计算”');
    check(/题目未注明温度，按常温 25°C 计算/.test(await page.locator('.chemistry-v2-scene').innerText()),'场景说明同样注明温度假设');
    check(await page.evaluate(()=>Math.abs(buildGenericContent().model.pH-1.84509804001)<1e-9),'未写温度题 pH≈1.845098');
    check(errors.length===0,'未写温度题无页面错误');
  }

  // D. 初始盐酸滑块：0.1mL 档位上的每个值都能重画曲线（修复前约四分之三的档位抛错）
  {
    const {page,errors}=await fresh();await generate(page,FORWARD);
    const failed=await page.evaluate(()=>{const bad=[];for(let i=100;i<=500;i++){const a=i/10;try{MASTER_LAB_TEMPLATES.hclNaohNeutralization.content(a,20,state.extraFixed.hclNaohNeutralization);}catch{bad.push(a);}}return bad;});
    check(failed.length===0,`初始盐酸 10–50mL 的 401 个滑块档位都能生成曲线（失败 ${failed.length} 个${failed.length?`，如 ${failed.slice(0,5).join('、')}`:''}）`);
    const before=errors.length;await change(page,0,10.2);
    check(await page.evaluate(()=>buildGenericContent().model.acidVolume===10.2&&state.p1===10.2),'拖到 10.2mL 后实验数值更新');
    check(errors.length===before,`拖到 10.2mL 时无页面错误${errors.length>before?`（${errors.at(-1)}）`:''}`);
  }

  // D2. 硝酸钾目标终温滑块只能停在教材五个温度（修复前步长为1°C，拖到21°C等值时报错）
  {
    const {page,errors}=await fresh();
    await generate(page,'初始为60°C饱和的纯KNO₃水溶液，水质量为100g，冷却至20°C，不蒸发且不损失水，充分达到平衡，求析出晶体质量。');
    check(await page.evaluate(()=>Number(document.querySelectorAll('.parameters input[type=range]')[1].step)===10),'硝酸钾目标终温滑块步长为10°C');
    const before=errors.length;
    await page.evaluate(()=>{const input=document.querySelectorAll('.parameters input[type=range]')[1];input.stepUp();input.dispatchEvent(new Event('input',{bubbles:true}));});
    check(await page.evaluate(()=>state.p2===30&&buildGenericContent().model.crystals===64.2),'终温滑块上调一格到30°C，析晶64.2g');
    check(errors.length===before,`调终温滑块时无页面错误${errors.length>before?`（${errors.at(-1)}）`:''}`);
  }

  // E. 生成遮罩高亮：单位完整
  {
    const {page}=await fresh();
    const tokens=await page.evaluate(q=>generationQuestionTokens(q).map(t=>q.slice(t.start,t.end)),'25°C，向20mL 0.100mol/L的盐酸中加入15mL 0.100mol/L的NaOH溶液，求混合液的pH');
    check(['20mL','0.100mol/L','15mL'].every(t=>tokens.includes(t)),`遮罩高亮保留完整单位：${tokens.join(' | ')}`);
    const circle=await page.evaluate(q=>generationQuestionTokens(q).map(t=>q.slice(t.start,t.end)),'单位圆中θ=150°，求sinθ、cosθ');
    check(circle.includes('150°'),`角度带“°”高亮：${circle.join(' | ')}`);
  }

  // G. 报告中转 AI 的自然说法：从物理等其他学科页面输入也能路由到对应本地模板
  {
    const {page}=await fresh();
    const routes=await page.evaluate(items=>items.map(([q,id])=>{const plan=planLocalExperiment(q,{subject:'物理',physicsTemplate:'brake',presetQuestion:'',gradeLevel:'senior'});return {q,id,ok:plan.ok&&plan.templateId===id,message:plan.parse?.message||''};}),[
      ['两直角边分别为6cm和8cm，求斜边长。','pythagoras'],
      ['两条直角边分别是9cm和12cm，用面积拼图验证。','pythagoras'],
      ['单位圆中θ=150°，求sinθ、cosθ，并求点P的坐标。','unitCircle'],
      ['20mL 0.1mol/L盐酸滴入30mL 0.1mol/L NaOH溶液中，求混合液的pH。','hclNaohNeutralization']
    ]);
    for(const r of routes)check(r.ok,`从物理页输入可本地生成：${r.q}${r.ok?'':`（${r.message}）`}`);
  }

  // F. AI 分析期间：再次点击有提示；改题后旧结果不覆盖新题
  const MAPPED='直角三角形两条直角边分别为6cm和8cm，求斜边长度。';
  const stubAI=(page,delay)=>page.evaluate(([delay,mapped])=>{
    window.mappedPlanFitsOriginal=()=>true;
    window.__aiCalls=0;
    window.MasterLabAITutor={...window.MasterLabAITutor,resolveUnmatchedQuestion:()=>{window.__aiCalls++;return new Promise(r=>setTimeout(()=>r({mode:'experiment',question:mapped}),delay));}};
  },[delay,MAPPED]);
  {
    const {page,errors}=await fresh();await stubAI(page,300);
    await page.locator('#questionInput').fill('一道没有本地模板的题，求神秘量X。');await page.locator('#generateButton').click();
    await page.waitForFunction(()=>state.hasGenerated&&activeGenericId()==='pythagoras',null,{timeout:15000});
    check(await page.evaluate(()=>state.generatedQuestion==='一道没有本地模板的题，求神秘量X。'&&document.querySelector('#questionInput').value===state.generatedQuestion),'对照：题目未改时，AI 匹配到的实验照常生成，输入框保留原题');
    check(errors.length===0,'对照流程无页面错误');
  }
  {
    const {page,errors}=await fresh();await stubAI(page,2500);
    await page.locator('#questionInput').fill('一道没有本地模板的题，求神秘量X。');await page.locator('#generateButton').click();
    await page.waitForFunction(()=>document.querySelector('#generateButton span').textContent==='AI 分析中');
    const t0=Date.now();await page.locator('#generateButton').click({timeout:1500});
    check(Date.now()-t0<1500,'AI 分析中按钮仍可点按（不被 pointer-events 吞掉）');
    check(await page.evaluate(()=>document.querySelector('#toast').classList.contains('show')&&/AI 正在分析上一题/.test(document.querySelector('#toast p').textContent)),'AI 分析中再点“生成实验”会提示正在分析上一题');
    check(await page.evaluate(()=>window.__aiCalls===1),'重复点击没有发起第二次 AI 分析');
    const NEXT='单位圆中，θ=30°，求sinθ。';
    await page.locator('#questionInput').fill(NEXT);
    check(/AI 仍在分析上一题/.test(await page.locator('#parseFeedback').innerText()),'分析期间改题，提示改为“AI 仍在分析上一题”');
    await page.waitForFunction(()=>!document.querySelector('#generateButton').classList.contains('loading'),null,{timeout:10000});
    await page.waitForTimeout(300);
    check(await page.evaluate(n=>document.querySelector('#questionInput').value===n&&activeGenericId()!=='pythagoras',NEXT),'旧题的 AI 结果没有覆盖新题，也没有生成旧题实验');
    check(/题目已修改，点击“生成实验”识别当前题目/.test(await page.locator('#parseFeedback').innerText()),'分析结束后提示点击生成识别当前题目');
    await page.locator('#generateButton').click();
    await page.waitForFunction(n=>state.hasGenerated&&state.generatedQuestion===n&&activeGenericId()==='unitCircle',NEXT,{timeout:15000});
    check(true,'随后点击生成实验，新题正常生成单位圆实验');
    check(errors.length===0,'AI 分析期间流程无页面错误');
  }
  check(report.apiRequests.length===0,'没有发出真实 AI 请求');
}catch(error){report.failures.push(`异常：${error.message}`);console.log('FAIL',error.message);}
finally{
  report.finished=new Date().toISOString();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  for(const c of contexts)await c.close().catch(()=>{});
  await browser.close();server.close();
}
console.log(`\n${report.checks.length} 项通过，${report.failures.length} 项失败`);
assert.equal(report.failures.length,0,report.failures.join('\n'));
