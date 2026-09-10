import { env } from 'cloudflare:workers';
import { owner, db, bucket, sameOrigin, jsonBody, readBody, HttpError, fail } from '@/lib/server';
import { renderInputSchema, decodeImage, renderPrompt, IMAGE_MODEL } from '@/lib/render-contract';
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const u = await owner(), b = renderInputSchema.parse(await jsonBody(req, 6000000));
        const key = env.OPENAI_API_KEY || b.apiKey;
        if (!key)
            throw new HttpError(503, 'AI 연결 후 시안을 만들 수 있습니다.');
        if (/\s/.test(key))
            throw new HttpError(400, 'API 키를 확인하세요.');
        let source;
        try {
            source = decodeImage(b.image);
            if (b.reference)
                decodeImage(b.reference);
        }
        catch (e) {
            throw new HttpError(400, (e as Error).message);
        }
        if (source.mime !== 'image/png')
            throw new HttpError(400, '3D 장면을 다시 캡처하세요.');
        const prior = await db().prepare('SELECT id,name,created_at,metadata FROM assets WHERE id=? AND owner=? AND kind=?').bind(b.requestId, u, 'render').first();
        if (prior)
            return Response.json({ result: { id: prior.id, name: prior.name, createdAt: prior.created_at, prompt: JSON.parse(prior.metadata as string).prompt } }, { headers: { 'Cache-Control': 'no-store' } });
        const model = env.OPENAI_IMAGE_MODEL || IMAGE_MODEL;
        const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(180000), body: JSON.stringify({ model, images: [{ image_url: b.image }, ...(b.reference ? [{ image_url: b.reference }] : [])], prompt: renderPrompt(b.prompt, !!b.reference,b.view,b.signText), n: 1, size: '1536x1024', quality: b.quality, output_format: 'jpeg', output_compression: 90, background: 'opaque' }) });
        if (!response.ok) {
            let code = '';
            try {
                code = (await response.json() as {
                    error?: {
                        code?: string;
                    };
                }).error?.code ?? '';
            }
            catch { }
            if (response.status === 401)
                throw new HttpError(401, 'OpenAI API 키가 유효하지 않습니다.');
            if (response.status === 403 || response.status === 404)
                throw new HttpError(403, '이 API 계정에서 이미지 모델을 사용할 수 없습니다. 모델 접근 권한을 확인하세요.');
            if (response.status === 429)
                throw new HttpError(429, 'AI 사용량 또는 요청 한도를 확인하세요.');
            if (code === 'moderation_blocked')
                throw new HttpError(422, '이 사진과 요청으로 시안을 만들 수 없습니다. 입력을 확인하세요.');
            throw new HttpError(502, 'AI 시안 생성에 실패했습니다. 입력을 유지했으니 다시 시도할 수 있습니다.');
        }
        const responseBytes = await readBody(response, 16000000);
        let data: {
            data?: {
                b64_json?: string;
            }[];
        };
        try {
            data = JSON.parse(new TextDecoder().decode(responseBytes));
        }
        catch {
            throw new HttpError(502, 'AI 응답을 읽지 못했습니다.');
        }
        const base64 = data.data?.[0]?.b64_json;
        if (!base64)
            throw new HttpError(502, 'AI가 이미지를 반환하지 않았습니다.');
        let output;
        try {
            output = decodeImage(`data:image/jpeg;base64,${base64}`, 10 * 1024 * 1024);
        }
        catch {
            throw new HttpError(502, '생성된 이미지 형식을 확인하지 못했습니다.');
        }
        const id = b.requestId, objectKey = `assets/${u}/${id}/${crypto.randomUUID()}`, sourceKey = `${objectKey}-source`, createdAt = new Date().toISOString();
        try {
            await bucket().put(objectKey, output.bytes, { httpMetadata: { contentType: output.mime } });
            await bucket().put(sourceKey, source.bytes, { httpMetadata: { contentType: 'image/png' } });
            await db().prepare('INSERT INTO assets(id,owner,kind,object_key,mime,name,metadata,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, u, 'render', objectKey, output.mime, b.name, JSON.stringify({ sourceKey, prompt: b.prompt, referenceUsed: !!b.reference, quality: b.quality, model }), createdAt).run();
        }
        catch (e) {
            await bucket().delete([objectKey, sourceKey]);
            throw e;
        }
        return Response.json({ result: { id, name: b.name, createdAt, prompt: b.prompt } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        if (e instanceof Error && e.name === 'TimeoutError')
            return Response.json({ error: '생성 대기 시간을 초과했습니다. AI 요청 비용이 발생했을 수 있습니다. 자동 재요청하지 않았습니다.' }, { status: 504 });
        return fail(e);
    }
}
