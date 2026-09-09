import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function owner() { const u = await getChatGPTUser(); if (!u)
    throw new HttpError(401, '로그인한 뒤 다시 시도해 주세요.'); return u.userId; }
export function db() { if (!env.DB)
    throw new HttpError(503, '프로젝트 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'); return env.DB; }
export function bucket() { if (!env.BUCKET)
    throw new HttpError(503, '사진 저장소에 연결할 수 없습니다.'); return env.BUCKET; }
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export function fail(e: unknown) { if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status }); if (e instanceof Error && e.name === 'ZodError')
    return Response.json({ error: '입력값 형식을 확인해 주세요.' }, { status: 400 }); console.error('request_failed', e instanceof Error ? e.name : 'unknown'); return Response.json({ error: '작업을 완료하지 못했습니다. 입력한 내용은 유지됩니다.' }, { status: 500 }); }
export function sameOrigin(req: Request) { const origin = req.headers.get('origin'); if (origin && origin !== new URL(req.url).origin)
    throw new HttpError(403, '허용되지 않은 요청입니다.'); }
export async function jsonBody(req: Request, max = 1500000) { if (Number(req.headers.get('content-length')) > max)
    throw new HttpError(413, '요청이 너무 큽니다.'); const text = await req.text(); if (text.length > max)
    throw new HttpError(413, '요청이 너무 큽니다.'); try {
    return JSON.parse(text);
}
catch {
    throw new HttpError(400, '잘못된 입력입니다.');
} }
