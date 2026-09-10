import {owner,db,bucket,fail,HttpError,sameOrigin,readBody} from '@/lib/server';
import {IMAGE_LIMIT,inspectImage} from '@/lib/image-assets';
export async function POST(req:Request){try{
    sameOrigin(req);const u=await owner(),bytes=await readBody(req,IMAGE_LIMIT);let metadata;
    try{metadata=inspectImage(bytes);}catch(e){throw new HttpError(400,(e as Error).message);}
    const id=crypto.randomUUID(),key=`assets/${u}/${id}`,name=(new URL(req.url).searchParams.get('name')||'내 이미지').slice(0,100),created_at=new Date().toISOString();
    await bucket().put(key,bytes,{httpMetadata:{contentType:metadata.mime}});
    try{await db().prepare('INSERT INTO assets(id,owner,kind,object_key,mime,name,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,u,'image',key,metadata.mime,name,JSON.stringify(metadata),created_at).run();}catch(e){await bucket().delete(key);throw e;}
    return Response.json({id,name,metadata,created_at},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function GET(){try{const u=await owner(),rows=await db().prepare('SELECT id,name,metadata,created_at FROM assets WHERE owner=? AND kind=? ORDER BY created_at DESC LIMIT 100').bind(u,'image').all();return Response.json({images:rows.results.map(r=>({...r,metadata:JSON.parse(r.metadata as string)}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
