import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['lib/ai-client.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {aiFetch}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const realFetch=globalThis.fetch,realTimer=globalThis.setTimeout,oldStorage=globalThis.sessionStorage;
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
globalThis.setTimeout=(fn,ms)=>realTimer(fn,Math.min(ms,1));let calls=[],mode='pending',checks=0;
globalThis.fetch=async(url,init)=>{calls.push({url,init});if(mode==='pending')return calls.length%2===1?Response.json({pending:true},{status:202}):Response.json({commands:[]});if(mode==='network')throw new TypeError('lost response');if(mode==='abort'){return Response.json({pending:true},{status:202})}if(mode==='terminal')return Response.json({error:'cancelled'},{status:422});return Response.json({commands:[]});};
const options=(prompt,signal)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,apiKey:'private-session-key'}),signal});
async function test(name,fn){calls=[];await fn();checks++;console.log('PASS '+name)}
try{
await test('pending result polls the same request identifier and immutable body',async()=>{assert.equal((await aiFetch('/api/ai',options('one'))).status,200);assert.equal(calls.length,2);assert.equal(calls[0].init.headers.get('X-Spatial-Request-Id'),calls[1].init.headers.get('X-Spatial-Request-Id'));assert.equal(calls[0].init.body,calls[1].init.body);assert.equal(storage.size,0)});
await test('lost response keeps a receipt without storing the API key or request content',async()=>{mode='network';await assert.rejects(()=>aiFetch('/api/ai',options('private-photo-request')));assert.equal(storage.size,1);assert.ok(!JSON.stringify([...storage]).includes('private'));const id=calls[0].init.headers.get('X-Spatial-Request-Id');mode='complete';await aiFetch('/api/ai',options('private-photo-request'));assert.equal(calls[1].init.headers.get('X-Spatial-Request-Id'),id);assert.equal(storage.size,0)});
await test('local cancellation preserves execution receipt for later recovery',async()=>{mode='abort';const controller=new AbortController();controller.abort();await assert.rejects(()=>aiFetch('/api/ai',options('abort',controller.signal)),{name:'AbortError'});assert.equal(storage.size,1);const id=calls[0].init.headers.get('X-Spatial-Request-Id');mode='complete';await aiFetch('/api/ai',options('abort'));assert.equal(calls[1].init.headers.get('X-Spatial-Request-Id'),id)});
await test('terminal cancellation permits a fresh explicitly retried request',async()=>{mode='terminal';await aiFetch('/api/ai',options('cancelled'));assert.equal(storage.size,0);const id=calls[0].init.headers.get('X-Spatial-Request-Id');mode='complete';await aiFetch('/api/ai',options('cancelled'));assert.notEqual(calls[1].init.headers.get('X-Spatial-Request-Id'),id)});
console.log(`${checks} AI client request recovery checks passed.`);
}finally{globalThis.fetch=realFetch;globalThis.setTimeout=realTimer;globalThis.sessionStorage=oldStorage;}
