'use client';
import {useEffect,useState} from 'react';
import {Layers,Ungroup,Pencil,Check,ArrowLeft} from 'lucide-react';
import {sceneGroups,selectionIds} from '@/lib/selection';
import type {SceneData,Selection} from '@/lib/scene-model';

export default function GroupControls({scene,selection,editingGroupId,onCreate,onRename,onUngroup,onEdit,onExit}:{scene:SceneData;selection:Selection;editingGroupId:string|null;onCreate:(name:string)=>boolean;onRename:(id:string,name:string)=>boolean;onUngroup:()=>void;onEdit:(id:string)=>void;onExit:()=>void}){
 const ids=selectionIds(selection),nodes=scene.nodes.filter(n=>ids.includes(n.id)),groups=sceneGroups(scene),selectedGroups=groups.filter(g=>g.nodes.some(n=>ids.includes(n.id)));
 const group=selectedGroups.length===1&&nodes.every(n=>n.group?.id===selectedGroups[0].id)?selectedGroups[0]:null,editing=groups.find(g=>g.id===editingGroupId);
 const [name,setName]=useState(group?.name??'새 가구 그룹');
 useEffect(()=>setName(group?.name??'새 가구 그룹'),[group?.id,group?.name]);
 if(!editing&&!group&&nodes.length<2)return null;
 const locked=selectedGroups.some(g=>g.nodes.some(n=>n.locked));
 return <section className="group-controls" aria-label="가구 그룹 관리">
  {editing&&<div className="group-edit-banner"><span><Pencil size={14}/><b>{editing.name}</b> 안 편집 중</span><button onClick={onExit}><ArrowLeft size={14}/>그룹 편집 완료</button><p>가구를 하나씩 선택해 크기와 소재를 바꾸세요. 묶음은 유지됩니다.</p></div>}
  <div className="small-heading"><span><Layers size={15}/> {group?'저장되는 가구 그룹':selectedGroups.length?`그룹 ${selectedGroups.length}개 포함`:'다시 선택해도 함께'}</span>{group&&<span>{group.nodes.length}개</span>}</div>
  {group?<><form className="group-name-form" onSubmit={e=>{e.preventDefault();onRename(group.id,name)}}><label className="field-label">그룹 이름<input className="text-input" value={name} maxLength={80} disabled={locked} onChange={e=>setName(e.target.value)}/></label><button className="outline-button" disabled={locked||!name.trim()||name.trim()===group.name} aria-label="그룹 이름 저장"><Check size={16}/></button></form><div className="group-buttons">{!editing&&<button className="primary-button" onClick={()=>onEdit(group.id)}><Pencil size={14}/>그룹 안 편집</button>}<button className="outline-button" disabled={locked} onClick={onUngroup}><Ungroup size={14}/>그룹 해제</button></div></>:nodes.length>1?<><button className="primary-button full" disabled={!!selectedGroups.length||nodes.some(n=>n.locked||n.hidden||n.host)} onClick={()=>onCreate('새 가구 그룹')}><Layers size={16}/>선택한 가구 그룹으로 묶기</button>{selectedGroups.length>0?<><p className="fineprint">기존 그룹을 해제하면 새 조합으로 묶을 수 있습니다.</p><button className="outline-button full" disabled={locked} onClick={onUngroup}><Ungroup size={15}/>선택한 그룹 해제</button></>:<p className="fineprint">묶은 뒤 이름을 붙이세요. 저장·실행 취소·다른 디자인 안에도 유지됩니다.</p>}</>:null}
 </section>;
}
