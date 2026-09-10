import {validateScene,type SceneData} from './scene-model';
import {calibratedWidth,validateUnderlay,underlayDepth,type ImagePoint,type PlanUnderlay} from './underlay-schema';
import type {ImageAsset} from './image-assets';
export function newUnderlay(image:ImageAsset,room:SceneData['room']):PlanUnderlay{return validateUnderlay({imageId:image.id,name:image.name,pixelWidth:image.metadata.width,pixelHeight:image.metadata.height,width:room.width,x:0,z:0,rotation:0,opacity:.65,visible:true});}
export function calibrateUnderlay(u:PlanUnderlay,start:ImagePoint,end:ImagePoint,distance:number):PlanUnderlay{return validateUnderlay({...u,width:calibratedWidth(u,start,end,distance),calibration:{start,end,distance}});}
export function underlayPoint(u:PlanUnderlay,point:ImagePoint){const dx=(point[0]-.5)*u.width,dz=(point[1]-.5)*underlayDepth(u),r=u.rotation*Math.PI/180;return{x:u.x+Math.cos(r)*dx+Math.sin(r)*dz,z:u.z-Math.sin(r)*dx+Math.cos(r)*dz};}
export function anchorUnderlay(u:PlanUnderlay,point:ImagePoint,x:number,z:number):PlanUnderlay{const world=underlayPoint(u,point);return validateUnderlay({...u,x:u.x+x-world.x,z:u.z+z-world.z});}
export function setUnderlay(scene:SceneData,u:PlanUnderlay|null){const next=structuredClone(scene);if(u)next.underlay=validateUnderlay(u);else delete next.underlay;return validateScene(next);}
export function acceptUnderlay(scene:SceneData,u:PlanUnderlay|null,baseScene:string,currentSession:number,baseSession:number){if(currentSession!==baseSession||JSON.stringify(scene)!==baseScene)throw new Error('프로젝트나 배치가 바뀌었습니다. 도면 배경을 다시 열어 주세요.');return setUnderlay(scene,u);}
