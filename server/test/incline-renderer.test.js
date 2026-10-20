import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Renderer from '../../web/instant-scene-renderer.js';
import Incline from '../../web/incline-diagram.js';
const bank=JSON.parse(await readFile(new URL('../eval/tutor-diagram-bank.json',import.meta.url),'utf8'));
const segments=scene=>scene.objects.flatMap(o=>o.from?[[o.from,o.to]]:o.points?o.points.map((p,i)=>[p,o.points[(i+1)%o.points.length]]):[]);
for(const row of bank.filter(r=>r.expect==='draw'))test('direct label geometry: '+row.id,()=>{
  const scene=Incline.createScene(row.q).scene,lines=segments(scene),placed=[];
  for(const arrow of scene.objects.filter(o=>o.type==='arrow')){
    const d=arrow.to.map((v,i)=>v-arrow.from[i]),length=Math.hypot(...d),direction=d.map(v=>v/length);
    const measure=(x,y)=>[x-10,y-9,x+10,y+9];
    for(const scale of [.6,1,1.2]){
      const result=Renderer.placeLabel({tip:arrow.to,direction},placed,lines,{scale,measure});
      assert.ok(result.box.every(Number.isFinite));
      const projected=[[0,1],[0,3],[2,1],[2,3]].map(([x,y])=>(result.box[x]-arrow.to[0])*direction[0]+(result.box[y]-arrow.to[1])*direction[1]);
      assert.ok(Math.min(...projected)*scale>=11.99,'label must be beyond the arrowhead');
      assert.ok(lines.every(([a,b])=>!Renderer.segmentHitsBox(a,b,result.box,3/scale)),'label must avoid line segments');
      assert.ok(placed.every(b=>!Renderer.boxesOverlap(b,result.box,3/scale)));
    }
    placed.push(Renderer.placeLabel({tip:arrow.to,direction},placed,lines,{scale:1,measure}).box);
  }
});
test('label collisions move sideways and impossible layouts fail closed',()=>{
  const label={tip:[100,100],direction:[0,-1]},measure=(x,y)=>[x-12,y-9,x+12,y+9];
  const first=Renderer.placeLabel(label,[],[],{scale:1,measure});
  const second=Renderer.placeLabel(label,[first.box],[],{scale:1,measure});
  assert.equal(Renderer.boxesOverlap(first.box,second.box,3),false);
  assert.notEqual(first.position[0],second.position[0]);
  const blocked=Array.from({length:401},(_,i)=>[[-1000,i-200],[1000,i-200]]);
  assert.throws(()=>Renderer.placeLabel(label,[],blocked,{scale:1,measure}),/LABEL_COLLISION/);
});
test('renderer refuses types without a supported layout',()=>{
  const raw=Incline.createScene(bank[0].q).scene;
  assert.throws(()=>Renderer.draw({},raw,'请画出串联电路图。'),/UNSUPPORTED_DIAGRAM/);
});

test('data labels avoid whole solid regions as well as their boundary lines',()=>{
  const polygon=[[0,0],[100,0],[100,100],[0,100]];
  assert.equal(Renderer.boxHitsPolygon([20,20,30,30],polygon),true,'text fully inside a solid must collide');
  assert.equal(Renderer.boxHitsPolygon([-10,-10,110,110],polygon),true,'a box containing the whole solid must collide');
  assert.equal(Renderer.boxHitsPolygon([110,20,130,30],polygon),false);
  assert.equal(Renderer.boxHitsPolygon([101,20,120,30],polygon,3),true,'respect a visible gap');
  const label={tip:[50,50],direction:[0,-1]},measure=(x,y)=>[x-20,y-7,x+20,y+7];
  const result=Renderer.placeLabel(label,[],[],{scale:1,measure,polygons:[polygon]});
  assert.equal(Renderer.boxHitsPolygon(result.box,polygon,3),false);
});
