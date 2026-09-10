import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(`drizzle/${file}`,'utf8'));
let user='owner-a';globalThis.__assembliesUser=()=>user?{userId:user}:null;
globalThis.__assembliesEnv={
 DB:{prepare(sql){
  const stmt=sqlite.prepare(sql);
  return {bind(...args){return {
   async first(){return stmt.get(...args)??null},
   async all(){return {results:stmt.all(...args)}},
   async run(){return {meta:{changes:stmt.run(...args).changes}}}
  }}};
 }}
};
const bundled=await build({stdin:{contents:"export * from './app/api/assemblies/route';export * from './lib/assemblies';export * from './lib/scene-model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__assembliesEnv':'export async function getChatGPTUser(){return globalThis.__assembliesUser()}'}))}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const id=()=>crypto.randomUUID(),kit=m.builtinAssemblies()[0],post=(assembly=kit,key=id(),origin='https://test.local')=>new Request('https://test.local/api/assemblies',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id:key,assembly})}),get=key=>new Request('https://test.local/api/assemblies'+(key?`?id=${key}`:'')),del=(key,origin='https://test.local')=>new Request(`https://test.local/api/assemblies?id=${key}`,{method:'DELETE',headers:{origin}});
const count=()=>sqlite.prepare('SELECT COUNT(*) AS count FROM assemblies').get().count;
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name)}const savedId=id();
await test('migrations and real SQLite queries store a set and idempotently reuse retries',async()=>{
 const response=await m.POST(post(kit,savedId));assert.equal(response.status,200);const data=await response.json();assert.equal(data.summary.count,3);assert.equal(count(),1);
 assert.equal((await m.POST(post(kit,savedId))).status,200);assert.equal(count(),1);assert.equal((await m.POST(post({...kit,note:'changed'},savedId))).status,409);assert.equal(count(),1);
 const full=await (await m.GET(get(savedId))).json();assert.deepEqual(full.assembly.nodes,kit.nodes);const list=await (await m.GET(get())).json();assert.equal(list.assemblies.length,1);assert.equal(list.assemblies[0].content,undefined);assert.equal(list.assemblies[0].owner,undefined);
 const plan=sqlite.prepare('EXPLAIN QUERY PLAN SELECT id,name FROM assemblies WHERE owner=? ORDER BY created_at DESC LIMIT 100').all(user);assert.ok(plan.some(p=>p.detail.includes('assemblies_owner_created')));
});
await test('read, write, delete and listing enforce owner isolation and request origin',async()=>{
 user='owner-b';assert.equal((await m.GET(get(savedId))).status,404);assert.equal((await (await m.GET(get())).json()).assemblies.length,0);assert.equal((await m.POST(post(kit,savedId))).status,409);assert.equal((await m.DELETE(del(savedId))).status,200);assert.equal(count(),1);
 user='owner-a';assert.equal((await m.POST(post(kit,id(),'https://foreign.local'))).status,403);assert.equal((await m.DELETE(del(savedId,'https://foreign.local'))).status,403);user=null;assert.equal((await m.GET(get())).status,401);assert.equal((await m.POST(post())).status,401);user='owner-a';
});
await test('invalid body, canonical geometry and excessive data fail before writes',async()=>{
 assert.equal((await m.POST(post(kit,'invalid'))).status,400);assert.equal((await m.POST(post({...kit,nodes:[]}))).status,400);assert.equal((await m.POST(post({...kit,nodes:kit.nodes.map(n=>({...n,x:n.x+10}))}))).status,400);
 const huge=new Request('https://test.local/api/assemblies',{method:'POST',body:'x'.repeat(210001)});assert.equal((await m.POST(huge)).status,413);assert.equal(count(),1);
});
await test('model and image references require matching ownership and kind, including inactive face images',async()=>{
 const image=id(),model=id();const add=(key,kind,owner)=>sqlite.prepare('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?)').run(key,owner,kind,`assets/${key}`,'application/octet-stream','asset','{}','today');add(image,'image',user);add(model,'model',user);
 const s=m.initialScene();s.nodes=[{...m.createNode('box','model'),kind:'model',assetId:model,faceFinishes:{'unused:0':{textureId:image}}}];const a=m.captureAssembly(s,['model'],'Model and image'),key=id();assert.equal((await m.POST(post(a,key))).status,200);
 sqlite.prepare('UPDATE assets SET owner=? WHERE id=?').run('foreign',image);assert.equal((await m.POST(post(a))).status,400);assert.equal((await m.GET(get(key))).status,400);sqlite.prepare('UPDATE assets SET owner=?,kind=? WHERE id=?').run(user,'render',image);assert.equal((await m.POST(post(a))).status,400);sqlite.prepare('UPDATE assets SET kind=? WHERE id=?').run('image',image);
 const wrong=structuredClone(a);wrong.nodes[0].finish={textureId:model};assert.equal((await m.POST(post(wrong))).status,400);
 const copies=m.insertAssembly({...s,nodes:[]},a,{x:0,y:0,z:0,rotation:0}).scene;assert.equal((await m.DELETE(del(key))).status,200);assert.equal((await m.GET(get(key))).status,404);assert.equal(copies.nodes.length,1);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM assets').get().n,2);
});
await test('atomic 100-set limit allows exact retries, and deletion frees one place',async()=>{
 for(let i=count();i<100;i++)assert.equal((await m.POST(post())).status,200);assert.equal(count(),100);assert.equal((await m.POST(post())).status,409);assert.equal(count(),100);assert.equal((await m.POST(post(kit,savedId))).status,200);
 await m.DELETE(del(savedId));assert.equal(count(),99);assert.equal((await m.POST(post())).status,200);assert.equal(count(),100);user='owner-b';assert.equal((await m.POST(post())).status,200);user='owner-a';assert.equal((await (await m.GET(get())).json()).assemblies.length,100);
});
console.log(`${checks} assembly API/SQLite checks passed. Authentication only is mocked; migrations and SQL execute locally.`);sqlite.close();delete globalThis.__assembliesEnv;delete globalThis.__assembliesUser;
