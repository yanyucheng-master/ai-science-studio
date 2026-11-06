import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const b={console};b.window=b;const root=new URL('../../web/',import.meta.url);
for(const name of ['biology-protocol-questions.js','physics-extra.js','biology-photosynthesis-core.js','biology-photosynthesis.js','biology-leaf-disks-core.js','biology-leaf-disks-questions.js','biology-leaf-disks.js'])if(existsSync(new URL(name,root)))vm.runInNewContext(await readFile(new URL(name,root),'utf8'),b);
const data=JSON.parse(await readFile(new URL('../eval/photosynthesis-separator-cases.json',import.meta.url),'utf8'));
for(const row of data.cases){const t=b.MASTER_LAB_TEMPLATES[row.templateId];if(!t)continue;
 test('separator/order strict parser and ownership '+row.id,()=>{
  const p=t.parseQuestion(row.question),a=t.protocolAssessment(row.question);
  assert.equal(p.ok,row.expected,JSON.stringify(p));assert.equal(t.protocolCandidate(row.question),true);
  assert.equal(a.parsed.ok,row.expected);assert.equal(a.ownership,row.expected?'complete':'confirmed');
  if(row.requiredMissing)assert.ok(p.message.includes(row.requiredMissing));
  if(p.ok){assert.equal(p.p1,1);assert.equal(p.p2,1);assert.equal(p.fixed.level,row.kind);}
 });
}
for(const[kind,f]of Object.entries(data.families)){const t=b.MASTER_LAB_TEMPLATES[f.id];if(!t)continue;
 test('literal question is the current built-in '+kind,()=>{const p=t.presetFor(t.level);assert.equal(t.question(p.p1,p.p2,p.fixed),data.cases.find(x=>x.kind===kind&&x.separator==='comma'&&x.mutation==='complete').question);});
 test('whole strict acceptance implies candidate across seeded condition orders '+kind,()=>{
  let seed=1701;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let n=0;n<12;n++){const parts=[...f.clauses];for(let i=parts.length-1;i>0;i--){const j=rand()%(i+1);[parts[i],parts[j]]=[parts[j],parts[i]];}
   for(const separator of ['，',' ','、','','\n；']){const q=[...parts,f.asks].join(separator)+'。';assert.equal(t.parseQuestion(q).ok,true,q);assert.equal(t.protocolAssessment(q).ownership,'complete');assert.equal(t.protocolCandidate(q),true);}
  }
 });
}
test('routing keeps numeric separators and cannot join quoted fragments into a condition',()=>{
 assert.equal(b.MasterLabProtocolQuestions.routingSource('3 0片'),'3 0片');
 const t=b.MASTER_LAB_TEMPLATES.photosynthesis;
 if(t)assert.equal(t.protocolAssessment('酒精“背景文字”水浴脱色').evidence.procedureCount,0);
});

const boundaries=JSON.parse(await readFile(new URL('../eval/photosynthesis-separator-boundaries.json',import.meta.url),'utf8'));
for(const row of boundaries)for(const id of ['photosynthesis','leafDisks']){const t=b.MASTER_LAB_TEMPLATES[id];if(!t)continue;test('explicit ownership boundary '+id+'/'+row.id,()=>{assert.equal(t.protocolAssessment(row.question).ownership,row.ownership?.[id]||(row.scope===id?'uncertain':'none'));});}
