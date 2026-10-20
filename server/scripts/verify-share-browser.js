// Local sharing acceptance. Isolated profiles, intercepted clipboard and no model calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.SHARE_QA_OUTPUT || resolve(root, 'artifacts/share-v1');
await mkdir(output, { recursive: true });
const web = resolve(root, 'web');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
const server = createServer(async (req, res) => {
  if (req.url === '/share-test-away') { res.writeHead(200, {'Content-Type':'text/html'}); res.end('<title>Away</title><p>Local navigation test</p>'); return; }
  const file = resolve(web, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html');
  if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
const report = { browser: browser.version(), checks: [], roundTrips: [], errors: [], blockedRequests: [] };
const contexts = [];
const prefix = '#/share/';
const hash = value => prefix + Buffer.from(JSON.stringify(value)).toString('base64url');
const decode = url => JSON.parse(Buffer.from(new URL(url).hash.slice(prefix.length), 'base64url').toString('utf8'));
const mark = label => { report.checks.push(label); console.log('PASS', label); };
async function fresh(width = 1366, suffix = '') {
  const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
  contexts.push(context);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/\/api\/v1\/|\/chat\/completions/.test(url.pathname)) report.blockedRequests.push(url.pathname);
    return url.origin === base && !/\/api\/v1\//.test(url.pathname)
      ? route.continue() : route.fulfill({ status: 204, body: '' });
  });
  await context.addInitScript(() => {
    window.__shareCopies = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      async writeText(value) { if (window.__denyClipboard) throw new Error('denied'); window.__shareCopies.push(value); }
    } });
    window.addEventListener('pageshow', event => { window.__lastPageShowPersisted = event.persisted; });
    if (!localStorage.getItem('share-test-seeded')) {
      localStorage.setItem('share-test-seeded','1');
      localStorage.setItem('master-lab-favorites-v1',JSON.stringify([{subject:'数学',question:'二次函数 y=x²-4x+3，求顶点。',title:'原有收藏',detail:'原有详情',visual:'math'}]));
      localStorage.setItem('masterLab.gradeLevel','junior');
      localStorage.setItem('masterLab.tutorSessions.v1',JSON.stringify({version:1,activeId:'share-test-session',sessions:[
        {id:'share-test-session',context:null,messages:[{role:'user',text:'分享前的提问',id:'m-share-test'}],draft:'分享前保留的草稿',quotes:[],updatedAt:1}
      ]}));
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(base + '/' + suffix);
  await page.waitForFunction(() => window.MasterLabShare && window.MasterLabAITutor);
  return page;
}
function snapshot() {
  return { subject: state.subject, grade: state.gradeLevel, question: state.generatedQuestion,
    template: activeGenericTemplate()?.id || (state.subject === '物理' ? state.physicsTemplate : state.subject),
    params: state.subject === '生物' ? [] : [state.p1, state.p2],
    metrics: [...elements.metricValues].map(element => element.textContent),
    mode: state.subject === '生物' ? [state.cellType, state.cellLevel, state.cellLevelLocked] : null };
}
async function open(page, payload) {
  await page.evaluate(async value => { location.hash = value; await MasterLabShare.restoreRoute(); }, typeof payload === 'string' ? payload : hash(payload));
}
async function copy(page) {
  const count = await page.evaluate(() => __shareCopies.length);
  await page.evaluate(() => MasterLabShare.copy());
  const copies = await page.evaluate(() => __shareCopies);
  assert.equal(copies.length, count + 1, await page.locator('#toast').textContent());
  return copies.at(-1);
}

try {
  const sender = await fresh(1366, '?unknown=discard&key=fixture-secret#old');
  const receiver = await fresh();
  await receiver.evaluate(() => {
    localStorage.setItem('masterLab.gradeLevel', 'junior');
    localStorage.setItem('share-test-favorites', 'keep-favorites');
    localStorage.setItem('share-test-chat', 'keep-chat');
  });
  const stored = await receiver.evaluate(() => ({ ...localStorage }));
  await sender.locator('#shareButton').click();
  assert.equal(await sender.evaluate(() => __shareCopies.length), 0);
  mark('uncreated experiment cannot be shared');
  // Exercise real generation and copy controls once; the bank below skips only the cosmetic overlay.
  await sender.locator('#questionInput').fill('汽车以20m/s的初速度行驶，刹车加速度大小为5m/s²，求停止距离。');
  await sender.locator('#generateButton').click();
  await sender.waitForFunction(() => state.hasGenerated && !document.querySelector('#generateButton').classList.contains('loading'));
  await sender.evaluate(() => { clearReasoningTimers(); clearDemoTimers(); });
  await sender.locator('#shareButton').click();
  const first = await sender.evaluate(() => __shareCopies.at(-1));
  assert.equal(new URL(first).search, ''); assert.equal(first.split('#').length, 2);
  const A = decode(first);
  await open(receiver, A);
  assert.deepEqual(await receiver.evaluate(snapshot), await sender.evaluate(snapshot));
  assert.equal(await receiver.evaluate(() => physicsBrakeModel().stopDistance), 40);
  const afterStorage = await receiver.evaluate(() => ({ ...localStorage }));
  for (const [key,value] of Object.entries(stored)) {
    if (key==='masterLab.tutorSessions.v1') {
      const sessions=JSON.parse(afterStorage[key]).sessions;
      const saved=sessions.find(session=>session.id==='share-test-session');
      assert.equal(saved?.draft,'分享前保留的草稿');
      assert.ok(saved.messages.some(message=>message.text==='分享前的提问'));
    } else assert.equal(afterStorage[key],value,key);
  }
  mark('UI share restores braking result 40m; URL query stripped and receiver storage unchanged');
  await sender.evaluate(() => { elements.ranges[0].value = 25; updateParameters(); resetExperiment(); });
  const adjusted = decode(await copy(sender));
  await open(receiver, adjusted);
  assert.equal(await receiver.evaluate(() => physicsBrakeModel().stopDistance), 62.5);
  mark('current parameters restore 62.5m instead of original-question defaults');

  const bank = JSON.parse(await readFile(resolve(root, 'server/eval/local-template-bank.json'), 'utf8'));
  await sender.evaluate(() => { showGenerationOverlay = async () => {}; });
  for (const [index, item] of bank.filter(item => item.expect === 'local').entries()) {
    await sender.evaluate(async item => {
      state.gradeLevel = item.level || 'senior';
      const ok = await generateExperiment({ questionOverride: item.q, allowAiFallback: false });
      if (!ok) throw new Error('Local generation failed: ' + item.q);
      clearReasoningTimers(); clearDemoTimers(); resetExperiment();
    }, item);
    const expected = await sender.evaluate(snapshot);
    let url;
    try { url = await copy(sender); await open(receiver, decode(url));
      assert.deepEqual(await receiver.evaluate(snapshot), expected);
      assert.equal(await receiver.evaluate(() => state.time), 0);
      assert.equal(await receiver.evaluate(() => state.playing), false);
    } catch (error) { throw new Error(`Bank ${index + 1} ${item.q}: ${error.message}`, { cause: error }); }
    report.roundTrips.push({ question: item.q, template: expected.template, grade: expected.grade });
  }
  mark(`${report.roundTrips.length} accepted question-bank cases round trip across all local templates`);
  const representatives = new Map();
  for (const item of bank.filter(item => item.expect === 'local')) {
    const key = (item.templateId || item.kind) + '/' + (item.level || 'senior');
    if (!representatives.has(key)) representatives.set(key,item);
  }
  report.adjustedTemplates = [];
  for (const [key,item] of representatives) {
    await sender.evaluate(async item => {
      state.gradeLevel=item.level||'senior'; await generateExperiment({questionOverride:item.q,allowAiFallback:false});
      clearReasoningTimers(); clearDemoTimers();
      if (state.subject==='生物') return;
      for (const input of elements.ranges) {
        if (input.disabled || Number(input.max)===Number(input.min)) continue;
        const step=Number(input.step)||1, value=Number(input.value), delta=value+step<=Number(input.max)?step:-step;
        input.value=String(value+delta); input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      clearReasoningTimers(); clearDemoTimers(); resetExperiment();
    },item);
    const expected = await sender.evaluate(snapshot);
    try { await open(receiver,decode(await copy(sender))); assert.deepEqual(await receiver.evaluate(snapshot),expected); }
    catch(error) { throw new Error('Adjusted '+key+': '+error.message,{cause:error}); }
    report.adjustedTemplates.push(key);
  }
  mark(`${report.adjustedTemplates.length} template/grade combinations also round trip after real slider input events`);
  const coilQuestion=bank.find(item=>item.expect==='local'&&item.kind==='solenoid').q;
  await sender.evaluate(async q=>{await generateExperiment({questionOverride:q,allowAiFallback:false});clearReasoningTimers();clearDemoTimers();},coilQuestion);
  for(const action of ['view','reverse','core']) {
    await sender.evaluate(action=>document.querySelector(`[data-solenoid-action="${action}"]`).click(),action);
    const data=decode(await copy(sender));await open(receiver,data);
    assert.deepEqual(decode(await copy(receiver)).mode,data.mode);
    assert.equal(await receiver.evaluate(()=>state.solenoidPaused),true);
  }
  mark('solenoid view, current direction and core controls restore exactly and start paused');
  const cellQuestion=bank.find(item=>item.expect==='local'&&item.kind==='biology').q;
  await sender.evaluate(async q=>{
    await generateExperiment({questionOverride:q,allowAiFallback:false});clearReasoningTimers();clearDemoTimers();
    document.querySelector('.cell-level-toggle button[data-level="senior"]').click();
    state.gradeLevel='junior';syncGradeSwitches();
  },cellQuestion);
  const cellPayload=decode(await copy(sender));await open(receiver,cellPayload);
  assert.deepEqual(await receiver.evaluate(snapshot),await sender.evaluate(snapshot));
  assert.equal(cellPayload.mode.locked,true);assert.equal(cellPayload.mode.level,'senior');assert.equal(cellPayload.grade,'junior');
  mark('independently locked cell explanation level survives a different global grade');

  const B = { ...A, question: '汽车以30m/s的初速度行驶，刹车加速度大小为5m/s²，求停止距离。', params: [30,5] };
  await open(receiver, A);
  await receiver.evaluate(() => { elements.ranges[0].value = 25; updateParameters(); });
  await open(receiver, '#/ai-tutor');
  await open(receiver, Object.fromEntries(Object.entries(A).reverse()));
  assert.equal(await receiver.evaluate(() => state.p1), 25);
  await open(receiver, B); assert.equal(await receiver.evaluate(() => state.p1), 30);
  await open(receiver, A); assert.equal(await receiver.evaluate(() => state.p1), 20);
  await open(receiver, '#%E5%8C%96%E5%AD%A6');
  assert.equal(await receiver.evaluate(() => state.hasGenerated), false);
  await open(receiver, A); assert.equal(await receiver.evaluate(() => state.p1), 20);
  await receiver.evaluate(() => applyWaitingState('数学', { presetQuestion: true }));
  await receiver.evaluate(() => MasterLabShare.restoreRoute());
  assert.equal(await receiver.evaluate(() => state.subject), '物理');
  mark('AI round trip and reordered equivalent data preserve edits; A→B→A and waiting→A reimport');
  await receiver.evaluate(() => { elements.ranges[0].value = 25; updateParameters(); });
  await receiver.reload(); await receiver.waitForFunction(() => state.hasGenerated && state.p1 === 20);
  mark('real refresh reimports initial shared parameters');

  const invalid = [
    ['version', {...A,v:2}], ['unknown field', {...A,secret:'x'}], ['missing', {...A,mode:undefined}],
    ['wrong type', {...A,params:['20',5]}], ['range', {...A,params:[1e9,5]}],
    ['null',null], ['array',[]], ['template', {...A,template:'__proto__'}],
    ['subject mismatch', {...A,subject:'生物'}], ['mode mismatch', {...A,mode:{braking:'friction'}}],
    ['question length', {...A,question:'中'.repeat(2001)}], ['question whitespace', {...A,question:' '+A.question}],
    ['invalid base64', prefix+'!'], ['invalid UTF8', prefix+Buffer.from([0xff]).toString('base64url')],
    ['invalid JSON', prefix+Buffer.from('{broken').toString('base64url')],
    ['noncanonical bits', hash(A).slice(0,-1)+'_'], ['missing payload', '#/share'], ['bytes 8001', prefix+Buffer.alloc(8001,32).toString('base64url')],
    ['full URL length', prefix+'A'.repeat(13000)]
  ];
  const variants = [
    ['solenoid','线圈匝数', data => {data.params[1]+=0.5;}],
    ['math','锁定缩放', data => {data.params[1]=2;}],
    ['efficiency','机械效率越界', data => {data.params=[1,10000];}],
    ['friction','离散接触面', data => {data.params[1]=1.5;}]
  ];
  for (const [template,label,mutate] of variants) {
    const item=bank.find(item => item.expect==='local' && (item.templateId||item.kind)===template && (template!=='friction'||item.level==='junior'));
    await sender.evaluate(async item => {state.gradeLevel=item.level||'senior';await generateExperiment({questionOverride:item.q,allowAiFallback:false});clearReasoningTimers();clearDemoTimers();},item);
    const payload=decode(await copy(sender));mutate(payload);invalid.push([label,payload]);
  }
  // 8000 bytes passes the transport limit but still fails payload shape; 8001 fails the byte limit.
  invalid.push(['bytes 8000',prefix+Buffer.from('"'+'a'.repeat(7998)+'"').toString('base64url')]);
  for (const [label,value] of invalid) {
    const previous = await receiver.evaluate(snapshot);
    await open(receiver,value);
    assert.deepEqual(await receiver.evaluate(snapshot),previous,label);
    assert.match(await receiver.locator('#parseFeedback').textContent(),/未恢复|恢复失败/,label);
    if(label==='bytes 8000') assert.doesNotMatch(await receiver.locator('#parseFeedback').textContent(),/数据过长/);
    if(label==='bytes 8001') assert.match(await receiver.locator('#parseFeedback').textContent(),/数据过长/);
  }
  mark(`${invalid.length} malformed, type, version, template, range and length cases fail without replacing experiment`);
  await open(receiver,A);
  await receiver.evaluate(() => { __denyClipboard=true; });
  const n = await receiver.evaluate(() => __shareCopies.length);
  await receiver.evaluate(() => MasterLabShare.copy());
  assert.equal(await receiver.evaluate(() => __shareCopies.length),n);
  assert.match(await receiver.locator('#toast').textContent(),/复制失败/);
  await receiver.evaluate(() => { __denyClipboard=false; document.querySelector('#generateButton').classList.add('loading'); });
  await receiver.evaluate(() => MasterLabShare.copy());
  assert.equal(await receiver.evaluate(() => __shareCopies.length),n);
  await receiver.evaluate(() => document.querySelector('#generateButton').classList.remove('loading'));
  mark('clipboard denial and generation-in-progress never report copied');

  for (const subject of ['物理','化学','数学','生物']) {
    await open(receiver,'#'+encodeURIComponent(subject));
    assert.equal(await receiver.evaluate(() => state.subject),subject);
    assert.equal(await receiver.evaluate(() => state.hasGenerated),false);
  }
  await open(receiver,'#/share-extra'); assert.equal(await receiver.evaluate(() => state.hasGenerated),false);
  await receiver.evaluate(() => MasterLabShare.restoreRoute());
  mark('four old subject routes and similar non-share route remain distinct');
  // Actual cross-document BFCache restore. This context avoids CDP request routing, which can disable caching.
  const cacheContext=await browser.newContext({viewport:{width:1366,height:950},reducedMotion:'reduce'});
  contexts.push(cacheContext);
  await cacheContext.addInitScript(base=>{window.MASTER_LAB_API_URL=base;window.addEventListener('pageshow',event=>{window.__cachePersisted=event.persisted;});},base);
  const cachePage=await cacheContext.newPage();cachePage.on('pageerror',error=>report.errors.push(error.message));
  await cachePage.goto(base+'/'+hash(A));await cachePage.waitForFunction(()=>state.hasGenerated);
  await cachePage.evaluate(()=>{elements.ranges[0].value=25;updateParameters();});
  await cachePage.goto(base+'/share-test-away');await cachePage.evaluate(()=>history.back());
  await cachePage.waitForFunction(()=>window.MasterLabShare && window.__cachePersisted===true && state.hasGenerated);
  report.bfcachePersisted=await cachePage.evaluate(()=>window.__cachePersisted);
  assert.equal(report.bfcachePersisted,true,'actual BFCache return must be observed');
  assert.equal(await cachePage.evaluate(()=>state.p1),25);
  await cachePage.evaluate(()=>applyWaitingState('化学',{presetQuestion:true}));
  await cachePage.goto(base+'/share-test-away');await cachePage.evaluate(()=>history.back());
  await cachePage.waitForFunction(()=>window.MasterLabShare && window.__cachePersisted===true && state.hasGenerated&&state.p1===20);
  assert.equal(await cachePage.evaluate(()=>window.__cachePersisted),true);
  mark('real BFCache keeps active edits and reimports after leaving the share context');
  const mobile = await fresh(390, hash(A));
  await mobile.waitForFunction(() => state.hasGenerated);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth+2),false);
  await mobile.screenshot({path:resolve(output,'share-mobile.png'),fullPage:true});
  await open(receiver,A);
  await receiver.screenshot({path:resolve(output,'share-desktop.png'),fullPage:true});
  mark('fresh mobile deep link and desktop layout render without horizontal overflow');
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.blockedRequests,[],'sharing never initiates AI requests');
  report.passed=true;
} catch (error) { report.passed=false; report.failure=error.stack; console.error(error); process.exitCode=1; }
finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,roundTrips:report.roundTrips.length,output}));
  for(const context of contexts) await context.close();
  await browser.close(); server.close();
}
