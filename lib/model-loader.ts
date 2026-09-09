import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { inspectGlb } from './glb';
export function disposeModel(root: T.Object3D) { const textures = new Set<T.Texture>(), mats = new Set<T.Material>(), geos = new Set<T.BufferGeometry>(); root.traverse(o => { if (o instanceof T.Mesh) {
    geos.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        mats.add(m);
        for (const value of Object.values(m))
            if (value instanceof T.Texture)
                textures.add(value);
    }
} }); textures.forEach(t => { t.dispose(); if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap)
    t.image.close(); }); mats.forEach(m => m.dispose()); geos.forEach(g => g.dispose()); }
export async function parseModel(bytes: ArrayBuffer) {
    const metadata = inspectGlb(bytes), manager = new T.LoadingManager();
    manager.setURLModifier(url => { if (!url.startsWith('blob:'))
        throw new Error('외부 텍스처는 사용할 수 없습니다.'); return url; });
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
    const source = gltf.scene;
    source.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(source), size = bounds.getSize(new T.Vector3());
    if (![size.x, size.y, size.z].every(x => Number.isFinite(x) && x > 0.00001 && x <= 1000)) {
        disposeModel(source);
        throw new Error('모델의 실제 크기를 읽을 수 없습니다.');
    }
    const root = new T.Group();
    root.add(source);
    source.position.x -= (bounds.min.x + bounds.max.x) / 2;
    source.position.y -= bounds.min.y;
    source.position.z -= (bounds.min.z + bounds.max.z) / 2;
    root.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
    root.updateMatrixWorld(true);
    let index = 0;
    root.traverse(o => { if (o instanceof T.Mesh) {
        o.userData = { part: `mesh${index++}` };
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = true;
    } });
    return { root, metadata, width: Math.round(size.x * 1000), height: Math.round(size.y * 1000), depth: Math.round(size.z * 1000) };
}
export function cloneModel(source: T.Group) { const root = source.clone(true); root.traverse(o => { if (o instanceof T.Mesh) {
    o.geometry = o.geometry.clone();
    const clone = (m: T.Material) => { const c = m.clone(); for (const [key, value] of Object.entries(c))
        if (value instanceof T.Texture)
            (c as any)[key] = value.clone(); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
} }); return root; }
