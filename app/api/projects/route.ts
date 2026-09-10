import { owner, db, fail, HttpError, sameOrigin, jsonBody } from '@/lib/server';
import { validateScene,imageReferences } from '@/lib/scene-model';
import {assertOwnedAssets} from '@/lib/asset-access';
export async function GET(req: Request) {
    try {
        const u = await owner(), id = new URL(req.url).searchParams.get('id');
        if (id) {
            const p = await db().prepare('SELECT id,name,scene,revision,updated_at FROM projects WHERE id=? AND owner=?').bind(id, u).first();
            if (!p)
                throw new HttpError(404, '프로젝트를 찾을 수 없습니다.');
            return Response.json({ ...p, scene: JSON.parse(p.scene as string) }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const rows = await db().prepare('SELECT id,name,revision,updated_at FROM projects WHERE owner=? ORDER BY updated_at DESC LIMIT 100').bind(u).all();
        return Response.json({ projects: rows.results }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        return fail(e);
    }
}
export async function POST(req: Request) {
    try {
        sameOrigin(req);
        const u = await owner(), b = await jsonBody(req);
        let scene;
        try {
            scene = validateScene(b.scene);
        }
        catch (e) {
            throw new HttpError(400, e instanceof Error && e.name !== 'ZodError' ? e.message : '장면 데이터를 확인해 주세요.');
        }
        const id = typeof b.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(b.id) ? b.id : crypto.randomUUID();
        const revision = b.revision;
        const now = new Date().toISOString();
        const designs=[scene,...(scene.variants??[]).map(v=>v.design)];
        const photoIds=[...new Set(designs.flatMap(s=>s.photoId?[s.photoId]:[]))];
        for(const photoId of photoIds){const photo=await db().prepare('SELECT id FROM photos WHERE id=? AND owner=?').bind(photoId,u).first();if(!photo)throw new HttpError(400,'현재 장면 또는 디자인 안의 사진을 사용할 수 없습니다.');}
        const references=[...designs.flatMap(s=>s.nodes.filter(n=>n.kind==='model').map(n=>[n.assetId!,'model'] as const)),...(scene.renders??[]).map(r=>[r.id,'render'] as const),...designs.flatMap(s=>imageReferences(s).map(id=>[id,'image'] as const))];
        await assertOwnedAssets(u,references,'현재 장면 또는 디자인 안의 모델·시안·이미지에 접근할 수 없습니다. 같은 계정에서 불러오거나 해당 항목을 제거하세요.');
        if (revision === 0) {
            try {
                await db().prepare('INSERT INTO projects(id,owner,name,scene,revision,updated_at) VALUES(?,?,?,?,1,?)').bind(id, u, scene.name, JSON.stringify(scene), now).run();
            }
            catch {
                throw new HttpError(409, '같은 프로젝트가 이미 있습니다. 다시 불러오거나 새 사본으로 저장하세요.');
            }
            return Response.json({ id, revision: 1, updated_at: now });
        }
        if (!Number.isInteger(revision) || revision < 1)
            throw new HttpError(400, '저장 버전을 확인해 주세요.');
        const r = await db().prepare('UPDATE projects SET name=?,scene=?,revision=revision+1,updated_at=? WHERE id=? AND owner=? AND revision=?').bind(scene.name, JSON.stringify(scene), now, id, u, revision).run();
        if (!r.meta.changes)
            throw new HttpError(409, '다른 창에서 수정된 프로젝트입니다. 현재 작업을 사본으로 저장해 주세요.');
        return Response.json({ id, revision: revision + 1, updated_at: now });
    }
    catch (e) {
        return fail(e);
    }
}
