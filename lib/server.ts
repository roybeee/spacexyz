import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function owner() {
    const u = await getChatGPTUser();
    if (!u)
        throw new HttpError(401, '로그인한 뒤 다시 시도해 주세요.');
    return u.userId;
}
export function db() {
    if (!env.DB)
        throw new HttpError(503, '프로젝트 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    return env.DB;
}
export function bucket() {
    if (!env.BUCKET)
        throw new HttpError(503, '사진 저장소에 연결할 수 없습니다.');
    return env.BUCKET;
}
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function fail(e: unknown) {
    if (e instanceof HttpError)
        return Response.json({ error: e.message, ...(e.status===202?{pending:true}:{}) }, { status: e.status, headers:{'Cache-Control':'no-store'} });
    if (e instanceof Error && e.name === 'ZodError')
        return Response.json({ error: '입력값 형식을 확인해 주세요.' }, { status: 400 });
    console.error('request_failed', e instanceof Error ? e.name : 'unknown');
    return Response.json({ error: '작업을 완료하지 못했습니다. 입력한 내용은 유지됩니다.' }, { status: 500 });
}
export function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
        throw new HttpError(403, '허용되지 않은 요청입니다.');
}
export async function readBody(req: Request | Response, max: number) {
    if (Number(req.headers.get('content-length')) > max)
        throw new HttpError(413, '파일 또는 요청 크기가 너무 큽니다.');
    const reader = req.body?.getReader();
    if (!reader)
        return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const result = await reader.read();
            if (result.done)
                break;
            total += result.value.byteLength;
            if (total > max) {
                await reader.cancel();
                throw new HttpError(413, '파일 또는 요청 크기가 너무 큽니다.');
            }
            chunks.push(result.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
    }
    return out;
}
export async function jsonBody(req: Request, max = 1500000) {
    const bytes = await readBody(req, max);
    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    }
    catch {
        throw new HttpError(400, '잘못된 입력입니다.');
    }
}
