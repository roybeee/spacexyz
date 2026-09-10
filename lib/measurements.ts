import {randomId} from '@/lib/random-id';
import {measurementAnchorSchema,measurementSchema,type MeasurementAnchor,type Measurement} from './measurement-schema';
import {validateScene,surfaceNames,type SceneData,type SceneNode} from './scene-model';
export type {MeasurementAnchor,Measurement} from './measurement-schema';
export type PointMM={x:number;y:number;z:number};
export type MeasurementScene=Pick<SceneData,'room'|'nodes'|'measurements'>;
export function nodeMeasurementPose(scene:MeasurementScene,n:SceneNode){
 const host=n.host;
 return {x:host==='left'?-scene.room.width/2:host==='right'?scene.room.width/2:n.x,y:n.y,z:host==='back'?-scene.room.depth/2:host==='front'?scene.room.depth/2:n.z,yaw:host?(['left','right'].includes(host)?Math.PI/2:0):n.rotation*Math.PI/180};
}
export function measurementAnchor(scene:MeasurementScene,id:string,p:PointMM):MeasurementAnchor{
 if(![p.x,p.y,p.z].every(Number.isFinite))throw new Error('측정 위치를 확인하세요.');
 const n=scene.nodes.find(n=>n.id===id),r=scene.room;
 if(n){const origin=nodeMeasurementPose(scene,n),c=Math.cos(origin.yaw),s=Math.sin(origin.yaw),dx=p.x-origin.x,dz=p.z-origin.z;return measurementAnchorSchema.parse({kind:'node',nodeId:id,point:[(c*dx-s*dz)/n.width,(p.y-origin.y)/n.height,(s*dx+c*dz)/n.depth]});}
 if(!Object.hasOwn(surfaceNames,id))throw new Error('가구·벽·바닥 위의 지점을 선택하세요.');
 const surface=id as keyof typeof r.surfaces;
 const a=surface==='floor'?{u:p.x/r.width+.5,v:p.z/r.depth+.5,offset:p.y}:surface==='left'||surface==='right'?{u:p.z/r.depth+.5,v:p.y/r.height,offset:p.x-(surface==='left'?-r.width/2:r.width/2)}:{u:p.x/r.width+.5,v:p.y/r.height,offset:p.z-(surface==='back'?-r.depth/2:r.depth/2)};
 // BoxGeometry stores Float32 vertices: exact face ray hits can drift a few micrometres.
 for(const boundary of [0,60,-60,-150])if(Math.abs(a.offset-boundary)<1e-3){a.offset=boundary;break;}
 return measurementAnchorSchema.parse({kind:'room',surface,...a});
}
export function resolveMeasurementAnchor(scene:MeasurementScene,a:MeasurementAnchor):PointMM|null{
 const r=scene.room;
 if(a.kind==='node'){const n=scene.nodes.find(n=>n.id===a.nodeId);if(!n)return null;const p=nodeMeasurementPose(scene,n),c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=a.point[0]*n.width,z=a.point[2]*n.depth;return{x:p.x+c*x+s*z,y:p.y+a.point[1]*n.height,z:p.z-s*x+c*z};}
 if(a.surface==='floor')return{x:(a.u-.5)*r.width,y:a.offset,z:(a.v-.5)*r.depth};
 if(a.surface==='left'||a.surface==='right')return{x:(a.surface==='left'?-r.width/2:r.width/2)+a.offset,y:a.v*r.height,z:(a.u-.5)*r.depth};
 return{x:(a.u-.5)*r.width,y:a.v*r.height,z:(a.surface==='back'?-r.depth/2:r.depth/2)+a.offset};
}
export function readMeasurement(scene:MeasurementScene,m:Measurement){
 const start=resolveMeasurementAnchor(scene,m.start),end=resolveMeasurementAnchor(scene,m.end);
 if(!start||!end)return null;
 const x=Math.abs(end.x-start.x),y=Math.abs(end.y-start.y),z=Math.abs(end.z-start.z);
 return{start,end,x,y,z,horizontal:Math.hypot(x,z),length:Math.hypot(x,y,z)};
}
export function measurementVisible(scene:MeasurementScene,m:Measurement){return !m.hidden&&[m.start,m.end].every(a=>a.kind==='room'||scene.nodes.some(n=>n.id===a.nodeId&&!n.hidden));}
export function addMeasurement(scene:SceneData,start:MeasurementAnchor,end:MeasurementAnchor,name=`치수 ${(scene.measurements?.length??0)+1}`,idFactory=()=>randomId()){
 const m=measurementSchema.parse({id:idFactory(),name,start,end,hidden:false}),value=readMeasurement(scene,m);
 if(!value)throw new Error('연결할 가구를 찾을 수 없습니다. 측정을 다시 시작하세요.');
 if(value.length<1)throw new Error('시작점에서 1mm 이상 떨어진 끝점을 선택하세요.');
 if((scene.measurements?.length??0)>=30)throw new Error('치수는 프로젝트당 30개까지 저장할 수 있습니다. 사용하지 않는 치수를 지우세요.');
 return validateScene({...scene,measurements:[...(scene.measurements??[]),m]});
}
export function editMeasurement(scene:SceneData,id:string,action:{type:'delete'}|{type:'rename';name:string}|{type:'hidden';value:boolean}){
 if(!scene.measurements?.some(m=>m.id===id))throw new Error('치수를 찾을 수 없습니다.');
 const measurements=scene.measurements.flatMap(m=>m.id!==id?[m]:action.type==='delete'?[]:action.type==='rename'?[{...m,name:action.name.trim()}]:[{...m,hidden:action.value}]);
 return validateScene({...scene,measurements});
}
export function anchorName(scene:MeasurementScene,a:MeasurementAnchor){return a.kind==='room'?surfaceNames[a.surface]:scene.nodes.find(n=>n.id===a.nodeId)?.name??'연결 대상 없음';}
export const distanceLabel=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')} mm`;
export function measurementsCsv(scene:MeasurementScene){
 const cell=(value:unknown)=>{const text=String(value??'');return `"${(typeof value==='string'&&/^[\s]*[=+\-@]/.test(text)?"'"+text:text).replace(/"/g,'""')}"`;};
 const n=(v:number|undefined)=>v===undefined?'':Number(v.toFixed(3));
 const rows=(scene.measurements??[]).map(m=>{const r=readMeasurement(scene,m);return[m.name,r?'연결됨':'연결 대상 없음',m.hidden?'숨김':'표시',anchorName(scene,m.start),anchorName(scene,m.end),n(r?.length),n(r?.horizontal),n(r?.y),n(r?.x),n(r?.z),n(r?.start.x),n(r?.start.y),n(r?.start.z),n(r?.end.x),n(r?.end.y),n(r?.end.z)];});
 return '\ufeff'+[['치수 이름','연결 상태','표시 설정','시작 대상','끝 대상','직선 거리 mm','수평 거리 mm','높이 차 mm','X 차 mm','Z 차 mm','시작 X','시작 Y','시작 Z','끝 X','끝 Y','끝 Z'],...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
