import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readHermes} from '@/lib/hermes-server';
import {fail} from '@/lib/server';
export async function GET(){try{const user=await getChatGPTUser(),hermes=user?await readHermes(user.userId):null;return Response.json({ai:!!hermes||!!env.OPENAI_API_KEY,aiKeyConfigured:!!env.OPENAI_API_KEY,imageReady:!!env.OPENAI_API_KEY,provider:hermes?'hermes':env.OPENAI_API_KEY?'openai':null,hermesConfigured:!!hermes,signedIn:!!user},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
