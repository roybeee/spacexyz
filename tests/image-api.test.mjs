import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const png=readFileSync('tests/fixtures/material.png'),jpg=readFileSync('tests/fixtures/material.jpg');
const assets=new Map(),files=new Map();let user='owner-a',failInsert=false,saves=0;const queries=[];
globalThis.__imageEnv={DB:{prepare(sql){return {bind(...args){return {
 async first(){if(sql.includes('FROM assets')){const a=assets.get(args[0]);return a?.owner===args[1]?a:null}return null},
 async all(){if(sql.includes('SELECT id,kind FROM assets')){queries.push(args.length-1);return {results:[...assets.values()].filter(a=>a.owner===args[0]&&args.slice(1).includes(a.id)).map(a=>({id:a.id,kind:a.kind}))}}return {results:[...assets.values()].filter(a=>a.owner===args[0]&&a.kind===args[1]).map(({id,name,metadata,created_at})=>({id,name,metadata,created_at}))}},
 async run(){if(sql.startsWith('INSERT INTO assets')){if(failInsert)throw new Error('forced insert failure');const [id,owner,kind,object_key,mime,name,metadata,created_at]=args;assets.set(id,{id,owner,kind,object_key,mime,name,metadata,created_at});}else saves++;return {meta:{changes:1}}}
 }}}}},BUCKET:{async put(key,bytes,options){files.set(key,{bytes,options})},async delete(key){files.delete(key)},async get(key){const f=files.get(key);return f?{body:f.bytes}:null}}};
globalThis.__imageUser=()=>user?{userId:user}:null;
const result=await build({stdin:{contents:"export {POST as upload,GET as list} from './app/api/images/route';export {GET as getAsset} from './app/api/assets/route';export {POST as save} from './app/api/projects/route';export * from './lib/scene-model';export * from './lib/facade';export * from './lib/design-variants';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__imageEnv':'export async function getChatGPTUser(){return globalThis.__imageUser()}'}))}}]});
const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const uploadReq=(bytes=png,origin='https://test.local')=>new Request('https://test.local/api/images?name=logo.png',{method:'POST',headers:{origin,'Content-Type':'image/jpeg'},body:bytes});
const saveReq=s=>new Request('https://test.local/api/projects',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({scene:s,revision:0})});
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name)};let imageId;
await test('uploads infer MIME from bytes and list only current owner image metadata',async()=>{
 const response=await m.upload(uploadReq());assert.equal(response.status,200);const data=await response.json();imageId=data.id;assert.equal(data.metadata.mime,'image/png');assert.equal(data.metadata.width,4);assert.equal(data.object_key,undefined);
 const asset=assets.get(imageId);assert.equal(asset.kind,'image');assert.ok(asset.object_key.startsWith('assets/owner-a/'));assert.equal(files.get(asset.object_key).options.httpMetadata.contentType,'image/png');
 const list=await (await m.list()).json();assert.equal(list.images.length,1);assert.equal(list.images[0].object_key,undefined);
 user='owner-b';assert.equal((await (await m.list()).json()).images.length,0);assert.equal((await m.getAsset(new Request(`https://test.local/api/assets?id=${imageId}`))).status,404);user='owner-a';const file=await m.getAsset(new Request(`https://test.local/api/assets?id=${imageId}`));assert.equal(file.headers.get('Content-Type'),'image/png');
 assert.equal((await m.upload(uploadReq(jpg))).status,200);
});
await test('auth, origin and malformed uploads fail before storage; DB failure removes only the new file',async()=>{
 const before=files.size;user=null;assert.equal((await m.upload(uploadReq())).status,401);user='owner-a';assert.equal((await m.upload(uploadReq(png,'https://foreign.local'))).status,403);
 for(const bytes of [png.subarray(0,20),Buffer.from('<svg/>'),Buffer.alloc(2*1024*1024+1)])assert.ok((await m.upload(uploadReq(bytes))).status>=400);assert.equal(files.size,before);
 failInsert=true;assert.equal((await m.upload(uploadReq())).status,500);failInsert=false;assert.equal(files.size,before);assert.ok(files.has(assets.get(imageId).object_key));
});
await test('project save rejects foreign or incorrect-kind images in every inactive location',async()=>{
 const original=assets.get(imageId);const make=where=>{let s=m.initialScene();if(where==='surface')s.room.surfaces.floor.finish={textureId:imageId};else if(where==='node'){s.nodes[0].hidden=true;s.nodes[0].finish={textureId:imageId};}else if(where==='face')s.nodes[0].faceFinishes={'unused:0':{textureId:imageId}};else{s.facade=m.defaultFacade(s);s.facade.sign.enabled=false;s.facade.sign.logoId=imageId;}s=m.saveVariant(s,'stored');s.nodes=[];s.room.surfaces.floor.finish={};delete s.facade;return s};
 for(const where of ['surface','node','face','logo']){const s=make(where),before=saves;original.owner='owner-b';assert.equal((await m.save(saveReq(s))).status,400);original.owner='owner-a';original.kind='model';assert.equal((await m.save(saveReq(s))).status,400);assert.equal(saves,before);original.kind='image';assert.equal((await m.save(saveReq(s))).status,200);}
});
await test('one ID used as both an image and model cannot bypass reference kind checks',async()=>{
 const s=m.initialScene();s.nodes=[{...m.createNode('box','model'),kind:'model',assetId:imageId}];s.room.surfaces.floor.finish={textureId:imageId};const before=saves;
 assert.equal((await m.save(saveReq(s))).status,400);assets.get(imageId).kind='model';assert.equal((await m.save(saveReq(s))).status,400);assert.equal(saves,before);assets.get(imageId).kind='image';
});
await test('references across multiple designs are verified in bounded batches beyond 80 assets',async()=>{
 let s=m.initialScene();for(let design=0;design<7;design++){s.nodes=[];for(let n=0;n<20;n++){const id=crypto.randomUUID();assets.set(id,{id,owner:user,kind:'model'});s.nodes.push({...m.createNode('box',`node-${n}`),kind:'model',assetId:id});}for(let n=0;n<8;n++){const id=crypto.randomUUID();assets.set(id,{id,owner:user,kind:'image'});s.nodes[n].finish={textureId:id};}if(design<6)s=m.saveVariant(s,`Design ${design}`);}
 queries.length=0;assert.equal((await m.save(saveReq(s))).status,200);assert.ok(queries.length>=3);assert.ok(queries.every(count=>count<=80));assert.equal(queries.reduce((a,b)=>a+b,0),196);
});
console.log(`${checks} image API checks passed with mocked owner/storage; no remote writes.`);delete globalThis.__imageEnv;delete globalThis.__imageUser;
