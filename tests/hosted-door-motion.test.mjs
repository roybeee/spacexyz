import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'spatial-hosted-motion-')),file=join(dir,'bundle.mjs');
const bundle=await build({stdin:{contents:"export * as T from 'three';export * from './lib/scene-model';export * from './lib/scene-engine';export * from './lib/door-geometry';export * from './lib/door-motion';export * from './lib/hosted-geometry';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
await writeFile(file,bundle.outputFiles[0].text);const m=await import(pathToFileURL(file));await rm(dir,{recursive:true,force:true});const {T}=m;
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const opening=()=>({id:crypto.randomUUID(),name:'실내 문',kind:'door',x:0,bottom:0,width:900,height:2100,door:{hinge:'left',side:'positive',angle:90}});
const square=()=>{const s=m.initialScene();return{...s,room:{...s.room,width:6400,depth:6400,height:3200},nodes:[]};};
function fixture(host='front',patch={}){
 const s=square(),rotation={front:0,right:90,back:180,left:-90}[host],r=rotation*Math.PI/180;
 const wall={...m.createNode('partition','wall'),width:2400,height:2900,depth:120,x:2200*Math.sin(r),z:2200*Math.cos(r),rotation,openings:[opening()]};
 // Rotate the original front-wall fixture about room centre. The hosted frame geometry is symmetric along its width.
 const side=host==='left'||host==='right',along={front:158,right:-158,back:-158,left:158}[host];
 const window={...m.createNode('window','hosted'),name:'깊은 외벽 창틀',host,x:side?0:along,z:side?along:0,y:700,width:1200,height:1400,depth:1000,...patch};
 s.nodes=[wall,window];return m.validateScene(s);
}
const inspect=s=>m.inspectDoorMotion(s,'wall',s.nodes[0].openings[0].id,90);
test('deep hosted jambs block the moving internal door on all four external walls',()=>{for(const host of ['front','back','left','right']){const s=fixture(host),before=JSON.stringify(s),report=inspect(s);assert.equal(report.blocked,true,host);const hits=report.issues.filter(issue=>issue.type==='object'&&issue.nodeId==='hosted');assert.equal(hits.length,1,host);assert.equal(hits[0].name,'깊은 외벽 창틀');assert.equal(hits[0].lastAngle,90);assert.equal(report.issues.some(issue=>issue.type==='boundary'),false);assert.equal(JSON.stringify(s),before);}});
test('hosted jamb hit is an actual solid intersection, with hidden exclusion and locked inclusion',()=>{const s=fixture(),wall=s.nodes[0],leaf=m.toWorldDoorBox(wall,m.doorGeometry(wall,wall.openings[0]).leaf),solids=m.hostObstacleBoxes(s.nodes[1],s.room);assert.ok(solids.some(box=>m.boxesOverlap(leaf,box)));assert.equal(inspect(fixture('front',{hidden:true})).blocked,false);assert.equal(inspect(fixture('front',{locked:true})).blocked,true);});
test('empty depth beside a deep window pane is not treated as a solid envelope',()=>{for(const host of ['front','back','left','right']){const s=fixture(host),n=s.nodes[1];s.nodes[0].y=100;Object.assign(n,{x:0,z:0,y:0,width:2000,height:2800});m.validateScene(s);const report=inspect(s);assert.equal(report.blocked,false,JSON.stringify({host,issues:report.issues}));}});
test('hosted solids above the door leaf or too shallow to reach it stay clear',()=>{assert.equal(inspect(fixture('front',{y:2200,height:800})).blocked,false);assert.equal(inspect(fixture('front',{depth:100})).blocked,false);});
test('hosted helper refuses unhosted furniture instead of interpreting origin as a wall pose',()=>{assert.throws(()=>m.hostObstacleBoxes(m.createNode('partition','p'),square().room),/외벽/);assert.throws(()=>m.hostObstacleBoxes({...m.createNode('box','b'),host:'front'},square().room),/외벽/);});
function expectedBox(b){const r=b.rotation*Math.PI/180,hx=(Math.abs(Math.cos(r))*b.width+Math.abs(Math.sin(r))*b.depth)/2,hz=(Math.abs(Math.sin(r))*b.width+Math.abs(Math.cos(r))*b.depth)/2;return new T.Box3(new T.Vector3((b.x-hx)/1000,(b.y-b.height/2)/1000,(b.z-hz)/1000),new T.Vector3((b.x+hx)/1000,(b.y+b.height/2)/1000,(b.z+hz)/1000));}
test('every hosted frame panel divider and handle matches actual engine world geometry',()=>{for(const kind of ['door','window'])for(const host of ['front','back','left','right'])for(const depth of [20,1000]){
 const s=square(),n={...m.createNode(kind,'hosted'),host,x:['front','back'].includes(host)?321.25:0,z:['left','right'].includes(host)?-231.75:0,y:kind==='door'?0:650.125,width:1234.5,height:1800.25,depth};s.nodes=[n];
 const e=Object.create(m.SceneEngine.prototype);Object.assign(e,{data:s,root:new T.Group(),material(id){return new T.MeshStandardMaterial({color:m.materials.find(mat=>mat.id===id).color});}});const g=e.buildNode(n);g.updateMatrixWorld(true);
 try{const actual=g.children.filter(child=>child instanceof T.Mesh),boxes=m.hostObstacleBoxes(n,s.room);assert.equal(actual.length,boxes.length);for(let i=0;i<actual.length;i++){const a=new T.Box3().setFromObject(actual[i]),b=expectedBox(boxes[i]);for(const bound of ['min','max'])for(const axis of ['x','y','z'])near(a[bound][axis],b[bound][axis]);}}
 finally{g.traverse(child=>{child.geometry?.dispose();if(child.material)for(const mat of Array.isArray(child.material)?child.material:[child.material])mat.dispose();});}
}});
console.log(`${checks} hosted-door-motion checks passed.`);
