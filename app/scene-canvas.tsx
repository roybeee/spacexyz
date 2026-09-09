'use client';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MonitorX } from 'lucide-react';
import type { SceneData, SceneNode, Selection } from '@/lib/scene-model';
import type { SceneEngine, ToolMode, ViewMode } from '@/lib/scene-engine';
export default function SceneCanvas({ scene, selection, tool, view, faceMode, snap, cutaway, onSelect, onTransform, onDraw, onReady }: {
    scene: SceneData;
    selection: Selection;
    tool: ToolMode;
    view: ViewMode;
    faceMode: 'face' | 'object';
    snap: boolean;
    cutaway: boolean;
    onSelect: (s: Selection) => void;
    onDraw: (p: {
        x: number;
        z: number;
        width: number;
        depth: number;
    }) => void;
    onTransform: (id: string, p: Partial<SceneNode>) => void;
    onReady: (e: SceneEngine | null) => void;
}) { const host = useRef<HTMLDivElement>(null), engine = useRef<SceneEngine | null>(null); const callbacks = useRef({ onSelect, onTransform, onDraw, onReady }); callbacks.current = { onSelect, onTransform, onDraw, onReady }; const current = useRef({ scene, selection, tool, view, faceMode, snap, cutaway }); current.current = { scene, selection, tool, view, faceMode, snap, cutaway }; const [error, setError] = useState(''), [ready, setReady] = useState(false); useEffect(() => { let cancelled = false; import('@/lib/scene-engine').then(({ SceneEngine }) => { if (cancelled || !host.current)
    return; try {
    const e = new SceneEngine(host.current, { onDraw: p => callbacks.current.onDraw(p), onSelect: s => callbacks.current.onSelect(s), onTransform: (id, p) => callbacks.current.onTransform(id, p) });
    engine.current = e;
    e.setScene(current.current.scene);
    e.setView(current.current.view);
    e.setSelection(current.current.selection);
    e.setSelectionMode(current.current.faceMode);
    e.setMode(current.current.tool);
    e.setSnap(current.current.snap);
    e.cutaway = current.current.cutaway;
    callbacks.current.onReady(e);
    setReady(true);
}
catch {
    setError('이 기기에서 3D 화면을 시작할 수 없습니다. 하드웨어 가속을 켜거나 최신 Chrome·Edge·Safari에서 열어 주세요.');
} }).catch(() => setError('3D 편집기를 불러오지 못했습니다. 새로고침해 주세요.')); return () => { cancelled = true; engine.current?.dispose(); engine.current = null; callbacks.current.onReady(null); }; }, []); useEffect(() => { engine.current?.setScene(scene); }, [scene]); useEffect(() => { engine.current?.setSelection(selection); }, [selection]); useEffect(() => { engine.current?.setMode(tool); }, [tool]); useEffect(() => { engine.current?.setView(view); }, [view]); useEffect(() => { engine.current?.setSelectionMode(faceMode); }, [faceMode]); useEffect(() => { engine.current?.setSnap(snap); }, [snap]); useEffect(() => { if (engine.current)
    engine.current.cutaway = cutaway; }, [cutaway]); return <div className="canvas-host" ref={host}>{!ready && !error && <div className="canvas-message"><LoaderCircle className="spin"/><b>3D 공간 불러오는 중</b></div>}{error && <div className="canvas-message"><MonitorX /><b>3D 화면을 사용할 수 없습니다</b><p>{error}</p></div>}</div>; }
