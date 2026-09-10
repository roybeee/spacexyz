import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {db,HttpError,readBody} from './server';

export const connectionInput=z.object({endpoint:z.string().trim().max(500),token:z.string().trim().min(20).max(500).regex(/^[\x21-\x7e]+$/)}).strict();
export type HermesConnection={endpoint:string;token:string;id:string;model:string;retention:number;verifiedAt:string};
const encoder=new TextEncoder();
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function fingerprint(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function hermesEndpoint(value:string){
 let u:URL;try{u=new URL(value.trim());}catch{throw new HttpError(400,'Hermes의 HTTPS 기본 주소를 입력하세요.');}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!h.includes('.')||h.includes(':')||/^[\d.]+$/.test(h)||/(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(h)||!/^\/(?:[a-zA-Z0-9_-]+\/?)*$/.test(u.pathname))throw new HttpError(400,'공개 HTTPS 게이트웨이 주소가 필요합니다. localhost·사설 IP·로그인 정보가 포함된 주소는 사용할 수 없습니다.');
 u.pathname=u.pathname.replace(/\/+$/,'').replace(/\/v1$/,'');return u.href.replace(/\/$/,'');
}
async function encryptionKey(){
 try{const raw=decode(env.SPATIAL_CONNECTION_KEY||'');if(raw.length!==32)throw new Error();return await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
 catch{throw new HttpError(503,'연결 암호 보관 설정을 확인해 주세요.');}
}
export async function seal(value:unknown,user:string){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await encryptionKey();const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('spatial:hermes:'+user)},key,encoder.encode(JSON.stringify(value)));return JSON.stringify({iv:encode(iv),data:encode(new Uint8Array(data))});}
export async function unseal(text:string,user:string):Promise<HermesConnection>{try{const b=JSON.parse(text),key=await encryptionKey();return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(b.iv),additionalData:encoder.encode('spatial:hermes:'+user)},key,decode(b.data))));}catch{throw new HttpError(503,'보관한 Hermes 연결을 읽지 못했습니다. 연결 보관 설정을 확인하세요.');}}
export async function readHermes(user:string){if(!env.SPATIAL_CONNECTION_KEY)return null;const row=await db().prepare('SELECT secret FROM hermes_connections WHERE owner=?').bind(user).first<{secret:string}>();return row?unseal(row.secret,user):null;}
export async function hermesRequest(c:HermesConnection,path:string,init:RequestInit={},authenticated=true){
 let response:Response;
 try{response=await fetch(c.endpoint+path,{...init,redirect:'manual',signal:AbortSignal.timeout(12000),headers:{...init.headers,'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${c.token}`}:{})}});}
 catch{throw new HttpError(502,'Hermes에 닿지 못했습니다. 게이트웨이와 네트워크를 확인한 뒤 같은 요청을 다시 확인하세요.');}
 if(!authenticated)return {response,data:{}};
 if(!response.ok){if(response.status===401||response.status===403)throw new HttpError(401,'Hermes 연결 암호를 확인하세요.');if(response.status===429)throw new HttpError(429,'Hermes가 다른 작업을 처리 중입니다. 같은 요청으로 다시 확인하세요.');if(response.status===404)throw new HttpError(409,'Hermes 실행 기록이나 기능을 찾지 못했습니다. 게이트웨이에서 확인하세요. 새 실행은 시작하지 않았습니다.');throw new HttpError(502,'Hermes 응답을 확인하지 못했습니다. 주소와 게이트웨이 상태를 확인하세요.');}
 let data:any;try{data=JSON.parse(new TextDecoder().decode(await readBody(response,350000)));}catch{throw new HttpError(502,'Hermes 응답 형식을 확인하지 못했습니다.');}
 if(!data||typeof data!=='object')throw new HttpError(502,'Hermes 응답 형식이 올바르지 않습니다.');return {response,data};
}
export async function verifyHermes(endpoint:string,token:string){
 const c:HermesConnection={endpoint:hermesEndpoint(endpoint),token,id:crypto.randomUUID(),model:'Hermes',retention:0,verifiedAt:new Date().toISOString()};
 const {data:caps}=await hermesRequest(c,'/v1/capabilities'),f=caps.features;
 if(caps.object!=='hermes.api_server.capabilities'||caps.platform!=='hermes-agent'||f?.run_submission!==true||f?.run_status!==true||f?.run_stop!==true||f?.runs_idempotency?.durable!==true||f.runs_idempotency.enabled===false||f.runs_idempotency.supported===false||!Number.isFinite(f.runs_idempotency.retention_seconds)||f.runs_idempotency.retention_seconds<120)throw new HttpError(422,'실행·조회·중지·영속 중복 방지를 지원하는 최신 Hermes gateway가 필요합니다.');
 const probe=await hermesRequest(c,'/v1/capabilities',{},false);if(![401,403].includes(probe.response.status))throw new HttpError(422,'인증 없이 접근 가능한 게이트웨이입니다. API_SERVER_KEY 보호를 먼저 설정하세요.');
 const {data:models}=await hermesRequest(c,'/v1/models');c.model=typeof models.data?.[0]?.id==='string'?models.data[0].id.slice(0,100):'Hermes';c.retention=Math.min(86400,f.runs_idempotency.retention_seconds);return c;
}
export const publicConnection=(c:HermesConnection|null)=>c?{connected:true,endpoint:c.endpoint,model:c.model,verifiedAt:c.verifiedAt}: {connected:false};
export type HermesJob={id:string;owner:string;connection_id:string;fingerprint:string;run_id:string|null;status:string;output:string|null;created_at:number;deadline:number;purpose:string;cancel_requested:number};
export const terminal=(s:string)=>['completed','failed','cancelled'].includes(s);
const validRun=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(s);
const pending=(message='Hermes가 분석 중입니다. 같은 요청의 결과를 확인하고 있습니다.')=>{throw new HttpError(202,message);};
export async function getJob(user:string,id:string){return db().prepare('SELECT * FROM hermes_jobs WHERE owner=? AND id=?').bind(user,id).first<HermesJob>();}
export async function pollJob(c:HermesConnection,j:HermesJob){
 if(terminal(j.status))return j;
 if(!j.run_id)return j;
 const {data:r}=await hermesRequest(c,'/v1/runs/'+j.run_id);
 if(r.object!=='hermes.run'||r.run_id!==j.run_id)throw new HttpError(502,'Hermes 실행 번호가 일치하지 않습니다.');
 if(!['started','queued','running','pending','waiting','waiting_approval','waiting_for_approval','stopping','completed','failed','cancelled'].includes(r.status))throw new HttpError(502,'Hermes 실행 상태를 해석하지 못했습니다.');
 let output:string|null=null;
 if(r.status==='completed'){if(typeof r.output!=='string'||r.output.length>200000)throw new HttpError(502,'Hermes 결과가 비어 있거나 너무 큽니다.');output=r.output.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');}
 await db().prepare('UPDATE hermes_jobs SET status=?,output=? WHERE owner=? AND id=?').bind(r.status,output,j.owner,j.id).run();return {...j,status:r.status,output};
}
export async function stopJob(c:HermesConnection,j:HermesJob){
 if(terminal(j.status))return j;
 await db().prepare('UPDATE hermes_jobs SET cancel_requested=1 WHERE owner=? AND id=?').bind(j.owner,j.id).run();
 if(!j.run_id)throw new HttpError(409,'접수 응답을 아직 확인하지 못했습니다. 원래 요청을 다시 실행해 접수 번호를 확인한 뒤 중지하세요. 취소 의사는 보관했습니다.');
 await hermesRequest(c,'/v1/runs/'+j.run_id+'/stop',{method:'POST',body:'{}'});return pollJob(c,{...j,cancel_requested:1});
}
export async function requireDesignAI(user:string,key:unknown){
 const hermes=await readHermes(user);if(hermes)return {user,hermes,key:''};
 if(typeof key!=='string'||!key)throw new HttpError(503,'AI 연결에서 Hermes 주소와 연결 암호를 등록하세요. 기본 배치·소재 편집은 연결 없이 가능합니다.');
 if(key.length>500||/\s/.test(key))throw new HttpError(400,'API 키를 확인하세요.');return {user,hermes:null,key};
}
type DesignAI=Awaited<ReturnType<typeof requireDesignAI>>;
export async function designResponse(ai:DesignAI,req:Request,payload:any):Promise<Response>{
 if(!ai.hermes)return fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${ai.key}`},signal:AbortSignal.timeout(90000),body:JSON.stringify(payload)});
 const c=ai.hermes,id=req.headers.get('X-Spatial-Request-Id');if(!id||!z.string().uuid().safeParse(id).success)throw new HttpError(400,'AI 요청 번호가 필요합니다. 페이지를 새로 열어 주세요.');
 const purpose=new URL(req.url).pathname,hash=await fingerprint([payload,c.id,purpose]);let j=await getJob(ai.user,id);
 if(j&&(j.fingerprint!==hash||j.connection_id!==c.id))throw new HttpError(400,'이 요청의 사진·장면·연결이 변경되었습니다. 새 요청으로 시작하세요.');
 if(!j){const now=Date.now();await db().prepare('INSERT OR IGNORE INTO hermes_jobs(id,owner,connection_id,fingerprint,status,created_at,deadline,purpose) VALUES(?,?,?,?,?,?,?,?)').bind(id,ai.user,c.id,hash,'pending',now,now+Math.min(c.retention*1000,600000)-30000,purpose).run();j=await getJob(ai.user,id);}
 if(!j||j.fingerprint!==hash)throw new HttpError(409,'AI 요청이 일치하지 않습니다.');
 if(!j.run_id){
  if(Date.now()>j.deadline)throw new HttpError(409,'접수 재시도 기간이 지났습니다. Hermes에서 기존 실행을 확인하세요. 중복 생성을 피하기 위해 다시 보내지 않았습니다.');
  const session='spatial-'+await fingerprint([env.SPATIAL_CONNECTION_KEY,ai.user,id,c.id]);
  const content=payload.input.flatMap((m:any)=>m.content.map((p:any)=>p.type==='input_image'?{type:'image_url',image_url:{url:p.image_url,detail:p.detail}}:{type:'text',text:p.text}));
  const body={session_id:session,conversation_history:[],input:[{role:'user',content}],instructions:payload.instructions+'\nReturn only the required JSON object. Do not use native tools, terminal, files, web, messaging, scheduling, or delegation. You only propose changes for the user to review in SPATIAL. Never execute external actions or expose credentials. JSON format: '+JSON.stringify(payload.text?.format)};
  const {data:r}=await hermesRequest(c,'/v1/runs',{method:'POST',headers:{'Idempotency-Key':session,'X-Hermes-Session-Key':session},body:JSON.stringify(body)});
  if(!validRun(r.run_id))throw new HttpError(502,'Hermes 접수 번호를 확인하지 못했습니다. 같은 요청으로 재확인하세요.');
  await db().prepare('UPDATE hermes_jobs SET run_id=? WHERE owner=? AND id=? AND run_id IS NULL').bind(r.run_id,ai.user,id).run();j=(await getJob(ai.user,id))!;
 }
 j=await pollJob(c,j);
 j.cancel_requested=(await getJob(ai.user,id))?.cancel_requested??j.cancel_requested;
 if(j.cancel_requested){if(!terminal(j.status))await stopJob(c,j);throw new HttpError(422,'중지한 요청입니다. 현재 장면에는 적용하지 않았습니다.');}
 if(['failed','cancelled'].includes(j.status))throw new HttpError(422,'Hermes 실행이 실패하거나 취소되었습니다. 게이트웨이의 모델 인증·실행 상태를 확인하세요.');
 if(j.status!=='completed')return pending(['waiting_approval','waiting_for_approval'].includes(j.status)?'Hermes에서 승인을 기다립니다. 연결 화면에서 실행을 확인하거나 중지하세요.':undefined);
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:j.output}]}]});
}
