import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const b={console};b.window=b;
const root=new URL('../../web/',import.meta.url);
for(const name of ['biology-protocol-questions.js','physics-extra.js','biology-photosynthesis-core.js','biology-photosynthesis.js','biology-leaf-disks-core.js','biology-leaf-disks-questions.js','biology-leaf-disks.js'])if(existsSync(new URL(name,root)))vm.runInNewContext(await readFile(new URL(name,root),'utf8'),b);
const Q=b.MasterLabProtocolQuestions;
test('normalization maps errors back to original punctuation, unit and Unicode',()=>{
 const raw='  直径为０．６厘米，错误片段：<b>中文 & "引号"</b>。';const v=Q.sourceView(raw);
 assert.ok(v.text.startsWith('直径为0.6cm'));assert.equal(v.excerpt(v.text.indexOf('错误')),'错误片段：<b>中文 & "引号"</b>');
});
test('a clipped quote is still literal text, with codepoints kept intact',()=>{
 const raw='😀'.repeat(80)+'<img>';const v=Q.sourceView(raw),s=v.excerpt(0);assert.equal(Array.from(s).length,73);assert.ok(s.endsWith('…'));assert.equal(s.includes('\uFFFD'),false);
});
const cases=[...JSON.parse(await readFile(new URL('../eval/photosynthesis-review-cases.json',import.meta.url),'utf8')),...JSON.parse(await readFile(new URL('../eval/photosynthesis-numeric-boundary-cases.json',import.meta.url),'utf8'))];
for(const row of cases){const t=b.MASTER_LAB_TEMPLATES[row.kind==='junior'?'photosynthesis':'leafDisks'];if(!t)continue;test((row.id.startsWith('numeric-')?'numeric boundary regression ':'sealed independent review ')+row.kind+'/'+row.id,()=>{const p=t.parseQuestion(row.question);assert.equal(p.ok,row.expected,JSON.stringify({input:row.question,actual:p}));if(row.id==='numeric-comma-count')assert.ok(p.message.includes('3,0片'));if(p.ok&&row.kind==='senior')assert.deepEqual(Array.from(t.model(p.p1,p.p2,p.fixed).observedCounts),[null,null,null]);});}
