import * as T from 'three';
import {snapFloorPoint} from './snap-settings';
export type DrawStatus={started:boolean;width:number;depth:number};
export type FloorPoint={x:number;z:number};
/** The first corner is already accepted; only the moving corner uses the current grid. */
export function drawRectangle(start:FloorPoint,end:FloorPoint,enabled:boolean,translationMm=50){
 const a=snapFloorPoint(start,false),b=snapFloorPoint(end,enabled,translationMm),width=Math.round(Math.abs(b.x-a.x)*1000),depth=Math.round(Math.abs(b.z-a.z)*1000);
 return{start:a,end:b,width,depth,x:Math.round((a.x+b.x)*500),z:Math.round((a.z+b.z)*500),valid:width>=50&&depth>=50};
}
export class DrawPreview{
 readonly group=new T.Group();
 private lineGeometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(12),3));
 private cornerGeometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(6),3));
 private lineMaterial=new T.LineBasicMaterial({color:0x8058ac,depthTest:false,depthWrite:false,toneMapped:false});
 private fillMaterial=new T.MeshBasicMaterial({color:0x8058ac,transparent:true,opacity:.14,depthTest:false,depthWrite:false,toneMapped:false,side:T.DoubleSide});
 private cornerMaterial=new T.PointsMaterial({color:0x8058ac,size:6,sizeAttenuation:false,depthTest:false,depthWrite:false,toneMapped:false});
 private fill=new T.Mesh(new T.PlaneGeometry(1,1),this.fillMaterial);
 private disposed=false;
 constructor(){this.group.name='DRAW_RECTANGLE_PREVIEW';this.group.visible=false;const line=new T.LineLoop(this.lineGeometry,this.lineMaterial),corners=new T.Points(this.cornerGeometry,this.cornerMaterial);this.fill.rotation.x=-Math.PI/2;this.fill.renderOrder=80;line.renderOrder=81;corners.renderOrder=82;this.group.add(this.fill,line,corners);}
 update(start:FloorPoint,end:FloorPoint,enabled:boolean,translationMm=50){
  const rect=drawRectangle(start,end,enabled,translationMm);if(this.disposed)return rect;
  const a=rect.start,b=rect.end,position=this.lineGeometry.getAttribute('position');[[a.x,a.z],[b.x,a.z],[b.x,b.z],[a.x,b.z]].forEach(([x,z],i)=>position.setXYZ(i,x,.01,z));position.needsUpdate=true;this.lineGeometry.computeBoundingSphere();
  const corners=this.cornerGeometry.getAttribute('position');corners.setXYZ(0,a.x,.012,a.z);corners.setXYZ(1,b.x,.012,b.z);corners.needsUpdate=true;this.cornerGeometry.computeBoundingSphere();
  this.fill.position.set((a.x+b.x)/2,.008,(a.z+b.z)/2);this.fill.scale.set(Math.abs(a.x-b.x),Math.abs(a.z-b.z),1);
  const color=rect.valid?0x8058ac:0xd36558;this.lineMaterial.color.setHex(color);this.fillMaterial.color.setHex(color);this.cornerMaterial.color.setHex(color);this.group.visible=true;return rect;
 }
 clear(){this.group.visible=false;}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.group.removeFromParent();this.lineGeometry.dispose();this.cornerGeometry.dispose();this.fill.geometry.dispose();this.lineMaterial.dispose();this.fillMaterial.dispose();this.cornerMaterial.dispose();}
}

export type GesturePointer={pointerId:number;clientX:number;clientY:number;button:number;isPrimary?:boolean};
/** A multi-pointer gesture stays suppressed until every participating pointer has ended. */
export class PointerGestureTracker{
 private active=new Map<number,{x:number;y:number;eligible:boolean;moved:boolean}>();
 private blocked=false;
 get size(){return this.active.size;}
 get canPreview(){return !this.blocked&&this.active.size<=1;}
 down(e:GesturePointer){if(this.active.has(e.pointerId)||this.active.size)this.blocked=true;const eligible=e.button===0&&e.isPrimary!==false;this.active.set(e.pointerId,{x:e.clientX,y:e.clientY,eligible,moved:false});if(!eligible)this.blocked=true;return eligible&&!this.blocked;}
 move(e:Pick<GesturePointer,'pointerId'|'clientX'|'clientY'>){const p=this.active.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>5)p.moved=true;}
 up(e:GesturePointer){const p=this.active.get(e.pointerId),click=!!p&&p.eligible&&!p.moved&&!this.blocked&&this.active.size===1&&e.button===0&&e.isPrimary!==false&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=5;this.active.delete(e.pointerId);if(!this.active.size)this.blocked=false;return click;}
 cancel(pointerId?:number){if(pointerId===undefined)this.active.clear();else this.active.delete(pointerId);this.blocked=this.active.size>0;}
}
