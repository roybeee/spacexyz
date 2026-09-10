import {partitionObstacleBoxes} from './door-geometry';
import type {SceneData,SceneNode} from './scene-model';

export type WalkPoint={x:number;z:number};
export type WalkObstacle=WalkPoint&{id:string;name:string;halfX:number;halfZ:number;yaw:number};
export type WalkWorld={limitX:number;limitZ:number;obstacles:WalkObstacle[]};
export const walkRadius=250;
export const walkEyeHeights=[1200,1500,1650,1800,1900] as const;

// Millimetres throughout. Rectangular envelopes deliberately include furniture voids.
function envelope(n:SceneNode){
 let width=n.width,depth=n.depth,height=n.height;
 if(n.kind==='plant'){
  // Rotated ellipsoid leaves and a circular pot can protrude beyond nominal dimensions.
  const leaf=Math.hypot(width*.22,depth*.32);
  depth=Math.max(depth,width*.8,2*(depth*.15+leaf));
  width=Math.max(width,2*(width*.15+leaf));
 }
 if(n.kind==='bench')height=Math.max(height,Math.min(460,height*.65)+20);
 if(n.kind==='counter')height+=.5;
 if(n.kind==='pendant')depth=Math.max(depth,2*Math.min(width*.15,height*.12));
 return {width,depth,height};
}
export function walkWorld(scene:Pick<SceneData,'room'|'nodes'>,eyeHeight:number):WalkWorld{
 if(!Number.isFinite(eyeHeight)||eyeHeight<1200||eyeHeight>1900)throw new Error('눈높이는 1,200~1,900mm로 설정하세요.');
 const obstacles=scene.nodes.filter(n=>!n.hidden).flatMap(n=>{
  if(n.kind==='partition'&&n.openings?.length){
   return partitionObstacleBoxes(n).filter(p=>p.y-p.height/2<eyeHeight+150&&p.y+p.height/2>0).map(p=>({id:n.id,name:n.name,x:p.x,z:p.z,halfX:p.width/2+walkRadius,halfZ:p.depth/2+walkRadius,yaw:p.rotation*Math.PI/180}));
  }
  const e=envelope(n);if(n.y>=eyeHeight+150||n.y+e.height<=0)return [];
  const x=n.host==='left'?-scene.room.width/2:n.host==='right'?scene.room.width/2:n.x,z=n.host==='back'?-scene.room.depth/2:n.host==='front'?scene.room.depth/2:n.z,yaw=n.host==='left'||n.host==='right'?Math.PI/2:n.rotation*Math.PI/180;
  return [{id:n.id,name:n.name,x,z,halfX:e.width/2+walkRadius,halfZ:e.depth/2+walkRadius,yaw}];
 });
 return {limitX:scene.room.width/2-60-walkRadius,limitZ:scene.room.depth/2-60-walkRadius,obstacles};
}
function local(p:WalkPoint,o:WalkObstacle){const c=Math.cos(o.yaw),s=Math.sin(o.yaw),x=p.x-o.x,z=p.z-o.z;return{x:c*x-s*z,z:s*x+c*z};}
export function walkBlocker(world:WalkWorld,p:WalkPoint):string|null{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return '위치를 선택하세요';
 if(Math.abs(p.x)>world.limitX||Math.abs(p.z)>world.limitZ)return '벽';
 for(const o of world.obstacles){const q=local(p,o);if(Math.abs(q.x)<o.halfX&&Math.abs(q.z)<o.halfZ)return o.name||'가구';}
 return null;
}
type Hit={time:number;normal:WalkPoint;name:string};
function obstacleHit(p:WalkPoint,d:WalkPoint,o:WalkObstacle):Hit|null{
 const a=local(p,o),c=Math.cos(o.yaw),s=Math.sin(o.yaw),v={x:c*d.x-s*d.z,z:s*d.x+c*d.z};
 let enter=-Infinity,leave=Infinity,normal:WalkPoint={x:0,z:0};
 for(const [axis,half]of [['x',o.halfX],['z',o.halfZ]] as const){
  if(Math.abs(v[axis])<1e-10){if(Math.abs(a[axis])>=half)return null;continue;}
  const first=(-half-a[axis])/v[axis],last=(half-a[axis])/v[axis],near=Math.min(first,last),far=Math.max(first,last);
  if(near>enter){enter=near;normal={x:0,z:0};normal[axis]=v[axis]>0?-1:1;}
  leave=Math.min(leave,far);if(enter>leave)return null;
 }
 if(enter< -1e-9||enter>1||leave<0)return null;
 return {time:Math.max(0,enter),normal:{x:c*normal.x+s*normal.z,z:-s*normal.x+c*normal.z},name:o.name||'가구'};
}
export function moveWalk(world:WalkWorld,start:WalkPoint,delta:WalkPoint):{point:WalkPoint;blocked:string|null}{
 const invalid=walkBlocker(world,start);if(invalid)return{point:{...start},blocked:invalid};
 if(!Number.isFinite(delta.x)||!Number.isFinite(delta.z))return{point:{...start},blocked:'이동값 오류'};
 let p={...start},d={...delta},blocked:string|null=null;
 for(let pass=0;pass<4&&Math.hypot(d.x,d.z)>1e-6;pass++){
  let hit:Hit|null=null;
  const consider=(next:Hit|null)=>{if(next&&(!hit||next.time<hit.time))hit=next;};
  for(const [axis,limit]of [['x',world.limitX],['z',world.limitZ]] as const){
   if(Math.abs(p[axis]+d[axis])>limit){const sign=d[axis]>0?1:-1,normal={x:0,z:0};normal[axis]=-sign;consider({time:Math.max(0,(sign*limit-p[axis])/d[axis]),normal,name:'벽'});}
  }
  for(const o of world.obstacles)consider(obstacleHit(p,d,o));
  const contact=hit as Hit|null;
  if(!contact){p={x:p.x+d.x,z:p.z+d.z};break;}
  blocked=contact.name;
  const t=Math.max(0,contact.time-.01/Math.max(1,Math.hypot(d.x,d.z)));
  p={x:p.x+d.x*t,z:p.z+d.z*t};
  const remain={x:d.x*(1-t),z:d.z*(1-t)},dot=remain.x*contact.normal.x+remain.z*contact.normal.z;
  d={x:remain.x-Math.min(0,dot)*contact.normal.x,z:remain.z-Math.min(0,dot)*contact.normal.z};
 }
 // Numerical guard: a failed step never relocates the viewer into an obstacle.
 return walkBlocker(world,p)?{point:{...start},blocked:blocked??'가구'}:{point:p,blocked};
}
export function findWalkStart(world:WalkWorld,preferred?:WalkPoint):WalkPoint|null{
 const first=preferred??{x:0,z:world.limitZ-100};
 if(!walkBlocker(world,first))return {...first};
 let best:WalkPoint|null=null,bestDistance=Infinity;
 const nx=Math.ceil(world.limitX*2/150),nz=Math.ceil(world.limitZ*2/150);
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const p={x:-world.limitX+ix*world.limitX*2/nx,z:-world.limitZ+iz*world.limitZ*2/nz},dist=(p.x-first.x)**2+(p.z-first.z)**2;
  if(dist<bestDistance&&!walkBlocker(world,p)){best=p;bestDistance=dist;}
 }
 return best;
}
export function walkDirection(yaw:number,forward:number,right:number,speed:number,seconds:number):WalkPoint{
 const length=Math.max(1,Math.hypot(forward,right)),distance=speed*Math.max(0,Math.min(.05,seconds));
 return{x:(-Math.sin(yaw)*forward+Math.cos(yaw)*right)/length*distance,z:(-Math.cos(yaw)*forward-Math.sin(yaw)*right)/length*distance};
}
