import { owner, db, bucket, fail, HttpError, sameOrigin, readBody } from '@/lib/server';
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const u = await owner();
        if (Number(req.headers.get('content-length')) > 11000000)
            throw new HttpError(413, '사진은 10MB 이하로 올려 주세요.');
        const payload = await readBody(req, 11000000);
        const form = await new Response(payload, { headers: { 'Content-Type': req.headers.get('content-type') ?? '' } }).formData();
        const file = form.get('file');
        if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
            throw new HttpError(400, '10MB 이하의 사진을 선택하세요.');
        const bytes = await file.arrayBuffer(), a = new Uint8Array(bytes);
        let mime = '';
        if (a[0] === 255 && a[1] === 216 && a[2] === 255)
            mime = 'image/jpeg';
        else if (a[0] === 137 && a[1] === 80 && a[2] === 78 && a[3] === 71)
            mime = 'image/png';
        else if (new TextDecoder().decode(a.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(a.slice(8, 12)) === 'WEBP')
            mime = 'image/webp';
        if (!mime)
            throw new HttpError(400, 'JPG, PNG, WEBP 사진만 사용할 수 있습니다.');
        const id = crypto.randomUUID(), key = `photos/${u}/${id}`;
        await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
        try {
            await db().prepare('INSERT INTO photos(id,owner,object_key,mime,name,created_at) VALUES(?,?,?,?,?,?)').bind(id, u, key, mime, file.name.slice(0, 200), new Date().toISOString()).run();
        }
        catch (e) {
            await bucket().delete(key);
            throw e;
        }
        return Response.json({ id, url: `/api/photos?id=${id}` });
    }
    catch (e) {
        return fail(e);
    }
}
export async function GET(req: Request) {
    try {
        const u = await owner(), id = new URL(req.url).searchParams.get('id');
        const p = await db().prepare('SELECT object_key,mime FROM photos WHERE id=? AND owner=?').bind(id, u).first();
        if (!p)
            throw new HttpError(404, '사진을 찾을 수 없습니다.');
        const o = await bucket().get(p.object_key as string);
        if (!o)
            throw new HttpError(404, '사진을 찾을 수 없습니다.');
        return new Response(o.body, { headers: { 'Content-Type': p.mime as string, 'Cache-Control': 'private,max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch (e) {
        return fail(e);
    }
}
