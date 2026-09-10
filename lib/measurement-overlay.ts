import * as T from 'three';
import {readMeasurement,measurementVisible,resolveMeasurementAnchor,distanceLabel,type MeasurementScene,type MeasurementAnchor} from './measurements';

function labelSprite(name:string,value:number){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=176;const c=canvas.getContext('2d');if(!c)throw new Error('치수 표시를 만들 수 없습니다.');
 c.fillStyle='#fffaf0';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle='#d39b3d';c.lineWidth=7;c.strokeRect(4,4,760,168);
 c.textAlign='center';c.fillStyle='#816235';c.font='30px sans-serif';c.fillText(name.length>25?name.slice(0,24)+'…':name,384,51,710);
 c.fillStyle='#473622';c.font='bold 62px sans-serif';c.fillText(distanceLabel(value),384,130,710);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,toneMapped:false}));label.renderOrder=102;return label;
}
export class MeasurementOverlay{
 group=new T.Group();private key='';
 constructor(private createLabel=labelSprite){this.group.name='MEASUREMENT_ANNOTATIONS';}
 update(scene:MeasurementScene,start:MeasurementAnchor|null=null){
  const resolved=(scene.measurements??[]).filter(m=>measurementVisible(scene,m)).flatMap(m=>{const value=readMeasurement(scene,m);return value?[{m,value}]:[]}),draft=start?resolveMeasurementAnchor(scene,start):null;
  const key=JSON.stringify({resolved,draft,width:scene.room.width,depth:scene.room.depth});if(key===this.key)return;
  this.clear();this.key=key;const scale=Math.max(.7,Math.min(1.5,Math.max(scene.room.width,scene.room.depth)/11000));
  const dot=(p:{x:number;y:number;z:number},color=0xca8b27)=>{const o=new T.Mesh(new T.SphereGeometry(.028*scale,10,8),new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false}));o.position.set(p.x/1000,p.y/1000,p.z/1000);o.renderOrder=103;this.group.add(o);};
  for(const {m,value}of resolved){
   const a=new T.Vector3(value.start.x/1000,value.start.y/1000,value.start.z/1000),b=new T.Vector3(value.end.x/1000,value.end.y/1000,value.end.z/1000);
   const line=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),new T.LineBasicMaterial({color:0xc88c31,depthTest:false,depthWrite:false}));line.renderOrder=101;line.userData.measurementId=m.id;this.group.add(line);dot(value.start);dot(value.end);
   const label=this.createLabel(m.name,value.length);label.position.copy(a).add(b).multiplyScalar(.5);label.scale.set(scale,scale*176/768,1);label.center.set(.5,-.08);label.userData.measurementId=m.id;this.group.add(label);
  }
  if(draft)dot(draft,0x7754c2);
 }
 clear(){this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats)mat.dispose();}if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});this.group.clear();this.key='';}
 dispose(){this.clear();this.group.removeFromParent();}
}
