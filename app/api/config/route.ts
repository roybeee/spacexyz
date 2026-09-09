import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function GET() { const user = await getChatGPTUser(); return Response.json({ ai: !!env.OPENAI_API_KEY, signedIn: !!user }, { headers: { 'Cache-Control': 'no-store' } }); }
