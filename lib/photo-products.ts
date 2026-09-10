import {z} from 'zod';
import {validateScene,type SceneData,type SceneNode} from './scene-model';
import {groupBounds,selectedNodes} from './selection';
import {photoDimensionsMeasured} from './object-photo-schema';
export type PhotoProduct={id:string;ids:string[];name:string;brand:string;code:string;imageId:string;width:number;depth:number;height:number;partCount:number;expectedParts:number;complete:boolean;consistent:boolean;hidden:boolean;locked:boolean;status:string;notes:string[]};
export function photoProductGroups(nodes:SceneNode[]){
 const groups=new Map<string,SceneNode[]>();
 for(const n of nodes){const p=n.objectPhoto;if(!p)continue;const key=p.representation==='parts'&&p.objectId&&n.group?`parts:${n.group.id}:${p.objectId}`:`node:${n.id}`;const list=groups.get(key)??[];list.push(n);groups.set(key,list);}
 return groups;
}
export function photoProducts(scene:Pick<SceneData,'nodes'>):PhotoProduct[]{return [...photoProductGroups(scene.nodes)].map(([id,nodes])=>{
 const n=nodes[0],p=n.objectPhoto!,parts=p.representation==='parts',expected=p.partCount??1;
 const complete=!parts||(nodes.length===expected&&new Set(nodes.map(n=>n.objectPhoto?.partIndex)).size===expected&&nodes.every(n=>n.objectPhoto?.partCount===expected&&n.objectPhoto.partIndex!==undefined&&n.objectPhoto.partIndex<expected));
 const consistent=nodes.every(n=>{const q=n.objectPhoto!;return q.imageId===p.imageId&&q.brand===p.brand&&q.productCode===p.productCode&&q.productName===p.productName;});
 // Measure in the first part's local axes, so rotating an intact product does
 // not enlarge its reported width/depth to world-aligned bounding dimensions.
 const a=n.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),origin={x:n.x,z:n.z};
 const b=parts?groupBounds(nodes.map(q=>({...q,x:(q.x-origin.x)*c-(q.z-origin.z)*s,z:(q.x-origin.x)*s+(q.z-origin.z)*c,rotation:q.rotation-n.rotation}))):n;
 return {id,ids:nodes.map(n=>n.id),name:p.productName||n.group?.name||n.name.split(' · ')[0],brand:p.brand,code:p.productCode,imageId:p.imageId,width:b.width,depth:b.depth,height:b.height,partCount:nodes.length,expectedParts:expected,complete,consistent,hidden:nodes.some(n=>n.hidden),locked:nodes.some(n=>n.locked),status:!complete?'부품 누락·중복 확인':!consistent?'제품 정보 불일치':parts?'사진 추정 부품':photoDimensionsMeasured(n)?'실측 입력 유지':'입력 치수 · 확인 필요',notes:p.notes};
});}
export const productDetailsSchema=z.object({name:z.string().trim().min(1).max(80),brand:z.string().trim().max(60),code:z.string().trim().max(60)}).strict();
export function editPhotoProduct(scene:SceneData,id:string,input:unknown){const p=photoProducts(scene).find(p=>p.id===id);if(!p)throw new Error('사진 가구를 찾지 못했습니다. 목록을 다시 여세요.');const value=productDetailsSchema.parse(input);selectedNodes(scene,p.ids);const ids=new Set(p.ids);return validateScene({...scene,nodes:scene.nodes.map(n=>ids.has(n.id)?{...n,objectPhoto:{...n.objectPhoto!,productName:value.name,brand:value.brand,productCode:value.code}}:n)});}
export function photoProductsCsv(scene:SceneData){const rows:(string|number)[][]=[['프로젝트',scene.name],['범위','전체 사진 가구 · 숨긴 요소 포함 · 검색 필터 미적용'],['치수 기준','부품형은 첫 부품의 방향을 기준으로 한 현재 외곽 · 실측 복원 아님'],['제품명','제조사','제품 코드','가로(mm)','깊이(mm)','높이(mm)','확인 수량','현재 부품','등록 부품','상태','표시','메모'],...photoProducts(scene).map(p=>[p.name,p.brand,p.code,Math.round(p.width),Math.round(p.depth),Math.round(p.height),p.complete&&p.consistent?1:'확인 필요',p.partCount,p.expectedParts,p.status,p.hidden?'숨긴 부품 포함':'표시',p.notes.join(' / ')])];const cell=(v:string|number)=>'"'+(typeof v==='string'&&/^\s*[=+\-@]/.test(v)?"'"+v:String(v)).replace(/"/g,'""')+'"';return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');}
export type PhotoProductTag={name:string;brand:string;code:string;imageId:string};
export function uniquePhotoTags(items:PhotoProductTag[]){return [...new Map(items.map(p=>[JSON.stringify([p.name,p.brand,p.code,p.imageId]),p])).values()];}
export function photoProductTags(nodes:SceneNode[]):PhotoProductTag[]{return uniquePhotoTags(nodes.filter(n=>n.objectPhoto).map(n=>({name:n.objectPhoto!.productName||n.name.split(' · ')[0],brand:n.objectPhoto!.brand,code:n.objectPhoto!.productCode,imageId:n.objectPhoto!.imageId})));}
