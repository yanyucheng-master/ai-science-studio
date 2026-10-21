// Mapping precedes local diagrams; unsupported diagrams use text, never AI coordinates.
import assert from 'node:assert/strict';
import { createDrawingHarness, generate, inclineQuestion, unsupportedQuestion, mappedQuestion } from './helpers/drawing-browser.js';
const harness = await createDrawingHarness(process.env.INSTANT_BROWSER_OUTPUT || 'artifacts/instant-routing');
const cases = [
  ['gateway-mapped', 'mapped', false, mappedQuestion],
  ['personal-mapped', 'mapped', true, mappedQuestion],
  ['gateway-offline', 'offline', false, mappedQuestion],
  ['gateway-local-fallback', 'local-fallback', false, mappedQuestion],
  ['gateway-local-diagram', 'none', false, inclineQuestion],
  ['personal-local-diagram', 'none', true, inclineQuestion],
  ['gateway-unsupported-text', 'none', false, unsupportedQuestion],
  ['personal-unsupported-text', 'none', true, unsupportedQuestion]
];
try {
  for (const [name, mapping, personal, question] of cases) await harness.run(name, async ({ page, row }) => {
    assert.equal(await page.evaluate(q => window.planLocalExperiment(q).ok, question), false, 'fixture must reach the mapping route');
    await generate(page, question);
    assert.equal(row.mapping, 1, 'health hints cannot suppress the actual mapping attempt');
    assert.equal(row.order[0], 'mapping');
    assert.ok(row.mappingQuestion.includes(question), 'mapping must retain the original question');
    if (mapping === 'mapped') {
      assert.equal(row.tutor, 0);
      const state = await page.evaluate(() => ({ generated: state.hasGenerated, template: state.physicsTemplate,
        original: state.generatedQuestion, parameters: [state.p1, state.p2], context: window.MasterLabAIHost.getContext() }));
      assert.equal(state.generated, true); assert.equal(state.template, 'brake'); assert.equal(state.original, question);
      assert.deepEqual(state.parameters, [20, 5]); assert.equal(state.context.originalQuestion, question);
    } else if (mapping === 'none' && question === inclineQuestion) {
      await page.waitForSelector('#instantCanvas svg');
      assert.equal(row.tutor, 0);
      assert.equal(await page.evaluate(() => window.MasterLabInstant.getContext().originalQuestion), question);
      assert.deepEqual(await page.locator('#instantCanvas .instant-force-label').allTextContents(), ['G', 'FN', 'f']);
      return;
    } else if (mapping === 'none') {
      assert.equal(row.tutor, 1); assert.deepEqual(row.order, ['mapping', 'tutor']);
      assert.match(await page.locator('.ai-message.assistant').innerText(), /保留文字讲解/);
      await page.locator('#aiTutorBackButton').click();
      assert.match(await page.locator('#parseFeedback').textContent(), /仅支持.*单物块粗糙斜面/);
    } else {
      assert.equal(row.tutor, 0, 'unavailable mapping must not silently start another paid request');
      assert.equal(await page.locator('#questionInput').inputValue(), question);
      assert.match(await page.locator('#parseFeedback').textContent(), /密钥|暂不可用/);
    }
    assert.equal(await page.locator('#instantExperiment').isVisible(), false, 'no stale building panel');
    assert.equal(await page.locator('#instantCanvas svg').count(), 0);
  }, { mapping, personal });
} finally { await harness.close(); }
