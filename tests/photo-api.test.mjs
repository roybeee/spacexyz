import assert from 'node:assert/strict';
import {build} from 'esbuild';
// Exercise the real route, parser and scene validator; mock only auth, bindings and provider I/O.
globalThis.__draftEnv={};globalThis.__draftUser={userId:'test-owner'};
const r=await build({entryPoints:['app/api/photo-draft/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime-stubs',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:args.path==='env'?'export const env=globalThis.__draftEnv':'export async function getChatGPTUser(){return globalThis.__draftUser}',loader:'js'}))}}]});
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
const body={input:{width:5000,depth:6600,height:2900,brand:'ofd',name:'Photo test'},apiKey:'test-only-key',image:'data:image/jpeg;base64,/9j/'};
const result={summary:'Approximate draft',notes:['Visible items only'],wallMaterial:'plaster',floorMaterial:'concrete',warmth:4000,items:[{kind:'table',name:'Estimated table',x:0,y:0,z:0,width:800,height:740,depth:800,rotation:0,material:'oak',host:null}]};
const responseData=(value=result)=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const request=(data=body,origin='https://test.local')=>new Request('https://test.local/api/photo-draft',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
let calls=0,sent,count=0;const originalFetch=globalThis.fetch;
function provider(data=responseData(),status=200){globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(init.body);return Response.json(data,{status})}}
async function test(name,fn){provider();calls=0;await fn();count++;console.log('PASS '+name)}
try{
await test('authenticated valid request produces editable estimated scene',async()=>{const res=await POST(request());assert.equal(res.status,200);const {scene}=await res.json();assert.equal(scene.draft.method,'photo-ai');assert.equal(scene.room.width,5000);assert.equal(scene.nodes[0].estimated,true);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.equal(sent.input[0].content[1].type,'input_image');assert.equal(sent.input[0].content[1].detail,'high');assert.equal(sent.model,'gpt-4.1-mini')});
await test('unauthenticated and cross-origin requests never reach AI',async()=>{globalThis.__draftUser=null;assert.equal((await POST(request())).status,401);globalThis.__draftUser={userId:'test-owner'};assert.equal((await POST(request(body,'https://other.local'))).status,403);assert.equal(calls,0)});
await test('missing key and malformed photo fail before provider',async()=>{assert.equal((await POST(request({...body,apiKey:undefined}))).status,503);assert.equal((await POST(request({...body,image:'no-image'}))).status,400);assert.equal(calls,0)});
await test('provider errors remain actionable',async()=>{for(const status of [401,429,500]){provider({},status);assert.equal((await POST(request())).status,status===500?502:status)}});
await test('refusal and incomplete output do not create a scene',async()=>{provider({status:'completed',output:[{content:[{type:'refusal'}]}]});assert.equal((await POST(request())).status,422);provider({status:'incomplete',output:responseData().output});assert.equal((await POST(request())).status,502)});
await test('invalid geometry is rejected after provider output',async()=>{const bad=structuredClone(result);bad.items[0].width=19000;provider(responseData(bad));const res=await POST(request());assert.equal(res.status,422);assert.equal((await res.json()).scene,undefined)});
await test('streamed oversized body is stopped before JSON/provider',async()=>{const chunk=new Uint8Array(1100000).fill(32);let reads=0,cancelled=false;const stream=new ReadableStream({pull(c){reads++;c.enqueue(chunk)},cancel(){cancelled=true}});const req=new Request('https://test.local/api/photo-draft',{method:'POST',body:stream,duplex:'half'});assert.equal((await POST(req)).status,413);assert.equal(calls,0);assert.ok(cancelled);assert.ok(reads<=3)});
console.log(`${count} mocked photo API checks passed. No real AI request was sent.`);
}finally{globalThis.fetch=originalFetch;delete globalThis.__draftEnv;delete globalThis.__draftUser}
