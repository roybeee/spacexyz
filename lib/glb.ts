/** Strict, self-contained static GLB subset. Validate before any loader sees bytes. */
export const MODEL_LIMIT = 8 * 1024 * 1024;
export function inspectGlb(bytes: ArrayBuffer) {
    const fail = (message: string): never => { throw new Error(message); };
    if (bytes.byteLength < 20 || bytes.byteLength > MODEL_LIMIT)
        fail('GLB 파일은 8MB 이하로 선택하세요.');
    const v = new DataView(bytes);
    if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2 || v.getUint32(8, true) !== bytes.byteLength)
        fail('올바른 GLB 2.0 파일이 아닙니다.');
    let at = 12, doc: any, bin: Uint8Array | undefined;
    while (at < bytes.byteLength) {
        if (at + 8 > bytes.byteLength)
            fail('GLB 파일이 잘렸습니다.');
        const length = v.getUint32(at, true), type = v.getUint32(at + 4, true);
        at += 8;
        if (length % 4 || at + length > bytes.byteLength)
            fail('GLB 데이터 길이가 맞지 않습니다.');
        if (type === 0x4e4f534a) {
            if (doc || at !== 20 || length > 1000000)
                fail('GLB 구조 정보를 확인하세요.');
            try {
                doc = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, at, length)));
            }
            catch {
                fail('GLB 구조를 읽을 수 없습니다.');
            }
        }
        else if (type === 0x004e4942) {
            if (bin)
                fail('단일 바이너리 GLB만 지원합니다.');
            bin = new Uint8Array(bytes, at, length);
        }
        else
            fail('지원하지 않는 GLB 데이터입니다.');
        at += length;
    }
    if (!doc || doc.asset?.version !== '2.0' || !bin)
        fail('메시가 포함된 GLB 2.0 파일을 선택하세요.');
    if (!Array.isArray(doc.buffers) || doc.buffers.length !== 1 || doc.buffers[0].uri || !Number.isInteger(doc.buffers[0].byteLength) || doc.buffers[0].byteLength > bin!.byteLength || doc.buffers[0].byteLength < 1)
        fail('외부 파일 없이 텍스처를 포함한 GLB로 내보내세요.');
    const supported = ['KHR_materials_unlit', 'KHR_texture_transform', 'KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_sheen', 'KHR_materials_volume', 'KHR_materials_emissive_strength', 'KHR_materials_iridescence', 'KHR_materials_anisotropy', 'KHR_materials_dispersion'];
    if ([...(doc.extensionsUsed ?? []), ...(doc.extensionsRequired ?? [])].some((s: string) => !supported.includes(s)))
        fail('압축·인스턴스 확장을 해제하고 일반 GLB로 내보내세요.');
    if (doc.animations?.length || doc.skins?.length)
        fail('애니메이션·스킨을 해제한 정적 모델을 사용하세요.');
    if (!Array.isArray(doc.nodes) || doc.nodes.length > 400 || !Array.isArray(doc.meshes) || doc.meshes.length < 1 || doc.meshes.length > 150)
        fail('모델은 150개 이하 메시·400개 이하 노드로 단순화해 주세요.');
    if ((doc.materials?.length ?? 0) > 150 || (doc.images?.length ?? 0) > 8 || (doc.accessors?.length ?? 0) > 2000)
        fail('모델의 소재·텍스처 수가 너무 많습니다.');
    // Acyclic, singly-parented hierarchy prevents pathological expansion in loaders.
    const state = new Map<number, number>(), parents = new Set<number>();
    const walk = (i: number, depth = 0) => { if (!Number.isInteger(i) || !doc.nodes[i] || depth > 64 || state.get(i) === 1)
        fail('모델의 노드 연결이 올바르지 않습니다.'); if (state.get(i) === 2)
        return; state.set(i, 1); const n = doc.nodes[i]; if (n.extensions || n.skin !== undefined)
        fail('확장 기능 없이 정적 모델로 내보내세요.'); for (const key of ['translation', 'rotation', 'scale', 'matrix'])
        if (n[key] && (!Array.isArray(n[key]) || n[key].some((x: unknown) => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1e6)))
            fail('모델의 변환 값이 올바르지 않습니다.'); for (const child of n.children ?? []) {
        if (parents.has(child))
            fail('모델의 노드 연결이 중복됩니다.');
        parents.add(child);
        walk(child, depth + 1);
    } state.set(i, 2); };
    for (let i = 0; i < doc.nodes.length; i++)
        walk(i);
    if (!Array.isArray(doc.scenes) || !doc.scenes.length || doc.scenes.length > 10)
        fail('모델의 장면 정보가 없습니다.');
    for (const scene of doc.scenes) {
        const roots = new Set<number>();
        for (const root of scene.nodes ?? []) {
            if (!Number.isInteger(root) || !doc.nodes[root] || roots.has(root) || parents.has(root))
                fail('모델 장면의 루트 연결이 잘못되었습니다.');
            roots.add(root);
        }
    }
    const views = doc.bufferViews ?? [];
    for (const view of views) {
        if (view.buffer !== 0 || !Number.isInteger(view.byteLength) || view.byteLength < 1 || !Number.isInteger(view.byteOffset ?? 0) || (view.byteOffset ?? 0) < 0 || (view.byteOffset ?? 0) + view.byteLength > doc.buffers[0].byteLength)
            fail('모델 버퍼 범위가 올바르지 않습니다.');
    }
    for (const accessor of doc.accessors ?? [])
        if (!Number.isInteger(accessor.count) || accessor.count < 1 || accessor.count > 600000 || accessor.sparse || !views[accessor.bufferView])
            fail('모델의 정점 데이터가 올바르지 않거나 너무 큽니다.');
    let vertices = 0, triangles = 0;
    const meshCounts = doc.meshes.map(() => ({ vertices: 0, triangles: 0 }));
    for (const [meshIndex, mesh] of doc.meshes.entries())
        for (const p of mesh.primitives ?? []) {
            if ((p.mode ?? 4) !== 4 || p.targets || p.extensions)
                fail('삼각형으로 변환한 정적 메시를 사용하세요.');
            const position = doc.accessors?.[p.attributes?.POSITION];
            if (!position || position.type !== 'VEC3')
                fail('정점 위치가 없는 모델입니다.');
            vertices += position.count;
            const count = p.indices === undefined ? position.count : doc.accessors?.[p.indices]?.count;
            if (!count || count % 3)
                fail('삼각형 인덱스를 확인하세요.');
            triangles += count / 3;
            meshCounts[meshIndex].vertices += position.count;
            meshCounts[meshIndex].triangles += count / 3;
        }
    let placedVertices = 0, placedTriangles = 0;
    for (const n of doc.nodes)
        if (n.mesh !== undefined) {
            const counts = meshCounts[n.mesh];
            if (!counts)
                fail('연결된 메시가 없습니다.');
            placedVertices += counts.vertices;
            placedTriangles += counts.triangles;
        }
    if (placedVertices > 200000 || placedTriangles > 200000)
        fail('반복 배치를 포함한 정점·삼각형 합계를 20만 개 이하로 줄여 주세요.');
    if (!triangles || vertices > 200000 || triangles > 200000)
        fail('정점과 삼각형을 각각 20만 개 이하로 줄여 주세요.');
    for (const im of doc.images ?? []) {
        if (im.uri || !Number.isInteger(im.bufferView) || !views[im.bufferView] || !['image/png', 'image/jpeg'].includes(im.mimeType))
            fail('PNG·JPG 텍스처를 GLB 내부에 포함하세요.');
        const view = views[im.bufferView], img = bin!.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
        const size = imageDimensions(img);
        if (!size || size.width > 2048 || size.height > 2048 || size.width * size.height > 4194304)
            fail('텍스처는 각각 2048×2048 이하의 PNG·JPG로 줄여 주세요.');
    }
    return { meshes: doc.meshes.length, vertices, triangles, bytes: bytes.byteLength };
}
function imageDimensions(a: Uint8Array): {
    width: number;
    height: number;
} | null {
    if (a.length >= 24 && a[0] === 137 && a[1] === 80 && a[2] === 78 && a[3] === 71) {
        const d = new DataView(a.buffer, a.byteOffset, a.byteLength);
        return { width: d.getUint32(16), height: d.getUint32(20) };
    }
    if (a[0] === 255 && a[1] === 216) {
        let at = 2;
        while (at + 4 < a.length) {
            if (a[at++] !== 255)
                return null;
            const marker = a[at++];
            if (marker === 0xd9 || marker === 0xda)
                return null;
            const len = (a[at] << 8) | a[at + 1];
            if (len < 2 || at + len > a.length)
                return null;
            if ([0xc0, 0xc1, 0xc2].includes(marker) && len >= 7)
                return { height: (a[at + 3] << 8) | a[at + 4], width: (a[at + 5] << 8) | a[at + 6] };
            at += len;
        }
    }
    return null;
}
