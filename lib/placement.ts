import {randomId} from '@/lib/random-id';
import {z} from 'zod';
import {validateScene,cloneUngroupedNode,collisions,type SceneData,type SceneNode} from './scene-model';
import {groupBounds,selectedNodes,sceneGroups} from './selection';

// SceneEngine draws 120 mm walls centered on the room boundary.
export const wallHalfThickness=60;
export const placementSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('array'),axis:z.enum(['x','z']),direction:z.union([z.literal(1),z.literal(-1)]),count:z.number().int().min(1).max(12),gap:z.number().finite().min(0).max(5000)}),
 z.object({type:z.literal('align'),edge:z.enum(['left','right','back','front','center']),margin:z.number().finite().min(0).max(2000)}),
 z.object({type:z.literal('relative'),referenceIds:z.array(z.string().min(1).max(80)).min(1).max(300),edge:z.enum(['left','right','back','front']),gap:z.number().finite().min(0).max(5000),cross:z.enum(['keep','center'])}),
 z.object({type:z.literal('radial'),center:z.object({x:z.number().finite(),z:z.number().finite()}),count:z.number().int().min(1).max(12),angle:z.number().finite().min(15).max(360),rotate:z.boolean()})
]);
export type PlacementRequest=z.infer<typeof placementSchema>;
export const placementEdges={left:'왼쪽 벽',right:'오른쪽 벽',back:'안쪽 벽',front:'입구 벽',center:'공간 중앙'} as const;
export const relativeEdges={left:'기준의 왼쪽 · X −',right:'기준의 오른쪽 · X +',back:'기준의 안쪽 · Z −',front:'기준의 입구쪽 · Z +'} as const;
/** References never move, so locked furniture is deliberately available as a reference. */
export function placementReferenceOptions(scene:SceneData,sourceIds:string[]){
 const source=new Set(sourceIds),eligible=(n:SceneNode)=>!source.has(n.id)&&!n.hidden&&!n.host;
 return [
  ...sceneGroups(scene).filter(g=>g.nodes.every(eligible)).map(g=>({key:`group:${g.id}`,name:g.name,ids:g.nodes.map(n=>n.id),group:true})),
  ...scene.nodes.filter(n=>!n.group&&eligible(n)).map(n=>({key:`node:${n.id}`,name:n.name||'이름 없는 가구',ids:[n.id],group:false}))
 ];
}
function referenceNodes(scene:SceneData,sourceIds:string[],ids:string[]){
 const source=new Set(sourceIds),set=new Set(ids);
 if(set.size!==ids.length)throw new Error('기준 가구 ID가 중복되었습니다. 기준을 다시 선택하세요.');
 const nodes=ids.map(id=>{const n=scene.nodes.find(n=>n.id===id);if(!n)throw new Error('기준 가구를 찾을 수 없습니다.');return n;});
 if(nodes.some(n=>source.has(n.id)))throw new Error('이동할 가구와 기준 가구는 서로 달라야 합니다.');
 if(nodes.some(n=>n.hidden))throw new Error('숨긴 가구를 기준으로 사용할 수 없습니다.');
 if(nodes.some(n=>n.host))throw new Error('벽에 연결된 문·창문은 기준 가구로 사용할 수 없습니다.');
 const option=placementReferenceOptions(scene,sourceIds).find(o=>o.ids.length===ids.length&&o.ids.every(id=>set.has(id)));
 if(!option)throw new Error('기준은 가구 하나 또는 완전한 그룹 하나를 선택하세요.');
 return {nodes,name:option.name};
}
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
export function planPlacement(scene:SceneData,ids:string[],input:PlacementRequest,editingGroupId:string|null=null,idFactory=()=>randomId(),groupIdFactory=()=>randomId()){
 let request:PlacementRequest;
 try{request=placementSchema.parse(input)}catch{throw new Error('기준·배치 방향과 횟수 1~12회, 간격 0~5,000mm, 원형 각도 15~360°, 벽 여유 0~2,000mm를 확인하세요.');}
 const nodes=placementNodes(scene,ids,editingGroupId),sourceIds=nodes.map(n=>n.id),set=new Set(sourceIds),s=structuredClone(scene),addedIds:string[]=[],delta={x:0,z:0};
 let step:number|undefined,radius:number|undefined,referenceName='';
 const completeGroups=sceneGroups(scene).filter(g=>g.nodes.every(n=>set.has(n.id))),usedGroups=new Set(sceneGroups(scene).map(g=>g.id));
 function copiesFor(index:number,pose:(n:SceneNode)=>Partial<Pick<SceneNode,'x'|'z'|'rotation'>>){
  const groupMap=new Map<string,{id:string;name:string}>();
  for(const g of completeGroups){const id=groupIdFactory();if(usedGroups.has(id))throw new Error('사본 그룹 ID가 중복되었습니다. 다시 배치하세요.');usedGroups.add(id);groupMap.set(g.id,{id,name:`${g.name.slice(0,68)} · ${index+1}`});}
  return nodes.map(n=>{const copy={...cloneUngroupedNode(n),id:idFactory(),name:`${n.name.slice(0,68)} · ${index+1}`,...pose(n)};if(n.group&&groupMap.has(n.group.id))copy.group=groupMap.get(n.group.id);return copy;});
 }
 if(request.type==='array'){
  const {axis,direction,count,gap}=request,host=nodes.length===1?nodes[0].host:undefined;
  if(nodes.some(n=>n.host)&&(!host||axis!==(['back','front'].includes(host)?'x':'z')))throw new Error('문·창문은 하나씩 선택하고 연결된 벽 방향으로 배열하세요.');
  if(scene.nodes.length+nodes.length*count>300)throw new Error('한 프로젝트에는 요소 300개까지 배치할 수 있습니다. 반복 횟수를 줄이세요.');
  const b=groupBounds(nodes);step=(host?nodes[0].width:axis==='x'?b.width:b.depth)+gap;
  for(let i=1;i<=count;i++){
   const copies=copiesFor(i,n=>({[axis]:n[axis]+direction*step!*i}));
   if(!host)assertInsideWalls(scene,copies);
   s.nodes.push(...copies);addedIds.push(...copies.map(n=>n.id));
  }
 }else if(request.type==='radial'){
  if(nodes.some(n=>n.host))throw new Error('벽에 연결된 문·창문은 원형으로 배치할 수 없습니다.');
  const {center,count,angle,rotate}=request,limitX=scene.room.width/2-wallHalfThickness,limitZ=scene.room.depth/2-wallHalfThickness,b=groupBounds(nodes);
  if(Math.abs(center.x)>limitX+1e-6||Math.abs(center.z)>limitZ+1e-6)throw new Error('원형 배치의 중심은 실내 벽 안쪽에 지정하세요.');
  radius=Math.hypot(b.center.x-center.x,b.center.z-center.z);
  if(radius<=50)throw new Error('선택한 구성의 중심에서 50mm 넘게 떨어진 회전 중심을 지정하세요.');
  if(scene.nodes.length+nodes.length*count>300)throw new Error('한 프로젝트에는 요소 300개까지 배치할 수 있습니다. 반복 횟수를 줄이세요.');
  step=angle===360?360/(count+1):angle/count;
  for(let i=1;i<=count;i++){
   const degrees=step*i,radians=degrees*Math.PI/180,c=Math.cos(radians),sin=Math.sin(radians);
   const turn=(x:number,z:number)=>({x:center.x+c*(x-center.x)+sin*(z-center.z),z:center.z-sin*(x-center.x)+c*(z-center.z)}),target=turn(b.center.x,b.center.z),dx=target.x-b.center.x,dz=target.z-b.center.z;
   const copies=copiesFor(i,n=>{
    if(!rotate)return{x:n.x+dx,z:n.z+dz};
    const yaw=n.rotation+degrees,rotation=yaw>3600||yaw< -3600?((yaw+180)%360+360)%360-180:yaw;
    return{...turn(n.x,n.z),rotation};
   });
   assertInsideWalls(scene,copies);s.nodes.push(...copies);addedIds.push(...copies.map(n=>n.id));
  }
 }else{
  if(nodes.some(n=>n.host))throw new Error('문·창문은 벽에 연결되어 있습니다. 정밀 편집에서 벽을 따라 이동하세요.');
  const b=groupBounds(nodes),edge=request.edge;
  if(request.type==='relative'){
   const reference=referenceNodes(scene,sourceIds,request.referenceIds),r=groupBounds(reference.nodes);referenceName=reference.name;
   if(edge==='left')delta.x=r.min.x-request.gap-b.max.x;
   if(edge==='right')delta.x=r.max.x+request.gap-b.min.x;
   if(edge==='back')delta.z=r.min.z-request.gap-b.max.z;
   if(edge==='front')delta.z=r.max.z+request.gap-b.min.z;
   if(request.cross==='center'){if(edge==='left'||edge==='right')delta.z=r.center.z-b.center.z;else delta.x=r.center.x-b.center.x;}
  }else{
   const clearance=wallHalfThickness+request.margin;
   if(edge==='left')delta.x=-scene.room.width/2+clearance-b.min.x;
   if(edge==='right')delta.x=scene.room.width/2-clearance-b.max.x;
   if(edge==='back')delta.z=-scene.room.depth/2+clearance-b.min.z;
   if(edge==='front')delta.z=scene.room.depth/2-clearance-b.max.z;
   if(edge==='center'){delta.x=-b.center.x;delta.z=-b.center.z;}
  }
  if(Math.abs(delta.x)<1e-7)delta.x=0;
  if(Math.abs(delta.z)<1e-7)delta.z=0;
  for(const n of s.nodes)if(set.has(n.id)){n.x+=delta.x;n.z+=delta.z;}
  assertInsideWalls(scene,s.nodes.filter(n=>set.has(n.id)));
 }
 const next=validateScene(s),resultIds=request.type==='array'||request.type==='radial'?addedIds:sourceIds,resultSet=new Set(resultIds),before=new Set(collisions(scene).map(c=>JSON.stringify([c.a,c.b].sort())));
 const overlaps=collisions(next).filter(c=>(resultSet.has(c.a)||resultSet.has(c.b))&&!before.has(JSON.stringify([c.a,c.b].sort())));
 const unchanged=JSON.stringify(next)===JSON.stringify(scene);
 const summary=request.type==='array'?`선택한 ${nodes.length}개 요소를 ${request.count}회 반복 · ${addedIds.length}개 추가 · 외곽 간격 ${request.gap.toLocaleString()}mm`:request.type==='radial'?`${nodes.length}개 구성 원형 배치 · ${request.angle}° ${request.angle===360?'전체 원':'구간'} · ${request.count}회 / ${addedIds.length}개 추가 · ${request.rotate?'구성 함께 회전':'원래 방향 유지'}`:request.type==='relative'?`${referenceName} ${relativeEdges[request.edge].split(' · ')[0].replace('기준의 ','')}에 ${nodes.length}개 요소 배치 · 외곽 간격 ${request.gap.toLocaleString()}mm${request.cross==='center'?' · 교차축 중심 맞춤':''}`:`${placementEdges[request.edge]}에 ${nodes.length}개 요소 함께 정렬${request.edge==='center'?'':` · 벽 안쪽면에서 ${request.margin.toLocaleString()}mm`}`;
 return {scene:next,sourceIds,resultIds,addedIds,request,step,radius,delta,overlaps,unchanged,summary,baseScene:JSON.stringify(scene)};
}
export type PlacementPlan=ReturnType<typeof planPlacement>;
export function acceptPlacementPlan(current:SceneData,plan:PlacementPlan,currentSession:number,plannedSession:number){
 if(currentSession!==plannedSession||JSON.stringify(current)!==plan.baseScene)throw new Error('미리보기 중 프로젝트나 배치가 변경되었습니다. 배열·정렬을 다시 열어 주세요.');
 return validateScene(plan.scene);
}
