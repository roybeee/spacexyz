import { owner, db, bucket, fail, HttpError, sameOrigin, readBody } from '@/lib/server';
import { inspectGlb, MODEL_LIMIT } from '@/lib/glb';
export async function POST(req: Request) { try {
    sameOrigin(req);
    const u = await owner(), bytes = await readBody(req, MODEL_LIMIT);
    let metadata;
    try {
        metadata = inspectGlb(bytes.buffer);
    }
    catch (e) {
        throw new HttpError(400, (e as Error).message);
    }
    const id = crypto.randomUUID(), key = `assets/${u}/${id}`, name = (new URL(req.url).searchParams.get('name') || '가져온 모델').slice(0, 100);
    await bucket().put(key, bytes, { httpMetadata: { contentType: 'model/gltf-binary' } });
    try {
        await db().prepare('INSERT INTO assets(id,owner,kind,object_key,mime,name,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, u, 'model', key, 'model/gltf-binary', name, JSON.stringify(metadata), new Date().toISOString()).run();
    }
    catch (e) {
        await bucket().delete(key);
        throw e;
    }
    return Response.json({ id, name, metadata }, { headers: { 'Cache-Control': 'no-store' } });
}
catch (e) {
    return fail(e);
} }
export async function GET(req: Request) { try {
    const u = await owner(), url = new URL(req.url), id = url.searchParams.get('id');
    if (!id) {
        const rows = await db().prepare('SELECT id,name,metadata,created_at FROM assets WHERE owner=? AND kind=? ORDER BY created_at DESC LIMIT 100').bind(u, 'render').all();
        return Response.json({ assets: rows.results.map(r => ({ ...r, metadata: JSON.parse(r.metadata as string) })) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const a = await db().prepare('SELECT object_key,mime,kind,metadata FROM assets WHERE id=? AND owner=?').bind(id, u).first();
    if (!a)
        throw new HttpError(404, '파일을 찾을 수 없습니다.');
    const source = url.searchParams.get('source') === '1';
    if (source && a.kind !== 'render')
        throw new HttpError(400, '원본 장면이 없습니다.');
    const key = source ? JSON.parse(a.metadata as string).sourceKey : a.object_key;
    const obj = await bucket().get(key);
    if (!obj)
        throw new HttpError(404, '파일을 찾을 수 없습니다.');
    return new Response(obj.body, { headers: { 'Content-Type': source ? 'image/png' : a.mime as string, 'Cache-Control': 'private,max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
catch (e) {
    return fail(e);
} }
