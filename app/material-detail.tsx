'use client';
import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { materials, type MaterialFinish, type MaterialId } from '@/lib/scene-model';
export default function MaterialDetail({ material, finish, disabled, onChange }: {
    material: MaterialId;
    finish: MaterialFinish;
    disabled?: boolean;
    onChange: (f: MaterialFinish) => void;
}) {
    const base = materials.find(m => m.id === material)!;
    const [rough, setRough] = useState(finish.roughness ?? base.roughness), [metal, setMetal] = useState(finish.metalness ?? base.metalness), [scale, setScale] = useState(String(finish.scale ?? 900)), [angle, setAngle] = useState(finish.rotation ?? 0), [color, setColor] = useState(finish.color ?? base.color);
    useEffect(() => { setRough(finish.roughness ?? base.roughness); setMetal(finish.metalness ?? base.metalness); setScale(String(finish.scale ?? 900)); setAngle(finish.rotation ?? 0); setColor(finish.color ?? base.color); }, [material, finish.color, finish.roughness, finish.metalness, finish.scale, finish.rotation, base]);
    return <fieldset disabled={disabled} className="material-detail"><label className="color-control">소재 색상<input aria-label="소재 색상" type="color" value={color} onChange={e => setColor(e.target.value)} onBlur={() => { if (color !== (finish.color ?? base.color))
        onChange({ color }); }}/></label><div className="small-heading spaced"><span>광택</span><span>{Math.round((1 - rough) * 100)}%</span></div><Slider aria-label="소재 광택" value={[1 - rough]} min={0} max={1} step={.05} disabled={disabled} onValueChange={v => setRough(1 - v[0])} onValueCommit={v => onChange({ roughness: 1 - v[0] })}/><div className="range-labels"><span>무광</span><span>유광</span></div><div className="small-heading spaced"><span>금속 질감</span><span>{Math.round(metal * 100)}%</span></div><Slider aria-label="소재 금속 질감" value={[metal]} min={0} max={1} step={.05} disabled={disabled} onValueChange={v => setMetal(v[0])} onValueCommit={v => onChange({ metalness: v[0] })}/><div className="finish-fields"><label>무늬 반복 크기<div><input aria-label="무늬 반복 크기" type="number" min={50} max={5000} value={scale} onChange={e => setScale(e.target.value)} onBlur={() => { const n = Number(scale); if (n >= 50 && n <= 5000)
        onChange({ scale: n });
    else
        setScale(String(finish.scale ?? 900)); }} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/><small>mm</small></div></label><label>결 방향<div><input aria-label="소재 결 방향" type="number" min={-180} max={180} step={15} value={angle} onChange={e => setAngle(Number(e.target.value))} onBlur={() => { if (angle >= -180 && angle <= 180)
        onChange({ rotation: angle });
    else
        setAngle(finish.rotation ?? 0); }} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/><small>°</small></div></label></div><p className="fineprint">선택한 범위에만 적용됩니다. 색상은 선택창을 닫은 뒤 다른 곳을 누르면 반영됩니다.</p></fieldset>;
}
