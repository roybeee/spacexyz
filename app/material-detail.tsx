'use client';
import { useEffect, useState } from 'react';
import {ImagePlus,Trash2} from 'lucide-react';
import ImagePicker from './image-picker';
import { Slider } from '@/components/ui/slider';
import { materials, type MaterialFinish, type MaterialId } from '@/lib/scene-model';
export default function MaterialDetail({ material, finish, disabled, original=false, model=false, onChange }: {
    material: MaterialId;
    finish: MaterialFinish;
    disabled?: boolean;
    original?: boolean;
    model?: boolean;
    onChange: (f: MaterialFinish) => void;
}) {
    const [picker,setPicker]=useState(false);
    const base = materials.find(m => m.id === material)!;
    const [rough, setRough] = useState(finish.roughness ?? base.roughness), [metal, setMetal] = useState(finish.metalness ?? base.metalness), [scale, setScale] = useState(String(finish.scale ?? 900)), [angle, setAngle] = useState(finish.rotation ?? 0), [color, setColor] = useState(finish.color ?? base.color);
    useEffect(() => { setRough(finish.roughness ?? base.roughness); setMetal(finish.metalness ?? base.metalness); setScale(String(finish.scale ?? 900)); setAngle(finish.rotation ?? 0); setColor(finish.color ?? base.color); }, [material, finish.color, finish.roughness, finish.metalness, finish.scale, finish.rotation, base]);
    return <><fieldset disabled={disabled} className="material-detail"><div className="texture-control">{finish.textureId?<><div className="texture-preview image-checker"><img src={`/api/assets?id=${finish.textureId}`} alt="적용한 소재 이미지"/></div><div className="texture-control-actions"><button className="outline-button" onClick={()=>setPicker(true)}><ImagePlus size={15}/>이미지 교체</button><button className="text-button" onClick={()=>onChange({textureId:null})}><Trash2 size={15}/>제거</button></div><p className="fineprint">업로드한 이미지의 원래 색상으로 표시합니다.</p></>:<button className="outline-button full" onClick={()=>setPicker(true)}><ImagePlus size={16}/>실제 소재 이미지 적용</button>}</div>{!original&&<>{!finish.textureId&&<label className="color-control">소재 색상<input aria-label="소재 색상" type="color" value={color} onChange={e => setColor(e.target.value)} onBlur={() => { if (color !== (finish.color ?? base.color))
        onChange({ color }); }}/></label>}<div className="small-heading spaced"><span>광택</span><span>{Math.round((1 - rough) * 100)}%</span></div><Slider aria-label="소재 광택" value={[1 - rough]} min={0} max={1} step={.05} disabled={disabled} onValueChange={v => setRough(1 - v[0])} onValueCommit={v => onChange({ roughness: 1 - v[0] })}/><div className="range-labels"><span>무광</span><span>유광</span></div><div className="small-heading spaced"><span>금속 질감</span><span>{Math.round(metal * 100)}%</span></div><Slider aria-label="소재 금속 질감" value={[metal]} min={0} max={1} step={.05} disabled={disabled} onValueChange={v => setMetal(v[0])} onValueCommit={v => onChange({ metalness: v[0] })}/><div className="finish-fields"><label>{finish.textureId?'이미지 한 장의 가로':'무늬 반복 크기'}<div><input aria-label="무늬 반복 크기" type="number" min={50} max={5000} value={scale} onChange={e => setScale(e.target.value)} onBlur={() => { const n = Number(scale); if (n >= 50 && n <= 5000)
        onChange({ scale: n });
    else
        setScale(String(finish.scale ?? 900)); }} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/><small>mm</small></div></label><label>결 방향<div><input aria-label="소재 결 방향" type="number" min={-180} max={180} step={15} value={angle} onChange={e => setAngle(Number(e.target.value))} onBlur={() => { if (angle >= -180 && angle <= 180)
        onChange({ rotation: angle });
    else
        setAngle(finish.rotation ?? 0); }} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }}/><small>°</small></div></label></div><p className="fineprint">{finish.textureId?(model?'가져온 모델은 원본 UV 좌표에 맞춰 반복합니다. 입력 크기는 실제 치수와 다를 수 있습니다.':'입력한 가로를 기준으로 원본 비율대로 반복합니다. 소재 사진은 이음새가 보일 수 있습니다.'):'선택한 범위에만 적용됩니다. 색상은 선택창을 닫은 뒤 다른 곳을 누르면 반영됩니다.'}</p></>}</fieldset>{picker&&<ImagePicker title="실제 소재 이미지" currentId={finish.textureId} onClose={()=>setPicker(false)} onSelect={image=>{onChange({textureId:image.id});setPicker(false)}}/>}</>;
}
