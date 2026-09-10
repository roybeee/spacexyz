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
export const facadeSchema = z.object({
    sign: z.object({logoId:z.string().uuid().nullable().optional(),logoScale:z.number().min(.1).max(1).optional(),enabled:z.boolean(),text:z.string().min(1).max(60).regex(/^[^\n\r\t]+$/),font:z.enum(['sans','serif','condensed']),width:z.number().finite().min(600).max(19800),height:z.number().finite().min(100).max(1400),x:z.number().finite().min(-10000).max(10000),bottom:z.number().finite().min(0).max(5900),depth:z.number().finite().min(40).max(400),material:z.enum(materialIds),color:hex,textColor:hex,illuminated:z.boolean()}),
    awning: z.object({enabled:z.boolean(),width:z.number().finite().min(600).max(19800),x:z.number().finite().min(-10000).max(10000),mount:z.number().finite().min(1000).max(6000),projection:z.number().finite().min(200).max(2400),drop:z.number().finite().min(0).max(1200),valance:z.number().finite().min(0).max(400),color:hex,stripeColor:hex,striped:z.boolean(),stripeWidth:z.number().finite().min(80).max(500)})
});
export type FacadeData=z.infer<typeof facadeSchema>;
export function validateFacade(room:{width:number;height:number},facade?:FacadeData){
    if(!facade)return;
    const {sign,awning}=facade;
    for(const [name,part] of [['간판',sign],['어닝',awning]] as const){if(part.enabled&&Math.abs(part.x)+part.width/2>room.width/2-100)throw new Error(`${name}이 전면 폭을 벗어납니다. 양끝 100mm 여유를 확보하세요.`)}
    if(sign.enabled&&sign.bottom+sign.height>room.height)throw new Error('간판 상단이 매장 높이를 벗어납니다.');
    if(awning.enabled){if(awning.mount>room.height||awning.mount+20>room.height)throw new Error('어닝 설치 높이가 매장 높이를 벗어납니다.');if(awning.mount-awning.drop-awning.valance<1000)throw new Error('어닝 하단 높이가 1,000mm 미만입니다. 설치 높이와 경사를 조정하세요.');if(awning.drop>awning.projection)throw new Error('어닝의 내려가는 높이는 돌출 길이 이내로 입력하세요.');if(sign.enabled&&Math.abs(sign.x-awning.x)<(sign.width+awning.width)/2&&awning.mount+20>sign.bottom&&awning.mount-awning.drop-awning.valance<sign.bottom+sign.height)throw new Error('간판과 어닝이 겹칩니다. 어닝을 간판 아래로 조정하세요.');}
}
export const finishSchema = z.object({ textureId:z.string().uuid().nullable().optional(), color: hex.optional(), roughness: z.number().min(0).max(1).optional(), metalness: z.number().min(0).max(1).optional(), scale: z.number().min(50).max(5000).optional(), rotation: z.number().min(-180).max(180).optional() });
export type MaterialFinish = z.infer<typeof finishSchema>;
export const nodeSchema = z.object({ id: z.string().min(1).max(80), kind: z.enum([...kinds, 'model']), assetId: z.string().uuid().optional(), name: z.string().max(80), x: z.number().finite().min(-30000).max(30000), y: z.number().finite().min(0).max(12000), z: z.number().finite().min(-30000).max(30000), width: z.number().finite().min(20).max(20000), height: z.number().finite().min(20).max(12000), depth: z.number().finite().min(20).max(20000), rotation: z.number().finite().min(-3600).max(3600), material: z.enum(materialIds), faces: z.record(z.enum(materialIds)).default({}), color: hex.optional(), finish: finishSchema.optional(), faceFinishes: z.record(z.string().max(60), finishSchema).optional(), uniformMaterial: z.boolean().optional(), estimated: z.boolean().optional(), locked: z.boolean().default(false), hidden: z.boolean().default(false), host: z.enum(['back', 'left', 'right', 'front']).optional() });
export type SceneNode = z.infer<typeof nodeSchema>;
const surface = z.object({ material: z.enum(materialIds), color: hex.optional(), finish: finishSchema.optional() });
export const coreSceneSchema = z.object({ version: z.literal(1), name: z.string().min(1).max(100), room: z.object({ width: z.number().min(2400).max(20000), depth: z.number().min(2400).max(20000), height: z.number().min(2200).max(6000), source: z.enum(['example', 'entered', 'measured']), surfaces: z.object({ floor: surface, back: surface, left: surface, right: surface, front: surface }) }), nodes: z.array(nodeSchema).max(300), facade: facadeSchema.optional(), lighting: z.object({ intensity: z.number().min(.2).max(2), warmth: z.number().min(2700).max(6500) }), photoId: z.string().max(80).optional(), renders: z.array(z.object({ id: z.string().uuid(), name: z.string().max(100), createdAt: z.string().datetime(), prompt: z.string().max(2000) })).max(20).optional(), palette: z.array(hex).max(8).optional(), draft: z.object({ method: z.enum(['photo-ai', 'template']), summary: z.string().max(1000), notes: z.array(z.string().max(500)).max(30) }).optional(), cameras: z.array(z.object({ id: z.string().max(80), name: z.string().max(80), view: z.enum(['perspective', 'top', 'front', 'interior']).optional(), zoom: z.number().min(.01).max(100).optional(), position: z.tuple([z.number().finite().min(-200).max(200), z.number().finite().min(-200).max(200), z.number().finite().min(-200).max(200)]), target: z.tuple([z.number().finite().min(-200).max(200), z.number().finite().min(-200).max(200), z.number().finite().min(-200).max(200)]) })).max(10).default([]) });
export const designSchema=coreSceneSchema.pick({room:true,nodes:true,lighting:true,photoId:true,palette:true,draft:true,facade:true});
export const variantSchema=z.object({id:z.string().uuid(),name:z.string().min(1).max(60),note:z.string().max(400),createdAt:z.string().datetime(),design:designSchema});
export const sceneSchema=coreSceneSchema.extend({variants:z.array(variantSchema).max(6).optional()});
export type DesignVariant=z.infer<typeof variantSchema>;
export type RenderResult = {
    id: string;
    name: string;
    createdAt: string;
    prompt: string;
};
export type SceneData = z.infer<typeof sceneSchema>;
export type Selection = {
    id: string;
    face?: string;
    ids?: string[];
} | null;
export const surfaceNames: Record<string, string> = { floor: '바닥', back: '안쪽 벽', left: '왼쪽 벽', right: '오른쪽 벽', front: '입구 벽' };
export const kindNames: Record<SceneNode['kind'], string> = { table: '카페 테이블', 'round-table': '원형 테이블', chair: '다이닝 체어', bench: '붙박이 벤치', counter: '카운터', shelf: '오픈 선반', plant: '실내 식물', pendant: '펜던트 조명', box: '직육면체', cylinder: '원기둥', partition: '파티션', door: '출입문', window: '창문', model: '가져온 3D 모델' };
const dims: Record<Kind, [
    number,
    number,
    number,
    MaterialId
]> = { table: [750, 740, 750, 'oak'], 'round-table': [800, 740, 800, 'oak'], chair: [460, 800, 480, 'oak'], bench: [2800, 800, 600, 'linen'], counter: [2600, 1050, 750, 'steel'], shelf: [1100, 1900, 380, 'oak'], plant: [480, 1500, 480, 'sage'], pendant: [450, 350, 450, 'charcoal'], box: [1000, 500, 600, 'oak'], cylinder: [600, 700, 600, 'concrete'], partition: [2000, 1200, 120, 'plaster'], door: [950, 2100, 160, 'oak'], window: [1800, 1300, 160, 'glass'] };
export function createNode(kind: Kind, id: string, x = 0, z = 0): SceneNode { const [width, height, depth, material] = dims[kind]; return { id, kind, name: kindNames[kind], x, y: kind === 'pendant' ? 2300 : kind === 'window' ? 900 : 0, z, width, height, depth, rotation: 0, material, faces: {}, locked: false, hidden: false, ...(kind === 'window' || kind === 'door' ? { host: 'back' as const } : {}) }; }
export function initialScene(): SceneData { const a: SceneNode[] = []; const add = (k: Kind, id: string, x: number, z: number, extra: Partial<SceneNode> = {}) => a.push({ ...createNode(k, id, x, z), ...extra }); add('counter', 'counter', -1500, -2100); add('shelf', 'shelf', -1900, -2920, { width: 1800, height: 2000, depth: 300 }); add('bench', 'bench', 2960, 100, { width: 3800, rotation: 90 }); [-1300, 0, 1300].forEach((z, i) => { add('table', `table-${i}`, 2040, z); add('chair', `chair-${i}`, 1200, z, { rotation: -90 }); }); add('plant', 'plant', -2900, -2650); add('plant', 'plant2', 2900, -2650, { height: 1200, width: 380, depth: 380 }); add('round-table', 'round', -1700, 1250, { width: 900, depth: 900 }); add('chair', 'round-chair1', -2600, 1250, { rotation: -90 }); add('chair', 'round-chair2', -800, 1250, { rotation: 90 }); add('pendant', 'lamp', -1500, -1700, { y: 2350 }); add('pendant', 'lamp2', 2100, 0, { y: 2350 }); add('window', 'window-left', 0, 600, { host: 'left', width: 2200, y: 850, height: 1450 }); add('door', 'door-front', -1600, 0, { host: 'front' }); return { version: 1, name: 'OFD · 스토어 컨셉', room: { width: 7200, depth: 6400, height: 2900, source: 'example', surfaces: { floor: { material: 'terrazzo' }, back: { material: 'plaster' }, left: { material: 'plaster' }, right: { material: 'plaster' }, front: { material: 'plaster' } } }, nodes: a, lighting: { intensity: 1, warmth: 4200 }, cameras: [] }; }
export function imageReferences(s:Pick<SceneData,'room'|'nodes'|'facade'>):string[]{return [...new Set([...Object.values(s.room.surfaces).map(v=>v.finish?.textureId),...s.nodes.flatMap(n=>[n.finish?.textureId,...Object.values(n.faceFinishes??{}).map(f=>f.textureId)]),s.facade?.sign.logoId].filter((id):id is string=>!!id))];}
export function validateScene(input: unknown): SceneData {
    const s = sceneSchema.parse(input);
    validateLayout(s);
    const variantIds=new Set<string>();
    for(const v of s.variants??[]){if(variantIds.has(v.id))throw new Error('디자인 안 ID가 중복되었습니다.');variantIds.add(v.id);validateLayout(v.design)}
    if(new TextEncoder().encode(JSON.stringify(s)).length>1400000)throw new Error('프로젝트 크기가 너무 큽니다. 사용하지 않는 디자인 안을 제거하세요.');

    return s;
}
function validateLayout(s:Pick<SceneData,'room'|'nodes'|'facade'>){
    if(imageReferences(s).length>8)throw new Error('한 디자인에 이미지 8개까지 사용할 수 있습니다. 사용하지 않는 소재·로고 이미지를 제거하세요.');
    validateFacade(s.room,s.facade);
    if (s.nodes.filter(n => n.kind === 'model').length > 20)
        throw new Error('외부 모델은 장면당 20개까지 배치할 수 있습니다.');
    const sign=s.facade?.sign;
    if(sign?.enabled&&s.nodes.some(n=>n.host==='front'&&!n.hidden&&Math.abs(n.x-sign.x)<(n.width+sign.width)/2&&n.y<sign.bottom+sign.height&&n.y+n.height>sign.bottom))throw new Error('간판이 전면 문·창문을 가립니다. 간판 높이를 올리거나 유리 전면을 새로 구성하세요.');
    const ids = new Set<string>();
    for (const n of s.nodes) {
        if (ids.has(n.id) || Object.hasOwn(surfaceNames, n.id) || n.id==='facade-sign' || n.id==='facade-awning')
            throw new Error('요소 ID가 중복되었습니다.');
        ids.add(n.id);
        if (n.kind === 'model' && !n.assetId)
            throw new Error('3D 모델 원본 파일을 지정하세요.');
        if (n.kind !== 'model' && n.assetId)
            throw new Error('모델 파일은 가져온 모델에만 연결할 수 있습니다.');
        const minimum: Partial<Record<SceneNode['kind'], [
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
    }
    for (const host of ['back', 'front', 'left', 'right']) {
        const openings = s.nodes.filter(n => n.host === host && !n.hidden);
        for (let i = 0; i < openings.length; i++)
            for (let j = i + 1; j < openings.length; j++) {
                const a = openings[i], b = openings[j];
                const ax = ['back', 'front'].includes(host) ? a.x : a.z, bx = ['back', 'front'].includes(host) ? b.x : b.z;
                if (Math.abs(ax - bx) < (a.width + b.width) / 2 && a.y < b.y + b.height && b.y < a.y + a.height)
                    throw new Error('문과 창문이 겹칩니다. 위치를 조정하세요.');
            }
    }
}
export const commandSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('material'), target: z.string(), material: z.enum(materialIds), color: hex.optional() }),
    z.object({ type: z.literal('resize'), target: z.string(), axis: z.enum(['width', 'height', 'depth']), value: z.number().min(20).max(20000) }),
    z.object({ type: z.literal('move'), target: z.string(), axis: z.enum(['x', 'y', 'z']), value: z.number().min(-20000).max(20000) }),
    z.object({ type: z.literal('rotate'), target: z.string(), value: z.number().min(-360).max(360) }),
    z.object({ type: z.literal('add'), kind: z.enum(kinds), count: z.number().int().min(1).max(10) }),
    z.object({ type: z.literal('light'), value: z.number().min(2700).max(6500) })
]);
export type SceneCommand = z.infer<typeof commandSchema>;
export function applyCommands(scene: SceneData, commands: SceneCommand[], idFactory = () => crypto.randomUUID()): SceneData {
    const s = structuredClone(scene);
    for (const raw of commands) {
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
            if (c.type === 'material' && Object.hasOwn(s.room.surfaces, id)) {
                s.room.surfaces[id as keyof typeof s.room.surfaces] = { material: c.material, ...(c.color ? { color: c.color } : {}) };
                continue;
            }
            if (!n)
                throw new Error(`요소를 찾을 수 없습니다: ${id}`);
            if (c.type === 'material') {
                n.material = c.material;
                n.faces = {};
                n.faceFinishes = {};
                n.finish = {};
                n.uniformMaterial = true;
                n.color = c.color;
            }
            else if (c.type === 'resize')
                n[c.axis] = c.value;
            else if (c.type === 'move')
                n[c.axis] = c.value;
            else if (c.type === 'rotate')
                n.rotation = c.value;
        }
    }
    return validateScene(s);
}
export function quickCommands(text: string, selection: Selection): SceneCommand[] | null {
    const t = text.trim();
    if (/(하지\s*마|바꾸지|않|제외|그리고|대신|유지)/.test(t))
        return null;
    const mat = materials.find(m => t.includes(m.name)) ?? (t.includes('우드') || t.includes('오크') ? materials[1] : t.includes('화이트') ? materials[0] : t.includes('스틸') ? materials[5] : t.includes('월넛') ? materials[2] : null);
    if (mat) {
        const target = t.includes('벽') ? 'walls' : t.includes('바닥') ? 'floor' : t.includes('테이블') ? 'tables' : selection?.id;
        if (target){const targets=selection?.ids?.length&&target===selection.id?selection.ids:[target];return targets.map(target=>({type:'material' as const,target,material:mat.id}));}
    }
    const add = t.match(/(테이블|의자|벤치|파티션)\s*(\d+)\s*개/);
    if (add)
        return [{ type: 'add', kind: ({ '테이블': 'table', '의자': 'chair', '벤치': 'bench', '파티션': 'partition' } as Record<string, Kind>)[add[1]], count: Number(add[2]) }];
    const size = t.match(/(높이|가로|폭|깊이)\D*(\d+(?:\.\d+)?)\s*(mm|cm|m|밀리|센티)?/i);
    if (size && selection && !selection.ids?.length && !surfaceNames[selection.id])
        return [{ type: 'resize', target: selection.id, axis: size[1] === '높이' ? 'height' : size[1] === '깊이' ? 'depth' : 'width', value: Number(size[2]) * (size[3] === 'cm' || size[3] === '센티' ? 10 : size[3] === 'm' ? 1000 : 1) }];
    if (t.includes('따뜻') && t.includes('조명'))
        return [{ type: 'light', value: 3000 }];
    return null;
}
export function partDefaultMaterial(node: SceneNode, part: string): MaterialId {
    if (node.uniformMaterial)
        return node.material;
    if ((node.kind === 'table' || node.kind === 'round-table') && (part === 'stem' || part === 'base'))
        return 'charcoal';
    if (node.kind === 'chair' && part.startsWith('leg'))
        return 'charcoal';
    if (node.kind === 'bench' && part === 'base')
        return 'oak';
    if (node.kind === 'counter' && part.startsWith('joint'))
        return 'charcoal';
    if (node.kind === 'plant' && part === 'pot')
        return 'concrete';
    if (node.kind === 'plant' && part === 'trunk')
        return 'walnut';
    if (node.kind === 'pendant' && part === 'cord')
        return 'charcoal';
    if ((node.kind === 'door' || node.kind === 'window') && (part.startsWith('frame') || part === 'divider'))
        return 'charcoal';
    if (node.kind === 'door' && part === 'handle')
        return 'steel';
    return node.material;
}
export function nodeAppearance(node: SceneNode, face?: string) {
    const material = face ? (node.faces[face] ?? partDefaultMaterial(node, face.split(':')[0])) : node.material;
    const finish: MaterialFinish = face && node.faces[face] ? { ...node.faceFinishes?.[face] } : { ...(node.color ? { color: node.color } : {}), ...node.finish, ...(face ? node.faceFinishes?.[face] : {}) };
    const original = node.kind === 'model' && !node.uniformMaterial && !(face && node.faces[face]) && !finish.textureId;
    return { material, finish, original };
}
export function selectionAppearance(scene: SceneData, selection: Selection) {
    if (!selection)
        return null;
    if (Object.hasOwn(scene.room.surfaces, selection.id)) {
        const s = scene.room.surfaces[selection.id as keyof SceneData['room']['surfaces']];
        return { material: s.material, finish: { ...(s.color ? { color: s.color } : {}), ...s.finish } as MaterialFinish };
    }
    const n = scene.nodes.find(n => n.id === selection.id);
    return n ? nodeAppearance(n, selection.face) : null;
}
export function editAppearance(scene: SceneData, selection: Selection, patch: {
    material?: MaterialId;
    finish?: MaterialFinish;
}, scope: 'face' | 'object' = 'face'): SceneData {
    if (!selection)
        throw new Error('소재를 바꿀 요소를 선택하세요.');
    const s = structuredClone(scene);
    if (Object.hasOwn(s.room.surfaces, selection.id)) {
        const surface = s.room.surfaces[selection.id as keyof SceneData['room']['surfaces']];
        if (patch.material) {
            surface.material = patch.material;
            delete surface.color;
            surface.finish = {};
        }
        if (patch.finish)
            surface.finish = { ...surface.finish, ...patch.finish };
        return validateScene(s);
    }
    const n = s.nodes.find(n => n.id === selection.id);
    if (!n)
        throw new Error('요소를 찾을 수 없습니다.');
    if (n.locked)
        throw new Error('잠금을 해제한 뒤 소재를 바꾸세요.');
    if (scope === 'face' && selection.face) {
        const key = selection.face;
        if (patch.material) {
            n.faces[key] = patch.material;
            n.faceFinishes = { ...n.faceFinishes, [key]: {} };
        }
        if (patch.finish)
            n.faceFinishes = { ...n.faceFinishes, [key]: { ...n.faceFinishes?.[key], ...patch.finish } };
    }
    else {
        if (patch.material) {
            n.material = patch.material;
            n.uniformMaterial = true;
            n.faces = {};
            n.faceFinishes = {};
            n.finish = {};
            delete n.color;
        }
        if (patch.finish) {
            n.finish = { ...n.finish, ...patch.finish };
            for (const key of new Set([...Object.keys(n.faces), ...Object.keys(n.faceFinishes ?? {})]))
                n.faceFinishes = { ...n.faceFinishes, [key]: { ...n.faceFinishes?.[key], ...patch.finish } };
        }
    }
    return validateScene(s);
}
export function footprint(node: SceneNode) { const r = node.rotation * Math.PI / 180; return { width: Math.abs(Math.cos(r)) * node.width + Math.abs(Math.sin(r)) * node.depth, depth: Math.abs(Math.sin(r)) * node.width + Math.abs(Math.cos(r)) * node.depth }; }
export function arrayNode(scene: SceneData, id: string, count: number, gap: number, axis: 'x' | 'z', idFactory = () => crypto.randomUUID()): SceneData {
    if (!Number.isInteger(count) || count < 1 || count > 12 || !Number.isFinite(gap) || gap < 0 || gap > 5000)
        throw new Error('복제 수 1~12개, 간격 0~5,000mm를 입력하세요.');
    const n = scene.nodes.find(n => n.id === id);
    if (!n)
        throw new Error('복제할 요소를 선택하세요.');
    if (n.locked)
        throw new Error('잠긴 요소는 배열할 수 없습니다.');
    if (n.host && axis !== (['back', 'front'].includes(n.host) ? 'x' : 'z'))
        throw new Error('문·창문은 연결된 벽 방향으로 배열하세요.');
    const f = footprint(n), step = (n.host ? n.width : axis === 'x' ? f.width : f.depth) + gap;
    const s = structuredClone(scene);
    for (let i = 1; i <= count; i++)
        s.nodes.push({ ...structuredClone(n), id: idFactory(), name: `${n.name.slice(0, 65)} ${i + 1}`, [axis]: n[axis] + step * i });
    return validateScene(s);
}
export function placeAgainst(scene: SceneData, id: string, edge: 'left' | 'right' | 'back' | 'front' | 'center'): SceneData {
    const s = structuredClone(scene), n = s.nodes.find(n => n.id === id);
    if (!n || n.host)
        throw new Error('일반 가구를 선택하세요.');
    if (n.locked)
        throw new Error('잠금을 해제하세요.');
    const f = footprint(n), margin = 65;
    if (edge === 'left')
        n.x = -s.room.width / 2 + f.width / 2 + margin;
    if (edge === 'right')
        n.x = s.room.width / 2 - f.width / 2 - margin;
    if (edge === 'back')
        n.z = -s.room.depth / 2 + f.depth / 2 + margin;
    if (edge === 'front')
        n.z = s.room.depth / 2 - f.depth / 2 - margin;
    if (edge === 'center') {
        n.x = 0;
        n.z = 0;
    }
    return validateScene(s);
}
export function collisions(scene: SceneData) {
    const list = scene.nodes.filter(n => !n.hidden && !n.host), out: {
        a: string;
        b: string;
        names: [
            string,
            string
        ];
    }[] = [];
    for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            if (a.y + a.height <= b.y + 2 || b.y + b.height <= a.y + 2)
                continue;
            const ra = a.rotation * Math.PI / 180, rb = b.rotation * Math.PI / 180;
            const ax = [Math.cos(ra), -Math.sin(ra)], az = [Math.sin(ra), Math.cos(ra)], bx = [Math.cos(rb), -Math.sin(rb)], bz = [Math.sin(rb), Math.cos(rb)];
            const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1], diff = [b.x - a.x, b.z - a.z];
            const separated = [ax, az, bx, bz].some(v => Math.abs(dot(diff, v)) >= Math.abs(dot(ax, v)) * a.width / 2 + Math.abs(dot(az, v)) * a.depth / 2 + Math.abs(dot(bx, v)) * b.width / 2 + Math.abs(dot(bz, v)) * b.depth / 2 - 2);
            if (!separated)
                out.push({ a: a.id, b: b.id, names: [a.name, b.name] });
        }
    return out;
}
