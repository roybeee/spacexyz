import {z} from 'zod';
import {validateScene,cloneUngroupedNode,collisions,type SceneData,type SceneNode} from './scene-model';
import {groupBounds,selectedNodes,sceneGroups} from './selection';

// SceneEngine draws 120 mm walls centered on the room boundary.
export const wallHalfThickness=60;
export const placementSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('array'),axis:z.enum(['x','z']),direction:z.union([z.literal(1),z.literal(-1)]),count:z.number().int().min(1).max(12),gap:z.number().finite().min(0).max(5000)}),
 z.object({type:z.literal('align'),edge:z.enum(['left','right','back','front','center']),margin:z.number().finite().min(0).max(2000)})
]);
export type PlacementRequest=z.infer<typeof placementSchema>;
export const placementEdges={left:'왼쪽 벽',right:'오른쪽 벽',back:'안쪽 벽',front:'입구 벽',center:'공간 중앙'} as const;
export function placementNodes(scene:SceneData,ids:string[],editingGroupId:string|null=null){
 const nodes=selectedNodes(scene,ids),set=new Set(ids);
 if(nodes.some(n=>n.hidden))throw new Error('숨긴 요소를 표시한 뒤 배치하세요.');
 for(const g of sceneGroups(scene))if(g.nodes.some(n=>set.has(n.id))&&!g.nodes.every(n=>set.has(n.id))&&g.id!==editingGroupId)throw new Error('그룹 전체를 선택하거나 그룹 안 편집에서 개별 가구를 선택하세요.');
 return nodes;
}
function assertInsideWalls(scene:SceneData,nodes:SceneNode[]){
 const b=groupBounds(nodes),x=scene.room.width/2-wallHalfThickness,z=scene.room.depth/2-wallHalfThickness;
 if(b.min.x < -x-1e-6||b.max.x>x+1e-6||b.min.z < -z-1e-6||b.max.z>z+1e-6)throw new Error('배치 결과가 벽 안쪽 공간을 벗어납니다. 방향·횟수·간격을 조정하세요.');
}
/** Geometric capacity only: other furniture and provider model limits are checked in the plan. */
export function arrayCapacity(scene:SceneData,nodes:SceneNode[],axis:'x'|'z',direction:1|-1,gap:number){
 if(!nodes.length||!Number.isFinite(gap)||gap<0||gap>5000)return 0;
 const host=nodes.length===1?nodes[0].host:undefined;
 if(nodes.some(n=>n.host)&&(!host||axis!==(['back','front'].includes(host)?'x':'z')))return 0;
 const bounds=groupBounds(nodes),span=host?nodes[0].width:axis==='x'?bounds.width:bounds.depth,step=span+gap;
 const edge=(axis==='x'?scene.room.width:scene.room.depth)/2-(host?100:wallHalfThickness);
 const low=host?nodes[0][axis]-span/2:bounds.min[axis],high=host?nodes[0][axis]+span/2:bounds.max[axis];
 const available=direction===1?edge-high:low+edge;
 return Math.max(0,Math.min(12,Math.floor((available+1e-6)/step),Math.floor((300-scene.nodes.length)/nodes.length)));
}
export function planPlacement(scene:SceneData,ids:string[],input:PlacementRequest,editingGroupId:string|null=null,idFactory=()=>crypto.randomUUID(),groupIdFactory=()=>crypto.randomUUID()){
 let request:PlacementRequest;
 try{request=placementSchema.parse(input)}catch{throw new Error('횟수 1~12회, 간격 0~5,000mm, 벽 여유 0~2,000mm와 배치 방향을 확인하세요.');}
 const nodes=placementNodes(scene,ids,editingGroupId),sourceIds=nodes.map(n=>n.id),set=new Set(sourceIds),s=structuredClone(scene),addedIds:string[]=[],delta={x:0,z:0};
 let step:number|undefined;
 if(request.type==='array'){
  const {axis,direction,count,gap}=request,host=nodes.length===1?nodes[0].host:undefined;
  if(nodes.some(n=>n.host)&&(!host||axis!==(['back','front'].includes(host)?'x':'z')))throw new Error('문·창문은 하나씩 선택하고 연결된 벽 방향으로 배열하세요.');
  if(scene.nodes.length+nodes.length*count>300)throw new Error('한 프로젝트에는 요소 300개까지 배치할 수 있습니다. 반복 횟수를 줄이세요.');
  const b=groupBounds(nodes);step=(host?nodes[0].width:axis==='x'?b.width:b.depth)+gap;
  const completeGroups=sceneGroups(scene).filter(g=>g.nodes.every(n=>set.has(n.id))),usedGroups=new Set(sceneGroups(scene).map(g=>g.id));
  for(let i=1;i<=count;i++){
   const groupMap=new Map<string,{id:string;name:string}>();
   for(const g of completeGroups){const id=groupIdFactory();if(usedGroups.has(id))throw new Error('사본 그룹 ID가 중복되었습니다. 다시 배치하세요.');usedGroups.add(id);groupMap.set(g.id,{id,name:`${g.name.slice(0,68)} · ${i+1}`});}
   const copies=nodes.map(n=>{const copy={...cloneUngroupedNode(n),id:idFactory(),name:`${n.name.slice(0,68)} · ${i+1}`,[axis]:n[axis]+direction*step!*i};if(n.group&&groupMap.has(n.group.id))copy.group=groupMap.get(n.group.id);return copy;});
   if(!host)assertInsideWalls(scene,copies);
   s.nodes.push(...copies);addedIds.push(...copies.map(n=>n.id));
  }
 }else{
  if(nodes.some(n=>n.host))throw new Error('문·창문은 벽에 연결되어 있습니다. 정밀 편집에서 벽을 따라 이동하세요.');
  const b=groupBounds(nodes),edge=request.edge,clearance=wallHalfThickness+request.margin;
  if(edge==='left')delta.x=-scene.room.width/2+clearance-b.min.x;
  if(edge==='right')delta.x=scene.room.width/2-clearance-b.max.x;
  if(edge==='back')delta.z=-scene.room.depth/2+clearance-b.min.z;
  if(edge==='front')delta.z=scene.room.depth/2-clearance-b.max.z;
  if(edge==='center'){delta.x=-b.center.x;delta.z=-b.center.z;}
  if(Math.abs(delta.x)<1e-7)delta.x=0;
  if(Math.abs(delta.z)<1e-7)delta.z=0;
  for(const n of s.nodes)if(set.has(n.id)){n.x+=delta.x;n.z+=delta.z;}
  assertInsideWalls(scene,s.nodes.filter(n=>set.has(n.id)));
 }
 const next=validateScene(s),resultIds=request.type==='array'?addedIds:sourceIds,resultSet=new Set(resultIds),before=new Set(collisions(scene).map(c=>JSON.stringify([c.a,c.b].sort())));
 const overlaps=collisions(next).filter(c=>(resultSet.has(c.a)||resultSet.has(c.b))&&!before.has(JSON.stringify([c.a,c.b].sort())));
 const unchanged=JSON.stringify(next)===JSON.stringify(scene);
 const summary=request.type==='array'?`선택한 ${nodes.length}개 요소를 ${request.count}회 반복 · ${addedIds.length}개 추가 · 외곽 간격 ${request.gap.toLocaleString()}mm`:`${placementEdges[request.edge]}에 ${nodes.length}개 요소 함께 정렬${request.edge==='center'?'':` · 벽 안쪽면에서 ${request.margin.toLocaleString()}mm`}`;
 return {scene:next,sourceIds,resultIds,addedIds,request,step,delta,overlaps,unchanged,summary,baseScene:JSON.stringify(scene)};
}
export type PlacementPlan=ReturnType<typeof planPlacement>;
export function acceptPlacementPlan(current:SceneData,plan:PlacementPlan,currentSession:number,plannedSession:number){
 if(currentSession!==plannedSession||JSON.stringify(current)!==plan.baseScene)throw new Error('미리보기 중 프로젝트나 배치가 변경되었습니다. 배열·정렬을 다시 열어 주세요.');
 return validateScene(plan.scene);
}
