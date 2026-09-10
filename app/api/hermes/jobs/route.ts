import {z} from 'zod';
import {owner,db,jsonBody,sameOrigin,fail,HttpError} from '@/lib/server';
import {readHermes,getJob,pollJob,stopJob} from '@/lib/hermes-server';
export async function GET(){try{const user=await owner();const {results}=await db().prepare('SELECT id,status,purpose,created_at,cancel_requested FROM hermes_jobs WHERE owner=? ORDER BY created_at DESC LIMIT 30').bind(user).all();return Response.json({jobs:results},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const user=await owner(),b=z.object({id:z.string().uuid(),action:z.enum(['poll','stop'])}).strict().parse(await jsonBody(req,500));
 const j=await getJob(user,b.id);if(!j)throw new HttpError(404,'이 계정의 요청을 찾지 못했습니다.');
 const c=await readHermes(user);if(!c||c.id!==j.connection_id)throw new HttpError(409,'요청을 시작한 Hermes 연결을 복원하세요.');
 const next=b.action==='stop'?await stopJob(c,j):await pollJob(c,j);
 return Response.json({id:next.id,status:next.status,cancelRequested:!!next.cancel_requested},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
