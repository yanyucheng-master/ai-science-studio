// Isolated local regression: real DOM and formula library, mock AI, no personal keys.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const web=resolve(root,'web');
const output=process.env.AI_QUALITY_OUTPUT || resolve(root,'outputs/ai-quality');
await mkdir(output,{recursive:true});
const q1='一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，求刹车距离。';
const q2=q1.replace('20m/s','10m/s');
const probability='袋中有3个红球和2个蓝球，不放回随机取2个球，求恰有1个红球的概率，并写出计算过程。';
const answer={mode:'steps',summary:'',steps:['列式：速度位移公式为 \\(v^{2}-v_{0}^{2}=2as\\)。','结论：刹车距离为40m。'],formulas:['s=\\frac{v_{0}^{2}}{2|a|}'],finalAnswer:'刹车距离为40m。',checks:[],followUp:'',warnings:[],source:'fixture'};
const math={...answer,steps:['列式：\\(f(x)=\\begin{cases}x^{2},&x\\ge0\\\\-x,&x<0\\end{cases}\\)。','代入：\\(x=\\sqrt{2}\\)，所以 \\(f(x)=2\\)。','结论：函数值为2。'],formulas:['\\frac{\\binom{3}{1}\\binom{2}{1}}{\\binom{5}{2}}=\\frac{3}{5}','\\sqrt{2}+\\frac{1}{\\sqrt{2}}','\\ce{2H2 + O2 -> 2H2O}'],finalAnswer:'函数值为2。'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname).replace(/^\//,'')||'index.html';
  const file=resolve(web,name);if(!file.startsWith(web+sep)){res.writeHead(400);res.end();return}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end()}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const reports=[];
const observedReplies=Object.fromEntries(await Promise.all(['limiting_reagent','genetics','genetics_text_escape'].map(async id=>
  [id,JSON.parse(await readFile(resolve(root,'server/test/fixtures/ai-quality',id+'.json'),'utf8'))])));
const names=['empty_gateway','null_gateway','unknown_gateway','invalid_math','parameters_pending','regenerate_pending','clear_pending','gateway_loading','composer_full','non_template','non_template_unavailable','chemistry_truncated_replay','genetics_mixed_formulas','genetics_text_escape','text_safety','math_mobile','long_history'];
try{
  for(const name of names){
    const context=await browser.newContext({viewport:{width:name==='math_mobile'?390:1366,height:900},reducedMotion:'reduce'});
    await context.addInitScript(url=>{window.MASTER_LAB_API_URL=url},base);
    const page=await context.newPage();const calls=[];const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let release;const held=new Promise(r=>{release=r});
    const hold=name.endsWith('_pending')||name==='gateway_loading';
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/v1/experiment/generate'){
        calls.push({kind:'generate',body:route.request().postDataJSON()});
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:'explanation',title:'取球概率',answer:'暂无对应模板',plan:null})});return;
      }
      if(url.pathname==='/api/v1/tutor/chat'){
        const body=route.request().postDataJSON();calls.push({kind:'chat',body,bytes:Buffer.byteLength(route.request().postData())});
        if(name==='non_template_unavailable'){
          await route.fulfill({status:503,contentType:'application/json',body:'null'});return;
        }
        if(hold)await held;
        let payload=answer;
        if(name==='empty_gateway')payload={};
        if(name==='null_gateway')payload=null;
        if(name==='unknown_gateway')payload={mode:'unknown',summary:'不能作为成功回答'};
        if(name==='invalid_math')payload={...answer,formulas:['\\frac{1}{']};
        if(name==='math_mobile')payload=math;
        if(name==='chemistry_truncated_replay')payload=observedReplies.limiting_reagent.payload;
        if(name==='genetics_mixed_formulas')payload=observedReplies.genetics.payload;
        if(name==='genetics_text_escape')payload=observedReplies.genetics_text_escape.payload;
        if(name==='non_template')payload={...answer,steps:['列式：总取法 \\(\\binom{5}{2}=10\\)，有利取法 \\(3\\times2=6\\)。','结论：概率为 \\(\\frac{3}{5}\\)。'],formulas:['P=\\frac{6}{10}=\\frac{3}{5}'],finalAnswer:'概率为 \\(\\frac{3}{5}\\)。'};
        if(name==='text_safety')payload={...answer,steps:['<img src=x onerror="window.qaUnsafe=true"> 只作为文本。','结论：答案为40m。'],formulas:['<svg onload="window.qaUnsafe=true">'],finalAnswer:'答案为40m。'};
        if(name==='long_history')payload={...answer,formulas:[],steps:Array.from({length:8},()=>('本地模拟的长教学步骤，核对公式适用范围、题设条件、计算和单位。').repeat(10))};
        try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)})}catch{ /* cancellation is expected */ }
        return;
      }
      if(url.hostname!=='127.0.0.1'){await route.fulfill({status:503,body:''});return}
      await route.continue();
    });
    async function generate(question){
      await page.locator('#questionInput').fill(question);await page.locator('#generateButton').click();
      await page.waitForFunction(q=>state.hasGenerated&&state.generatedQuestion===q&&!document.querySelector('#generateButton').classList.contains('loading'),question);
    }
    async function complete(){
      const deadline=Date.now()+5000;while(!calls.some(item=>item.kind==='chat')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
      await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true');
    }
    try{
      await page.goto(base);await page.waitForFunction(()=>typeof MasterLabAITutor==='object'&&typeof katex==='object');
      await page.evaluate(()=>{if(state.autoDemoTimer)clearTimeout(state.autoDemoTimer)});
      if(name.startsWith('non_template')||name==='chemistry_truncated_replay'||name.startsWith('genetics_')){
        const question=name==='chemistry_truncated_replay'?observedReplies.limiting_reagent.question:
          name.startsWith('genetics_')?observedReplies.genetics.question:probability;
        await page.locator('#questionInput').fill(question);await page.locator('#generateButton').click();
        await page.waitForURL('**/#/ai-tutor');await complete();
      }else{
        await generate(q1);await page.locator('#mentorExpandButton').click();
        if(name==='composer_full'){
          await page.locator('#aiTutorInput').fill('请给完整步骤和最终答案，不要只给提示');await page.locator('#aiTutorSendButton').click();
        }else {
          await page.locator('#aiTutorInput').fill('请完整解答，写出必要步骤和最终结论。');
          await page.locator('#aiTutorSendButton').click();
        }
        if(hold){
          await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='true');
          if(name==='parameters_pending')await page.locator('.parameters input[type=range]').first().evaluate(input=>{input.value='10';input.dispatchEvent(new Event('input',{bubbles:true}))});
          if(name==='regenerate_pending')await generate(q2);
          if(name==='clear_pending')await page.locator('#aiTutorClearButton').click();
          if(name==='gateway_loading')assert.equal(await page.locator('.ai-thinking-badge:is(button)').count(),0);
          release();
        }
        await complete();
        if(name==='long_history')for(let round=0;round<3;round++){
          await page.locator('#aiTutorInput').fill('请完整解答，写出必要步骤和最终结论。');
          await page.locator('#aiTutorSendButton').click();await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')!=='true');
        }
      }
      const ui=await page.evaluate(()=>({status:document.querySelector('#aiTutorStatus').textContent,context:document.querySelector('#aiTutorContextTitle').textContent,
        error:!!document.querySelector('.ai-message.error'),pending:!!document.querySelector('.ai-message.pending'),answer:[...document.querySelectorAll('.ai-message.assistant')].at(-1)?.innerText||'',
        katex:document.querySelectorAll('.ai-message.assistant .katex').length,duplicates:document.querySelectorAll('.ai-step-result').length,
        unsafe:!!window.qaUnsafe,unsafeElements:document.querySelectorAll('.ai-message.assistant img, .ai-message.assistant svg, .ai-message.assistant script, .ai-message.assistant a[href]').length,
        overflow:document.documentElement.scrollWidth>window.innerWidth+1,subjects:[detectSubjectStrict('袋中随机取球的概率'),detectSubjectStrict('AaBb遗传，求基因型概率'),detectSubjectStrict('弹簧简谐振动方程'),detectSubjectStrict('反应物的物质的量')]}));
      assert.equal(ui.pending,false,name+' pending response');assert.deepEqual(errors,[]);
      if(['empty_gateway','null_gateway','unknown_gateway','invalid_math','non_template_unavailable'].includes(name)){assert.equal(ui.error,true);assert.doesNotMatch(ui.status,/回答完成/)}
      else assert.equal(ui.error,false,name);
      if(['parameters_pending','regenerate_pending','clear_pending'].includes(name)){assert.equal(ui.answer,'');assert.doesNotMatch(ui.status,/回答完成/)}
      if(name==='composer_full')assert.equal(calls[0].body.responseLevel,'steps');
      if(name==='non_template'){assert.equal(calls.length,2);assert.equal(calls[1].body.responseLevel,'steps');assert.equal(calls[1].body.context.originalQuestion,probability);assert.match(ui.context,/数学/);assert.match(ui.answer,/3/)}
      if(name==='non_template_unavailable'){
        assert.equal(calls.length,2);assert.match(ui.status,/本次回答未完成/);assert.doesNotMatch(ui.status,/模板|未识别/);
        assert.match(ui.answer,/公益默认 AI 服务暂时不可用|默认 AI 服务|AI.*暂时/);
      }
      if(name==='math_mobile'){assert.ok(ui.katex>=5);assert.equal(ui.duplicates,0);assert.equal(ui.overflow,false);assert.doesNotMatch(ui.answer,/\\(?:frac|sqrt|ce|begin)/)}
      if(name==='chemistry_truncated_replay'||name.startsWith('genetics_')){
        assert.equal(calls.length,2);assert.ok(ui.katex>8);assert.equal(ui.duplicates,0);
        assert.doesNotMatch(ui.answer,/\\(?:frac|mathrm|ce)\b|\\_/);
        if(name==='chemistry_truncated_replay'){assert.match(ui.answer,/1\.68/);assert.match(ui.context,/化学/)}
        else {assert.match(ui.answer,/9:3:3:1/);assert.match(ui.context,/生物/)}
      }
      if(name==='text_safety'){assert.equal(ui.unsafe,false);assert.equal(ui.unsafeElements,0)}
      if(name==='long_history'){assert.equal(calls.length,4);assert.ok(calls.every(call=>call.bytes<=14*1024));assert.ok(calls[3].body.history.length<6)}
      assert.deepEqual(ui.subjects,['数学','生物','物理','化学']);
      await page.locator('#aiTutorWorkspace').screenshot({path:resolve(output,name+'.png')});
      reports.push({name,passed:true,ui,calls:calls.map(call=>({kind:call.kind,bytes:call.bytes,responseLevel:call.body.responseLevel,historyCount:call.body.history?.length}))});
      console.log(JSON.stringify({name,passed:true}));
    }catch(error){
      const observed=await page.locator('#aiTutorWorkspace').innerText().catch(()=>null);
      await page.locator('#aiTutorWorkspace').screenshot({path:resolve(output,name+'-failed.png')}).catch(()=>{});
      reports.push({name,passed:false,error:error.message,observed});console.log(JSON.stringify({name,passed:false,error:error.message}));
    }
    finally{release();await context.close()}
  }
  await writeFile(resolve(output,'report.json'),JSON.stringify(reports,null,2),'utf8');
  if(reports.some(report=>!report.passed))process.exitCode=1;
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
