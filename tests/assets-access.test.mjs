import assert from 'node:assert/strict';
import {build} from 'esbuild';
const id='fbe6a9c5-cc21-42fa-92ce-1e66c2a9b8fd';let asset={id,kind:'render',owner:'owner-a',object_key:'image-key',mime:'image/jpeg',metadata:'{"sourceKey":"source-key"}'},saved=0;
globalThis.__assetEnv={
 DB:{prepare(sql){return {bind(...args){return {
  async first(){if(sql.includes('FROM assets'))return args[0]===asset.id&&args[1]===asset.owner?asset:null;return null},
  async all(){if(sql.includes('SELECT id,kind FROM assets'))return {results:args[0]===asset.owner&&args.slice(1).includes(id)?[{id,kind:asset.kind}]:[]};return {results:[]}},
  async run(){saved++;return {meta:{changes:1}}}
 }}}}},
 BUCKET:{get:async()=>({body:new Uint8Array([1,2,3])})}
};
const r=await build({stdin:{contents:"export {GET as getAsset,POST as postAsset} from './app/api/assets/route';export {POST as saveProject} from './app/api/projects/route';export {initialScene,createNode} from './lib/scene-model';export {saveVariant} from './lib/design-variants';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__assetEnv':"export async function getChatGPTUser(){return {userId:'owner-a'}}"}))}}]});const m=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('PASS '+name)};
const projectRequest=s=>new Request('https://test.local/api/projects',{method:'POST',headers:{origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({scene:s,revision:0})});
await test('asset files require matching owner',async()=>{assert.equal((await m.getAsset(new Request(`https://test.local/api/assets?id=${id}`))).status,200);asset.owner='owner-b';assert.equal((await m.getAsset(new Request(`https://test.local/api/assets?id=${id}`))).status,404);asset.owner='owner-a'});
await test('model reference cannot reuse a render ID to bypass type validation',async()=>{const s=m.initialScene();s.nodes=[{...m.createNode('box','model'),kind:'model',assetId:id}];s.renders=[{id,name:'test',createdAt:'2026-09-09T00:00:00.000Z',prompt:''}];assert.equal((await m.saveProject(projectRequest(s))).status,400);assert.equal(saved,0);asset.kind='model';s.renders=[];assert.equal((await m.saveProject(projectRequest(s))).status,200);assert.equal(saved,1)});
await test('foreign model references cannot be saved',async()=>{asset.owner='owner-b';const s=m.initialScene();s.nodes=[{...m.createNode('box','model'),kind:'model',assetId:id}];assert.equal((await m.saveProject(projectRequest(s))).status,400);assert.equal(saved,1);asset.owner='owner-a'});
await test('inactive variants cannot bypass model ownership or asset kind checks',async()=>{let s=m.initialScene();s.nodes=[{...m.createNode('box','model'),kind:'model',assetId:id}];s=m.saveVariant(s,'model design');s.nodes=[];const before=saved;asset.owner='owner-b';assert.equal((await m.saveProject(projectRequest(s))).status,400);assert.equal(saved,before);asset.owner='owner-a';asset.kind='render';assert.equal((await m.saveProject(projectRequest(s))).status,400);assert.equal(saved,before);asset.kind='model';assert.equal((await m.saveProject(projectRequest(s))).status,200);assert.equal(saved,before+1)});
await test('inactive variants cannot save inaccessible photo references',async()=>{let s=m.initialScene();s.photoId='foreign-photo';s=m.saveVariant(s,'photo design');delete s.photoId;const before=saved;assert.equal((await m.saveProject(projectRequest(s))).status,400);assert.equal(saved,before)});
await test('non-GLB upload is rejected before storage',async()=>{const req=new Request('https://test.local/api/assets',{method:'POST',headers:{origin:'https://test.local'},body:new Uint8Array([1,2,3])});assert.equal((await m.postAsset(req)).status,400)});
console.log(`${checks} asset access checks passed.`);delete globalThis.__assetEnv;
