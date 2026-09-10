'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {CheckCircle2, DoorOpen, Maximize, Minus, Pause, Play, Plus, RotateCcw, RotateCw, TriangleAlert, X} from 'lucide-react';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '@/components/ui/dialog';
import {physicalNodeBounds} from '@/lib/door-geometry';
import {inspectDoorMotion} from '@/lib/door-motion';
import type {SceneData} from '@/lib/scene-model';
import type {SceneEngine} from '@/lib/scene-engine';
import SceneCanvas from './scene-canvas';
import './door-motion.css';

export default function DoorMotionDialog({scene, nodeId, openingId, onClose}: {
    scene: SceneData;
    nodeId: string;
    openingId?: string;
    onClose: () => void;
}) {
    const [snapshot] = useState(() => structuredClone(scene));
    const parent = snapshot.nodes.find(node => node.id === nodeId && node.kind === 'partition');
    const doors = parent?.openings?.filter(opening => opening.kind === 'door' && opening.door) ?? [];
    const [activeId, setActiveId] = useState(() => doors.find(door => door.id === openingId)?.id ?? doors[0]?.id ?? '');
    const active = doors.find(door => door.id === activeId);
    const [angle, setAngle] = useState(active?.door?.angle ?? 0);
    const [displayAngle, setDisplayAngle] = useState(angle);
    const [playing, setPlaying] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const engine = useRef<SceneEngine | null>(null);
    const frame = useRef(0), previousId = useRef(''), currentAngle = useRef(angle), alive = useRef(true);
    const latestActiveId = useRef(activeId), rebuildListener = useRef<(() => void) | null>(null);
    latestActiveId.current = activeId;
    const usable = !!parent && !parent.hidden && !!active;
    const inspection = useMemo(() => {
        if (!active) return {report:null, error:''};
        try {return {report:inspectDoorMotion(snapshot, nodeId, activeId, angle), error:''};}
        catch (cause) {return {report:null, error:cause instanceof Error && cause.name !== 'ZodError' ? cause.message : '입력한 장면의 문·가구 치수를 확인해 주세요.'};}
    }, [snapshot, nodeId, activeId, angle]);
    const report = inspection.report;
    const degrees = (value: number) => `${Math.round(value * 10) / 10}°`;

    function cancelFrame() {
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
    }
    function stop() {
        cancelFrame();
        setPlaying(false);
        setDisplayAngle(currentAngle.current);
    }
    function showAngle(value: number) {
        if (!engine.current || !active) return false;
        const success = engine.current.previewDoorAngle(nodeId, active.id, value);
        if (!success) {setError('선택한 문의 미리보기를 준비하지 못했습니다. 창을 닫고 다시 열어 주세요.'); return false;}
        currentAngle.current = value;
        setDisplayAngle(value);
        return true;
    }
    function changeAngle(value: number) {
        stop();
        setAngle(value);
        setError('');
        showAngle(value);
    }
    function fit(e = engine.current) {
        if (!e || !parent) return;
        const bounds = physicalNodeBounds(parent);
        const center: [number, number, number] = [bounds.center.x / 1000, bounds.center.y / 1000, bounds.center.z / 1000];
        const radius = Math.max(.6, Math.hypot(bounds.width, bounds.height, Math.max(bounds.depth, (active?.width ?? 0) * 2)) / 2000);
        const aspect = Math.max(.25, e.host.clientWidth / Math.max(1, e.host.clientHeight));
        const halfFov = Math.min(20 * Math.PI / 180, Math.atan(Math.tan(20 * Math.PI / 180) * aspect));
        const distance = radius / Math.sin(halfFov) * 1.12;
        const yaw = parent.rotation * Math.PI / 180;
        const side = active?.door?.side === 'negative' ? -1 : 1;
        const length = Math.hypot(.35, .36, 1);
        const dx = (.35 * Math.cos(yaw) + side * Math.sin(yaw)) / length;
        const dz = (-.35 * Math.sin(yaw) + side * Math.cos(yaw)) / length;
        e.restoreCamera({view:'perspective', fov:40, target:center, position:[center[0] + dx * distance, center[1] + .36 / length * distance, center[2] + dz * distance]});
        e.orbit.maxDistance = Math.max(70, distance * 2);
    }
    function rotate(direction: number) {
        const e = engine.current;
        if (!e) return;
        const delta = direction * Math.PI / 12, c = Math.cos(delta), s = Math.sin(delta);
        const x = e.camera.position.x - e.orbit.target.x, z = e.camera.position.z - e.orbit.target.z;
        e.camera.position.x = e.orbit.target.x + c * x + s * z;
        e.camera.position.z = e.orbit.target.z - s * x + c * z;
        e.orbit.update();
    }
    function onReady(value: SceneEngine | null) {
        const previous = engine.current;
        if (previous && previous.onSceneRebuilt === rebuildListener.current) previous.onSceneRebuilt = undefined;
        rebuildListener.current = null;
        engine.current = value;
        if (!value) {cancelFrame(); if (alive.current) setReady(false); return;}
        const restorePreview = () => {
            if (!alive.current || engine.current !== value || !latestActiveId.current) return;
            value.previewDoorAngle(nodeId, latestActiveId.current, currentAngle.current);
        };
        rebuildListener.current = restorePreview;
        value.onSceneRebuilt = restorePreview;
        value.renderer.domElement.setAttribute('aria-label', '문 열림 동작 미리보기. 회전과 확대 버튼으로 시점을 바꿀 수 있습니다.');
        value.paused = document.hidden;
        previousId.current = activeId;
        if (active) showAngle(active.door?.angle ?? 0);
        fit(value);
        if (alive.current) setReady(true);
    }

    useEffect(() => {
        alive.current = true;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncPreference = () => {setReducedMotion(preference.matches); if (preference.matches) stop();};
        const visibility = () => {if (engine.current) engine.current.paused = document.hidden; if (document.hidden) stop();};
        syncPreference();
        preference.addEventListener('change', syncPreference);
        window.addEventListener('blur', stop);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            alive.current = false;
            cancelFrame();
            if (engine.current && engine.current.onSceneRebuilt === rebuildListener.current) engine.current.onSceneRebuilt = undefined;
            rebuildListener.current = null;
            preference.removeEventListener('change', syncPreference);
            window.removeEventListener('blur', stop);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, []);
    useEffect(() => {
        stop();
        const previous = doors.find(door => door.id === previousId.current);
        if (engine.current && previous && previous.id !== activeId) engine.current.previewDoorAngle(nodeId, previous.id, previous.door!.angle);
        previousId.current = activeId;
        const saved = active?.door?.angle ?? 0;
        setAngle(saved);
        currentAngle.current = saved;
        setDisplayAngle(saved);
        setError('');
        // The canvas reports readiness after setScene/setView. Fit once more in the
        // following React effect, while stable snapshot/view props prevent later resets.
        if (ready && active) {showAngle(saved); fit();}
    }, [activeId, ready]);
    useEffect(() => {
        if (!playing || !ready || !active || reducedMotion || angle <= 0) return;
        const e = engine.current;
        if (!e) return;
        const started = performance.now();
        let lastLabel = -Infinity;
        const tick = (time: number) => {
            if (!alive.current || engine.current !== e) return;
            const phase = ((time - started) % 2400) / 2400;
            const value = angle * (1 - Math.cos(phase * Math.PI * 2)) / 2;
            if (!e.previewDoorAngle(nodeId, active.id, value)) {
                setPlaying(false);
                setError('문 동작을 표시하지 못했습니다. 미리보기 창을 다시 열어 주세요.');
                return;
            }
            currentAngle.current = value;
            // Render the moving door each frame; refresh the numeric label at most 12 times a second.
            if (time - lastLabel >= 80) {setDisplayAngle(value); lastLabel = time;}
            frame.current = requestAnimationFrame(tick);
        };
        currentAngle.current = 0;
        e.previewDoorAngle(nodeId, active.id, 0);
        setDisplayAngle(0);
        frame.current = requestAnimationFrame(tick);
        return cancelFrame;
    }, [playing, ready, activeId, angle, reducedMotion]);

    return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="door-motion-dialog" showCloseButton={false}>
        <header className="door-motion-header"><div><DoorOpen size={24}/><div><DialogTitle>문 열림 동작 미리보기</DialogTitle><DialogDescription>{parent?.name ?? '파티션'} · 문을 움직이며 주변 공간을 살펴보세요.</DialogDescription></div></div><button className="outline-button" onClick={onClose}><X size={16}/>편집으로 돌아가기</button></header>
        {!usable ? <div className="door-motion-empty"><DoorOpen size={42}/><b>{parent?.hidden ? '숨겨진 파티션입니다' : '열림 방향이 설정된 문이 없습니다'}</b><p>{parent?.hidden ? '편집 화면에서 파티션을 표시한 뒤 다시 열어 주세요.' : '파티션의 개구부 편집에서 문을 추가하고, 경첩과 열림 방향을 설정해 적용하세요.'}</p><button className="primary-button" onClick={onClose}>편집으로 돌아가기</button></div>
            : <div className="door-motion-layout"><section className="door-motion-viewport" aria-label="독립된 문 동작 미리보기">
                <SceneCanvas scene={snapshot} selection={null} tool="select" view="perspective" faceMode="object" snap={false} cutaway={true} measurementsVisible={false} onSelect={() => {}} onTransform={() => {}} onDraw={() => {}} onReady={onReady}/>
                <div className="door-motion-state"><span>{playing ? '열고 닫는 중' : '현재 미리보기'}</span><b>{Math.round(displayAngle)}<small>°</small></b></div>
                <div className="door-motion-camera"><button title="왼쪽으로 회전" aria-label="시점 왼쪽으로 회전" disabled={!ready} onClick={() => rotate(-1)}><RotateCcw size={18}/></button><button title="오른쪽으로 회전" aria-label="시점 오른쪽으로 회전" disabled={!ready} onClick={() => rotate(1)}><RotateCw size={18}/></button><i/><button title="확대" aria-label="문 미리보기 확대" disabled={!ready} onClick={() => engine.current?.zoom(.85)}><Plus size={18}/></button><button title="축소" aria-label="문 미리보기 축소" disabled={!ready} onClick={() => engine.current?.zoom(1.18)}><Minus size={18}/></button><button title="파티션 전체 보기" aria-label="파티션 전체가 보이도록 시점 맞추기" disabled={!ready} onClick={() => fit()}><Maximize size={18}/></button></div>
                <span className="door-motion-view-hint">드래그로 회전 · 스크롤 또는 두 손가락으로 확대</span>
            </section><aside className="door-motion-settings">
                <label className="field-label">살펴볼 문<select className="text-input" value={activeId} onChange={event => {stop(); setActiveId(event.target.value);}}>{doors.map(door => <option key={door.id} value={door.id}>{door.name}</option>)}</select></label>
                <div className="door-motion-details"><b>{active.width.toLocaleString()} × {active.height.toLocaleString()} mm</b><span>{active.door?.hinge === 'left' ? '왼쪽 경첩' : '오른쪽 경첩'} · {active.door?.side === 'positive' ? '파티션 앞면으로 열림' : '파티션 뒷면으로 열림'}</span><span>저장된 열림 각도 {active.door?.angle ?? 0}°</span></div>
                <div className="door-motion-angle"><label htmlFor="door-preview-angle">{playing ? '반복 재생 최대 각도' : '열림 각도'}<strong>{angle}°</strong></label><input id="door-preview-angle" type="range" min={0} max={120} step={1} value={angle} disabled={!ready} aria-valuetext={`${angle}도`} onChange={event => changeAngle(Number(event.target.value))}/><div className="door-motion-range-labels"><span>닫힘 0°</span><span>120°</span></div></div>
                <div className="door-motion-presets">{[0, 45, 90, 120].map(value => <button key={value} disabled={!ready} className={angle === value ? 'selected' : ''} aria-pressed={angle === value} onClick={() => changeAngle(value)}>{value}°</button>)}</div>
                <button className="primary-button door-motion-play" disabled={!ready || reducedMotion || (!playing && angle === 0)} onClick={() => playing ? stop() : setPlaying(true)}>{playing ? <Pause size={17}/> : <Play size={17}/>} {playing ? '동작 정지' : '열고 닫기 재생'}</button>
                <p className="door-motion-play-hint">{reducedMotion ? '기기의 모션 줄이기 설정이 켜져 있습니다. 각도 버튼으로 열림 상태를 확인하세요.' : angle === 0 ? '45°·90°·120°를 선택한 뒤 동작을 재생하세요.' : '0°에서 선택한 각도까지 열고 닫습니다. 한 번 왕복하는 데 2.4초가 걸립니다.'}</p>
                <button className="outline-button full" disabled={!ready} onClick={() => changeAngle(active.door?.angle ?? 0)}>저장된 각도로 되돌리기</button>
                <section className={`door-motion-inspection${report?.blocked || inspection.error ? ' has-issues' : ''}`} aria-label="문 동작 간섭 검토">
                    <div className="door-motion-inspection-heading"><b>현재 배치에서 간섭 검토</b>{report && <span>0° → {degrees(report.limitAngle)} · {report.samples}개 각도</span>}</div>
                    {inspection.error ? <p className="door-motion-inspection-status" role="status"><TriangleAlert size={17}/><span>검토를 완료하지 못했습니다.<small>{inspection.error}</small></span></p>
                        : report && <><p className="door-motion-inspection-status" role="status">{report.blocked ? <TriangleAlert size={17}/> : <CheckCircle2 size={17}/>}<span>{report.blocked ? `간섭을 확인할 대상 ${report.issues.length}곳` : '검토한 각도에서 간섭 없음'}</span></p>
                            {!!report.issues.length && <ul className="door-motion-issue-list">{report.issues.map((issue, index) => <li key={`${issue.type}:${issue.nodeId ?? ''}:${index}`}><div><b>{issue.name}</b><span>{issue.type === 'boundary' ? '공간 경계' : issue.type === 'self' ? '같은 파티션' : '주변 가구·벽'}</span></div><small>{issue.firstAngle === issue.lastAngle ? `확인 각도 ${degrees(issue.firstAngle)}` : `처음 확인 ${degrees(issue.firstAngle)} · 마지막 ${degrees(issue.lastAngle)}`}</small></li>)}</ul>}
                        </>}
                    <p className="door-motion-inspection-limit">{report?.limitAngle === 0 ? '닫힌 상태만 검사했습니다. 문이 열리는 범위는 각도를 높여 확인하세요.' : '시작·끝을 포함해 최대 5° 간격으로 검사합니다. 샘플 사이 각도는 확인하지 않았습니다.'} 실측·시공 검토를 대신하지 않습니다. 재생은 간섭 여부와 관계없이 계속됩니다.</p>
                </section>
                <div className="door-motion-note"><b>이 창에서 자유롭게 살펴보세요</b><p>미리보기 각도는 저장되지 않습니다. 각도를 유지하려면 개구부 편집에서 설정한 뒤 적용하세요.</p><p>동작 중 가구와의 충돌을 자동으로 멈추지는 않습니다. 문이 지나가는 공간을 여러 시점에서 확인하세요.</p></div>
            </aside></div>}
        {error && <p className="form-error door-motion-error" role="alert">{error}</p>}
    </DialogContent></Dialog>;
}
