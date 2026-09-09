'use client';
import { useState } from 'react';
import { Check, Copy, Move, ScanLine } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { collisions, arrayNode, placeAgainst, type SceneData, type Selection } from '@/lib/scene-model';
export default function PlacementDialog({ open, onClose, scene, selection, onCommit, onSelect }: {
    open: boolean;
    onClose: () => void;
    scene: SceneData;
    selection: Selection;
    onCommit: (s: SceneData, label?: string) => boolean;
    onSelect: (s: Selection) => void;
}) { const [count, setCount] = useState(2), [gap, setGap] = useState(300), [axis, setAxis] = useState<'x' | 'z'>('x'), [error, setError] = useState(''); const node = scene.nodes.find(n => n.id === selection?.id), conflicts = collisions(scene); const run = (fn: () => SceneData) => { setError(''); try {
    onCommit(fn(), '배치를 변경했습니다.');
}
catch (e) {
    setError((e as Error).message);
} }; return <Dialog open={open} onOpenChange={o => { if (!o)
    onClose(); }}><DialogContent className="placement-dialog"><DialogHeader><DialogTitle>배열과 정렬</DialogTitle><DialogDescription>{node ? `${node.name}의 위치를 조정하세요.` : '3D 화면에서 가구를 선택하면 배열할 수 있습니다.'}</DialogDescription></DialogHeader>{node && <><div className="array-fields"><label>추가할 개수<input type="number" min={1} max={12} value={count} onChange={e => setCount(Number(e.target.value))}/></label><label>가구 사이 간격 · mm<input type="number" min={0} max={5000} value={gap} onChange={e => setGap(Number(e.target.value))}/></label><label>배열 방향<Select value={axis} onValueChange={v => setAxis(v as 'x' | 'z')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="x">가로 X +</SelectItem><SelectItem value="z">세로 Z +</SelectItem></SelectContent></Select></label></div><button className="primary-button full" disabled={node.locked} onClick={() => run(() => arrayNode(scene, node.id, count, gap, axis))}><Copy size={16}/>같은 간격으로 {count}개 추가</button>{!node.host && <div className="align-buttons">{[['left', '왼쪽 벽'], ['right', '오른쪽 벽'], ['back', '안쪽 벽'], ['front', '입구 벽'], ['center', '공간 중앙']].map(([edge, name]) => <button key={edge} disabled={node.locked} onClick={() => run(() => placeAgainst(scene, node.id, edge as 'left' | 'right' | 'back' | 'front' | 'center'))}><Move size={14}/>{name}</button>)}</div>}</>}{error && <p role="alert" className="form-error">{error}</p>}<div className="collision-heading"><ScanLine size={17}/><b>가구 겹침 {conflicts.length}곳</b></div><p className="fineprint">회전한 가구의 외곽 크기를 기준으로 확인합니다. 실제 메시 간섭이나 통행·시공 기준을 판정하지 않습니다.</p><div className="collision-list">{conflicts.length ? conflicts.slice(0, 40).map(c => <button key={`${c.a}-${c.b}`} onClick={() => { onSelect({ id: c.a }); onClose(); }}><span>{c.names[0]}</span><span>↔</span><span>{c.names[1]}</span></button>) : <p><Check size={16}/>외곽 크기를 기준으로 겹친 가구가 없습니다.</p>}</div></DialogContent></Dialog>; }
