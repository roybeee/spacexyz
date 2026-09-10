import {z} from 'zod';
import {owner,db,fail,HttpError,sameOrigin,jsonBody} from '@/lib/server';
import {materialPresetSchema,validateMaterialPreset,type MaterialPreset,type MaterialPresetRow} from '@/lib/material-presets';
import {assertOwnedAssets} from '@/lib/asset-access';

const headers={'Cache-Control':'no-store'};
const requestSchema=z.object({id:z.string().uuid(),preset:materialPresetSchema}).strict();
const getId=(req:Request)=>z.string().uuid().parse(new URL(req.url).searchParams.get('id'));
const row=(record:Record<string,unknown>):MaterialPresetRow=>({id:record.id as string,preset:validateMaterialPreset(JSON.parse(record.content as string)),created_at:record.created_at as string});
async function checkAssets(user:string,presets:MaterialPreset[]){
    await assertOwnedAssets(user,presets.flatMap(preset=>preset.finish.textureId?[[preset.finish.textureId,'image'] as const]:[]),'소재에 연결된 이미지를 사용할 수 없습니다. 본인이 업로드한 소재 이미지를 선택하세요.');
}
function failure(error:unknown){const response=fail(error);response.headers.set('Cache-Control','no-store');return response;}

export async function GET(req:Request){try{
    const user=await owner();
    if(new URL(req.url).searchParams.has('id')){
        const record=await db().prepare('SELECT id,content,created_at FROM material_presets WHERE id=? AND owner=?').bind(getId(req),user).first();
        if(!record)throw new HttpError(404,'보관한 소재를 찾을 수 없습니다.');
        const result=row(record);await checkAssets(user,[result.preset]);return Response.json(result,{headers});
    }
    const records=await db().prepare('SELECT id,content,created_at FROM material_presets WHERE owner=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(user).all();
    const presets=records.results.map(row);await checkAssets(user,presets.map(item=>item.preset));return Response.json({presets},{headers});
}catch(error){return failure(error);}}

export async function POST(req:Request){try{
    sameOrigin(req);const user=await owner(),body=requestSchema.parse(await jsonBody(req,20000));
    await checkAssets(user,[body.preset]);
    const content=JSON.stringify(body.preset),created_at=new Date().toISOString();
    // Cap enforcement is part of the write statement. Stable request IDs make retries safe.
    const result=await db().prepare('INSERT INTO material_presets(id,owner,name,content,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM material_presets WHERE owner=?) < 100 ON CONFLICT(id) DO NOTHING').bind(body.id,user,body.preset.name,content,created_at,user).run();
    if(!result.meta.changes){
        const existing=await db().prepare('SELECT id,content,created_at FROM material_presets WHERE id=? AND owner=?').bind(body.id,user).first();
        if(existing&&existing.content===content)return Response.json(row(existing),{headers});
        throw new HttpError(409,'소재를 저장하지 못했습니다. 보관함은 100개까지이며, 내용을 수정했다면 새 소재로 저장해 주세요.');
    }
    return Response.json({id:body.id,preset:body.preset,created_at},{headers});
}catch(error){return failure(error);}}

export async function DELETE(req:Request){try{
    sameOrigin(req);const user=await owner(),id=getId(req);
    await db().prepare('DELETE FROM material_presets WHERE id=? AND owner=?').bind(id,user).run();
    return Response.json({deleted:true},{headers});
}catch(error){return failure(error);}}
