// D1/Hermes owns the execution receipt. This per-tab index holds only hashes and
// IDs so an interrupted identical request can find its existing execution.
const attempts=new Map<string,string>();
const active=new Set<string>();
const keyPrefix='spatial-ai-attempt:';
function pause(ms:number,signal?:AbortSignal|null){return new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('분석 확인을 중단했습니다. 연결 화면에서 Hermes 실행을 확인할 수 있습니다.','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});}
export async function aiFetch(url:string,options:RequestInit):Promise<Response>{
 const body=JSON.parse(String(options.body));delete body.apiKey;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([url,body]))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(active.has(digest))throw new Error('같은 분석의 결과를 확인하고 있습니다.');
 let id=attempts.get(digest);try{id??=sessionStorage.getItem(keyPrefix+digest)||undefined;}catch{}
 id??=crypto.randomUUID();attempts.set(digest,id);try{sessionStorage.setItem(keyPrefix+digest,id);}catch{}
 const headers=new Headers(options.headers);headers.set('X-Spatial-Request-Id',id);active.add(digest);
 const forget=()=>{attempts.delete(digest);try{sessionStorage.removeItem(keyPrefix+digest);}catch{}};
 try{for(let i=0;i<150;i++){
  const response=await fetch(url,{...options,headers});
  if(response.status===202){await pause(2000,options.signal);continue;}
  // Keep receipts on temporary upstream/auth failures. Successful application
  // and terminal validation failures can start a fresh independent request.
  if(response.ok||[400,404,413,422].includes(response.status))forget();
  return response;
 }throw new Error('Hermes 분석이 계속 진행 중입니다. 같은 내용으로 다시 요청하면 결과를 이어서 확인합니다. AI 연결에서 상태 확인·중지도 가능합니다.');}
 finally{active.delete(digest);}
}
