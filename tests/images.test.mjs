import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export * as T from 'three';export * from './lib/image-assets';export * from './lib/image-textures';export * from './lib/scene-engine';export * from './lib/scene-model';export * from './lib/model-loader';export * from './lib/facade';export * from './lib/facade-mesh';export * from './lib/design-variants';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64')),{T}=m;
const png=readFileSync('tests/fixtures/material.png'),jpg=readFileSync('tests/fixtures/material.jpg');
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name)}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`),id=()=>crypto.randomUUID();
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise}};
const engine=()=>Object.assign(Object.create(m.SceneEngine.prototype),{modelCache:new Map(),imageCache:new Map(),pendingAssets:new Map(),assetErrors:[],assetEpoch:1,geometryKey:'one',disposed:false,root:new T.Group(),setSelection(){}});
await test('real PNG/JPEG fixtures are accepted; truncation, CRC, size and dimensions are rejected',()=>{
 assert.deepEqual(m.inspectImage(png),{width:4,height:2,mime:'image/png',bytes:png.length});assert.equal(m.inspectImage(jpg).mime,'image/jpeg');
 for(const bytes of [png.subarray(0,-3),jpg.subarray(0,-2),Buffer.from('<svg/>'),Buffer.alloc(m.IMAGE_LIMIT+1)])assert.throws(()=>m.inspectImage(bytes));
 const broken=Buffer.from(png);broken[45]^=1;assert.throws(()=>m.inspectImage(broken));assert.throws(()=>m.inspectImage(png,{bytes:1000,dimension:3,pixels:8}));
 // A valid zero-length IDAT before the original nonempty IDAT must not reject a decodable PNG.
 const empty=Buffer.from('000000004944415435af061e','hex');const at=png.indexOf(Buffer.from('IDAT'))-4;
 assert.equal(m.inspectImage(Buffer.concat([png.subarray(0,at),empty,png.subarray(at)])).width,4);
});
await test('image edits preserve inheritance, explicit removal, variants and legacy JSON',()=>{
 let s=m.initialScene();assert.deepEqual(m.imageReferences(m.validateScene(s)),[]);const node=s.nodes[0],image=id();
 s=m.editAppearance(s,{id:node.id},{finish:{textureId:image,scale:1000}},'object');
 assert.equal(m.nodeAppearance(s.nodes[0],'body:0').finish.textureId,image);
 s=m.editAppearance(s,{id:node.id,face:'body:0'},{finish:{textureId:null}},'face');
 assert.equal(m.nodeAppearance(s.nodes[0],'body:0').finish.textureId,null);assert.equal(m.nodeAppearance(s.nodes[0],'body:1').finish.textureId,image);
 s.facade=m.defaultFacade(s);s.facade.sign.logoId=id();s=m.saveVariant(s,'with images');const saved=s.variants[0].id;
 s=m.editAppearance(s,{id:node.id},{finish:{textureId:null}},'object');s.facade.sign.logoId=null;
 const restored=m.restoreVariant(m.validateScene(JSON.parse(JSON.stringify(s))),saved);assert.equal(restored.nodes[0].finish.textureId,image);assert.ok(restored.facade.sign.logoId);
 const model={...m.createNode('box','custom'),kind:'model',assetId:id(),finish:{textureId:image}};assert.equal(m.nodeAppearance(model,'mesh0:0').original,false);model.faceFinishes={'mesh0:0':{textureId:null}};assert.equal(m.nodeAppearance(model,'mesh0:0').original,true);
});
await test('all image references are counted even in hidden objects, inactive faces and disabled logos',()=>{
 const s=m.initialScene();s.nodes=[m.createNode('box','one')];s.nodes[0].hidden=true;s.nodes[0].faceFinishes={};
 for(let i=0;i<8;i++)s.nodes[0].faceFinishes[`unused:${i}`]={textureId:id()};assert.equal(m.imageReferences(m.validateScene(s)).length,8);
 s.facade=m.defaultFacade(s);s.facade.sign.enabled=false;s.facade.sign.logoId=id();assert.throws(()=>m.validateScene(s),/8개/);
});
await test('texture repeats and rotations preserve image aspect in physical metres',()=>{
 const source=new T.Texture({width:400,height:200});source.colorSpace=T.SRGBColorSpace;
 for(const angle of [0,45,90,-90,180]){const map=m.materialImage(source,[4,2],1000,angle),p=new T.Vector2(.5,.5).applyMatrix3(map.matrix),x=new T.Vector2(.75,.5).applyMatrix3(map.matrix).sub(p),y=new T.Vector2(.5,1).applyMatrix3(map.matrix).sub(p);
 near(Math.hypot(x.x,x.y*.5),1);near(Math.hypot(y.x,y.y*.5),1);near(x.x*y.x+x.y*y.y*.25,0);assert.equal(map.colorSpace,T.SRGBColorSpace);map.dispose();}
 const map=m.materialImage(source,[4,2],1000,90);near(map.repeat.x,4);near(map.repeat.y,4);assert.notEqual(map,source);assert.equal(source.repeat.x,1);source.dispose();map.dispose();
});
await test('wall segments join continuously and reveal faces retain two-dimensional UVs',()=>{
 const a=new T.BoxGeometry(2,2,.12),b=new T.BoxGeometry(2,2,.12);m.wallImageUV(a,-1,1,4,2);m.wallImageUV(b,1,1,4,2);
 for(const g of [a,b]){const pos=g.getAttribute('position'),uv=g.getAttribute('uv');for(let face=0;face<6;face++){const us=new Set(),vs=new Set();for(let i=face*4;i<face*4+4;i++){us.add(uv.getX(i).toFixed(5));vs.add(uv.getY(i).toFixed(5));if(face===4&&Math.abs(pos.getX(i)+(g===a?-1:1))<.001)near(uv.getX(i),.5);}assert.ok(us.size>1&&vs.size>1);}g.dispose();}
});
await test('export UV baking matches editor transforms without mutating editor geometry or texture',()=>{
 const source=new T.Texture({width:400,height:200}),map=m.materialImage(source,[4,2],1000,45),mat=new T.MeshStandardMaterial({map}),root=new T.Group();
 const geo=new T.BoxGeometry(4,2,.1),mesh=new T.Mesh(geo,[mat,mat,mat,mat,mat,mat]);root.add(mesh);
 const expected=geo.toNonIndexed(),uv=expected.getAttribute('uv'),clone=m.cloneModel(root);m.bakeImageTransforms(clone);const baked=clone.children[0],actual=baked.geometry.getAttribute('uv');
 for(let i=0;i<uv.count;i++){const p=new T.Vector2().fromBufferAttribute(uv,i).applyMatrix3(map.matrix);near(actual.getX(i),p.x);near(actual.getY(i),p.y);}
 assert.ok(geo.index);assert.equal(map.matrixAutoUpdate,false);assert.equal(baked.material[0].map.repeat.x,1);assert.equal(baked.material[0].map.rotation,0);assert.equal(baked.material[0].map.userData.physicalImage,undefined);
 engine().clearGroup(clone);engine().clearGroup(root);expected.dispose();source.dispose();
});
await test('logo uses a contained plane, keeps transparency and never invokes text rasterization',async()=>{
 const e=engine(),s=m.initialScene();s.facade=m.defaultFacade(s);s.facade.awning.enabled=false;s.facade.sign.logoId=id();s.facade.sign.logoScale=.8;
 const source=new T.Texture({width:200,height:400}),wait=deferred();e.imageAsset=()=>wait.promise;
 e.root.add(m.buildFacade(s,()=>new T.MeshStandardMaterial(),()=>{throw new Error('text should not draw')},(label,id,w,h)=>e.bindLogo(label,id,w,h)));
 const label=e.root.getObjectByName('간판 로고');assert.equal(label.visible,false);let ready=false;const done=e.modelsReady().then(()=>ready=true);await Promise.resolve();assert.equal(ready,false);
 wait.resolve(source);await done;near(label.scale.x/label.scale.y,.5);assert.ok(label.scale.x<=s.facade.sign.width/1000*.9*.8);assert.ok(label.scale.y<=s.facade.sign.height/1000*.82*.8);assert.equal(label.material.transparent,true);assert.equal(label.material.color.getHexString(),'ffffff');assert.equal(label.visible,true);assert.notEqual(label.material.map,source);e.clearGroup(e.root);source.dispose();
});
await test('readiness waits for image application spawned after another asynchronous asset',async()=>{
 const e=engine(),outer=deferred(),inner=deferred(),mat=new T.MeshStandardMaterial();let applied=false,ready=false;e.imageAsset=()=>inner.promise;
 e.trackAsset(outer.promise.then(()=>e.bindImage(id(),mat,()=>applied=true)));const done=e.modelsReady().then(()=>ready=true);
 outer.resolve();await new Promise(r=>setTimeout(r,0));assert.equal(ready,false);inner.resolve(new T.Texture());await done;assert.equal(applied,true);mat.dispose();
});
await test('disposed targets and obsolete scenes never receive late images; current failures block export',async()=>{
 const e=engine(),wait=deferred(),mat=new T.MeshStandardMaterial();let applied=false;e.imageAsset=()=>wait.promise;e.bindImage(id(),mat,()=>applied=true);mat.dispose();wait.resolve(new T.Texture());await e.modelsReady();assert.equal(applied,false);
 const stale=deferred(),next=new T.MeshStandardMaterial();e.imageAsset=()=>stale.promise;e.bindImage(id(),next,()=>applied=true);const done=e.modelsReady();e.assetEpoch++;e.geometryKey='two';stale.resolve(new T.Texture());await assert.rejects(done,/변경/);assert.equal(applied,false);next.dispose();
 const bad=engine();bad.imageAsset=()=>Promise.reject(new Error('image decode failed'));bad.bindImage(id(),new T.MeshStandardMaterial(),()=>{});await assert.rejects(bad.modelsReady(),/decode failed/);
});
await test('decoder revokes URLs on success/failure and reports aborted loads',async()=>{
 const saved={fetch:globalThis.fetch,Image:globalThis.Image,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let creates=0,revokes=0,broken=false;
 globalThis.fetch=async()=>new Response(png);URL.createObjectURL=()=>{creates++;return 'blob:test'};URL.revokeObjectURL=()=>revokes++;globalThis.Image=class{width=4;height=2;async decode(){if(broken)throw new Error('bad pixels')}};
 try{const tx=await m.loadImageTexture(id(),new AbortController().signal);assert.equal(tx.colorSpace,T.SRGBColorSpace);tx.dispose();broken=true;await assert.rejects(m.loadImageTexture(id(),new AbortController().signal),/bad pixels/);broken=false;const controller=new AbortController();controller.abort();await assert.rejects(m.loadImageTexture(id(),controller.signal),/취소/);assert.equal(creates,revokes);}finally{globalThis.fetch=saved.fetch;globalThis.Image=saved.Image;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
});
await test('actual GLB export embeds image bytes and alpha material while retaining baked UVs',async()=>{
 const saved={document:globalThis.document,ImageData:globalThis.ImageData,FileReader:globalThis.FileReader};
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return {translate(){},scale(){},putImageData(){}}},toBlob(fn){fn(new Blob([png],{type:'image/png'}))}}}};
 globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height})}};
 globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.()})}};
 const e=engine(),source=new T.DataTexture(new Uint8Array(4*2*4).fill(255),4,2);source.colorSpace=T.SRGBColorSpace;
 const map=m.materialImage(source,[4,2],1000,45),mat=new T.MeshStandardMaterial({map,transparent:true,alphaTest:.01});const mesh=new T.Mesh(new T.PlaneGeometry(4,2),mat);mesh.name='textured logo';e.root.add(mesh);e.data={nodes:[]};
 const originalUV=mesh.geometry.getAttribute('uv').array.slice();
 try{const buffer=await e.exportGlb(),view=new DataView(buffer),jsonLength=view.getUint32(12,true),json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength))),binary=20+jsonLength+8;
  assert.equal(json.images.length,1);assert.equal(json.images[0].mimeType,'image/png');assert.equal(json.materials[0].alphaMode,'BLEND');
  const imageView=json.bufferViews[json.images[0].bufferView],bytes=new Uint8Array(buffer,binary+imageView.byteOffset,png.length);assert.deepEqual(Buffer.from(bytes),png);
  assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions,undefined);assert.deepEqual(mesh.geometry.getAttribute('uv').array,originalUV);assert.equal(mat.map,map);assert.equal(map.matrixAutoUpdate,false);
 }finally{e.clearGroup(e.root);source.dispose();globalThis.document=saved.document;globalThis.ImageData=saved.ImageData;globalThis.FileReader=saved.FileReader;}
});
console.log(`${checks} image checks passed. Uses headless Three and mocked image decoding, no browser or AI call.`);
