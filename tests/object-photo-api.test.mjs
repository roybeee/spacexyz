import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
// Real route, image parser and SQLite ownership query; replace auth, bucket and AI network only.
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE assets(id TEXT, owner TEXT, kind TEXT, object_key TEXT)');
const imageId=crypto.randomUUID(),foreignId=crypto.randomUUID(),modelId=crypto.randomUUID();
for(const [id,owner,kind] of [[imageId,'owner','image'],[foreignId,'other','image'],[modelId,'owner','model']])sqlite.prepare('INSERT INTO assets VALUES(?,?,?,?)').run(id,owner,kind,id);
let user='owner',file=readFileSync('tests/fixtures/material.png'),calls=0,sent,headers;
globalThis.__objectEnv={DB:{prepare(sql){return {bind(...args){return {async first(){return sqlite.prepare(sql).get(...args)}}}}}},BUCKET:{async get(){return file?{body:file}:null}}};
globalThis.__objectUser=()=>user?{userId:user}:null;
const bundle=await build({entryPoints:['app/api/object-photo/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__objectEnv':'export async function getChatGPTUser(){return globalThis.__objectUser()}'}))}}]});
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const analysis={kind:'table',name:'사진 테이블',material:'oak',color:'#a08060',notes:['상판 형태를 단순화한 추정 모델'],parts:[{shape:'box',name:'상판',x:0,y:0,z:0,width:1,height:1,depth:1,material:'oak',color:'#a08060'}]};
const data=(value=analysis)=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const request=(body={imageId,apiKey:'test-only-key'},origin='https://test.local')=>new Request('https://test.local/api/object-photo',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;let checks=0;
function provider(body=data(),status=200){globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');calls++;sent=JSON.parse(init.body);headers=init.headers;return Response.json(body,{status})}}
async function test(name,fn){calls=0;provider();await fn();checks++;console.log('PASS '+name)}
try{
await test('owned image bytes reach strict AI analysis, with no guessed absolute dimensions',async()=>{const res=await POST(request());assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert.deepEqual((await res.json()).analysis,analysis);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.match(sent.input[0].content[1].image_url,/^data:image\/png;base64,/);assert.ok(!('width' in sent.text.format.schema.properties));assert.equal(sent.text.format.schema.properties.parts.items.additionalProperties,false)});
await test('auth and cross-origin requests fail before provider',async()=>{user=null;assert.equal((await POST(request())).status,401);user='owner';assert.equal((await POST(request(undefined,'https://other.local'))).status,403);assert.equal(calls,0)});
await test('foreign and wrong-kind assets cannot be submitted to AI',async()=>{for(const id of [foreignId,modelId,crypto.randomUUID()])assert.equal((await POST(request({imageId:id,apiKey:'test-only-key'}))).status,404);assert.equal(calls,0)});
await test('missing key, invalid identifier, URL payload and malformed key fail early',async()=>{assert.equal((await POST(request({imageId}))).status,503);for(const body of [{imageId:'bad',apiKey:'test-key'},{imageId,apiKey:'test key'},{imageId,apiKey:'test-key',url:'https://other.local/photo.jpg'}])assert.equal((await POST(request(body))).status,400);assert.equal(calls,0)});
await test('missing and corrupt stored photographs are rejected before AI',async()=>{const original=file;file=null;assert.equal((await POST(request())).status,404);file=Buffer.from('not-image');assert.equal((await POST(request())).status,400);file=original;assert.equal(calls,0)});
await test('server key takes priority and no credential enters the response',async()=>{globalThis.__objectEnv.OPENAI_API_KEY='server-test-key';const res=await POST(request());assert.equal(headers.Authorization,'Bearer server-test-key');assert.ok(!(await res.text()).includes('server-test-key'));delete globalThis.__objectEnv.OPENAI_API_KEY});
await test('provider status, refusal and incomplete output are actionable',async()=>{for(const status of [401,429,500]){provider({},status);assert.equal((await POST(request())).status,status===500?502:status)}provider({status:'completed',output:[{content:[{type:'refusal'}]}]});assert.equal((await POST(request())).status,422);provider({...data(),status:'incomplete'});assert.equal((await POST(request())).status,502)});
await test('malformed provider envelopes and invalid inferred parts produce no object',async()=>{for(const body of [null,{status:'completed',output:'invalid'},data({...analysis,parts:Array(17).fill(analysis.parts[0])}),data({...analysis,width:1200}),data({...analysis,parts:[{...analysis.parts[0],width:0}]})]){provider(body);const res=await POST(request());assert.equal(res.status,502);assert.equal((await res.json()).analysis,undefined)}globalThis.fetch=async()=>new Response('{broken');assert.equal((await POST(request())).status,502)});
await test('timeout preserves an actionable manual fallback',async()=>{globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await POST(request())).status,504)});
await test('oversized request never reaches AI',async()=>{assert.equal((await POST(request({imageId,apiKey:'x'.repeat(3000)}))).status,413);assert.equal(calls,0)});
console.log(`${checks} photo object API checks passed with real SQLite and mocked AI calls.`);
}finally{globalThis.fetch=originalFetch;sqlite.close();delete globalThis.__objectEnv;delete globalThis.__objectUser}
