import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'spatial-door-')),file=join(dir,'bundle.mjs');
const bundle=await build({stdin:{contents:"export * as T from 'three';export * from './lib/door-geometry';export * from './lib/walk-world';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
await writeFile(file,bundle.outputFiles[0].text);const m=await import(pathToFileURL(file));await rm(dir,{recursive:true,force:true});const{T}=m;
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const opening=(patch={})=>({id:crypto.randomUUID(),name:'실내 문',kind:'door',x:0,bottom:0,width:900,height:2100,door:{hinge:'left',side:'positive',angle:90},...patch});
const node=(patch={})=>({id:'wall',kind:'partition',name:'파티션',x:0,y:0,z:0,rotation:0,width:5000,height:2900,depth:120,material:'plaster',faces:{},hidden:false,locked:false,openings:[opening()],...patch});
const scene=n=>({room:{width:20000,depth:20000,height:6000},nodes:[n]});
function mesh(box){const result=new T.Mesh(new T.BoxGeometry(box.width,box.height,box.depth),new T.MeshBasicMaterial());result.position.set(box.x,box.y,box.z);result.rotation.y=box.rotation*Math.PI/180;return result;}
function release(o){o.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});}
function localPoint(n,x,z){return new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),n.rotation*Math.PI/180).add(new T.Vector3(n.x,0,n.z));}
test('legacy centre-mounted doors remain unconfigured and retain old solid panel geometry',()=>{
 const o=opening({door:undefined}),n=node({openings:[o]});assert.equal(m.doorGeometry(n,o),null);
 const boxes=m.partitionObstacleBoxes(n),panel=boxes.find(b=>b.width===840&&b.height===2070),handle=boxes.find(b=>b.width===20&&b.height===120);
 assert.deepEqual(panel,{x:0,y:1035,z:0,width:840,height:2070,depth:25,rotation:0});near(handle.x,350);near(handle.z,22.5);near(handle.depth,20);
 assert.ok(m.walkBlocker(m.walkWorld(scene(n),1650),{x:0,z:0}));
});
test('passages and windows never acquire a moving leaf',()=>{for(const kind of ['passage','window'])assert.equal(m.doorGeometry(node(),opening({kind})),null);});
test('face-mounted closed leaves stay centred across the aperture and outside thick wall faces',()=>{
 for(const depth of [20,120,500])for(const hinge of ['left','right'])for(const side of ['positive','negative']){
  const o=opening({x:83.125,door:{hinge,side,angle:0}}),n=node({depth}),d=m.doorGeometry(n,o),sign=side==='positive'?1:-1;
  near(d.leaf.x,o.x);near(d.leaf.z*sign-d.leafDepth/2,depth/2+2);near(d.handle.z*sign-d.handle.depth/2,d.leaf.z*sign+d.leafDepth/2);
  near(d.leaf.width,840);near(d.leaf.height,2070);near(d.leafDepth,Math.min(depth*.4,25));
 }
});
test('left and right hinges swing into the chosen local side at 45, 90 and 120 degrees',()=>{
 for(const hinge of ['left','right'])for(const side of ['positive','negative'])for(const angle of [45,90,120]){
  const d=m.doorGeometry(node(),opening({door:{hinge,side,angle}})),sign=side==='positive'?1:-1;
  assert.ok((d.leaf.z-d.hinge.z)*sign>0);near(Math.hypot(d.leaf.x-d.hinge.x,d.leaf.z-d.hinge.z),420);
  const p=new T.Vector3(-d.dir*420,0,0).applyAxisAngle(new T.Vector3(0,1,0),d.yaw*Math.PI/180).add(new T.Vector3(d.leaf.x,0,d.leaf.z));near(p.x,d.hinge.x);near(p.z,d.hinge.z);
 }
});
test('handles remain on the outward leaf face near the free edge for every swing direction',()=>{
 for(const hinge of ['left','right'])for(const side of ['positive','negative'])for(const angle of [0,45,90,120]){
  const d=m.doorGeometry(node(),opening({door:{hinge,side,angle}})),v=new T.Vector3(d.handle.x-d.leaf.x,0,d.handle.z-d.leaf.z).applyAxisAngle(new T.Vector3(0,1,0),-d.yaw*Math.PI/180);
  near(v.x*d.dir,d.leafWidth/2-100);near(v.z*d.side,d.leafDepth/2+10);near(d.handle.rotation,d.leaf.rotation);
 }
});
test('parent yaw and translation compose with leaf and handle transforms independently',()=>{
 for(const rotation of [0,37,90,-143])for(const hinge of ['left','right'])for(const side of ['positive','negative']){
  const n=node({x:400.125,y:200.5,z:-730.25,rotation}),d=m.doorGeometry(n,opening({x:150.25,door:{hinge,side,angle:73}}));
  const parent=new T.Group();parent.position.set(n.x,n.y,n.z);parent.rotation.y=rotation*Math.PI/180;
  for(const b of [d.leaf,d.handle]){const child=mesh(b);parent.add(child);parent.updateMatrixWorld(true);const actual=new T.Vector3();child.getWorldPosition(actual);const world=m.toWorldDoorBox(n,b);near(actual.x,world.x);near(actual.y,world.y);near(actual.z,world.z);const a=new T.Box3().setFromObject(child),flat=mesh(world),f=new T.Box3().setFromObject(flat);for(const key of ['x','y','z']){near(a.min[key],f.min[key],1e-5);near(a.max[key],f.max[key],1e-5);}release(flat);}
  release(parent);
 }
});
test('physical bounds match the real body and open meshes including asymmetric protrusions',()=>{
 for(const rotation of [0,37,90,-143])for(const angle of [0,45,90,120]){
  const n=node({width:1400,depth:500,x:250.5,z:-880.25,rotation,openings:[opening({door:{hinge:'right',side:'negative',angle}})]}),d=m.doorGeometry(n,n.openings[0]);
  const parent=new T.Group();parent.position.set(n.x,n.y,n.z);parent.rotation.y=rotation*Math.PI/180;
  parent.add(mesh({x:0,y:n.height/2,z:0,width:n.width,height:n.height,depth:n.depth,rotation:0}),mesh(d.leaf),mesh(d.handle));
  const expected=new T.Box3().setFromObject(parent),actual=m.physicalNodeBounds(n);for(const key of ['x','y','z']){near(expected.min[key],actual.min[key],1e-5);near(expected.max[key],actual.max[key],1e-5);}release(parent);
 }
 const n=node(),b=m.physicalNodeBounds(n);assert.ok(b.max.z>n.depth/2+800);near(b.min.z,-n.depth/2);assert.ok(b.center.z>0);
});
test('ordinary nodes keep their declared rotated bounds without adding door geometry',()=>{
 const n=node({kind:'box',openings:undefined,width:1000,depth:300,height:800,x:500,y:200,z:-900,rotation:90}),b=m.physicalNodeBounds(n);near(b.min.x,350);near(b.max.x,650);near(b.min.z,-1400);near(b.max.z,-400);near(b.min.y,200);near(b.max.y,1000);
});
test('all configured leaves and handles contribute when a partition contains several doors',()=>{
 const n=node({openings:[opening({x:-1200}),opening({x:1200,door:{hinge:'right',side:'negative',angle:90}})]}),b=m.physicalNodeBounds(n);assert.ok(b.min.z< -900);assert.ok(b.max.z>900);const obstacles=m.partitionObstacleBoxes(n);assert.equal(obstacles.filter(o=>o.width===840&&o.depth===25).length,2);assert.equal(obstacles.filter(o=>o.width===20&&o.depth===20&&o.height===120).length,2);
});
test('90-degree doors allow walking through their true clear gap for every hand and parent yaw',()=>{
 for(const rotation of [0,37,90,-143])for(const hinge of ['left','right'])for(const side of ['positive','negative']){
  const n=node({x:500,z:-300,rotation,openings:[opening({door:{hinge,side,angle:90}})]}),w=m.walkWorld(scene(n),1650),a=localPoint(n,0,1400),b=localPoint(n,0,-1400),move=m.moveWalk(w,a,{x:b.x-a.x,z:b.z-a.z});near(move.point.x,b.x,1e-4);near(move.point.z,b.z,1e-4);assert.equal(move.blocked,null);
 }
});
test('closed and partly opened doors remain physical walking obstacles',()=>{
 for(const angle of [0,10,30])for(const side of ['positive','negative']){
  const n=node({openings:[opening({door:{hinge:'left',side,angle}})]}),w=m.walkWorld(scene(n),1650),move=m.moveWalk(w,{x:0,z:1600},{x:0,z:-3200});assert.ok(move.blocked);assert.ok(move.point.z> -1500);
 }
});
test('narrow openings, low frames, window sills and wall cells still block walking',()=>{
 for(const o of [opening({width:500}),opening({height:1800}),opening({kind:'window',bottom:100,height:2200,door:undefined})]){const n=node({openings:[o]}),w=m.walkWorld(scene(n),1650),move=m.moveWalk(w,{x:0,z:1400},{x:0,z:-2800});assert.ok(move.blocked);}
 const n=node(),w=m.walkWorld(scene(n),1650);assert.ok(m.walkBlocker(w,{x:1000,z:0}));
});
test('open leaves block their swung footprint instead of becoming invisible to collision',()=>{
 const n=node(),d=m.doorGeometry(n,n.openings[0]),w=m.walkWorld(scene(n),1650);assert.ok(m.walkBlocker(w,{x:d.leaf.x,z:d.leaf.z}));assert.ok(m.walkBlocker(w,{x:d.handle.x,z:d.handle.z}));assert.equal(m.walkBlocker(w,{x:0,z:0}),null);
});
test('hidden and overhead partitions do not leave stale walking obstacles',()=>{
 assert.equal(m.walkWorld(scene(node({hidden:true})),1650).obstacles.length,0);assert.equal(m.walkWorld(scene(node({y:2000})),1650).obstacles.length,0);
});
test('walking still respects room boundaries, valid eye heights and frame time caps',()=>{
 const w=m.walkWorld(scene(node({hidden:true})),1650);assert.equal(m.walkBlocker(w,{x:w.limitX+1,z:0}),'벽');for(const h of [1199,1901,NaN])assert.throws(()=>m.walkWorld(scene(node()),h));near(Math.hypot(...Object.values(m.walkDirection(0,1,0,1000,10))),50);
});
test('legacy thin and thick door handles stay within the old wall envelope',()=>{
 for(const depth of [20,120,500]){const n=node({depth,openings:[opening({door:undefined})]}),b=m.partitionObstacleBoxes(n),panel=b.find(o=>o.width===840&&o.height===2070),handle=b.find(o=>o.width===20&&o.height===120);near(handle.z-handle.depth/2,panel.depth/2);assert.ok(handle.z+handle.depth/2<=depth/2);}
});
console.log(`${checks} door geometry checks passed.`);
