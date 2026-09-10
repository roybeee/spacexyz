import {partitionCells,type PartitionOpening,type PartitionShape} from './partition-openings-schema';
import {boxesOverlap} from './geometry-overlap';
import type {SceneNode} from './scene-model';

/** Centre-based boxes in millimetres; rotation is a Three.js Y yaw in degrees. */
export type LocalDoorBox={x:number;y:number;z:number;width:number;height:number;depth:number;rotation:number};
type Pose=Pick<SceneNode,'x'|'y'|'z'|'rotation'>;
const radians=(degrees:number)=>degrees*Math.PI/180;

/** Missing configuration preserves the original, fixed, centre-mounted door. */
export function doorGeometry(n:Pick<PartitionShape,'depth'>,o:PartitionOpening){
 if(o.kind!=='door'||!o.door)return null;
 const dir=o.door.hinge==='left'?1:-1,side=o.door.side==='positive'?1:-1;
 const leafWidth=o.width-60,leafHeight=o.height-30,leafDepth=Math.min(n.depth*.4,25);
 // The entire closed leaf is outside the wall face, with 2 mm hinge clearance.
 const hinge={x:o.x-dir*leafWidth/2,z:side*(n.depth/2+leafDepth/2+2)};
 const yaw=-dir*side*o.door.angle,c=Math.cos(radians(yaw)),s=Math.sin(radians(yaw));
 const rotate=(x:number,z:number)=>({x:hinge.x+c*x+s*z,z:hinge.z-s*x+c*z});
 const leaf:LocalDoorBox={...rotate(dir*leafWidth/2,0),y:o.bottom+leafHeight/2,width:leafWidth,height:leafHeight,depth:leafDepth,rotation:yaw};
 const handle:LocalDoorBox={...rotate(dir*(leafWidth-100),side*(leafDepth/2+10)),y:o.bottom+o.height*.47,width:20,height:120,depth:20,rotation:yaw};
 return{hinge,yaw,dir,side,leaf,handle,leafWidth,leafHeight,leafDepth};
}

export function toWorldDoorBox(n:Pose,box:LocalDoorBox):LocalDoorBox{
 const r=radians(n.rotation),c=Math.cos(r),s=Math.sin(r);
 return{...box,x:n.x+c*box.x+s*box.z,y:n.y+box.y,z:n.z-s*box.x+c*box.z,rotation:n.rotation+box.rotation};
}

/** Declared body plus the true, asymmetric protrusion of every upgraded door. */
export function physicalNodeBounds(n:SceneNode){
 const boxes:LocalDoorBox[]=[{x:0,y:n.height/2,z:0,width:n.width,height:n.height,depth:n.depth,rotation:0}];
 for(const o of n.openings??[]){const door=doorGeometry(n,o);if(door)boxes.push(door.leaf,door.handle);}
 const min={x:Infinity,y:n.y,z:Infinity},max={x:-Infinity,y:n.y+n.height,z:-Infinity};
 for(const local of boxes){const b=toWorldDoorBox(n,local),r=radians(b.rotation),c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),halfX=(c*b.width+s*b.depth)/2,halfZ=(s*b.width+c*b.depth)/2;
  min.x=Math.min(min.x,b.x-halfX);max.x=Math.max(max.x,b.x+halfX);min.z=Math.min(min.z,b.z-halfZ);max.z=Math.max(max.z,b.z+halfZ);if(local!==boxes[0]){min.y=Math.min(min.y,b.y-b.height/2);max.y=Math.max(max.y,b.y+b.height/2);}
 }
 return{min,max,center:{x:(min.x+max.x)/2,y:(min.y+max.y)/2,z:(min.z+max.z)/2},width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z};
}

/** Actual wall cells, frames and panels; a passage contributes no filled box. */
export function partitionObstacleBoxes(n:SceneNode,options:{movingDoors?:boolean}={}):LocalDoorBox[]{
 const boxes:LocalDoorBox[]=partitionCells(n).map(p=>({x:p.x,y:p.y,z:0,width:p.width,height:p.height,depth:n.depth,rotation:0}));
 const box=(x:number,y:number,z:number,width:number,height:number,depth:number)=>boxes.push({x,y,z,width,height,depth,rotation:0});
 for(const o of n.openings??[]){
  if(o.kind==='passage')continue;
  box(o.x-o.width/2+15,o.bottom+o.height/2,0,30,o.height,n.depth);
  box(o.x+o.width/2-15,o.bottom+o.height/2,0,30,o.height,n.depth);
  box(o.x,o.bottom+o.height-15,0,o.width-60,30,n.depth);
  const door=doorGeometry(n,o);
  if(door){if(options.movingDoors!==false)boxes.push(door.leaf,door.handle);continue;}
  const sill=o.kind==='window'?30:0,panelDepth=Math.min(n.depth*(o.kind==='window'?.5:.4),o.kind==='window'?12:25);
  if(sill)box(o.x,o.bottom+15,0,o.width-60,30,n.depth);
  box(o.x,o.bottom+sill+(o.height-30-sill)/2,0,o.width-60,o.height-30-sill,panelDepth);
  if(o.kind==='door'){const handleDepth=Math.min(20,(n.depth-panelDepth)/2);box(o.x+o.width/2-100,o.bottom+o.height*.47,panelDepth/2+handleDepth/2,20,120,handleDepth);}
 }
 return boxes.map(b=>toWorldDoorBox(n,b));
}

/** Current-pose interference between different door assemblies or a door and its fixed wall. */
export function partitionSelfCollision(n:SceneNode){
 if(n.kind!=='partition'||n.hidden)return false;
 const moving=(n.openings??[]).flatMap(o=>{const door=doorGeometry(n,o);return door?[[door.leaf,door.handle].map(b=>toWorldDoorBox(n,b))]:[];});
 if(!moving.length)return false;
 const fixed=partitionObstacleBoxes(n,{movingDoors:false});
 for(let i=0;i<moving.length;i++){
  if(moving[i].some(a=>fixed.some(b=>boxesOverlap(a,b))))return true;
  for(let j=i+1;j<moving.length;j++)if(moving[i].some(a=>moving[j].some(b=>boxesOverlap(a,b))))return true;
 }
 return false;
}
