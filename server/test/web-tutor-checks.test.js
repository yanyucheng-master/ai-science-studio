import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  findDeterministicTutorIssues,
  findMissingTutorCoverage,
  findTutorTopicMismatches,
  isTargetedTutorFollowUp,
  latestTutorQuestion,
  sanitizeTutorChatRequest
} from '../src/protocol.js';

// The browser's direct connection and the gateway must judge replies the same way.
const sandbox = {};
vm.runInNewContext(await readFile(new URL('../../web/tutor-checks.js', import.meta.url), 'utf8'), sandbox);
const checks = sandbox.MasterLabTutorChecks;

const induction = '质量0.20kg、长度0.50m的金属棒在磁场B=0.80T中运动，回路电阻R=2.0Ω，拉力F=1.0N，求a(v)。';
const requests = [
  { message: '请完整解答。', responseLevel: 'steps', context: { mode: 'question', originalQuestion: induction } },
  { message: '先给我一个提示', responseLevel: 'hint', context: { mode: 'question', originalQuestion: induction } },
  { message: '帮我检查：a(v)=(1.0-0.16v)/0.20', responseLevel: 'check', context: { mode: 'question', originalQuestion: induction } },
  { message: '出一道变式', responseLevel: 'variant', context: { mode: 'question', originalQuestion: induction } },
  { message: '【引用片段，仅作提问材料】\n1. AI 回答："加速度可能为负。"\n【本次问题】\n为什么这里加速度为负？', responseLevel: 'explain',
    history: [{ role: 'user', content: '请完整解答。' }, { role: 'assistant', content: 'a(v)=5-0.4v' }],
    context: { mode: 'question', originalQuestion: induction } },
  { message: '请完整解答，并判断是否发生相对滑动，求所需时间和产生的热量。', responseLevel: 'steps',
    context: { mode: 'question', originalQuestion: '小球沿圆形轨道运动，木板与滑块之间有摩擦。' } },
  { message: '我还是没懂，换一种说法', responseLevel: 'explain', history: [{ role: 'user', content: '为什么？' }],
    context: { mode: 'question', originalQuestion: '小球沿圆形轨道运动。' } }
];
const replies = [
  { mode: 'steps', summary: '', steps: ['金属棒受安培力。', 'a(v)=(1.0-0.16v)/0.20'], finalAnswer: 'a(v)=(1.0-0.16v)/0.20' },
  { mode: 'steps', summary: '', steps: ['金属棒受安培力 F=B²L²v/R。', 'a(v)=(1.0-0.08v)/0.20=5-0.4v'], finalAnswer: 'a(v)=5-0.4v' },
  { mode: 'hint', summary: '先写出安培力与速度的关系。', steps: [] },
  { mode: 'explain', summary: '你写的 a(v)=(1.0-0.16v)/0.20 漏了回路电阻。', steps: [] },
  { mode: 'explain', summary: '变式：若 R=4.0Ω，a(v)=5-0.2v。', steps: [] },
  { mode: 'steps', summary: '', steps: ['先分析受力。', '再列式。'], finalAnswer: null },
  { mode: 'explain', summary: '你卡在受力方向，还是把力代入公式这一步？', steps: [] }
];

test('browser checks match the gateway on every request and reply pair', () => {
  for (const raw of requests) {
    const request = sanitizeTutorChatRequest(raw);
    assert.equal(checks.latestQuestion(request), latestTutorQuestion(request));
    assert.equal(checks.isTargetedFollowUp(request), isTargetedTutorFollowUp(request));
    for (const reply of replies) {
      const label = `${raw.responseLevel} / ${reply.steps?.[1] || reply.summary}`;
      assert.deepEqual(Array.from(checks.topicMismatches(request, reply)), findTutorTopicMismatches(request, reply), `topic: ${label}`);
      assert.deepEqual(Array.from(checks.deterministicIssues(request, reply)), findDeterministicTutorIssues(request, reply), `numbers: ${label}`);
      assert.deepEqual(Array.from(checks.missingCoverage(request, reply)), findMissingTutorCoverage(request, reply), `coverage: ${label}`);
    }
  }
});
