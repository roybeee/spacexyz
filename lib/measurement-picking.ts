import type {Intersection,Object3D} from 'three';
import {measurementAnchor,type MeasurementScene} from './measurements';
export function pickMeasurementAnchor(scene:MeasurementScene,hits:Intersection<Object3D>[]){
 const hit=hits.find(h=>{let o:Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}return !!h.object.userData.nodeId;});
 if(!hit)throw new Error('가구·벽·바닥 위의 지점을 클릭하세요.');
 if(hit.object.userData.unmeasurable)throw new Error('3D 모델을 다 불러온 뒤 측정하세요.');
 if(hit.object.userData.measurementBlocked)throw new Error('움직이는 문짝·손잡이는 고정 측정점을 저장할 수 없습니다. 문틀이나 벽면에서 측정하세요.');
 return measurementAnchor(scene,hit.object.userData.nodeId,{x:hit.point.x*1000,y:hit.point.y*1000,z:hit.point.z*1000});
}
