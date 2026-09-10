import {db,HttpError} from './server';
export async function assertOwnedAssets(owner:string,references:ReadonlyArray<readonly [string,string]>,message='세트에 포함된 모델·소재 이미지를 사용할 수 없습니다.') {
    const ids=[...new Set(references.map(r=>r[0]))],owned=new Map<string,string>();
    for(let i=0;i<ids.length;i+=80){const group=ids.slice(i,i+80);const rows=await db().prepare(`SELECT id,kind FROM assets WHERE owner=? AND id IN (${group.map(()=>'?').join(',')})`).bind(owner,...group).all();for(const row of rows.results)owned.set(row.id as string,row.kind as string)}
    if(references.some(([id,kind])=>owned.get(id)!==kind))throw new HttpError(400,message);
}
