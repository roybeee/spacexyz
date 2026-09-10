import {randomId} from '@/lib/random-id';
import {layerSchema,layerNameKey,validateScene,type SceneData,type SceneNode} from './scene-model';
import {expandGroupIds,selectedNodes} from './selection';

export const layerColors=['#7161cf','#b47844','#608a70','#4f8caa','#bd7186','#a89543','#7f8491'];
export const layerPresets=[{name:'고객 좌석',color:layerColors[0]},{name:'주방 설비',color:layerColors[1]},{name:'조명',color:layerColors[5]},{name:'진열·장식',color:layerColors[2]},{name:'문·창호',color:layerColors[3]}];
export type LayerRow={id:string|null;name:string;color:string;nodes:SceneNode[];shown:number;locked:number};
export function layerRows(scene:SceneData):LayerRow[]{
 return [...(scene.layers??[]),{id:null,name:'미분류',color:'#9297a2'}].map(layer=>{const nodes=scene.nodes.filter(n=>(n.layerId??null)===layer.id);return {...layer,nodes,shown:nodes.filter(n=>!n.hidden).length,locked:nodes.filter(n=>n.locked).length}});
}
function requireLayer(scene:SceneData,id:string|null){if(id!==null&&!scene.layers?.some(l=>l.id===id))throw new Error('레이어를 찾을 수 없습니다. 목록을 다시 확인하세요.');}
export function layerAssignmentIds(scene:SceneData,ids:string[]){
 selectedNodes(scene,ids,'state');
 return expandGroupIds(scene,ids); // Always keep a group intact, even in member-edit mode.
}
export function assignLayer(scene:SceneData,ids:string[],layerId:string|null):SceneData{
 requireLayer(scene,layerId);const members=layerAssignmentIds(scene,ids),set=new Set(members);
 const changed=scene.nodes.filter(n=>set.has(n.id)&&(n.layerId??null)!==layerId);
 // No-op assignments remain harmless even if a previously assigned object was locked.
 if(changed.some(n=>n.locked))throw new Error('잠긴 가구가 포함되어 있습니다. 그룹 전체의 잠금을 해제한 뒤 레이어를 바꾸세요.');
 return validateScene({...scene,nodes:scene.nodes.map(n=>{if(!set.has(n.id))return n;const copy={...n};if(layerId===null)delete copy.layerId;else copy.layerId=layerId;return copy})});
}
export function addLayer(scene:SceneData,name:string,color:string,ids:string[]=[],idFactory=()=>randomId()):SceneData{
 if((scene.layers?.length??0)>=20)throw new Error('레이어는 20개까지 만들 수 있습니다.');
 const parsed=layerSchema.safeParse({id:idFactory(),name,color});if(!parsed.success)throw new Error('레이어 이름은 1~50자, 색상은 올바른 색상값으로 입력하세요.');
 const layer=parsed.data;if(scene.layers?.some(l=>l.id===layer.id))throw new Error('레이어 ID가 중복되었습니다.');
 const next=validateScene({...scene,layers:[...(scene.layers??[]),layer]});
 return ids.length?assignLayer(next,ids,layer.id):next;
}
export type LayerAction={type:'rename';name:string;color:string}|{type:'delete'}|{type:'hidden'|'locked';value:boolean}|{type:'isolate'};
export function editLayer(scene:SceneData,id:string|null,action:LayerAction):SceneData{
 requireLayer(scene,id);
 const owns=(n:SceneNode)=>(n.layerId??null)===id;
 if(action.type==='rename'){
  if(id===null)throw new Error('미분류의 이름은 바꿀 수 없습니다.');
  const parsed=layerSchema.safeParse({id,name:action.name,color:action.color});if(!parsed.success)throw new Error('레이어 이름은 1~50자, 색상은 올바른 색상값으로 입력하세요.');
  return validateScene({...scene,layers:scene.layers?.map(l=>l.id===id?parsed.data:l)});
 }
 if(action.type==='delete'){
  if(id===null)throw new Error('미분류는 삭제할 수 없습니다.');
  return validateScene({...scene,layers:scene.layers?.filter(l=>l.id!==id),nodes:scene.nodes.map(n=>{if(!owns(n))return n;const copy={...n};delete copy.layerId;return copy})});
 }
 if(!scene.nodes.some(owns))throw new Error('이 레이어에 가구·문·창문이 없습니다.');
 return validateScene({...scene,nodes:scene.nodes.map(n=>{
  if(action.type==='isolate')return {...n,hidden:!owns(n)};
  return owns(n)?{...n,[action.type]:action.value}:n;
 })});
}
export function layerName(scene:Pick<SceneData,'layers'>,node:SceneNode){return scene.layers?.find(l=>l.id===node.layerId)?.name??'미분류';}
export function availableLayerPresets(scene:SceneData){const names=new Set(scene.layers?.map(l=>layerNameKey(l.name)));return layerPresets.filter(p=>!names.has(layerNameKey(p.name)));}
