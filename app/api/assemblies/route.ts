import {uniquePhotoTags,type PhotoProductTag} from '@/lib/photo-products';
import {z} from 'zod';
import {owner,db,fail,HttpError,sameOrigin,jsonBody} from '@/lib/server';
import {validateAssembly,assemblySummary,type Assembly} from '@/lib/assemblies';
import {imageReferences,initialScene} from '@/lib/scene-model';
import {assertOwnedAssets} from '@/lib/asset-access';
const headers={'Cache-Control':'no-store'};
const getId=(req:Request)=>z.string().uuid().parse(new URL(req.url).searchParams.get('id'));
async function checkAssets(u:string,a:Assembly){await assertOwnedAssets(u,[...a.nodes.filter(n=>n.kind==='model').map(n=>[n.assetId!,'model'] as const),...imageReferences({...initialScene(),nodes:a.nodes}).map(id=>[id,'image'] as const)]);}
function checked(input:unknown){try{return validateAssembly(input)}catch(e){throw new HttpError(400,e instanceof Error&&e.name!=='ZodError'?e.message:'세트 내용을 확인해 주세요.');}}
export async function GET(req:Request){try{
    const u=await owner();if(new URL(req.url).searchParams.has('id')){
        const row=await db().prepare('SELECT id,content,created_at FROM assemblies WHERE id=? AND owner=?').bind(getId(req),u).first();if(!row)throw new HttpError(404,'세트를 찾을 수 없습니다.');
        const assembly=checked(JSON.parse(row.content as string));await checkAssets(u,assembly);return Response.json({id:row.id,assembly,created_at:row.created_at},{headers});
    }
    const rows=await db().prepare('SELECT id,name,note,category,count,width,depth,height,created_at,(SELECT json_group_array(json_object(\'name\',coalesce(nullif(json_extract(value,\'$.objectPhoto.productName\'),\'\'),CASE WHEN instr(json_extract(value,\'$.name\'),\' · \')>0 THEN substr(json_extract(value,\'$.name\'),1,instr(json_extract(value,\'$.name\'),\' · \')-1) ELSE json_extract(value,\'$.name\') END),\'brand\',coalesce(json_extract(value,\'$.objectPhoto.brand\'),\'\'),\'code\',coalesce(json_extract(value,\'$.objectPhoto.productCode\'),\'\'),\'imageId\',json_extract(value,\'$.objectPhoto.imageId\'))) FROM json_each(assemblies.content,\'$.nodes\') WHERE json_type(value,\'$.objectPhoto\')=\'object\') AS product_json FROM assemblies WHERE owner=? ORDER BY created_at DESC LIMIT 100').bind(u).all();return Response.json({assemblies:rows.results.map(row=>{const {product_json,...summary}=row;const products=uniquePhotoTags(JSON.parse(String(product_json||'[]')) as PhotoProductTag[]);return {...summary,...(products.length?{products}:{})};})},{headers});
}catch(e){return fail(e)}}
export async function POST(req:Request){try{
    sameOrigin(req);const u=await owner(),body=await jsonBody(req,210000),id=z.string().uuid().parse(body.id),assembly=checked(body.assembly);await checkAssets(u,assembly);
    const content=JSON.stringify(assembly),now=new Date().toISOString(),summary=assemblySummary(id,assembly,now);
    // The request ID makes retries idempotent without allowing another owner to replace a row.
    const result=await db().prepare('INSERT INTO assemblies(id,owner,name,note,category,content,count,width,depth,height,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM assemblies WHERE owner=?) < 100 ON CONFLICT(id) DO NOTHING').bind(id,u,assembly.name,assembly.note,assembly.category,content,summary.count,summary.width,summary.depth,summary.height,now,u).run();
    if(!result.meta.changes){const existing=await db().prepare('SELECT id,content,created_at FROM assemblies WHERE id=? AND owner=?').bind(id,u).first();if(existing&&existing.content===content)return Response.json({summary:assemblySummary(id,assembly,existing.created_at as string)},{headers});throw new HttpError(409,'세트를 저장하지 못했습니다. 보관함은 100개까지이며, 내용이 바뀐 재시도는 새 세트로 저장해 주세요.');}
    return Response.json({summary},{headers});
}catch(e){return fail(e)}}
export async function DELETE(req:Request){try{sameOrigin(req);const u=await owner(),id=getId(req);await db().prepare('DELETE FROM assemblies WHERE id=? AND owner=?').bind(id,u).run();return Response.json({deleted:true},{headers});}catch(e){return fail(e)}}
