'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Box, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createNode, validateScene, type SceneData, type SceneNode } from '@/lib/scene-model';
import { MODEL_LIMIT } from '@/lib/glb';
export default function ModelImportDialog({ open, onClose, scene, onAdd, initialFile }: {
    open: boolean;
    onClose: () => void;
    scene: SceneData;
    onAdd: (n: SceneNode) => boolean;
    initialFile?: File | null;
}) {
    const input = useRef<HTMLInputElement>(null), active = useRef(0), inFlight = useRef(false);
    const [file, setFile] = useState<File | null>(null), [bytes, setBytes] = useState<ArrayBuffer | null>(null), [info, setInfo] = useState<{
        meshes: number;
        triangles: number;
    } | null>(null), [dimensions, setDimensions] = useState({ width: 1000, height: 1000, depth: 1000 }), [nativeSize, setNative] = useState(dimensions), [name, setName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
    useEffect(() => () => { active.current++; }, []);
    useEffect(() => { if (open && initialFile)
        inspect(initialFile); }, [open, initialFile]);
    async function inspect(file: File) { const token = ++active.current; setError(''); setBytes(null); setInfo(null); setReading(true); try {
        if (!file.name.toLowerCase().endsWith('.glb') || file.size > MODEL_LIMIT)
            throw new Error('8MB 이하의 GLB 파일을 선택하세요.');
        const buffer = await file.arrayBuffer();
        const { parseModel, disposeModel } = await import('@/lib/model-loader');
        const m = await parseModel(buffer);
        const dims = { width: m.width, height: m.height, depth: m.depth };
        disposeModel(m.root);
        if (token !== active.current)
            return;
        setNative(dims);
        setDimensions(dims);
        setInfo(m.metadata);
        setBytes(buffer);
        setFile(file);
        setName(file.name.replace(/\.glb$/i, '').slice(0, 80));
    }
    catch (e) {
        if (token === active.current)
            setError((e as Error).message);
    }
    finally {
        if (token === active.current)
            setReading(false);
    } }
    async function add() { if (!bytes || !file || inFlight.current)
        return; inFlight.current = true; setBusy(true); setError(''); try {
        const n: SceneNode = { ...createNode('box', crypto.randomUUID()), kind: 'model', assetId: crypto.randomUUID(), name: name.trim() || '가져온 모델', ...dimensions, material: 'plaster' };
        validateScene({ ...scene, nodes: [...scene.nodes, n] });
        const res = await fetch(`/api/assets?name=${encodeURIComponent(n.name)}`, { method: 'POST', headers: { 'Content-Type': 'model/gltf-binary' }, body: bytes });
        const d = await res.json() as {
            id: string;
            error?: string;
        };
        if (!res.ok)
            throw new Error(d.error || '모델 업로드에 실패했습니다.');
        n.assetId = d.id;
        if (onAdd(n))
            onClose();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        inFlight.current = false;
        setBusy(false);
    } }
    return <Dialog open={open} onOpenChange={o => { if (!o && !busy)
        onClose(); }}><DialogContent className="model-import-dialog"><DialogHeader><DialogTitle>3D 가구 모델 가져오기</DialogTitle><DialogDescription>실제 제품 모델을 배치하고 크기와 소재를 바꿔 보세요.</DialogDescription></DialogHeader><button className="model-drop" disabled={busy || reading} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && e.dataTransfer.files[0])
        inspect(e.dataTransfer.files[0]); }}>{reading ? <LoaderCircle className="spin"/> : <Box size={30}/>}<b>{reading ? '모델 구조 확인 중…' : file?.name || 'GLB 파일 선택 또는 끌어놓기'}</b><span>8MB 이하 · 텍스처를 포함한 정적 모델</span></button><input ref={input} type="file" accept=".glb" className="hidden" onChange={e => { if (e.target.files?.[0])
        inspect(e.target.files[0]); e.target.value = ''; }}/>{info && <><p className="fineprint">메시 {info.meshes}개 · 삼각형 {info.triangles.toLocaleString()}개 · 원본 소재 유지</p><label className="field-label">모델 이름<input className="text-input" maxLength={80} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label><div className="dimensions-grid">{(['width', 'height', 'depth'] as const).map((axis, i) => <label className="field-label" key={axis}>{['가로', '높이', '깊이'][i]} · mm<input type="number" className="text-input" min={20} max={20000} value={dimensions[axis]} disabled={busy} onChange={e => setDimensions({ ...dimensions, [axis]: Number(e.target.value) })}/></label>)}</div><button className="text-button" disabled={busy} onClick={() => { const scale = Math.min((scene.room.width - 200) / nativeSize.width, (scene.room.depth - 200) / nativeSize.depth, (scene.room.height - 100) / nativeSize.height, 1); setDimensions({ width: Math.max(20, Math.floor(nativeSize.width * scale)), height: Math.max(20, Math.floor(nativeSize.height * scale)), depth: Math.max(20, Math.floor(nativeSize.depth * scale)) }); }}>원본 비율로 공간 안에 맞추기</button></>}{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full" onClick={add} disabled={!bytes || reading || busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Upload size={16}/>} {busy ? '모델 추가 중…' : '공간 중앙에 추가'}</button><p className="fineprint">GLB 단위는 미터로 읽습니다. 치수를 확인해 주세요. 가져온 모델의 면 선택은 파일의 소재 영역 단위입니다. SKP·MAX는 텍스처를 포함한 일반 GLB로 변환한 뒤 사용하세요.</p></DialogContent></Dialog>;
}
