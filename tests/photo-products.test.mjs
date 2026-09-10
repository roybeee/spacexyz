import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
let user='owner';globalThis.__productsUser=()=>({userId:user});
globalThis.__productsEnv={
 DB:{prepare(query){
  const stmt=sql.prepare(query);
  return {bind(...args){return {
   async first(){return stmt.get(...args)||null},
   async all(){return {results:stmt.all(...args)}},
   async run(){return {meta:{changes:stmt.run(...args).changes}}}
  }}};
 }}
};
const b=await build({stdin:{contents:"export * from './lib/photo-products';export * from './lib/object-photo';export * from './lib/scene-model';export * from './lib/selection';export * from './lib/assemblies';export {POST,GET} from './app/api/assemblies/route';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__productsEnv':'export async function getChatGPTUser(){return globalThis.__productsUser()}'}))}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const base={...m.initialScene(),nodes:[],room:{...m.initialScene().room,width:12000,depth:12000}},imageId=crypto.randomUUID();
const part=(name,x,y,z,width,height,depth)=>({shape:'box',name,x,y,z,width,height,depth,material:'oak',color:'#aa8877'});
const input={kind:'table',name:'참고 테이블',material:'oak',color:'#aa8877',width:1200,depth:700,height:750,photo:{imageId,representation:'parts',analysis:'ai',dimensions:'entered',brand:'시험 제조사',productCode:'TEST-001'},parts:[part('상판',0,.9,0,1,.1,1),...[-.4,.4].flatMap(x=>[-.4,.4].map(z=>part('다리',x,0,z,.1,.9,.1)))]};
let scene=m.createPhotoObject(base,input).scene,checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name)}
try{
test('five photo-derived parts count as one complete product',()=>{const [p]=m.photoProducts(scene);assert.equal(p.complete,true);assert.equal(p.partCount,5);assert.equal(p.expectedParts,5);assert.equal(p.name,input.name);assert.equal(p.code,'TEST-001');assert.deepEqual([p.width,p.depth,p.height],[1200,700,750]);assert.match(p.status,/추정/)});
test('intact 90-degree group rotation keeps product dimensions',()=>{const next=m.transformGroup(scene,scene.nodes.map(n=>n.id),{x:1000,y:0,z:500,rotation:90});const p=m.photoProducts(next)[0];assert.deepEqual([p.width,p.depth,p.height].map(Math.round),[1200,700,750]);});
test('deleted or individually duplicated parts cannot count as a verified whole product',()=>{const missing={...scene,nodes:scene.nodes.slice(1)};assert.equal(m.photoProducts(missing)[0].complete,false);const extra={...scene,nodes:[...scene.nodes,{...structuredClone(scene.nodes[0]),id:crypto.randomUUID()}]};assert.equal(m.photoProducts(extra)[0].complete,false)});
test('ungrouped fragments stay separate and require review',()=>{const split={...scene,nodes:scene.nodes.map(n=>{const c={...n};delete c.group;return c;})};const p=m.photoProducts(split);assert.equal(p.length,5);assert.ok(p.every(p=>!p.complete))});
test('complete duplicate groups remain independent products',()=>{const copy=m.batchAction(scene,scene.nodes.map(n=>n.id),{type:'duplicate',x:2200,z:0});const p=m.photoProducts(copy);assert.equal(p.length,2);assert.ok(p.every(p=>p.complete));assert.notEqual(p[0].id,p[1].id)});
test('a saved set with two copies remaps part identity to avoid conflating products',()=>{const copy=m.batchAction(scene,scene.nodes.map(n=>n.id),{type:'duplicate',x:2200,z:0});const a=m.captureAssembly(copy,copy.nodes.map(n=>n.id),'두 테이블');const placed=m.insertAssembly(base,a,{x:0,y:0,z:0,rotation:90});const p=m.photoProducts(placed.scene);assert.equal(p.length,2);assert.ok(p.every(p=>p.complete&&p.partCount===5));assert.equal(new Set(placed.scene.nodes.map(n=>n.objectPhoto.objectId)).size,2);});
test('separate placements use independent photo identities',()=>{const a=m.captureAssembly(scene,scene.nodes.map(n=>n.id),'테이블');const one=m.insertAssembly(base,a,{x:0,y:0,z:0,rotation:0});const two=m.insertAssembly(one.scene,a,{x:2500,y:0,z:0,rotation:0});assert.equal(new Set(two.scene.nodes.map(n=>n.objectPhoto.objectId)).size,2);assert.equal(m.photoProducts(two.scene).length,2)});
test('product edits update all parts without changing geometry or unrelated nodes',()=>{const original=structuredClone(scene),p=m.photoProducts(scene)[0];scene=m.editPhotoProduct(scene,p.id,{name:'OFD · 테이블',brand:'사용자 제조사',code:'USER-002'});assert.ok(scene.nodes.every(n=>n.objectPhoto.productCode==='USER-002'));assert.equal(m.photoProducts(scene)[0].name,'OFD · 테이블');assert.deepEqual(scene.nodes.map(({objectPhoto,...n})=>n),original.nodes.map(({objectPhoto,...n})=>n));assert.equal(original.nodes[0].objectPhoto.productCode,'TEST-001')});
test('one locked part blocks the complete metadata edit atomically',()=>{const locked={...scene,nodes:scene.nodes.map((n,i)=>i===2?{...n,locked:true}:n)},before=JSON.stringify(locked);assert.throws(()=>m.editPhotoProduct(locked,m.photoProducts(locked)[0].id,{name:'새 이름',brand:'x',code:'x'}),/잠금/);assert.equal(JSON.stringify(locked),before)});
test('inconsistent product codes are explicitly marked for review',()=>{const next=structuredClone(scene);next.nodes[1].objectPhoto.productCode='different';const p=m.photoProducts(next)[0];assert.equal(p.consistent,false);assert.match(p.status,/불일치/)});
test('metadata survives scene JSON and assembly persistence preparation',()=>{const restored=m.validateScene(JSON.parse(JSON.stringify(scene)));assert.equal(m.photoProducts(restored)[0].name,'OFD · 테이블');const a=m.captureAssembly(restored,restored.nodes.map(n=>n.id),'OFD 표준 테이블');const summary=m.assemblySummary('id',a);assert.equal(summary.products.length,1);assert.equal(summary.products[0].code,'USER-002');assert.equal(summary.products[0].name,'OFD · 테이블')});
test('CSV guards formula injection and omits private asset identifiers',()=>{const next=m.editPhotoProduct(scene,m.photoProducts(scene)[0].id,{name:'=CMD()',brand:'@vendor',code:'+code'});const csv=m.photoProductsCsv(next);assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes("'=CMD()"));assert.ok(csv.includes("'@vendor"));assert.ok(!csv.includes(imageId));assert.ok(csv.includes('1200'));});
test('standard photo proxies retain measured status only at recorded dimensions',()=>{const single=m.createPhotoObject(base,{...input,parts:undefined,photo:{...input.photo,dimensions:'measured'}}).scene;assert.equal(m.photoProducts(single)[0].status,'실측 입력 유지');single.nodes[0].width+=10;assert.equal(m.photoProducts(single)[0].status,'입력 치수 · 확인 필요')});
const now=new Date().toISOString();sql.prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?)').run(imageId,user,'image','key','image/png','photo','{}',now);
const a=m.captureAssembly(scene,scene.nodes.map(n=>n.id),'보관 세트'),id=crypto.randomUUID(),origin='https://test.local';
const saved=await m.POST(new Request(origin+'/api/assemblies',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id,assembly:a})}));assert.equal(saved.status,200);
const list=await(await m.GET(new Request(origin+'/api/assemblies'))).json();assert.deepEqual(list.assemblies[0].products,(await saved.json()).summary.products);assert.equal(list.assemblies[0].product_json,undefined);assert.equal(list.assemblies[0].content,undefined);checks++;console.log('PASS real SQLite listing returns searchable product metadata consistent with the save response');
user='other';assert.deepEqual((await(await m.GET(new Request(origin+'/api/assemblies'))).json()).assemblies,[]);checks++;console.log('PASS saved product codes and photographs remain isolated by owner');
console.log(`${checks} photo product inventory checks passed.`);
}finally{sql.close();delete globalThis.__productsEnv;delete globalThis.__productsUser;}
