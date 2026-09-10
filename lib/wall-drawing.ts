import {z} from 'zod';
import {collisions,createNode,materialIds,validateScene,type SceneData} from './scene-model';
import {groupBounds} from './selection';
import {wallHalfThickness} from './placement';

export const wallPointSchema=z.object({x:z.number().finite().min(-30000).max(30000),z:z.number().finite().min(-30000).max(30000)});
export type WallPoint=z.infer<typeof wallPointSchema>;
export const wallDrawingSchema=z.object({
 points:z.array(wallPointSchema).min(2).max(31),closed:z.boolean(),
 name:z.string().trim().min(1).max(65),thickness:z.number().finite().min(20).max(500),
 height:z.number().finite().min(100).max(6000),material:z.enum(materialIds),layerId:z.string().uuid().optional()
});
export type WallDrawingRequest=z.infer<typeof wallDrawingSchema>;
const epsilon=1e-6;
const distance=(a:WallPoint,b:WallPoint)=>Math.hypot(b.x-a.x,b.z-a.z);
const cross=(a:WallPoint,b:WallPoint,c:WallPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
function touch(a:WallPoint,b:WallPoint,c:WallPoint,d:WallPoint){
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)-epsilon||Math.max(c.x,d.x)<Math.min(a.x,b.x)-epsilon||Math.max(a.z,b.z)<Math.min(c.z,d.z)-epsilon||Math.max(c.z,d.z)<Math.min(a.z,b.z)-epsilon)return false;
 const ab=distance(a,b),cd=distance(c,d),sign=(n:number)=>Math.abs(n)<=epsilon?0:Math.sign(n);
 return sign(cross(a,b,c)/ab)*sign(cross(a,b,d)/ab)<=0&&sign(cross(c,d,a)/cd)*sign(cross(c,d,b)/cd)<=0;
}
export function wallSegments(points:WallPoint[],closed=false){
 return points.slice(1).map((end,i)=>({start:points[i],end})).concat(closed&&points.length>2?[{start:points.at(-1)!,end:points[0]}]:[]);
}
/** Reject centerline crossings and retracing. Adjacent rectangles intentionally meet at their centerline ends. */
export function validateWallPath(input:WallPoint[],closed=false){
 const points=z.array(wallPointSchema).min(1).max(31).parse(input);
 if(closed&&points.length<3)throw new Error('세 점 이상 찍은 뒤 시작점과 연결하세요.');
 const segments=wallSegments(points,closed);
 if(segments.length>30)throw new Error('한 번에 벽 30구간까지 그릴 수 있습니다.');
 for(const {start,end} of segments){const length=distance(start,end);if(length<100-epsilon||length>20000+epsilon)throw new Error('각 구간의 중심선 길이는 100~20,000mm여야 합니다.');}
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j],adjacent=j===i+1||(closed&&i===0&&j===segments.length-1);
  if(adjacent){
   const ux=a.end.x-a.start.x,uz=a.end.z-a.start.z,vx=b.end.x-b.start.x,vz=b.end.z-b.start.z;
   if(Math.abs(ux*vz-uz*vx)/distance(a.start,a.end)<=epsilon&&ux*vx+uz*vz<0)throw new Error('이전 벽을 되짚을 수 없습니다. 마지막 점을 취소하고 방향을 바꾸세요.');
  }else if(touch(a.start,a.end,b.start,b.end))throw new Error('벽 중심선이 교차하거나 이미 그린 구간에 닿습니다. 점을 취소하고 다시 그리세요.');
 }
 return points;
}
/** Only pointer input is snapped; exact coordinate and length entry is preserved. */
export function snapWallPoint(input:WallPoint,from:WallPoint|undefined,grid:boolean,orthogonal:boolean):WallPoint{
 const p=wallPointSchema.parse(input),result={x:grid?Math.round(p.x/50)*50:p.x,z:grid?Math.round(p.z/50)*50:p.z};
 if(from&&orthogonal){if(Math.abs(result.x-from.x)>=Math.abs(result.z-from.z))result.z=from.z;else result.x=from.x;}
 return result;
}
export function planWalls(scene:SceneData,input:WallDrawingRequest,idFactory=()=>crypto.randomUUID(),groupIdFactory=()=>crypto.randomUUID()){
 let request:WallDrawingRequest;
 try{request=wallDrawingSchema.parse(input);}catch{throw new Error('이름, 좌표, 두께 20~500mm, 높이 100mm 이상과 소재를 확인하세요.');}
 validateWallPath(request.points,request.closed);
 if(request.height>scene.room.height)throw new Error('벽 높이는 공간의 천장 높이 이하여야 합니다.');
 if(request.layerId&&!scene.layers?.some(l=>l.id===request.layerId))throw new Error('선택한 레이어가 없습니다. 레이어를 다시 선택하세요.');
 const segments=wallSegments(request.points,request.closed);
 if(scene.nodes.length+segments.length>300)throw new Error('한 프로젝트에는 요소 300개까지 배치할 수 있습니다.');
 const group=segments.length>1?{id:groupIdFactory(),name:request.name}:undefined;
 if(group&&scene.nodes.some(n=>n.group?.id===group.id))throw new Error('그룹 ID가 중복되었습니다. 다시 그려 주세요.');
 const usedIds=new Set([...scene.nodes.map(n=>n.id),'floor','back','front','left','right']);
 const nodes=segments.map(({start,end},i)=>{
  const id=idFactory();if(usedIds.has(id))throw new Error('요소 ID가 중복되었습니다. 다시 그려 주세요.');usedIds.add(id);
  return {...createNode('partition',id,(start.x+end.x)/2,(start.z+end.z)/2),name:`${request.name} · ${i+1}`,width:distance(start,end),depth:request.thickness,height:request.height,rotation:(-Math.atan2(end.z-start.z,end.x-start.x)*180/Math.PI)||0,material:request.material,...(group?{group}:{}),...(request.layerId?{layerId:request.layerId}:{})};
 });
 const bounds=groupBounds(nodes),x=scene.room.width/2-wallHalfThickness,z=scene.room.depth/2-wallHalfThickness;
 if(bounds.min.x< -x-epsilon||bounds.max.x>x+epsilon||bounds.min.z< -z-epsilon||bounds.max.z>z+epsilon)throw new Error('벽 두께를 포함한 외곽이 실내 공간을 벗어납니다. 외벽에서 안쪽으로 옮겨 그리세요.');
 const next=validateScene({...structuredClone(scene),nodes:[...structuredClone(scene.nodes),...nodes]}),addedIds=nodes.map(n=>n.id),index=new Map(addedIds.map((id,i)=>[id,i]));
 const overlaps=collisions(next).filter(c=>{
  const a=index.get(c.a),b=index.get(c.b);if(a===undefined&&b===undefined)return false;
  if(a!==undefined&&b!==undefined&&(Math.abs(a-b)===1||(request.closed&&Math.abs(a-b)===nodes.length-1)))return false;
  return true;
 });
 const totalLength=nodes.reduce((sum,n)=>sum+n.width,0);
 return {scene:next,baseScene:JSON.stringify(scene),request,addedIds,overlaps,totalLength,summary:`벽 ${nodes.length}구간 · 중심선 합계 ${Math.round(totalLength).toLocaleString()}mm · 두께 ${request.thickness} / 높이 ${request.height}mm`};
}
export type WallPlan=ReturnType<typeof planWalls>;
export function acceptWallPlan(current:SceneData,plan:WallPlan,currentSession:number,plannedSession:number){
 if(currentSession!==plannedSession||JSON.stringify(current)!==plan.baseScene)throw new Error('미리보기 중 프로젝트나 배치가 변경되었습니다. 벽 그리기를 다시 열어 주세요.');
 return validateScene(plan.scene);
}
