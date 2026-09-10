import {validateScene,footprint,surfaceNames,type SceneData,type SceneNode,type Selection,type MaterialId} from './scene-model';
export type GroupDelta={x:number;y:number;z:number;rotation:number};
export const selectionIds=(s:Selection)=>s?[...new Set(s.ids?.length?s.ids:[s.id])]:[];
export function expandGroupIds(scene:SceneData,ids:string[],editingGroupId:string|null=null){
 const found=ids.filter(id=>scene.nodes.some(n=>n.id===id));
 const groups=new Set(scene.nodes.filter(n=>found.includes(n.id)&&n.group?.id!==editingGroupId).map(n=>n.group?.id).filter(Boolean));
 return [...new Set([...found,...scene.nodes.filter(n=>n.group&&groups.has(n.group.id)).map(n=>n.id)])];
}
export function normalizeSelection(scene:SceneData,s:Selection,editingGroupId:string|null=null):Selection{
 if(!s)return null;if(Object.hasOwn(surfaceNames,s.id))return{id:s.id};
 const ids=expandGroupIds(scene,selectionIds(s),editingGroupId),node=scene.nodes.find(n=>n.id===ids[0]);
 return ids.length?{id:ids[0],...(ids.length>1?{ids}:s.face&&(!node?.group||node.group.id===editingGroupId)?{face:s.face}:{})}:null;
}
export function chooseSelection(scene:SceneData,current:Selection,next:Selection,additive=false,editingGroupId:string|null=null):Selection{
 if(!next)return additive?normalizeSelection(scene,current,editingGroupId):null;
 const selected=normalizeSelection(scene,next,editingGroupId);
 if(!additive||Object.hasOwn(surfaceNames,next.id))return selected;
 const ids=selectionIds(normalizeSelection(scene,current,editingGroupId)).filter(id=>!Object.hasOwn(surfaceNames,id)),clicked=selectionIds(selected);
 const updated=clicked.every(id=>ids.includes(id))?ids.filter(id=>!clicked.includes(id)):[...ids,...clicked];
 return normalizeSelection(scene,updated.length?{id:updated[0],ids:updated}:null,editingGroupId);
}
export function sceneGroups(scene:SceneData){
 const groups=new Map<string,{id:string;name:string;nodes:SceneNode[]}>();
 for(const n of scene.nodes){if(!n.group)continue;let group=groups.get(n.group.id);if(!group){group={...n.group,nodes:[]};groups.set(group.id,group)}group.nodes.push(n)}
 return [...groups.values()];
}
export function createGroup(scene:SceneData,ids:string[],name:string,idFactory=()=>crypto.randomUUID()):SceneData{
 const nodes=selectedNodes(scene,ids,'transform');
 if(nodes.length<2)throw new Error('가구를 2개 이상 선택하세요.');
 if(nodes.some(n=>n.group))throw new Error('기존 그룹을 먼저 해제한 뒤 새로 묶으세요.');
 if(new Set(nodes.map(n=>n.layerId)).size>1)throw new Error('같은 레이어로 배정한 뒤 그룹으로 묶으세요. 속성의 레이어에서 함께 변경할 수 있습니다.');
 const group={id:idFactory(),name:name.trim()},set=new Set(ids);
 if(scene.nodes.some(n=>n.group?.id===group.id))throw new Error('그룹 ID가 중복되었습니다.');
 return validateScene({...scene,nodes:scene.nodes.map(n=>set.has(n.id)?{...n,group}:n)});
}
export function editGroup(scene:SceneData,groupIds:string[],action:{type:'rename';name:string}|{type:'ungroup'}):SceneData{
 const ids=new Set(groupIds),nodes=scene.nodes.filter(n=>n.group&&ids.has(n.group.id));
 if(!nodes.length||groupIds.some(id=>!nodes.some(n=>n.group?.id===id)))throw new Error('그룹을 찾을 수 없습니다.');
 selectedNodes(scene,nodes.map(n=>n.id));
 return validateScene({...scene,nodes:scene.nodes.map(n=>{if(!n.group||!ids.has(n.group.id))return n;const copy={...n};if(action.type==='ungroup')delete copy.group;else copy.group={...n.group,name:action.name.trim()};return copy})});
}
export function selectedNodes(scene:SceneData,ids:string[],operation:'transform'|'edit'|'state'='edit'){const unique=[...new Set(ids)];if(!unique.length)throw new Error('가구를 선택하세요.');const nodes=unique.map(id=>{const n=scene.nodes.find(n=>n.id===id);if(!n)throw new Error('선택한 가구를 찾을 수 없습니다.');if(operation!=='state'&&n.locked)throw new Error(`${n.name}: 먼저 잠금을 해제하세요.`);if(operation==='transform'&&(n.host||n.hidden))throw new Error('문·창문과 숨긴 요소는 묶어서 이동할 수 없습니다.');return n});return nodes}
export function groupBounds(nodes:SceneNode[]){if(!nodes.length)throw new Error('가구를 선택하세요.');const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};for(const n of nodes){const f=footprint(n);min.x=Math.min(min.x,n.x-f.width/2);max.x=Math.max(max.x,n.x+f.width/2);min.z=Math.min(min.z,n.z-f.depth/2);max.z=Math.max(max.z,n.z+f.depth/2);min.y=Math.min(min.y,n.y);max.y=Math.max(max.y,n.y+n.height)}return{min,max,center:{x:(min.x+max.x)/2,y:(min.y+max.y)/2,z:(min.z+max.z)/2},width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}}
export function groupPoses(nodes:SceneNode[],delta:GroupDelta,pivot=groupBounds(nodes).center){
 if(!Object.values(delta).every(Number.isFinite))throw new Error('이동과 회전 값을 확인하세요.');
 const clean=(v:number)=>Math.abs(v)<1e-7?0:v,dx=clean(delta.x),dy=clean(delta.y),dz=clean(delta.z),yaw=clean(delta.rotation),angle=yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return nodes.map(n=>({id:n.id,x:!dx&&!yaw?n.x:Math.round(pivot.x+(n.x-pivot.x)*c+(n.z-pivot.z)*s+dx),y:!dy?n.y:Math.round(n.y+dy),z:!dz&&!yaw?n.z:Math.round(pivot.z-(n.x-pivot.x)*s+(n.z-pivot.z)*c+dz),rotation:!yaw?n.rotation:Math.round((n.rotation+yaw)*1e6)/1e6}));
}
export function transformGroup(scene:SceneData,ids:string[],delta:GroupDelta,pivot?:{x:number;y:number;z:number}){const nodes=selectedNodes(scene,ids,'transform'),poses=groupPoses(nodes,delta,pivot);return validateScene({...scene,nodes:scene.nodes.map(n=>{const p=poses.find(p=>p.id===n.id);return p?{...n,...p}:n})})}
export type BatchAction={type:'material';material:MaterialId}|{type:'delete'}|{type:'duplicate';x:number;z:number}|{type:'hidden'|'locked';value:boolean}|{type:'align';axis:'x'|'z';edge:'min'|'center'|'max'};
export function batchAction(scene:SceneData,ids:string[],action:BatchAction,idFactory=()=>crypto.randomUUID()):SceneData{const nodes=selectedNodes(scene,ids,action.type==='hidden'||action.type==='locked'?'state':action.type==='align'?'transform':'edit'),set=new Set(ids),s=structuredClone(scene);
 if(action.type==='delete')s.nodes=s.nodes.filter(n=>!set.has(n.id));
 if(action.type==='material')for(const n of s.nodes.filter(n=>set.has(n.id))){n.material=action.material;n.uniformMaterial=true;n.faces={};n.faceFinishes={};n.finish={};delete n.color}
 if(action.type==='hidden'||action.type==='locked')for(const n of s.nodes.filter(n=>set.has(n.id)))n[action.type]=action.value;
 if(action.type==='duplicate'){
  if(!Number.isFinite(action.x)||!Number.isFinite(action.z))throw new Error('복제 간격을 확인하세요.');if(nodes.some(n=>n.host))throw new Error('문·창문은 개별 복제하세요.');
  const groups=new Map(sceneGroups(scene).filter(g=>g.nodes.every(n=>set.has(n.id))).map(g=>[g.id,{id:crypto.randomUUID(),name:`${g.name.slice(0,70)} 사본`}]));
  for(const n of nodes){const copy={...structuredClone(n),id:idFactory(),name:`${n.name.slice(0,70)} 사본`,x:n.x+action.x,z:n.z+action.z};delete copy.group;if(n.group&&groups.has(n.group.id))copy.group=groups.get(n.group.id);s.nodes.push(copy)}
 }
 if(action.type==='align'){if(nodes.some(n=>n.group))throw new Error('그룹 내부 간격을 보호합니다. 개별 위치는 그룹 안 편집에서 조정하세요.');const bounds=groupBounds(nodes);for(const n of s.nodes.filter(n=>set.has(n.id))){const f=footprint(n),half=(action.axis==='x'?f.width:f.depth)/2;n[action.axis]=action.edge==='min'?bounds.min[action.axis]+half:action.edge==='max'?bounds.max[action.axis]-half:bounds.center[action.axis]}}
 return validateScene(s);
}
