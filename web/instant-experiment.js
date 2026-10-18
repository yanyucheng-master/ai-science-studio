(() => {
  'use strict';
  const Core = window.MasterLabInstantScene;
  const panel = document.querySelector('#instantExperiment');
  if (!Core || !panel) return;
  const $ = id => document.getElementById(id);
  const status = $('instantStatus'), title = $('instantTitle'), canvas = $('instantCanvas'), details = $('instantDetails');
  let serial = 0, pending = null, current = null, cache = null, favoriteWasDisabled = false;
  const contextEvent = () => window.dispatchEvent(new CustomEvent('masterlab:context-changed', { detail: { reason: 'instant' } }));
  function dismiss() {
    serial++; pending?.abort('user'); pending = null; current = null;
    panel.hidden = true; document.body.classList.remove('instant-active');
    if ($('instantZoom').open) $('instantZoom').close();
    if ($('promptFavoriteButton')?.dataset.instantDisabled) {
      $('promptFavoriteButton').disabled = favoriteWasDisabled;
      delete $('promptFavoriteButton').dataset.instantDisabled;
    }
  }
  const getContext = () => current ? { mode: 'question', subject: current.scene.subject, originalQuestion: current.question, templateId: '', parameters: {}, deterministicResult: {}, formula: '', currentStep: 'AI 即时生成的静态科学示意图，不按比例，不是精确仿真。' } : null;
  function paragraphs(heading, values) {
    if (!values.length) return;
    const section = document.createElement('section'), h = document.createElement('h3'); h.textContent = heading; section.append(h);
    for (const value of values) { const p = document.createElement('p'); p.textContent = Core.displayText(value); window.ScienceFormula?.enhance(p); section.append(p); }
    details.append(section);
  }
  function present(scene, question, metadata = {}) {
    const { checked } = window.MasterLabInstantRenderer.draw(canvas, scene, question);
    current = { scene: checked.scene, question };
    title.textContent = Core.displayText(scene.title); window.ScienceFormula?.enhance(title); details.replaceChildren();
    paragraphs('题目给定', scene.givens);
    paragraphs('科学依据与解释', [...scene.basis, ...scene.explanation]);
    paragraphs('示意边界', ['图形位置、颜色和长度用于表达关系，不作为测量结果；本图不是精确仿真。', ...scene.assumptions]);
    if (checked.results.length) paragraphs('程序复核的数值', checked.results.map(r => `${r.rule}：${Number(r.value.toPrecision(6))} ${r.unit}`));
    status.textContent = `${metadata.cached ? '已复用本次会话的图示' : '图示已生成'} · ${checked.checks.geometry} 项几何约束、${checked.checks.science} 项方向与模型检查、${checked.checks.calculations} 项数值复核；其余为 AI 定性解释`;
    panel.hidden = false; panel.setAttribute('aria-busy', 'false');
    $('instantCancel').hidden = true; $('instantActions').hidden = false;
    document.body.classList.add('instant-active');
    const favorite = $('promptFavoriteButton');
    if (favorite && !favorite.dataset.instantDisabled) { favoriteWasDisabled = favorite.disabled; favorite.dataset.instantDisabled = 'true'; favorite.disabled = true; }
    contextEvent(); panel.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  async function boundedJson(response) {
    if (!response.body) throw new Error('EMPTY_RESPONSE');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '', bytes = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 96000) throw new Error('RESPONSE_TOO_LARGE'); text += decoder.decode(value, { stream: true }); }
      text += decoder.decode(); return JSON.parse(text);
    } finally { await reader.cancel().catch(() => {}); }
  }
  async function request(question, key, config, signal) {
    const direct = Boolean(key);
    const response = await fetch(direct ? `${config.browserBase}/chat/completions` : `${config.gatewayBase}/api/v1/scene/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(direct ? Core.requestBody(question, config.model) : { question }), signal
    });
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new Error(`AI_HTTP_${response.status}`); }
    const payload = await boundedJson(response);
    if (!direct) return payload;
    if (payload?.choices?.[0]?.finish_reason !== 'stop') throw new Error('INCOMPLETE_RESPONSE');
    return { mode: 'instant', scene: JSON.parse(payload.choices[0].message.content) };
  }
  async function generate(question, subject = '') {
    dismiss(); const requestSerial = serial;
    const controller = new AbortController(); pending = controller;
    const config = window.MasterLabAITutor.sceneServiceConfig;
    let key = ''; try { key = (localStorage.getItem('masterLab.deepseekApiKey') || '').trim(); } catch { /* existing default gateway mechanism */ }
    panel.hidden = false; title.textContent = '正在构建科学示意图';
    status.textContent = '正在理解题意与绘图关系，通常需要数十秒。可以随时取消。';
    panel.setAttribute('aria-busy', 'true'); canvas.replaceChildren(); details.replaceChildren();
    $('instantCancel').hidden = false; $('instantActions').hidden = true;
    const started = Date.now();
    const timer = setTimeout(() => controller.abort('timeout'), Core.LIMITS.timeout + 5000);
    const progress = setInterval(() => { status.textContent = `正在生成并核查图示 · 已等待 ${Math.floor((Date.now() - started) / 1000)} 秒，可取消后修改题目。`; }, 1000);
    try {
      if (question.length > 2000) throw new Error('QUESTION_TOO_LONG');
      const signature = JSON.stringify([question, key, config]);
      const result = cache?.signature === signature && Date.now() - cache.time < 300000 ? { ...cache.value, cached: true } : await request(question, key, config, controller.signal);
      if (requestSerial !== serial || controller.signal.aborted) return { mode: 'cancelled' };
      if (result.mode !== 'instant') {
        status.textContent = result.code === 'DECLINED' ? `暂不绘图：${result.reason}` : '当前图示无法可靠生成，正在转入 AI 导师。';
        return { mode: 'explanation', code: result.code || 'DECLINED' };
      }
      present(result.scene, question, result);
      cache = { signature, value: { mode: 'instant', scene: current.scene }, time: Date.now() };
      return { mode: 'instant', durationMs: Date.now() - started };
    } catch (error) {
      if (requestSerial !== serial || controller.signal.reason === 'user') return { mode: 'cancelled' };
      canvas.replaceChildren(); current = null;
      status.textContent = controller.signal.reason === 'timeout' ? '图示生成超时，正在转入 AI 导师；原实验已保留。' : '本次图示未通过生成或校验，正在转入 AI 导师；原实验已保留。';
      return { mode: 'explanation', code: controller.signal.reason === 'timeout' ? 'AI_TIMEOUT' : error.message };
    } finally {
      clearTimeout(timer); clearInterval(progress);
      if (requestSerial === serial) { pending = null; panel.setAttribute('aria-busy', 'false'); $('instantCancel').hidden = true; }
    }
  }
  $('instantCancel').addEventListener('click', () => { dismiss(); window.MasterLabAIHost?.showToast('已取消图示生成，原实验仍然保留。'); });
  $('instantBack').addEventListener('click', () => { dismiss(); window.MasterLabAIHost?.restoreRetainedExperiment(); contextEvent(); });
  $('instantAsk').addEventListener('click', () => { if (current) window.MasterLabAITutor.explainQuestion(current.question, current.scene.subject); });
  $('instantExpand').addEventListener('click', () => {
    if (!current) return;
    const dialog = $('instantZoom'); dialog.showModal();
    try { window.MasterLabInstantRenderer.draw($('instantZoomCanvas'), current.scene, current.question); } catch { dialog.close(); }
    $('instantZoomRange').value = '100'; $('instantZoomCanvas').style.width = '100%';
  });
  $('instantZoomRange').addEventListener('input', event => { $('instantZoomCanvas').style.width = `${Number(event.target.value)}%`; });
  $('instantZoomClose').addEventListener('click', () => $('instantZoom').close());
  $('questionInput').addEventListener('input', () => { if (pending) dismiss(); });
  window.addEventListener('masterlab:context-changed', event => { if (event.detail?.reason !== 'instant') dismiss(); }, { capture: true });
  window.addEventListener('hashchange', () => { if (pending) dismiss(); });
  window.addEventListener('pagehide', dismiss);
  window.MasterLabInstant = Object.freeze({ generate, dismiss, getContext });
})();
