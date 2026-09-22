import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const sandbox = {};
vm.runInNewContext(await readFile(new URL('../../web/science-motion.js', import.meta.url), 'utf8'), sandbox);
const { createClock, projectileGeometry, reactionAt, currentSpeed } = sandbox.ScienceMotion;
const near = (a, b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≈ ${b}`);
function projectile(speed, height) {
  const gravity=9.8, fallTime=Math.sqrt(2*height/gravity);
  return { speed, height, gravity, fallTime, range:speed*fallTime, verticalSpeed:gravity*fallTime };
}

test('projectile starts horizontally, lands exactly, and vectors use one scale', () => {
  for (const speed of [2,12,30]) for (const height of [5,20,80]) {
    const m=projectile(speed,height), start=projectileGeometry(m,0), end=projectileGeometry(m,999);
    near(start.vy,0); near(start.point.x,80); near(end.point.y,200);
    near(end.point.x-start.point.x,m.range*end.scale);
    near(end.point.y-start.point.y,m.height*end.scale);
    near(start.dx,end.dx); near(end.dy/end.dx,end.vy/end.vx);
    near(end.t,m.fallTime);
  }
});

test('equal-time ghosts have equal horizontal gaps and increasing vertical gaps', () => {
  const m=projectile(12,20), g=projectileGeometry(m,1.2);
  assert.equal(g.ghosts.length,7);
  const dy=[];
  for(let i=1;i<g.ghosts.length;i++) {
    near(g.ghosts[i].x-g.ghosts[i-1].x,12*.2*g.scale);
    dy.push(g.ghosts[i].y-g.ghosts[i-1].y);
  }
  assert.ok(dy.every((v,i)=>!i||v>dy[i-1]));
});

test('changing projectile parameters changes geometry without distorting angle', () => {
  const a=projectileGeometry(projectile(12,20),1),b=projectileGeometry(projectile(24,20),1);
  assert.notEqual(a.point.x,b.point.x);
  near(a.point.y,b.point.y);
  assert.notEqual(a.dy/a.dx,b.dy/b.dx);
});

test('reaction: no product before contact; mass and molar balances at every phase', () => {
  for(const [feMol,cuso4Mol] of [[.1,.2],[.2,.1],[.2,.2]]) {
    const model={feMol,cuso4Mol,reactedMol:Math.min(feMol,cuso4Mol)};
    for(const p of [0,.1,.15,.25,.5,.9,1,2]) {
      const r=reactionAt(model,p);
      near(r.feLeftMol+r.producedMol,feMol);
      near(r.cuso4Left+r.producedMol,cuso4Mol);
      near(r.producedMass,r.producedMol*64);
      if(p<=.15) near(r.producedMol,0);
      if(p>=.9) {near(r.extent,1); near(Math.min(r.feLeftMol,r.cuso4Left),0);}
    }
  }
});

test('reaction completion is independent of yield and stays stopped after exhaustion', () => {
  const model={feMol:.1,cuso4Mol:.2,reactedMol:.1};
  const a=reactionAt(model,.9), b=reactionAt(model,1);
  near(a.producedMass,6.4); near(b.extent,1); near(b.cuso4Left,.1);
  assert.equal(a.producedMol,b.producedMol);
});

test('conventional current: zero current stops; speed increases monotonically', () => {
  assert.equal(currentSpeed(0),0);assert.equal(currentSpeed(-1),0);
  const speeds=[.01,.1,.5,1,4].map(currentSpeed);
  assert.ok(speeds.every((s,i)=>!i||s>speeds[i-1]));
});

test('RAF ownership: repeated start, reentrant render, pause/resume and completion', () => {
  let next=0, active=true, clock;
  const queue=new Map(), deltas=[];
  clock=createClock({ request:cb=>{queue.set(++next,cb);return next;},cancel:id=>queue.delete(id),
    active:()=>active,render:dt=>{deltas.push(dt);clock.reconcile();} });
  const tick=t=>{const [id,cb]=queue.entries().next().value;queue.delete(id);cb(t);};
  clock.reconcile();clock.reconcile();assert.equal(queue.size,1);
  tick(100);tick(116);assert.equal(queue.size,1);near(deltas[1],.016);
  active=false;clock.reconcile();assert.equal(queue.size,0);assert.equal(clock.pending,false);
  active=true;clock.reconcile();tick(5000);near(deltas.at(-1),0);
  tick(9000);near(deltas.at(-1),.06);
  clock.stop();assert.equal(queue.size,0);
});
