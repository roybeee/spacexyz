import {env} from 'cloudflare:workers';
import {owner,db,jsonBody,sameOrigin,fail,HttpError} from '@/lib/server';
import {connectionInput,readHermes,verifyHermes,seal,publicConnection} from '@/lib/hermes-server';
export async function GET(){try{const user=await owner();return Response.json({...publicConnection(await readHermes(user)),storageReady:!!env.SPATIAL_CONNECTION_KEY},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const user=await owner(),input=connectionInput.parse(await jsonBody(req,2000));
 // Validate encryption before sending a credential to the gateway.
 await seal({check:true},user);
 const previous=await readHermes(user),config=await verifyHermes(input.endpoint,input.token);
 if(previous?.endpoint===config.endpoint)config.id=previous.id;
 else if(previous&&await db().prepare("SELECT id FROM hermes_jobs WHERE owner=? AND connection_id=? AND status NOT IN ('completed','failed','cancelled') LIMIT 1").bind(user,previous.id).first())throw new HttpError(409,'진행 중인 Hermes 요청을 먼저 확인하거나 중지한 뒤 주소를 변경하세요. 같은 주소의 암호는 갱신할 수 있습니다.');
 const secret=await seal(config,user);
 await db().prepare('INSERT INTO hermes_connections(owner,secret) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET secret=excluded.secret').bind(user,secret).run();
 return Response.json(publicConnection(config),{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function DELETE(req:Request){try{
 sameOrigin(req);const user=await owner();
 if(await db().prepare("SELECT id FROM hermes_jobs WHERE owner=? AND status NOT IN ('completed','failed','cancelled') LIMIT 1").bind(user).first())throw new HttpError(409,'진행 중인 요청을 먼저 확인하거나 중지하세요.');
 await db().prepare('DELETE FROM hermes_connections WHERE owner=?').bind(user).run();return Response.json({connected:false},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
