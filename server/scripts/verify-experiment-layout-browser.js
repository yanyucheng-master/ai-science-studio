// Offline layout acceptance for the shared experiment card and its existing controls.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDrawingHarness } from './helpers/drawing-browser.js';

const harness = await createDrawingHarness(process.env.EXPERIMENT_LAYOUT_OUTPUT || 'artifacts/experiment-layout');
const layouts = [];
const selected = name => !process.env.EXPERIMENT_LAYOUT_FILTER || new RegExp(process.env.EXPERIMENT_LAYOUT_FILTER).test(name);
const viewports = [{ width: 1366, height: 768 }, { width: 820, height: 900 }, { width: 390, height: 844 }, { width: 1265, height: 638 }];
const playable = [
  { id: 'brake', subject: '物理', level: 'senior' },
  { id: 'projectile', subject: '物理', level: 'senior' },
  { id: 'boardSlider', subject: '物理', level: 'senior' },
  { id: 'feCuSO4', subject: '化学', level: 'junior' },
  { id: 'caco3Hcl', subject: '化学', level: 'junior' },
  { id: 'naclSolution', subject: '化学', level: 'junior' },
  { id: 'pythagoras', subject: '数学', level: 'junior' },
  { id: 'arithmeticSum', subject: '数学', level: 'senior' },
  { id: 'unitCircle', subject: '数学', level: 'senior' }
];
const statics = [
  ...['solenoid', 'circuit', 'lever', 'lens', 'buoyancy', 'friction', 'lampPower', 'parallelCircuit', 'planeMirror', 'seriesCircuit', 'heatBalance', 'liquidPressure', 'efficiency', 'sound'].map(id => ({ id, subject: '物理', level: 'junior' })),
  ...['quadratic', 'linearSystem', 'tangent'].map(id => ({ id, subject: '数学', level: id === 'tangent' ? 'senior' : 'junior' })),
  ...['cellPlant', 'cellAnimal'].map(id => ({ id, subject: '生物', level: 'junior' }))
];
async function settle(page) {
  await page.waitForFunction(() => state.hasGenerated && !document.querySelector('#generateButton').classList.contains('loading') && !document.querySelector('#generationOverlay').classList.contains('show'), null, { polling: 20 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#generationOverlay')).opacity === '0', null, { polling: 20 });
  await page.evaluate(() => { clearReasoningTimers(); clearDemoTimers(); });
  await page.waitForFunction(() => document.querySelector('.experiment-card').getBoundingClientRect().top <= 32, null, { polling: 20 });
}
async function choose(page, item) {
  await page.locator(`.grade-switch:visible [data-grade="${item.level}"]`).first().click();
  await page.locator(`.subject-tab[data-subject="${item.subject}"]`).click();
  await page.locator('#physicsPresetToggle').click();
  const option = page.locator(`.preset-option[data-preset="${item.id}"]`);
  if (await option.getAttribute('hidden') === null) await option.click();
  else await page.locator('#physicsPresetToggle').click();
  await page.locator('#generateButton').click();
  await settle(page);
  assert.equal(await page.evaluate(() => state.presetKey), item.id, 'the actual menu must select the intended experiment');
}
async function geometry(page, name, { transport = true, fullscreen = false } = {}) {
  const actual = await page.evaluate(() => {
    const card = document.querySelector('.experiment-card'), scene = document.querySelector('#scene'), bar = document.querySelector('.transport'), params = document.querySelector('.parameters');
    const box = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const visible = node => getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    const b = box(bar);
    const visibleChildren = [...bar.children].filter(visible);
    const lab = scene.querySelector('.chemistry-lab-scene');
    return {
      viewport: { width: innerWidth, height: innerHeight }, pageWidth: document.documentElement.scrollWidth,
      header: box(card.querySelector('.card-header')), bar: b, scene: box(scene), params: box(params),
      barVisible: visible(bar), paramsVisible: visible(params),
      buttonsInside: visibleChildren.every(node => { const r = box(node); return r.x >= b.x - 1 && r.right <= b.right + 1 && r.y >= b.y - 1 && r.bottom <= b.bottom + 1; }),
      timecodesReadable: [...bar.querySelectorAll('.timecode')].every(node => node.scrollWidth <= node.clientWidth + 1),
      unique: ['playButton', 'resetButton', 'timeline', 'playbackButton', 'fullscreenButton'].every(id => document.querySelectorAll('#' + id).length === 1) && document.querySelectorAll('.transport').length === 1,
      immersive: card.classList.contains('immersive-mode'),
      chemistryClipped: Boolean(lab && scene.scrollHeight > scene.clientHeight + 1 && getComputedStyle(scene).overflowY === 'hidden'),
      initialValues: [state.p1, state.p2], template: activeGenericId() || state.physicsTemplate, subject: state.subject
    };
  });
  layouts.push({ name, ...actual });
  assert.equal(actual.unique, true, `${name}: one functional control set`);
  assert.equal(actual.barVisible, transport, `${name}: preserve playback visibility`);
  assert.ok(actual.pageWidth <= actual.viewport.width + 1, `${name}: no horizontal page overflow`);
  if (actual.paramsVisible) assert.ok(actual.params.y >= actual.scene.bottom - 1, `${name}: parameters remain after the original scene`);
  if (transport) {
    assert.ok(actual.header.bottom <= actual.bar.y + 1, `${name}: toolbar follows the complete title/question`);
    assert.ok(actual.bar.bottom <= actual.scene.y + 1, `${name}: toolbar precedes the scene`);
    assert.ok(actual.bar.y >= -1 && actual.bar.bottom <= actual.viewport.height + 1, `${name}: entire toolbar is in the initial viewport`);
    assert.ok(actual.buttonsInside && actual.timecodesReadable, `${name}: controls and values are not clipped`);
  }
  if (fullscreen) {
    assert.equal(actual.immersive, true, `${name}: fullscreen mode entered`);
    assert.equal(actual.chemistryClipped, false, `${name}: long chemistry content remains scrollable rather than clipped`);
  }
  return actual;
}
async function playControls(page, row) {
  await page.locator('#playButton').click();
  await page.waitForFunction(() => state.playing && state.time > .1, null, { polling: 20 });
  await page.locator('#playButton').click();
  assert.equal(await page.evaluate(() => state.playing), false);
  await page.locator('#timeline').fill('50');
  const middle = await page.evaluate(() => ({ time: state.time, duration: duration(), playing: state.playing }));
  assert.ok(Math.abs(middle.time / middle.duration - .5) < .001 && !middle.playing, 'scrubbing pauses at the requested progress');
  await page.locator('#playButton').click();
  await page.waitForFunction(t => state.playing && state.time > t, middle.time, { polling: 20 });
  await page.locator('#playButton').click();
  const previousRate = await page.evaluate(() => state.playbackRate);
  await page.locator('#playbackButton').click();
  assert.notEqual(await page.evaluate(() => state.playbackRate), previousRate, 'speed control retains its listener');
  await page.locator('#resetButton').click();
  assert.deepEqual(await page.evaluate(() => [state.time, state.playing]), [0, false], 'reset returns to the paused start');
  row.playback = { play: true, pause: true, resume: true, scrub: true, rate: true, reset: true };
}

try {
  for (const viewport of viewports) for (const item of playable) {
    const name = `${item.id}-${viewport.width}x${viewport.height}`;
    if (!selected(name)) continue;
    await harness.run(name, async ({ page, row }) => {
      await page.setViewportSize(viewport);
      assert.equal(await page.locator('.transport').isVisible(), false, 'waiting state hides playback');
      await choose(page, item);
      row.layout = await geometry(page, name);
      if (item.subject === '数学' && viewport.width <= 820) {
        await page.evaluate(() => {
          window.__layoutTouch = [];
          document.addEventListener('pointerdown', event => window.__layoutTouch.push({ type: event.pointerType, id: event.target.id }));
        });
        await page.locator('#playButton').tap();
        await page.waitForFunction(() => state.playing && state.time > .1, null, { polling: 20 });
        await page.locator('#playButton').tap();
        assert.equal(await page.evaluate(() => state.playing), false, 'real touch pauses the shared player');
        const range = page.locator('.parameters input[type=range]:not(:disabled)').first();
        await range.scrollIntoViewIfNeeded();
        const before = await range.inputValue();
        const bounds = await range.boundingBox();
        await page.touchscreen.tap(bounds.x + bounds.width * .72, bounds.y + bounds.height / 2);
        assert.notEqual(await range.inputValue(), before, 'touch on the actual range changes a comparison parameter');
        await page.locator('#resetButton').tap();
        assert.equal(await range.inputValue(), before, 'touch reset restores the original parameter');
        const touches = await page.evaluate(() => window.__layoutTouch);
        assert.ok(touches.length >= 4 && touches.every(event => event.type === 'touch'), 'events originate from a touch device');
        row.touch = { sharedPlayPause: true, nativeRange: true, originalReset: true, pointerTypes: [...new Set(touches.map(event => event.type))] };
        await page.locator('.experiment-card').scrollIntoViewIfNeeded();
        await page.evaluate(() => focusExperimentCard());
        await page.waitForFunction(() => document.querySelector('.experiment-card').getBoundingClientRect().top <= 32, null, { polling: 20 });
      }
      if (['caco3Hcl', 'naclSolution', 'brake'].includes(item.id)) await page.screenshot({ path: resolve(harness.output, `${name}-viewport.png`) });
      await playControls(page, row);
      await page.locator('#fullscreenButton').click();
      await geometry(page, name + '-fullscreen', { fullscreen: true });
      if (item.id === 'naclSolution' && viewport.width === 390) await page.screenshot({ path: resolve(harness.output, name + '-fullscreen-viewport.png') });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.experiment-card').evaluate(node => node.classList.contains('immersive-mode')), false);
      row.fullscreen = { entered: true, escaped: true };
      assert.equal(row.mapping + row.tutor + row.scenes, 0, 'layout and local playback do not need an AI request');
    }, { width: viewport.width, touch: item.subject === '数学' && viewport.width <= 820 });
  }
  for (const item of statics) {
    if (!selected('static-' + item.id)) continue;
    await harness.run('static-' + item.id, async ({ page, row }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await choose(page, item);
      row.layout = await geometry(page, 'static-' + item.id, { transport: false });
      if (item.subject === '数学') {
        row.graphLabels = await page.evaluate(() => {
          const svg = document.querySelector('#mathGraph'), bounds = svg.getBoundingClientRect();
          const labels = [...svg.querySelectorAll('[data-label],.math-point-label,.math-function-label,.math-line-label')].map(node => {
            const box = node.getBoundingClientRect();
            return { text: node.textContent, x: box.x, y: box.y, right: box.right, bottom: box.bottom };
          });
          return { labels, inside: labels.every(box => box.x >= bounds.x - 1 && box.y >= bounds.y - 1 && box.right <= bounds.right + 1 && box.bottom <= bounds.bottom + 1) };
        });
        assert.ok(row.graphLabels.labels.length > 0 && row.graphLabels.inside, 'existing function-graph labels remain present and inside the mobile plot');
        if (item.id !== 'tangent') {
          const labels = row.graphLabels.labels;
          for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            assert.ok(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1, 'placed formula and point labels do not overlap');
          }
        }
      }
      assert.equal(row.layout.paramsVisible, item.subject !== '生物', 'preserve each template parameter-panel visibility');
      const range = page.locator('.parameters input[type=range]:visible:not(:disabled)').first();
      if (await range.count()) {
        const spec = await range.evaluate(node => ({ value: Number(node.value), min: Number(node.min), max: Number(node.max), step: Number(node.step) || 1 }));
        const next = spec.value + spec.step <= spec.max ? spec.value + spec.step : spec.value - spec.step;
        if (next >= spec.min && next <= spec.max) { await range.fill(String(next)); assert.ok(Math.abs(Number(await range.inputValue()) - next) < 1e-6); }
        row.parameterInput = true;
      }
      assert.equal(row.mapping + row.tutor + row.scenes, 0);
    }, { width: 390 });
  }
  for (const viewport of [viewports[0], viewports[3]]) {
    if (!selected('demo-' + viewport.width)) continue;
    await harness.run('demo-' + viewport.width, async ({ page, row }) => {
      await page.setViewportSize(viewport);
      await page.evaluate(() => clearTimeout(state.autoDemoTimer));
      await page.locator('#questionInput').fill('一辆汽车以20m/s的速度行驶，刹车加速度大小为5m/s²，求刹车距离。');
      await page.locator('#generateButton').click(); await settle(page);
      row.layout = await geometry(page, 'demo-' + viewport.width);
      await playControls(page, row);
    }, { width: viewport.width, search: '?demo=1' });
  }
  if (selected('transitions-favorites-and-share')) await harness.run('transitions-favorites-and-share', async ({ page, row, context }) => {
    await page.setViewportSize(viewports[0]);
    await choose(page, playable.find(item => item.id === 'caco3Hcl'));
    await page.locator('#favoriteButton').click();
    await choose(page, statics.find(item => item.id === 'quadratic'));
    await geometry(page, 'transition-to-math', { transport: false });
    await page.locator('#favoriteList [data-favorite-id]').first().click();
    assert.equal(await page.locator('.transport').isVisible(), false, 'favorite question waits for generation');
    await page.locator('#generateButton').click(); await settle(page);
    await geometry(page, 'favorite-restored');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__layoutShare = value; } } }));
    await page.locator('#shareButton').click();
    await page.waitForFunction(() => typeof window.__layoutShare === 'string');
    const shared = await page.evaluate(() => window.__layoutShare);
    const receiver = await context.newPage();
    await receiver.goto(shared);
    await receiver.waitForFunction(() => state.hasGenerated && !document.querySelector('#generateButton').classList.contains('loading'));
    await receiver.locator('.experiment-card').scrollIntoViewIfNeeded();
    await receiver.evaluate(() => focusExperimentCard());
    await receiver.waitForFunction(() => document.querySelector('.experiment-card').getBoundingClientRect().top <= 32, null, { polling: 20 });
    await geometry(receiver, 'share-restored');
    await receiver.close();
    await choose(page, playable.find(item => item.id === 'brake'));
    await geometry(page, 'transition-back-to-physics');
    row.restore = { favorite: true, share: true, subjects: true };
    assert.equal(row.mapping + row.tutor + row.scenes, 0);
  });
} finally {
  await writeFile(resolve(harness.output, 'layouts.json'), JSON.stringify(layouts, null, 2) + '\n');
  await harness.close();
}
