import { z } from 'zod';
export const materialIds = ['plaster', 'oak', 'walnut', 'concrete', 'terrazzo', 'steel', 'charcoal', 'sage', 'clay', 'linen', 'white-tile', 'glass'] as const;
export const kinds = ['table', 'round-table', 'chair', 'bench', 'counter', 'shelf', 'plant', 'pendant', 'box', 'cylinder', 'partition', 'door', 'window'] as const;
export type Kind = typeof kinds[number];
export type MaterialId = typeof materialIds[number];
export const materials: {
    id: MaterialId;
    name: string;
    group: string;
    color: string;
    roughness: number;
    metalness: number;
    pattern: string;
}[] = [
    { id: 'plaster', name: '웜 화이트', group: '페인트', color: '#e9e5dc', roughness: .9, metalness: 0, pattern: 'plain' },
    { id: 'oak', name: '내추럴 오크', group: '우드', color: '#c7a477', roughness: .65, metalness: 0, pattern: 'wood' },
    { id: 'walnut', name: '딥 월넛', group: '우드', color: '#77513d', roughness: .58, metalness: 0, pattern: 'wood' },
    { id: 'concrete', name: '라이트 콘크리트', group: '스톤', color: '#b4b5b0', roughness: .93, metalness: 0, pattern: 'stone' },
    { id: 'terrazzo', name: '샌드 테라조', group: '스톤', color: '#d0c8b9', roughness: .76, metalness: 0, pattern: 'terrazzo' },
    { id: 'steel', name: '브러시드 스틸', group: '메탈', color: '#bfc5ca', roughness: .3, metalness: .85, pattern: 'steel' },
    { id: 'charcoal', name: '매트 차콜', group: '페인트', color: '#353a3d', roughness: .72, metalness: .1, pattern: 'plain' },
    { id: 'sage', name: '올리브 그린', group: '페인트', color: '#777e61', roughness: .88, metalness: 0, pattern: 'plain' },
    { id: 'clay', name: '테라코타', group: '페인트', color: '#b7785e', roughness: .9, metalness: 0, pattern: 'plain' },
    { id: 'linen', name: '아이보리 패브릭', group: '패브릭', color: '#d8d0bd', roughness: 1, metalness: 0, pattern: 'fabric' },
    { id: 'white-tile', name: '화이트 타일', group: '타일', color: '#e4e4dd', roughness: .35, metalness: 0, pattern: 'tile' },
    { id: 'glass', name: '클리어 글라스', group: '유리', color: '#c8e1e5', roughness: .08, metalness: .05, pattern: 'plain' }
];
const hex = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const nodeSchema = z.object({ id: z.string().min(1).max(80), kind: z.enum(kinds), name: z.string().max(80), x: z.number().finite().min(-30000).max(30000), y: z.number().finite().min(0).max(12000), z: z.number().finite().min(-30000).max(30000), width: z.number().finite().min(20).max(20000), height: z.number().finite().min(20).max(12000), depth: z.number().finite().min(20).max(20000), rotation: z.number().finite().min(-3600).max(3600), material: z.enum(materialIds), faces: z.record(z.enum(materialIds)).default({}), color: hex.optional(), locked: z.boolean().default(false), hidden: z.boolean().default(false), host: z.enum(['back', 'left', 'right', 'front']).optional() });
export type SceneNode = z.infer<typeof nodeSchema>;
const surface = z.object({ material: z.enum(materialIds), color: hex.optional() });
export const sceneSchema = z.object({ version: z.literal(1), name: z.string().min(1).max(100), room: z.object({ width: z.number().min(2400).max(20000), depth: z.number().min(2400).max(20000), height: z.number().min(2200).max(6000), source: z.enum(['example', 'entered', 'measured']), surfaces: z.object({ floor: surface, back: surface, left: surface, right: surface, front: surface }) }), nodes: z.array(nodeSchema).max(300), lighting: z.object({ intensity: z.number().min(.2).max(2), warmth: z.number().min(2700).max(6500) }), photoId: z.string().max(80).optional(), palette: z.array(hex).max(8).optional(), cameras: z.array(z.object({ id: z.string().max(80), name: z.string().max(80), position: z.tuple([z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100)]), target: z.tuple([z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100), z.number().finite().min(-100).max(100)]) })).max(10).default([]) });
export type SceneData = z.infer<typeof sceneSchema>;
export type Selection = {
    id: string;
    face?: string;
} | null;
export const surfaceNames: Record<string, string> = { floor: '바닥', back: '안쪽 벽', left: '왼쪽 벽', right: '오른쪽 벽', front: '입구 벽' };
export const kindNames: Record<Kind, string> = { table: '카페 테이블', 'round-table': '원형 테이블', chair: '다이닝 체어', bench: '붙박이 벤치', counter: '카운터', shelf: '오픈 선반', plant: '실내 식물', pendant: '펜던트 조명', box: '직육면체', cylinder: '원기둥', partition: '파티션', door: '출입문', window: '창문' };
const dims: Record<Kind, [
    number,
    number,
    number,
    MaterialId
]> = { table: [750, 740, 750, 'oak'], 'round-table': [800, 740, 800, 'oak'], chair: [460, 800, 480, 'oak'], bench: [2800, 800, 600, 'linen'], counter: [2600, 1050, 750, 'steel'], shelf: [1100, 1900, 380, 'oak'], plant: [480, 1500, 480, 'sage'], pendant: [450, 350, 450, 'charcoal'], box: [1000, 500, 600, 'oak'], cylinder: [600, 700, 600, 'concrete'], partition: [2000, 1200, 120, 'plaster'], door: [950, 2100, 160, 'oak'], window: [1800, 1300, 160, 'glass'] };
export function createNode(kind: Kind, id: string, x = 0, z = 0): SceneNode { const [width, height, depth, material] = dims[kind]; return { id, kind, name: kindNames[kind], x, y: kind === 'pendant' ? 2300 : kind === 'window' ? 900 : 0, z, width, height, depth, rotation: 0, material, faces: {}, locked: false, hidden: false, ...(kind === 'window' || kind === 'door' ? { host: 'back' as const } : {}) }; }
export function initialScene(): SceneData { const a: SceneNode[] = []; const add = (k: Kind, id: string, x: number, z: number, extra: Partial<SceneNode> = {}) => a.push({ ...createNode(k, id, x, z), ...extra }); add('counter', 'counter', -1500, -2100); add('shelf', 'shelf', -1900, -2920, { width: 1800, height: 2000, depth: 300 }); add('bench', 'bench', 2960, 100, { width: 3800, rotation: 90 }); [-1300, 0, 1300].forEach((z, i) => { add('table', `table-${i}`, 2040, z); add('chair', `chair-${i}`, 1200, z, { rotation: -90 }); }); add('plant', 'plant', -2900, -2650); add('plant', 'plant2', 2900, -2650, { height: 1200, width: 380, depth: 380 }); add('round-table', 'round', -1700, 1250, { width: 900, depth: 900 }); add('chair', 'round-chair1', -2600, 1250, { rotation: -90 }); add('chair', 'round-chair2', -800, 1250, { rotation: 90 }); add('pendant', 'lamp', -1500, -1700, { y: 2350 }); add('pendant', 'lamp2', 2100, 0, { y: 2350 }); add('window', 'window-left', 0, 600, { host: 'left', width: 2200, y: 850, height: 1450 }); add('door', 'door-front', -1600, 0, { host: 'front' }); return { version: 1, name: 'OFD · 스토어 컨셉', room: { width: 7200, depth: 6400, height: 2900, source: 'example', surfaces: { floor: { material: 'terrazzo' }, back: { material: 'plaster' }, left: { material: 'plaster' }, right: { material: 'plaster' }, front: { material: 'plaster' } } }, nodes: a, lighting: { intensity: 1, warmth: 4200 }, cameras: [] }; }
export function validateScene(input: unknown): SceneData { const s = sceneSchema.parse(input); const ids = new Set<string>(); for (const n of s.nodes) {
    if (ids.has(n.id) || n.id in surfaceNames)
        throw new Error('요소 ID가 중복되었습니다.');
    ids.add(n.id);
    const minimum: Partial<Record<Kind, [
        number,
        number,
        number
    ]>> = { table: [250, 200, 250], 'round-table': [250, 200, 250], chair: [250, 350, 250], bench: [300, 400, 300], counter: [300, 300, 250], shelf: [200, 200, 100], plant: [100, 300, 100], pendant: [100, 100, 100], door: [300, 800, 20], window: [200, 200, 20] };
    const mn = minimum[n.kind];
    if (mn && (n.width < mn[0] || n.height < mn[1] || n.depth < mn[2]))
        throw new Error(`${n.name}: 최소 가로 ${mn[0]} · 높이 ${mn[1]} · 깊이 ${mn[2]}mm가 필요합니다.`);
    if (n.host) {
        if (n.rotation !== 0 || (['back', 'front'].includes(n.host) ? n.z !== 0 : n.x !== 0))
            throw new Error('문·창문은 벽을 따라 이동할 수 있고 회전할 수 없습니다.');
        const width = ['back', 'front'].includes(n.host) ? s.room.width : s.room.depth;
        const along = ['back', 'front'].includes(n.host) ? n.x : n.z;
        if (Math.abs(along) + n.width / 2 > width / 2 - 100 || n.y + n.height > s.room.height)
            throw new Error(`${n.name}이 벽 범위를 벗어납니다.`);
        if (n.kind !== 'door' && n.kind !== 'window')
            throw new Error('문과 창문만 벽에 연결할 수 있습니다.');
    }
    else if (n.kind === 'door' || n.kind === 'window')
        throw new Error('문 또는 창문의 벽을 지정하세요.');
    else {
        const r = n.rotation * Math.PI / 180;
        const bw = Math.abs(Math.cos(r)) * n.width + Math.abs(Math.sin(r)) * n.depth;
        const bd = Math.abs(Math.sin(r)) * n.width + Math.abs(Math.cos(r)) * n.depth;
        if (Math.abs(n.x) + bw / 2 > s.room.width / 2 + 1 || Math.abs(n.z) + bd / 2 > s.room.depth / 2 + 1)
            throw new Error(`${n.name}이 바닥 경계를 벗어납니다.`);
        if (n.y + n.height > s.room.height + 1)
            throw new Error(`${n.name}이 천장보다 높습니다.`);
    }
} for (const host of ['back', 'front', 'left', 'right']) {
    const openings = s.nodes.filter(n => n.host === host && !n.hidden);
    for (let i = 0; i < openings.length; i++)
        for (let j = i + 1; j < openings.length; j++) {
            const a = openings[i], b = openings[j];
            const ax = ['back', 'front'].includes(host) ? a.x : a.z, bx = ['back', 'front'].includes(host) ? b.x : b.z;
            if (Math.abs(ax - bx) < (a.width + b.width) / 2 && a.y < b.y + b.height && b.y < a.y + a.height)
                throw new Error('문과 창문이 겹칩니다. 위치를 조정하세요.');
        }
} return s; }
export const commandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('material'), target: z.string(), material: z.enum(materialIds), color: hex.optional() }),
    z.object({ type: z.literal('resize'), target: z.string(), axis: z.enum(['width', 'height', 'depth']), value: z.number().min(20).max(20000) }),
    z.object({ type: z.literal('move'), target: z.string(), axis: z.enum(['x', 'y', 'z']), value: z.number().min(-20000).max(20000) }),
    z.object({ type: z.literal('rotate'), target: z.string(), value: z.number().min(-360).max(360) }),
    z.object({ type: z.literal('add'), kind: z.enum(kinds), count: z.number().int().min(1).max(10) }),
    z.object({ type: z.literal('light'), value: z.number().min(2700).max(6500) })
]);
export type SceneCommand = z.infer<typeof commandSchema>;
export function applyCommands(scene: SceneData, commands: SceneCommand[], idFactory = () => crypto.randomUUID()): SceneData { const s = structuredClone(scene); for (const raw of commands) {
    const c = commandSchema.parse(raw);
    if (c.type === 'add') {
        for (let i = 0; i < c.count; i++) {
            const n = createNode(c.kind, idFactory(), (i - (c.count - 1) / 2) * 1000, 0);
            s.nodes.push(n);
        }
        continue;
    }
    if (c.type === 'light') {
        s.lighting.warmth = c.value;
        continue;
    }
    const targets = c.target === 'walls' ? ['back', 'left', 'right', 'front'] : c.target === 'tables' ? s.nodes.filter(n => n.kind === 'table' || n.kind === 'round-table').map(n => n.id) : [c.target];
    if (!targets.length)
        throw new Error('편집할 요소가 없습니다.');
    for (const id of targets) {
        const n = s.nodes.find(n => n.id === id);
        if (n?.locked)
            throw new Error(`${n.name}은 잠겨 있습니다.`);
        if (c.type === 'material' && id in s.room.surfaces) {
            s.room.surfaces[id as keyof typeof s.room.surfaces] = { material: c.material, ...(c.color ? { color: c.color } : {}) };
            continue;
        }
        if (!n)
            throw new Error(`요소를 찾을 수 없습니다: ${id}`);
        if (c.type === 'material') {
            n.material = c.material;
            n.faces = {};
            n.color = c.color;
        }
        else if (c.type === 'resize')
            n[c.axis] = c.value;
        else if (c.type === 'move')
            n[c.axis] = c.value;
        else if (c.type === 'rotate')
            n.rotation = c.value;
    }
} return validateScene(s); }
export function quickCommands(text: string, selection: Selection): SceneCommand[] | null { const t = text.trim(); const mat = materials.find(m => t.includes(m.name)) ?? (t.includes('우드') || t.includes('오크') ? materials[1] : t.includes('화이트') ? materials[0] : t.includes('스틸') ? materials[5] : t.includes('월넛') ? materials[2] : null); if (mat) {
    const target = t.includes('벽') ? 'walls' : t.includes('바닥') ? 'floor' : t.includes('테이블') ? 'tables' : selection?.id;
    if (target)
        return [{ type: 'material', target, material: mat.id }];
} const add = t.match(/(테이블|의자|벤치|파티션)\s*(\d+)\s*개/); if (add)
    return [{ type: 'add', kind: ({ '테이블': 'table', '의자': 'chair', '벤치': 'bench', '파티션': 'partition' } as Record<string, Kind>)[add[1]], count: Number(add[2]) }]; const size = t.match(/(높이|가로|폭|깊이)\D*(\d+(?:\.\d+)?)\s*(mm|cm|m|밀리|센티)?/i); if (size && selection && !surfaceNames[selection.id])
    return [{ type: 'resize', target: selection.id, axis: size[1] === '높이' ? 'height' : size[1] === '깊이' ? 'depth' : 'width', value: Number(size[2]) * (size[3] === 'cm' || size[3] === '센티' ? 10 : size[3] === 'm' ? 1000 : 1) }]; if (t.includes('따뜻') && t.includes('조명'))
    return [{ type: 'light', value: 3000 }]; return null; }
