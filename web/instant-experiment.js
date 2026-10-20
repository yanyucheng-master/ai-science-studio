(() => {
  'use strict';
  const Core = window.MasterLabInstantScene;
  const panel = document.querySelector('#instantExperiment');
  if (!Core || !panel) return;
  const $ = id => document.getElementById(id);
  const status = $('instantStatus'), title = $('instantTitle'), canvas = $('instantCanvas'), details = $('instantDetails');
  let serial = 0, pending = null, current = null, favoriteWasDisabled = false;
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
  const getContext = () => current ? { mode: 'question', subject: current.scene.subject, originalQuestion: current.question, templateId: '', parameters: {}, deterministicResult: {}, formula: '', currentStep: '程序推导的静态受力方向示意图，不按比例，不用于力的大小或倾角计算。' } : null;
  function paragraphs(heading, values) {
    if (!values.length) return;
    const section = document.createElement('section'), h = document.createElement('h3'); h.textContent = heading; section.append(h);
    for (const value of values) { const p = document.createElement('p'); p.textContent = Core.displayText(value); window.ScienceFormula?.enhance(p); section.append(p); }
    details.append(section);
  }
  function present(scene, question) {
    const strict = Core.validateDiagram(scene, question);
    if (!strict.ok) throw new Error(strict.code);
    const { checked } = window.MasterLabInstantRenderer.draw(canvas, strict.scene, question);
    current = { scene: checked.scene, question };
    title.textContent = Core.displayText(scene.title); window.ScienceFormula?.enhance(title); details.replaceChildren();
    paragraphs('题目给定', scene.givens);
    paragraphs('受力依据与解释', [...scene.basis, ...scene.explanation]);
    paragraphs('示意边界', ['图形位置、颜色和长度用于表达关系，不作为测量结果；本图不是精确仿真。', ...scene.assumptions]);
    status.textContent = `图示已生成 · ${checked.checks.geometry} 项几何约束已核对；箭头长度不表示力的大小。`;
    panel.hidden = false; panel.setAttribute('aria-busy', 'false');
    $('instantCancel').hidden = true; $('instantActions').hidden = false;
    document.body.classList.add('instant-active');
    const favorite = $('promptFavoriteButton');
    if (favorite && !favorite.dataset.instantDisabled) { favoriteWasDisabled = favorite.disabled; favorite.disabled = true; favorite.dataset.instantDisabled = 'true'; }
    contextEvent(); panel.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  // Both the conversation and the experiment entry use this local, fail-closed path.
  // There is deliberately no provider request, credential lookup or coordinate fallback.
  async function createScene(question, { signal, aiConditions } = {}) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!window.MasterLabInclineDiagram) return { mode: 'explanation', code: 'DECLINED', reason: '受力图模块尚未就绪，保留文字讲解。' };
    const result = window.MasterLabInclineDiagram.createCompetitionScene(question, { aiConditions });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return result;
  }
  function settleFallback(code, message, reason = '') {
    canvas.replaceChildren(); details.replaceChildren(); current = null;
    title.textContent = '科学示意图'; status.textContent = message;
    panel.hidden = true; document.body.classList.remove('instant-active');
    return { mode: 'explanation', code, ...(reason ? { reason } : {}) };
  }
  async function generate(question, subject = '') {
    dismiss(); const requestSerial = serial;
    const controller = new AbortController(); pending = controller;
    panel.hidden = false; title.textContent = '正在核对斜面受力条件';
    status.textContent = '正在核对题意并推导受力方向。';
    panel.setAttribute('aria-busy', 'true'); canvas.replaceChildren(); details.replaceChildren();
    $('instantCancel').hidden = false; $('instantActions').hidden = true;
    const started = Date.now();
    try {
      const result = await createScene(question, { signal: controller.signal });
      if (requestSerial !== serial || controller.signal.aborted) return { mode: 'cancelled' };
      if (result.mode !== 'instant') return settleFallback(result.code || 'DECLINED', `暂不绘图：${result.reason}`, result.reason);
      present(result.scene, question);
      return { mode: 'instant', durationMs: Date.now() - started };
    } catch (error) {
      if (requestSerial !== serial || controller.signal.reason === 'user') return { mode: 'cancelled' };
      return settleFallback(error.message, '本次受力图未通过核对，正在转入文字导师；原实验已保留。');
    } finally {
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
  window.MasterLabInstant = Object.freeze({ generate, createScene, dismiss, getContext });
})();
