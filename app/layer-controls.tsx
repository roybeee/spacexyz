'use client';
import {Layers,Lock} from 'lucide-react';
import {expandGroupIds,selectionIds} from '@/lib/selection';
import type {SceneData,Selection} from '@/lib/scene-model';

export default function LayerControls({scene,selection,onAssign,onManage}:{scene:SceneData;selection:Selection;onAssign:(id:string|null)=>boolean;onManage:()=>void}){
 const ids=selectionIds(selection).filter(id=>scene.nodes.some(n=>n.id===id)),members=expandGroupIds(scene,ids),nodes=scene.nodes.filter(n=>members.includes(n.id)),layers=[...new Set(nodes.map(n=>n.layerId??'unassigned'))],locked=nodes.some(n=>n.locked);
 if(!nodes.length)return null;
 return <section className="layer-controls" aria-label="선택 요소 레이어"><div className="small-heading"><span><Layers size={15}/>레이어</span><button onClick={onManage}>관리</button></div><select aria-label="선택한 가구의 레이어" className="text-input" value={layers.length===1?layers[0]:'mixed'} disabled={locked} onChange={e=>onAssign(e.target.value==='unassigned'?null:e.target.value)}>{layers.length>1&&<option value="mixed" disabled>여러 레이어 · 함께 변경</option>}<option value="unassigned">미분류</option>{scene.layers?.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>{locked?<p><Lock size={12}/>잠금을 해제하면 레이어를 바꿀 수 있습니다.</p>:<p>{members.length>ids.length?`그룹을 포함한 ${members.length}개가 함께 이동합니다.`:nodes.some(n=>n.group)?'그룹 전체의 레이어를 함께 변경합니다.':`${nodes.length}개 요소의 분류를 변경합니다.`}</p>}{!scene.layers?.length&&<button className="text-button full" onClick={onManage}>첫 레이어 만들기</button>}</section>;
}
