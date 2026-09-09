import { z } from 'zod';
import { initialScene, createNode, validateScene, materialIds, kinds, footprint, collisions, type SceneData, type SceneNode } from './scene-model';
export const draftInputSchema = z.object({ width: z.number().min(2400).max(20000), depth: z.number().min(2400).max(20000), height: z.number().min(2200).max(6000), brand: z.enum(['ofd', 'oda', 'cafe']), name: z.string().min(1).max(100) });
export type DraftInput = z.infer<typeof draftInputSchema>;
const itemSchema = z.object({ kind: z.enum(kinds), name: z.string().min(1).max(80), x: z.number().finite(), y: z.number().finite().min(0), z: z.number().finite(), width: z.number().finite().min(20).max(20000), height: z.number().finite().min(20).max(6000), depth: z.number().finite().min(20).max(20000), rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]), material: z.enum(materialIds), host: z.enum(['back', 'front', 'left', 'right']).nullable() });
export const draftResultSchema = z.object({ summary: z.string().max(1000), notes: z.array(z.string().max(500)).max(12), wallMaterial: z.enum(materialIds), floorMaterial: z.enum(materialIds), warmth: z.number().min(2700).max(6500), items: z.array(itemSchema).min(1).max(30) });
const itemProperties = { kind: { type: 'string', enum: kinds }, name: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, depth: { type: 'number' }, rotation: { type: 'number', enum: [0, 90, 180, 270] }, material: { type: 'string', enum: materialIds }, host: { type: ['string', 'null'], enum: ['back', 'front', 'left', 'right', null] } };
export const draftOutputJSONSchema = { type: 'object', additionalProperties: false, required: ['summary', 'notes', 'wallMaterial', 'floorMaterial', 'warmth', 'items'], properties: { summary: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } }, wallMaterial: { type: 'string', enum: materialIds }, floorMaterial: { type: 'string', enum: materialIds }, warmth: { type: 'number' }, items: { type: 'array', items: { type: 'object', additionalProperties: false, required: Object.keys(itemProperties), properties: itemProperties } } } };
function emptyDraft(input: DraftInput): SceneData { const s = initialScene(); s.name = input.name; s.nodes = []; s.room.width = input.width; s.room.depth = input.depth; s.room.height = input.height; s.room.source = 'entered'; s.cameras = []; return s; }
export function buildPhotoDraft(input: DraftInput, result: unknown, idFactory = () => crypto.randomUUID()): SceneData {
    const q = draftInputSchema.parse(input), r = draftResultSchema.parse(result), s = emptyDraft(q), notes = [...r.notes];
    for (const key of ['back', 'front', 'left', 'right'] as const)
        s.room.surfaces[key] = { material: r.wallMaterial };
    s.room.surfaces.floor = { material: r.floorMaterial };
    s.lighting.warmth = r.warmth;
    for (const item of r.items) {
        const n: SceneNode = { ...createNode(item.kind, idFactory()), ...item, host: item.host ?? undefined, estimated: true };
        if (n.host) {
            if (!['door', 'window'].includes(n.kind))
                throw new Error(`${n.name}: 문·창문만 벽에 연결할 수 있습니다.`);
            n.rotation = 0;
            const side = ['back', 'front'].includes(n.host) ? 'x' : 'z', normal = side === 'x' ? 'z' : 'x', limit = (side === 'x' ? q.width : q.depth) / 2 - n.width / 2 - 100;
            if (limit < 0)
                throw new Error(`${n.name}이 벽보다 큽니다.`);
            const before = n[side];
            n[side] = Math.max(-limit, Math.min(limit, n[side]));
            n[normal] = 0;
            if (before !== n[side])
                notes.push(`${n.name}: 벽 범위 안으로 위치를 조정했습니다.`);
        }
        else {
            if (n.kind === 'door' || n.kind === 'window')
                throw new Error(`${n.name}: 연결할 벽이 없습니다.`);
            const f = footprint(n), maxX = q.width / 2 - f.width / 2 - 65, maxZ = q.depth / 2 - f.depth / 2 - 65;
            if (maxX < 0 || maxZ < 0)
                throw new Error(`${n.name}의 크기가 공간보다 큽니다.`);
            const x = n.x, z = n.z;
            n.x = Math.round(Math.max(-maxX, Math.min(maxX, x)));
            n.z = Math.round(Math.max(-maxZ, Math.min(maxZ, z)));
            if (x !== n.x || z !== n.z)
                notes.push(`${n.name}: 공간 경계 안으로 위치를 조정했습니다.`);
        }
        s.nodes.push(n);
    }
    s.draft = { method: 'photo-ai', summary: r.summary, notes: ['공간 크기는 입력값입니다. 사진에서 파악한 가구의 치수·위치·소재는 추정값이므로 현장에서 확인하세요.', ...notes].slice(0, 30) };
    return validateScene(s);
}
export function templateDraft(input: DraftInput, idFactory = () => crypto.randomUUID()): SceneData {
    const q = draftInputSchema.parse(input), s = emptyDraft(q), w = q.width, d = q.depth, notes: string[] = [];
    const add = (kind: typeof kinds[number], patch: Partial<SceneNode>) => {
        const n = { ...createNode(kind, idFactory()), ...patch, estimated: true };
        try {
            const candidate = validateScene({ ...s, nodes: [...s.nodes, n] });
            if (collisions(candidate).some(pair => pair.a === n.id || pair.b === n.id)) {
                notes.push(`${n.name}: 다른 가구와 겹쳐 기본 배치에서 제외했습니다.`);
                return;
            }
            s.nodes.push(n);
        }
        catch {
            notes.push(`${n.name}: 공간 크기에 맞지 않아 기본 배치에서 제외했습니다.`);
        }
    };
    const counterW = Math.max(600, Math.min(2500, w * .45)), cx = -w / 2 + counterW / 2 + 100, cz = -d / 2 + 1500;
    add('counter', { x: cx, z: cz, width: counterW, depth: 800, material: q.brand === 'oda' ? 'steel' : 'oak' });
    if (q.brand === 'oda')
        add('partition', { name: '카운터 위 가림판 · 높이 조정 가능', x: cx, z: cz - 340, width: counterW, height: 500, depth: 80, y: 1050, material: 'oak' });
    add('shelf', { x: cx, z: -d / 2 + 260, width: Math.min(1500, counterW), height: Math.min(1900, q.height - 200), depth: 300 });
    const benchW = Math.min(3800, Math.max(1200, d - 2300));
    add('bench', { x: w / 2 - 370, z: 500, width: benchW, depth: 600, rotation: 90, material: q.brand === 'oda' ? 'walnut' : 'linen' });
    const count = d >= 5500 ? 3 : d >= 4000 ? 2 : 1;
    for (let i = 0; i < count; i++) {
        const z = 500 + (i - (count - 1) / 2) * 1200;
        add('table', { x: w / 2 - 1350, z, width: 700, depth: 700, material: q.brand === 'oda' ? 'walnut' : 'oak' });
        add('chair', { x: w / 2 - 2200, z, rotation: -90 });
    }
    add('plant', { x: -w / 2 + 380, z: d / 2 - 380, width: 400, depth: 400, height: 1100 });
    if (w >= 5000 && d >= 5500) {
        add('round-table', { x: -w / 2 + 1450, z: d / 2 - 1450 });
        add('chair', { x: -w / 2 + 600, z: d / 2 - 1450, rotation: -90 });
        add('chair', { x: -w / 2 + 2300, z: d / 2 - 1450, rotation: 90 });
    }
    s.room.surfaces.floor = { material: q.brand === 'oda' ? 'concrete' : 'terrazzo' };
    s.lighting.warmth = q.brand === 'oda' ? 3500 : 4200;
    s.draft = { method: 'template', summary: `${q.brand === 'ofd' ? 'OFD' : q.brand === 'oda' ? 'ODA' : '카페'} 기본 배치 템플릿`, notes: ['선택한 브랜드 방향과 입력 치수로 만든 배치입니다. 사진 속 구조를 인식한 결과가 아닙니다.', '가구 치수와 배치는 제안값입니다. 현장과 실제 제품을 확인해 조정하세요.', ...notes].slice(0, 30) };
    return validateScene(s);
}
