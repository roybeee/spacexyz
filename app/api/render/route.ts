import { env } from 'cloudflare:workers';
import { owner, db, bucket, sameOrigin, jsonBody, readBody, HttpError, fail } from '@/lib/server';
import { renderInputSchema, decodeImage, renderPrompt, IMAGE_MODEL } from '@/lib/render-contract';
export async function POST(req: Request) {
    let claimed: {id:string;owner:string}|null=null;
    let failureState='uncertain';
    try {
        sameOrigin(req);
        const u = await owner(), b = renderInputSchema.parse(await jsonBody(req, 6000000));
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
        const database=db();bucket();
        const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({name:b.name,prompt:b.prompt,quality:b.quality,view:b.view,signText:b.signText??null,image:b.image,reference:b.reference??null}))))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
        const priorRequest=await database.prepare('SELECT owner,fingerprint,status FROM render_requests WHERE id=?').bind(b.requestId).first();
        if(priorRequest&&(priorRequest.owner!==u||priorRequest.fingerprint!==fingerprint))
            throw new HttpError(409,'같은 요청 번호의 내용이 다릅니다. 새 요청으로 시작해 주세요.');
        const readSaved=()=>database.prepare('SELECT id,name,created_at,metadata FROM assets WHERE id=? AND owner=? AND kind=?').bind(b.requestId,u,'render').first();
        const savedResponse=(row:Record<string,unknown>)=>Response.json({result:{id:row.id,name:row.name,createdAt:row.created_at,prompt:JSON.parse(row.metadata as string).prompt}},{headers:{'Cache-Control':'no-store'}});
        const prior=await readSaved();
        if(prior)return savedResponse(prior);
        const blocked=(status:unknown)=>Response.json({requestState:status,error:status==='rejected'?'이 요청은 AI 서비스에서 거절되었습니다. 설정을 확인한 뒤 새 요청으로 시작하세요.':status==='pending'?'이 요청은 처리 중이거나 결과를 확인하지 못한 상태입니다. 잠시 후 같은 요청 결과를 다시 확인하세요. 추가 생성은 요청하지 않았습니다.':'이 요청의 생성 결과를 확인하지 못했습니다. 추가 생성은 요청하지 않았습니다. 새 요청은 별도 비용이 발생할 수 있습니다.'},{status:409,headers:{'Cache-Control':'no-store'}});
        if(priorRequest)return blocked(priorRequest.status);
        const key=env.OPENAI_API_KEY||b.apiKey;
        if(!key)throw new HttpError(503,'AI 연결 후 시안을 만들 수 있습니다.');
        if(/\s/.test(key))throw new HttpError(400,'API 키를 확인하세요.');
        const claim=await database.prepare("INSERT INTO render_requests(id,owner,fingerprint,status,created_at) VALUES(?,?,?,'pending',?) ON CONFLICT(id) DO NOTHING").bind(b.requestId,u,fingerprint,new Date().toISOString()).run();
        if(claim.meta.changes!==1){
            const concurrent=await database.prepare('SELECT owner,fingerprint,status FROM render_requests WHERE id=?').bind(b.requestId).first();
            if(!concurrent||concurrent.owner!==u||concurrent.fingerprint!==fingerprint)throw new HttpError(409,'요청 번호를 사용할 수 없습니다. 새 요청으로 시작해 주세요.');
            const saved=await readSaved();
            return saved?savedResponse(saved):blocked(concurrent.status);
        }
        claimed={id:b.requestId,owner:u};
        const model = env.OPENAI_IMAGE_MODEL || IMAGE_MODEL;
        const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(180000), body: JSON.stringify({ model, images: [{ image_url: b.image }, ...(b.reference ? [{ image_url: b.reference }] : [])], prompt: renderPrompt(b.prompt, !!b.reference,b.view,b.signText), n: 1, size: '1536x1024', quality: b.quality, output_format: 'jpeg', output_compression: 90, background: 'opaque' }) });
        if (!response.ok) {
            if(response.status>=400&&response.status<500)failureState='rejected';
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
            throw new HttpError(502, 'AI 시안 생성 결과를 확인하지 못했습니다. 같은 요청을 다시 확인할 수 있습니다.');
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
            // An INSERT may have committed even when its response was lost. Never delete its files.
            let saved;
            try { saved=await readSaved(); } catch { throw e; }
            if(saved)return savedResponse(saved);
            await bucket().delete([objectKey, sourceKey]);
            throw e;
        }
        await database.prepare("UPDATE render_requests SET status='completed' WHERE id=? AND owner=?").bind(id,u).run().catch(()=>{});
        return Response.json({ result: { id, name: b.name, createdAt, prompt: b.prompt } }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        // Retain every claimed ID. Timeouts and storage failures must never acquire another paid generation.
        if(claimed)await db().prepare('UPDATE render_requests SET status=? WHERE id=? AND owner=?').bind(failureState,claimed.id,claimed.owner).run().catch(()=>{});
        const response=e instanceof Error&&e.name==='TimeoutError'
            ?Response.json({error:'생성 대기 시간을 초과했습니다. AI 요청 비용이 발생했을 수 있습니다. 같은 요청 확인은 추가 생성을 요청하지 않습니다.'},{status:504})
            :fail(e);
        return Response.json({...await response.json() as object,...(claimed?{requestState:failureState}:{})},{status:response.status,headers:{'Cache-Control':'no-store'}});
    }
}
