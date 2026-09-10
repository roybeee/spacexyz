import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * from './lib/assemblies';export * from './lib/scene-model';export * from './lib/selection';export * from './lib/design-variants';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name)}const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),id=()=>crypto.randomUUID();
const empty=()=>({...m.initialScene(),nodes:[]});
const sample=()=>{const s=empty();s.nodes=[{...m.createNode('box','a',-800.25,300.5),y:180.25,rotation:-45,finish:{textureId:id(),scale:730,rotation:30},faceFinishes:{'body:0':{textureId:null}},locked:true},{...m.createNode('chair','b',1200,0),y:400.75,rotation:375}];return s};
await test('capture normalizes a floor pivot and preserves original height, yaw and per-face images',()=>{
 const s=sample(),before=JSON.stringify(s),a=m.captureAssembly(s,['a','b'],'Store kit'),b=m.groupBounds(a.nodes);
 near(b.center.x,0);near(b.center.z,0);near(b.min.y,0);near(a.elevation,180.25);near(a.nodes[1].y,220.5);assert.equal(a.nodes[1].rotation,15);assert.equal(a.nodes[0].locked,false);assert.equal(a.nodes[0].faceFinishes['body:0'].textureId,null);assert.equal(a.nodes[0].finish.scale,730);assert.equal(JSON.stringify(s),before);
});
await test('placement follows Three yaw, preserves pair distances and remains independently editable',()=>{
 const s=sample(),a=m.captureAssembly(s,['a','b'],'Kit'),target=empty(),original=JSON.stringify(a),delta={x:0,y:a.elevation,z:0,rotation:90},inserted=m.insertAssembly(target,a,delta),nodes=inserted.scene.nodes;
 for(let i=0;i<2;i++){near(nodes[i].x,a.nodes[i].z);near(nodes[i].z,-a.nodes[i].x);near(nodes[i].y,s.nodes[i].y);assert.notEqual(nodes[i].id,a.nodes[i].id);assert.equal(nodes[i].hidden,false);}
 near(Math.hypot(nodes[0].x-nodes[1].x,nodes[0].z-nodes[1].z),Math.hypot(s.nodes[0].x-s.nodes[1].x,s.nodes[0].z-s.nodes[1].z));nodes[0].faceFinishes['body:0'].textureId=id();assert.equal(JSON.stringify(a),original);assert.equal(target.nodes.length,0);
});
await test('capture rejects missing, duplicate, excessive, hosted and hidden selections',()=>{
 const s=sample();for(const ids of [[],['a','a'],['missing'],Array.from({length:31},(_,i)=>String(i))])assert.throws(()=>m.captureAssembly(s,ids,'bad'));
 s.nodes[0].hidden=true;assert.throws(()=>m.captureAssembly(s,['a'],'bad'),/숨긴/);s.nodes=[m.createNode('window','window')];assert.throws(()=>m.captureAssembly(s,['window'],'bad'),/문·창문/);
 const a=m.builtinAssemblies()[0];a.nodes[0].x+=10;assert.throws(()=>m.validateAssembly(a),/기준/);
});
await test('all built-in sets place without internal overlap and anchors preserve exact dimensions',()=>{
 const s=empty();for(const a of m.builtinAssemblies())for(const rotation of [0,90,180,270,360])for(const edge of ['center','back','left','right','front']){
  const p={...m.assemblyAnchor(s,a,rotation,edge),y:a.elevation,rotation},result=m.insertAssembly(s,a,p);assert.equal(result.overlaps.length,0);assert.deepEqual(result.scene.nodes.map(n=>[n.width,n.height,n.depth]),a.nodes.map(n=>[n.width,n.height,n.depth]));
 }
 const fit=empty();fit.room.width=2400;fit.room.depth=2400;const a=m.captureAssembly({...fit,nodes:[{...m.createNode('box','fit'),width:2400,depth:2400}]},['fit'],'Fit');for(const rotation of [0,90,180,360])m.insertAssembly(fit,a,{...m.assemblyAnchor(fit,a,rotation,'right'),y:0,rotation});
});
await test('oversized, too high, invalid and ID-colliding placements reject the entire insertion',()=>{
 const s=empty(),a=m.builtinAssemblies()[1],before=JSON.stringify(s);s.room.width=2400;assert.throws(()=>m.insertAssembly(s,a,{x:0,y:0,z:0,rotation:0}),/경계/);assert.throws(()=>m.assemblyAnchor(s,a,0,'back'),/들어가지/);
 s.room.width=7200;for(const p of [{x:0,y:2700,z:0,rotation:0},{x:NaN,y:0,z:0,rotation:0},{x:0,y:-1,z:0,rotation:0},{x:0,y:0,z:0,rotation:361}])assert.throws(()=>m.insertAssembly(s,a,p));
 for(const factory of [()=> 'same',()=> 'floor'])assert.throws(()=>m.insertAssembly(s,a,{x:0,y:0,z:0,rotation:0},factory));assert.equal(JSON.stringify(s),before);
});
await test('combined node, model and image caps apply with original scene unchanged',()=>{
 const s=empty(),a=m.builtinAssemblies()[0];s.nodes=Array.from({length:300},(_,i)=>m.createNode('box',`box-${i}`));assert.throws(()=>m.insertAssembly(s,a,{x:0,y:0,z:0,rotation:0}));assert.equal(s.nodes.length,300);
 s.nodes=Array.from({length:20},(_,i)=>({...m.createNode('box',`model-${i}`),kind:'model',assetId:id()}));const modelKit=m.captureAssembly({...empty(),nodes:[{...m.createNode('box','one'),kind:'model',assetId:id()}]},['one'],'Model');assert.throws(()=>m.insertAssembly(s,modelKit,{x:0,y:0,z:0,rotation:0}),/20개/);
 s.nodes=Array.from({length:8},(_,i)=>({...m.createNode('box',`image-${i}`),finish:{textureId:id()}}));const imageKit=m.captureAssembly({...empty(),nodes:[{...m.createNode('box','one'),finish:{textureId:id()}}]},['one'],'Image');assert.throws(()=>m.insertAssembly(s,imageKit,{x:0,y:0,z:0,rotation:0}),/8개/);
});
await test('reported overlaps include new elements and leave pre-existing collisions out',()=>{
 const s=empty();s.nodes=[m.createNode('box','old-a',-2000,-2000),m.createNode('box','old-b',-2000,-2000),m.createNode('box','old-c')];const a=m.captureAssembly({...empty(),nodes:[m.createNode('box','new')]},['new'],'one'),out=m.insertAssembly(s,a,{x:0,y:0,z:0,rotation:0});assert.equal(out.overlaps.length,1);assert.equal(out.overlaps[0].a,'old-c');assert.ok(out.ids.includes(out.overlaps[0].b));
});
await test('inserted sets survive JSON and design restoration without changing other project state',()=>{
 let s=empty();s=m.saveVariant(s,'before');const a=m.builtinAssemblies()[0],out=m.insertAssembly(s,a,{x:0,y:0,z:0,rotation:90});assert.deepEqual(out.scene.variants,s.variants);const after=m.saveVariant(out.scene,'after'),saved=JSON.parse(JSON.stringify(after));assert.equal(m.restoreVariant(saved,saved.variants[0].id).nodes.length,0);assert.deepEqual(m.restoreVariant(saved,saved.variants[1].id).nodes,out.scene.nodes);
});
console.log(`${checks} assembly checks passed.`);
