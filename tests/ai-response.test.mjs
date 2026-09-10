import assert from 'node:assert/strict';
import {build} from 'esbuild';
globalThis.__env={OPENAI_API_KEY:'test-only-key'};globalThis.__user={userId:'owner-a'};
const bundle=await build({stdin:{contents:"export {POST} from './app/api/ai/route';export {initialScene} from './lib/scene-model';export {GET as config} from './app/api/config/route';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'stub'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='env'?'export const env=globalThis.__env':'export async function getChatGPTUser(){return globalThis.__user}'}));}}]});
const {POST,initialScene,config}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch;let calls=0,checks=0;
const req=(scene=initialScene())=>new Request('https://test.local/api/ai',{method:'POST',headers:{Origin:'https://test.local','Content-Type':'application/json'},body:JSON.stringify({prompt:'벽은 웜 화이트로 바꾸고 바닥과 가구 배치는 유지해 줘',scene})});
function provider(text){globalThis.fetch=async()=>{calls++;return Response.json({status:'completed',output:[{content:[{type:'output_text',text:typeof text==='string'?text:JSON.stringify(text)}]}]})}}
try{
for(const bad of ['null','{broken}',{commands:'bad'},{commands:[{type:'unsupported'}]},{commands:[{type:'material',target:'walls',material:'nonexistent'}]}]){provider(bad);assert.equal((await POST(req())).status,502)}checks++;console.log('PASS malformed AI output is a provider error, not user input error');
provider({summary:'벽을 변경합니다',commands:[{type:'material',target:'walls',material:'plaster'}]});const response=await POST(req());assert.equal(response.status,200);assert.equal((await response.json()).commands.length,1);checks++;console.log('PASS valid AI commands remain supported');
const before=calls;assert.equal((await POST(req({bad:true}))).status,400);assert.equal(calls,before);checks++;console.log('PASS invalid user scene fails before provider');
let data=await (await config()).json();assert.equal(data.aiKeyConfigured,true);assert.equal(data.signedIn,true);assert.equal(data.apiKey,undefined);delete globalThis.__env.OPENAI_API_KEY;data=await (await config()).json();assert.equal(data.aiKeyConfigured,false);assert.equal((await POST(req())).status,503);assert.equal(calls,before);checks++;console.log('PASS config reports key presence without exposing it and missing key blocks AI');
console.log(`${checks} AI/config checks passed with mocked provider responses. No paid AI call was made.`);
}finally{globalThis.fetch=originalFetch;delete globalThis.__env;delete globalThis.__user}
