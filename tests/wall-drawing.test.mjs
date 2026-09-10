import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'spatial-wall-tests-')),file=join(dir,'bundle.mjs');
const bundle=await build({stdin:{contents:"export * as T from 'three';export * from './lib/scene-model';export * from './lib/wall-drawing';export * from './lib/selection';export * from './lib/floor-plan';export * from './lib/design-variants';export * from './lib/underlay';export * from './lib/budget';export * from './lib/group-export';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
await writeFile(file,bundle.outputFiles[0].text);const m=await import(pathToFileURL(file));await rm(dir,{recursive:true,force:true});
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),uuid=()=>crypto.randomUUID();
const empty=()=>{const s=m.initialScene();return {...s,room:{...s.room,width:12000,depth:10000,height:3200},nodes:[]};};
const point=(x,z)=>({x,z}),request=(points=[point(-1000,-1000),point(1000,-1000),point(1000,1000)],extra={})=>({points,closed:false,name:'벽 구성',thickness:120,height:1200,material:'plaster',...extra});
const square=[point(-1000,-1000),point(1000,-1000),point(1000,1000),point(-1000,1000)];
test('generated centerline endpoints round trip in every quadrant and retain fractional coordinates',()=>{
 for(const [dx,dz] of [[1500.123,650.456],[-1500.123,650.456],[-1500.123,-650.456],[1500.123,-650.456],[0,1800.125],[0,-1800.125],[1800.125,0],[-1800.125,0]]){
  const a=point(-93.531,120.373),b=point(a.x+dx,a.z+dz),p=m.planWalls(empty(),request([a,b])),n=p.scene.nodes[0],r=n.rotation*Math.PI/180;
  near(n.x-Math.cos(r)*n.width/2,a.x);near(n.z+Math.sin(r)*n.width/2,a.z);near(n.x+Math.cos(r)*n.width/2,b.x);near(n.z-Math.sin(r)*n.width/2,b.z);near(n.width,Math.hypot(dx,dz));near(p.totalLength,n.width);
 }
});
test('single walls and multi-section groups retain standard editable partition behavior',()=>{
 const one=m.planWalls(empty(),request(square.slice(0,2),{material:'walnut',height:3200,thickness:240})).scene.nodes[0];
 assert.equal(one.group,undefined);assert.equal(one.kind,'partition');assert.equal(one.host,undefined);assert.equal(one.estimate,undefined);assert.deepEqual(one.faces,{});assert.equal(one.y,0);assert.equal(one.material,'walnut');assert.equal(one.height,3200);
 const p=m.planWalls(empty(),request()),groups=m.sceneGroups(p.scene);assert.equal(groups.length,1);assert.equal(groups[0].nodes.length,2);assert.equal(groups[0].name,'벽 구성');
 assert.deepEqual(new Set(m.selectionIds(m.chooseSelection(p.scene,null,{id:p.addedIds[1]}))),new Set(p.addedIds));
 const selected=m.chooseSelection(p.scene,null,{id:p.addedIds[0],face:'body:0'},false,groups[0].id);assert.equal(selected.face,'body:0');assert.equal(m.selectionIds(selected).length,1);
});
test('thickness fits exactly against all four inner wall faces and rejects any overflow',()=>{
 for(const [axis,edge] of [['x',-5940],['x',5940],['z',-4940],['z',4940]]){
  const center=edge-Math.sign(edge)*60,points=axis==='x'?[point(center,-1000),point(center,1000)]:[point(-1000,center),point(1000,center)];
  const p=m.planWalls(empty(),request(points)),b=m.groupBounds(p.scene.nodes);near(edge<0?b.min[axis]:b.max[axis],edge);
  const outside=points.map(p=>({...p,[axis]:p[axis]+Math.sign(edge)*.01}));assert.throws(()=>m.planWalls(empty(),request(outside)),/외곽.*벗어/);
 }
});
test('diagonal centerlines inside the room still reject a rotated corner beyond the inner wall',()=>{
 const s=empty(),points=[point(4000,3200),point(5900,4850)];assert.throws(()=>m.planWalls(s,request(points,{thickness:500})),/외곽/);
 const fit=m.planWalls(s,request([point(4000,3200),point(5500,4450)],{thickness:500}));assert.equal(fit.addedIds.length,1);
});
test('height and runtime numeric, enum and text errors reject before changing the source',()=>{
 const s=empty(),before=JSON.stringify(s);
 for(const extra of [{height:3201},{height:NaN},{height:99},{thickness:19},{thickness:501},{thickness:Infinity},{material:'missing'},{name:''},{name:'x'.repeat(66)},{closed:'yes'}])assert.throws(()=>m.planWalls(s,request(undefined,extra)));
 for(const p of [point(NaN,0),point(0,Infinity),point(30001,0)])assert.throws(()=>m.planWalls(s,request([point(0,0),p])));
 assert.equal(JSON.stringify(s),before);
});
test('path spans accept 100mm minimum and 20000mm maximum but reject short and long segments',()=>{
 m.validateWallPath([point(0,0),point(100,0)]);m.validateWallPath([point(-10000,0),point(10000,0)]);
 for(const length of [0,99.99,20000.01])assert.throws(()=>m.validateWallPath([point(0,0),point(length,0)]),/100/);
});
test('backtracking and adjacent retracing are rejected even at a closed-path seam',()=>{
 for(const points of [[point(0,0),point(2000,0),point(1000,0)],[point(0,0),point(1000,0),point(0,0)],[point(0,0),point(1000,1000),point(500,500)]])assert.throws(()=>m.validateWallPath(points),/되짚/);
 assert.throws(()=>m.validateWallPath([point(0,0),point(1000,0),point(1000,1000),point(500,0)],true),/되짚|교차/);
 assert.throws(()=>m.validateWallPath([point(0,0),point(2000,0),point(2000,1000),point(1000,1000),point(1000,0)],true),/되짚|교차/);
});
test('crossing, nonadjacent endpoint touching and collinear overlap are rejected',()=>{
 for(const points of [[point(0,0),point(2000,2000),point(0,2000),point(2000,0)],[point(0,0),point(2000,0),point(1000,1000),point(1000,0)],[point(0,0),point(2000,0),point(2000,1000),point(-1000,1000),point(-1000,0),point(1000,0)]])assert.throws(()=>m.validateWallPath(points),/교차/);
});
test('forward collinear segments, L corners, simple concave polygons and closed rectangles are valid',()=>{
 m.validateWallPath([point(0,0),point(1000,0),point(2000,0)]);
 for(const [points,closed] of [[request().points,false],[square,true],[[point(-2000,-2000),point(2000,-2000),point(0,0),point(2000,2000),point(-2000,2000)],true]]){
  const p=m.planWalls(empty(),request(points,{closed}));assert.equal(p.addedIds.length,points.length-(closed?0:1));
 }
 assert.throws(()=>m.validateWallPath(square.slice(0,2),true),/세 점/);
 assert.throws(()=>m.validateWallPath([point(0,0),point(2000,0),point(0,2000),point(2000,2000)],true),/교차/);
});
test('all intended adjacent corners including first-last closed seam are omitted from preview conflicts',()=>{
 const p=m.planWalls(empty(),request(square,{closed:true,thickness:300}));assert.equal(p.overlaps.length,0);assert.equal(m.collisions(p.scene).length,4);
 const l=m.planWalls(empty(),request());assert.equal(l.overlaps.length,0);assert.equal(m.collisions(l.scene).length,1);
});
test('a narrow U reports nonadjacent new wall overlap while preserving intended junctions',()=>{
 const p=m.planWalls(empty(),request([point(0,0),point(0,2000),point(100,2000),point(100,0)],{thickness:300}));
 assert.equal(p.overlaps.length,1);assert.deepEqual(new Set([p.overlaps[0].a,p.overlaps[0].b]),new Set([p.addedIds[0],p.addedIds[2]]));
});
test('preview reports only new furniture conflicts and honors hidden and vertically separated objects',()=>{
 const s=empty();s.nodes=[m.createNode('box','hit'),{...m.createNode('box','hidden'),hidden:true},{...m.createNode('pendant','above'),y:2400},m.createNode('box','old-a',3500,3500),m.createNode('box','old-b',3500,3500)];
 const p=m.planWalls(s,request([point(-1000,0),point(1000,0)]));assert.equal(p.overlaps.length,1);assert.ok([p.overlaps[0].a,p.overlaps[0].b].includes('hit'));
});
test('path limit is 30 actual sections for open and closed paths',()=>{
 const line=Array.from({length:31},(_,i)=>point(-3000+i*200,0));assert.equal(m.planWalls(empty(),request(line)).addedIds.length,30);
 const ring=count=>Array.from({length:count},(_,i)=>point(Math.cos(i*2*Math.PI/count)*3000,Math.sin(i*2*Math.PI/count)*3000));
 assert.equal(m.planWalls(empty(),request(ring(30),{closed:true})).addedIds.length,30);
 assert.throws(()=>m.planWalls(empty(),request(ring(31),{closed:true})),/30구간/);assert.throws(()=>m.validateWallPath([...line,point(3200,0)]));
});
test('300 node cap is atomic and unchanged furniture remains untouched',()=>{
 const s=empty();s.nodes=Array.from({length:299},(_,i)=>m.createNode('chair',`old-${i}`));const before=JSON.stringify(s);
 assert.equal(m.planWalls(s,request(square.slice(0,2))).scene.nodes.length,300);assert.throws(()=>m.planWalls(s,request()),/300개/);assert.equal(JSON.stringify(s),before);
});
test('new group and node IDs cannot alias existing elements or each other',()=>{
 const s=empty();s.nodes=[{...m.createNode('partition','old'),group:{id:uuid(),name:'기존'}}];const before=JSON.stringify(s);
 assert.throws(()=>m.planWalls(s,request(),()=> 'old'),/ID가 중복/);assert.throws(()=>m.planWalls(s,request(),()=> 'same'),/ID가 중복/);assert.throws(()=>m.planWalls(s,request(),uuid,()=>s.nodes[0].group.id),/그룹 ID/);assert.throws(()=>m.planWalls(s,request(),uuid,()=> 'bad'));
 for(const id of ['floor','back','front','left','right'])assert.throws(()=>m.planWalls(s,request(),()=>id),/ID가 중복/);assert.equal(JSON.stringify(s),before);
});
test('layers, underlay and existing cost data are preserved without copying estimates onto new walls',()=>{
 const s=empty(),layer={id:uuid(),name:'구획',color:'#112233'};s.layers=[layer];s.nodes=[{...m.createNode('chair','old'),estimate:{unitPrice:10000,note:'기존 단가'}}];s.budget={target:100000,extras:[]};s.underlay=m.newUnderlay({id:uuid(),name:'평면',metadata:{width:1000,height:500,mime:'image/png',bytes:1000}},s.room);
 const p=m.planWalls(s,request(undefined,{layerId:layer.id}));assert.deepEqual(p.scene.nodes[0],s.nodes[0]);assert.deepEqual(p.scene.budget,s.budget);assert.deepEqual(p.scene.underlay,s.underlay);assert.deepEqual(p.scene.layers,s.layers);assert.ok(p.scene.nodes.slice(1).every(n=>n.layerId===layer.id&&!n.estimate));
 assert.throws(()=>m.planWalls(s,request(undefined,{layerId:uuid()})),/레이어/);
});
test('pointer snapping preserves the exact constrained axis from fractional numeric entry',()=>{
 assert.deepEqual(m.snapWallPoint(point(123.4,-177.8),undefined,true,true),point(100,-200));
 const from=point(12.345,67.89);assert.deepEqual(m.snapWallPoint(point(1100,120),from,true,true),point(1100,67.89));assert.deepEqual(m.snapWallPoint(point(10,1000),from,true,true),point(12.345,1000));
 assert.deepEqual(m.snapWallPoint(point(123.456,789.123),from,false,false),point(123.456,789.123));
});
test('rotated underlay reference endpoints become walls at the same physical world positions',()=>{
 const s=empty(),u={...m.newUnderlay({id:uuid(),name:'도면',metadata:{width:1000,height:500}},s.room),width:4000,rotation:37,x:400,z:-200};
 const a=m.underlayPoint(u,[.2,.3]),b=m.underlayPoint(u,[.8,.3]),p=m.planWalls(s,request([a,b])),n=p.scene.nodes[0];near(n.rotation,37);near(n.width,2400);near(n.x,(a.x+b.x)/2);near(n.z,(a.z+b.z)/2);
});
test('preview acceptance preserves exact IDs and rejects changed scenes and identical other projects',()=>{
 const s=empty(),p=m.planWalls(s,request()),accepted=m.acceptWallPlan(s,p,9,9);assert.deepEqual(accepted,p.scene);assert.deepEqual(accepted.nodes.map(n=>n.id),p.addedIds);assert.equal(s.nodes.length,0);
 assert.throws(()=>m.acceptWallPlan(s,p,10,9),/프로젝트/);const changed=structuredClone(s);changed.name='변경';assert.throws(()=>m.acceptWallPlan(changed,p,9,9),/변경/);
});
test('JSON and independent design snapshots retain complete wall groups and before state',()=>{
 const s=m.saveVariant(empty(),'원래'),p=m.planWalls(s,request(square,{closed:true})),saved=m.saveVariant(p.scene,'구획');
 const json=m.validateScene(JSON.parse(JSON.stringify(saved)));assert.deepEqual(m.restoreVariant(json,json.variants[1].id).nodes,p.scene.nodes);assert.equal(m.restoreVariant(json,json.variants[0].id).nodes.length,0);assert.deepEqual(p.scene.variants,s.variants);
 const rows=m.planRows(p.scene);assert.equal(rows.length,4);assert.ok(rows.every(row=>row[2]==='파티션'));
});
test('GLB group hierarchy preserves the drawn centerline poses and physical section dimensions',()=>{
 const {T}=m,p=m.planWalls(empty(),request()),root=new T.Group();
 for(const n of p.scene.nodes){const mesh=new T.Mesh(new T.BoxGeometry(n.width/1000,n.height/1000,n.depth/1000),new T.MeshStandardMaterial());mesh.userData.nodeId=n.id;mesh.position.set(n.x/1000,n.height/2000,n.z/1000);mesh.rotation.y=n.rotation*Math.PI/180;root.add(mesh);}
 root.updateMatrixWorld(true);const matrices=root.children.map(n=>n.matrixWorld.clone());m.groupExportNodes(root,p.scene.nodes);assert.equal(root.children.length,1);const group=root.children[0];assert.equal(group.userData.furnitureGroupId,p.scene.nodes[0].group.id);assert.equal(group.children.length,2);group.children.forEach((child,i)=>assert.deepEqual(child.matrixWorld.elements,matrices[i].elements));
});
console.log(`${checks} wall-drawing checks passed.`);
