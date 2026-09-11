import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8'));
let user='shortlist-owner';globalThis.__shortlistUser=()=>user?{userId:user}:null;
globalThis.__shortlistEnv={DB:{
 prepare(query){
  const stmt=sql.prepare(query);
  return {bind(...args){return {
   async first(){return stmt.get(...args)??null;},
   async all(){return {results:stmt.all(...args)};},
   async run(){return {meta:{changes:stmt.run(...args).changes}};}
  };}};
 }
}};

const bundle=await build({stdin:{contents:"export * from './lib/material-shortlist';export * from './lib/material-products';export * from './lib/scene-model';export * from './lib/design-variants';export * from './app/api/projects/route';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__shortlistEnv':'export async function getChatGPTUser(){return globalThis.__shortlistUser()}'}));}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name)}
const scene=m.initialScene(),ids=['bodaq-zx169','hanex-vm-004'];
await test('shortlist survives scene serialization without applying finishes or loading private images',()=>{const next=m.setMaterialShortlist(scene,ids),restored=m.validateScene(JSON.parse(JSON.stringify(next)));assert.deepEqual(restored.materialShortlist,ids);assert.deepEqual(restored.room,scene.room);assert.deepEqual(restored.nodes,scene.nodes);assert.deepEqual(m.imageReferences(restored),[]);assert.deepEqual(m.catalogTextureKeys(restored),[]);assert.equal(scene.materialShortlist,undefined);assert.equal(m.setMaterialShortlist(next,ids),next)});
await test('unknown and duplicate candidates and over-limit imports are rejected while exactly 40 work',()=>{assert.throws(()=>m.setMaterialShortlist(scene,['invented']));assert.throws(()=>m.setMaterialShortlist(scene,[ids[0],ids[0]]));assert.throws(()=>m.setMaterialShortlist(scene,m.materialProducts.slice(0,41).map(p=>p.id)));assert.equal(m.setMaterialShortlist(scene,m.materialProducts.slice(0,40).map(p=>p.id)).materialShortlist.length,40);assert.equal(m.validateScene(scene).materialShortlist,undefined)});
await test('candidate removal and design restoration retain project-level intent without mutating geometry',()=>{const a=m.setMaterialShortlist(scene,ids),variant=m.saveVariant(a,'A'),b=m.setMaterialShortlist(variant,[ids[1]]),c=m.restoreVariant(b,b.variants[0].id);assert.deepEqual(c.materialShortlist,[ids[1]]);assert.deepEqual(c.room,scene.room);assert.deepEqual(m.setMaterialShortlist(c,[]).materialShortlist,[]);assert.equal(m.initialScene().materialShortlist,undefined)});
await test('unavailable paint may be researched as a candidate but cannot become an applied finish',()=>{const p=m.materialProducts.find(p=>p.kind==='color'&&!p.previewColor);assert.ok(p);assert.deepEqual(m.setMaterialShortlist(scene,[p.id]).materialShortlist,[p.id]);assert.throws(()=>m.productFinish(p));});
await test('CSV preserves real codes and official source links and labels candidates explicitly',()=>{const csv=m.materialShortlistCsv(ids);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('ZX169'));assert.ok(csv.includes('VM-004'));assert.ok(csv.includes('https://www.hyundailnc.com/product/contents'));assert.equal(csv.split('\r\n').length,3);assert.ok(csv.includes('검토 후보 · 시공 확정 아님'));assert.throws(()=>m.materialShortlistCsv(['invented']));});
const request=(method,body,key='shortlist-project')=>new Request('https://test.local/api/projects?id='+key,{method,headers:{origin:'https://test.local','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
await test('project API persists and reloads shortlist with existing owner storage and revision protection',async()=>{const saved=m.setMaterialShortlist(scene,ids);assert.equal((await m.POST(request('POST',{id:'shortlist-project',revision:0,scene:saved}))).status,200);const row=await (await m.GET(request('GET'))).json();assert.deepEqual(row.scene.materialShortlist,ids);assert.equal(row.revision,1);assert.equal((await m.POST(request('POST',{id:row.id,revision:1,scene:m.setMaterialShortlist(saved,[ids[1]])}))).status,200);assert.equal((await m.POST(request('POST',{id:row.id,revision:1,scene:saved}))).status,409);assert.deepEqual((await (await m.GET(request('GET'))).json()).scene.materialShortlist,[ids[1]])});
await test('project candidate API rejects unknown IDs and does not leak another owners selections',async()=>{assert.equal((await m.POST(request('POST',{id:'bad-shortlist',revision:0,scene:{...scene,materialShortlist:['invalid']}}))).status,400);user='another-owner';assert.equal((await m.GET(request('GET'))).status,404);user=null;assert.equal((await m.GET(request('GET'))).status,401)});
console.log(`${count} shortlist checks passed; authentication and Cloudflare bindings substituted, real SQLite project queries exercised.`);sql.close();delete globalThis.__shortlistUser;delete globalThis.__shortlistEnv;
