import {z} from 'zod';
import * as T from 'three';
export const sectionSchema=z.object({axis:z.enum(['x','y','z']),position:z.number().finite().min(0).max(1),keep:z.enum(['positive','negative']),guide:z.boolean().default(true)});
export type SectionView=z.infer<typeof sectionSchema>;
export type SectionRoom={width:number;depth:number;height:number};
export const sectionAxes={x:'좌우',y:'높이',z:'앞뒤'};
export function sectionRange(room:SectionRoom,axis:SectionView['axis']):[number,number]{return axis==='y'?[0,room.height]:axis==='x'?[-room.width/2,room.width/2]:[-room.depth/2,room.depth/2];}
export function sectionOffset(room:SectionRoom,s:SectionView){const [min,max]=sectionRange(room,s.axis);return min+(max-min)*s.position;}
export function sectionAtOffset(room:SectionRoom,s:SectionView,offset:number):SectionView{const [min,max]=sectionRange(room,s.axis);if(!Number.isFinite(offset)||offset<min||offset>max)throw new Error(`${min}~${max}mm 범위로 입력하세요.`);return sectionSchema.parse({...s,position:(offset-min)/(max-min)});}
export function sectionPlane(room:SectionRoom,s:SectionView){const normal=new T.Vector3();normal[s.axis]=s.keep==='positive'?1:-1;return new T.Plane(normal,-normal[s.axis]*sectionOffset(room,s)/1000);}
/** Matches the GPU's retained half-space. Tolerance accommodates Float32 raycast boundaries. */
export function sectionContains(room:SectionRoom,s:SectionView|null|undefined,point:T.Vector3){return !s||sectionPlane(room,s).distanceToPoint(point)>=-1e-6;}
export function sectionGuidePoints(room:SectionRoom,s:SectionView){const w=room.width/2000,d=room.depth/2000,h=room.height/1000,p=sectionOffset(room,s)/1000;return (s.axis==='x'?[[p,0,-d],[p,h,-d],[p,h,d],[p,0,d]]:s.axis==='y'?[[-w,p,-d],[w,p,-d],[w,p,d],[-w,p,d]]:[[-w,0,p],[w,0,p],[w,h,p],[-w,h,p]]).map(v=>new T.Vector3(...v));}
export function sectionDescription(room:SectionRoom,s:SectionView){const offset=Math.round(sectionOffset(room,s)).toLocaleString('ko-KR'),side=s.axis==='x'?(s.keep==='positive'?'오른쪽':'왼쪽'):s.axis==='y'?(s.keep==='positive'?'위쪽':'아래쪽'):(s.keep==='positive'?'입구쪽':'안쪽');return `${sectionAxes[s.axis]} ${offset}mm · ${side} 유지`;}
