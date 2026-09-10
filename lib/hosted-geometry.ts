import {toWorldDoorBox,type LocalDoorBox} from './door-geometry';
import type {SceneData,SceneNode} from './scene-model';

/** Actual external door/window solids, in world millimetres. Match SceneEngine.buildNode. */
export function hostObstacleBoxes(n:SceneNode,room:Pick<SceneData['room'],'width'|'depth'>):LocalDoorBox[]{
 if(!n.host||(n.kind!=='door'&&n.kind!=='window'))throw new Error('외벽에 연결된 문·창문을 선택하세요.');
 const side=n.host==='left'||n.host==='right';
 const pose={x:side?(n.host==='left'?-room.width/2:room.width/2):n.x,y:n.y,z:side?n.z:(n.host==='back'?-room.depth/2:room.depth/2),rotation:side?90:0};
 const boxes:LocalDoorBox[]=[];
 const box=(width:number,height:number,depth:number,x:number,y:number,z:number)=>boxes.push({x,y,z,width,height,depth,rotation:0});
 box(n.width,n.height,25,0,n.height/2,0);
 for(const direction of [-1,1])box(45,n.height,n.depth,direction*(n.width/2-22),n.height/2,0);
 box(n.width,45,n.depth,0,n.height-22,0);
 if(n.kind==='window'){
  box(n.width,45,n.depth,0,22,0);
  box(35,n.height,55,0,n.height/2,0);
 }else box(20,160,60,n.width/2-120,n.height*.47,35);
 return boxes.map(b=>toWorldDoorBox(pose,b));
}
