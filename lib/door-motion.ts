import {boxesOverlap,collisionBoxes,type SceneData} from './scene-model';
import {doorGeometry,toWorldDoorBox,partitionObstacleBoxes,type LocalDoorBox} from './door-geometry';
import {hostObstacleBoxes} from './hosted-geometry';

export type DoorMotionIssue={type:'object'|'boundary'|'self';nodeId?:string;name:string;firstAngle:number;lastAngle:number};
export type DoorMotionInspection={samples:number;step:number;limitAngle:number;issues:DoorMotionIssue[];blocked:boolean};
type Bounds={min:{x:number;y:number;z:number};max:{x:number;y:number;z:number}};
function bounds(boxes:LocalDoorBox[]):Bounds{
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const b of boxes){const r=b.rotation*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),dx=(c*b.width+s*b.depth)/2,dz=(s*b.width+c*b.depth)/2;min.x=Math.min(min.x,b.x-dx);max.x=Math.max(max.x,b.x+dx);min.y=Math.min(min.y,b.y-b.height/2);max.y=Math.max(max.y,b.y+b.height/2);min.z=Math.min(min.z,b.z-dz);max.z=Math.max(max.z,b.z+dz);}
 return{min,max};
}
function intersects(a:Bounds,b:Bounds){return a.min.x<b.max.x&&b.min.x<a.max.x&&a.min.y<b.max.y&&b.min.y<a.max.y&&a.min.z<b.max.z&&b.min.z<a.max.z;}

/** Sampled inspection at at most five-degree steps; this is not continuous sweep proof. */
export function inspectDoorMotion(scene:SceneData,nodeId:string,openingId:string,limitAngle:number):DoorMotionInspection{
 if(!Number.isFinite(limitAngle)||limitAngle<0||limitAngle>120)throw new Error('열림 범위는 0~120°로 입력하세요.');
 const n=scene.nodes.find(n=>n.id===nodeId);
 if(!n||n.kind!=='partition')throw new Error('문이 있는 파티션을 선택하세요.');
 if(n.hidden)throw new Error('숨긴 파티션은 표시한 뒤 검사하세요.');
 const active=n.openings?.find(o=>o.id===openingId);
 if(!active||active.kind!=='door'||!active.door)throw new Error('개폐 설정을 사용 중인 문을 선택하세요.');
 const segments=Math.ceil(limitAngle/5),step=segments?limitAngle/segments:0;
 const samples=Array.from({length:segments+1},(_,i)=>{const angle=i===segments?limitAngle:i*step,door=doorGeometry(n,{...active,door:{...active.door!,angle}})!;const boxes=[door.leaf,door.handle].map(b=>toWorldDoorBox(n,b));return{angle,boxes,bounds:bounds(boxes)};});
 const sweptBounds=bounds(samples.flatMap(s=>s.boxes));
 // Keep the active aperture, but replace its moving assembly with only its fixed frame.
 const self=partitionObstacleBoxes({...n,openings:n.openings!.map(o=>o.id===active.id?{...o,kind:'passage',door:undefined}:o)});
 const frame:LocalDoorBox[]=[
  {x:active.x-active.width/2+15,y:active.bottom+active.height/2,z:0,width:30,height:active.height,depth:n.depth,rotation:0},
  {x:active.x+active.width/2-15,y:active.bottom+active.height/2,z:0,width:30,height:active.height,depth:n.depth,rotation:0},
  {x:active.x,y:active.bottom+active.height-15,z:0,width:active.width-60,height:30,depth:n.depth,rotation:0}
 ];
 self.push(...frame.map(b=>toWorldDoorBox(n,b)));
 const selfCandidates=self.filter(b=>intersects(sweptBounds,bounds([b])));
 const others=scene.nodes.filter(o=>o.id!==n.id&&!o.hidden).map(o=>{const boxes=o.host?hostObstacleBoxes(o,scene.room):collisionBoxes(o);return{node:o,boxes,bounds:bounds(boxes)};}).filter(o=>intersects(sweptBounds,o.bounds));
 const found=new Map<string,DoorMotionIssue>(),mark=(type:DoorMotionIssue['type'],name:string,angle:number,nodeId?:string)=>{const key=`${type}:${nodeId??''}`,old=found.get(key);if(old)old.lastAngle=angle;else found.set(key,{type,name,firstAngle:angle,lastAngle:angle,...(nodeId?{nodeId}:{})});};
 const limitX=scene.room.width/2-60,limitZ=scene.room.depth/2-60,epsilon=1e-6;
 for(const sample of samples){const b=sample.bounds;
  if(b.min.x< -limitX-epsilon||b.max.x>limitX+epsilon||b.min.z< -limitZ-epsilon||b.max.z>limitZ+epsilon||b.min.y< -epsilon||b.max.y>scene.room.height+epsilon)mark('boundary','실내 벽·바닥·천장',sample.angle);
  if(sample.boxes.some(moving=>selfCandidates.some(fixed=>boxesOverlap(moving,fixed))))mark('self',n.name,sample.angle,n.id);
  for(const o of others)if(intersects(sample.bounds,o.bounds)&&sample.boxes.some(moving=>o.boxes.some(fixed=>boxesOverlap(moving,fixed))))mark('object',o.node.name,sample.angle,o.node.id);
 }
 const issues=[...found.values()];return{samples:samples.length,step,limitAngle,issues,blocked:issues.length>0};
}
