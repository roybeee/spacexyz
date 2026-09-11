import {z} from 'zod';
import {owner,db,fail,HttpError,sameOrigin,jsonBody} from '@/lib/server';
import {brandStandardSchema,validateBrand,type BrandRow} from '@/lib/brand-standards';
const headers={'Cache-Control':'no-store'};
const input=z.object({id:z.string().uuid(),revision:z.number().int().min(0),standard:brandStandardSchema}).strict();
const row=(r:Record<string,unknown>):BrandRow=>({id:r.id as string,standard:validateBrand(JSON.parse(r.content as string)),revision:r.revision as number,updated_at:r.updated_at as string});
function failure(e:unknown){const r=fail(e);r.headers.set('Cache-Control','no-store');return r;}
export async function GET(req:Request){try{
 const user=await owner(),id=new URL(req.url).searchParams.get('id');
 if(id){z.string().uuid().parse(id);const r=await db().prepare('SELECT id,content,revision,updated_at FROM brands WHERE id=? AND owner=?').bind(id,user).first();if(!r)throw new HttpError(404,'브랜드를 찾을 수 없습니다.');return Response.json(row(r),{headers});}
 const result=await db().prepare('SELECT id,content,revision,updated_at FROM brands WHERE owner=? ORDER BY updated_at DESC,id DESC LIMIT 50').bind(user).all();return Response.json({brands:result.results.map(row)},{headers});
}catch(e){return failure(e)}}
export async function POST(req:Request){try{
 sameOrigin(req);const user=await owner(),b=input.parse(await jsonBody(req,20000)),content=JSON.stringify(b.standard),now=new Date().toISOString();
 const result=b.revision===0?await db().prepare('INSERT INTO brands(id,owner,name,content,revision,updated_at) SELECT ?,?,?,?,1,? WHERE (SELECT COUNT(*) FROM brands WHERE owner=?) < 50 ON CONFLICT(id) DO NOTHING').bind(b.id,user,b.standard.name,content,now,user).run():await db().prepare('UPDATE brands SET name=?,content=?,revision=revision+1,updated_at=? WHERE id=? AND owner=? AND revision=?').bind(b.standard.name,content,now,b.id,user,b.revision).run();
 if(!result.meta.changes){const existing=await db().prepare('SELECT id,content,revision,updated_at FROM brands WHERE id=? AND owner=?').bind(b.id,user).first();if(existing&&existing.content===content&&existing.revision===b.revision+1)return Response.json(row(existing),{headers});throw new HttpError(409,'브랜드가 다른 곳에서 변경되었거나 50개 보관 한도에 도달했습니다. 내 입력을 사본으로 보관하거나 목록을 다시 확인하세요.');}
 return Response.json({id:b.id,standard:b.standard,revision:b.revision+1,updated_at:now},{headers});
}catch(e){return failure(e)}}
export async function DELETE(req:Request){try{
 sameOrigin(req);const user=await owner(),p=new URL(req.url).searchParams,id=z.string().uuid().parse(p.get('id')),revision=z.coerce.number().int().min(1).parse(p.get('revision'));
 const result=await db().prepare('DELETE FROM brands WHERE id=? AND owner=? AND revision=?').bind(id,user,revision).run();
 if(!result.meta.changes){const existing=await db().prepare('SELECT id FROM brands WHERE id=? AND owner=?').bind(id,user).first();if(existing)throw new HttpError(409,'브랜드가 변경되었습니다. 목록을 새로고침한 뒤 삭제하세요.');}
 return Response.json({deleted:true},{headers});
}catch(e){return failure(e)}}
