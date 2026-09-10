import {z} from 'zod';
import {createNode,kindNames,materialIds,validateScene,type SceneData,type SceneNode} from './scene-model';
import {objectPhotoSchema} from './object-photo-schema';
import {randomId} from './random-id';
export const objectPhotoKinds=['table','round-table','chair','bench','counter','shelf','plant','pendant','box','cylinder'] as const;
export const photoPartSchema=z.object({shape:z.enum(['box','cylinder']),name:z.string().trim().min(1).max(30),x:z.number().finite().min(-1).max(1),y:z.number().finite().min(0).max(1),z:z.number().finite().min(-1).max(1),width:z.number().finite().min(.01).max(1),height:z.number().finite().min(.01).max(1),depth:z.number().finite().min(.01).max(1),material:z.enum(materialIds),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict();
export type PhotoPart=z.infer<typeof photoPartSchema>;
export const objectPhotoInputSchema=z.object({kind:z.enum(objectPhotoKinds),name:z.string().trim().min(1).max(80),width:z.number().finite().min(20).max(10000),height:z.number().finite().min(20).max(10000),depth:z.number().finite().min(20).max(10000),material:z.enum(materialIds),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),photo:objectPhotoSchema,parts:z.array(photoPartSchema).max(16).optional()});
export type ObjectPhotoInput=z.infer<typeof objectPhotoInputSchema>;
export const objectPhotoAnalysisSchema=z.object({kind:z.enum(objectPhotoKinds),name:z.string().trim().min(1).max(80),material:z.enum(materialIds),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),notes:z.array(z.string().max(300)).max(5),parts:z.array(photoPartSchema).max(16)}).strict();
const partProperties={shape:{type:'string',enum:['box','cylinder']},name:{type:'string'},x:{type:'number'},y:{type:'number'},z:{type:'number'},width:{type:'number'},height:{type:'number'},depth:{type:'number'},material:{type:'string',enum:materialIds},color:{type:'string'}};
export const objectPhotoAnalysisJSONSchema={type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:objectPhotoKinds},name:{type:'string'},material:{type:'string',enum:materialIds},color:{type:'string'},notes:{type:'array',items:{type:'string'}},parts:{type:'array',items:{type:'object',additionalProperties:false,properties:partProperties,required:Object.keys(partProperties)}}},required:['kind','name','material','color','notes','parts']};
/** Fit the union of visible inferred parts exactly to authoritative user dimensions. */
export function photoPartLayout(raw:PhotoPart[],size:{width:number;height:number;depth:number}){
 const parts=z.array(photoPartSchema).min(1).max(16).parse(raw),min={x:Math.min(...parts.map(p=>p.x-p.width/2)),y:Math.min(...parts.map(p=>p.y)),z:Math.min(...parts.map(p=>p.z-p.depth/2))},max={x:Math.max(...parts.map(p=>p.x+p.width/2)),y:Math.max(...parts.map(p=>p.y+p.height)),z:Math.max(...parts.map(p=>p.z+p.depth/2))};
 const sx=size.width/(max.x-min.x),sy=size.height/(max.y-min.y),sz=size.depth/(max.z-min.z);
 return parts.map(p=>({...p,x:(p.x-(max.x+min.x)/2)*sx,y:(p.y-min.y)*sy,z:(p.z-(max.z+min.z)/2)*sz,width:p.width*sx,height:p.height*sy,depth:p.depth*sz}));
}
export function createPhotoObject(scene:SceneData,raw:unknown,id=randomId()):{scene:SceneData;node:SceneNode;nodes:SceneNode[];ids:string[]}{
 const input=objectPhotoInputSchema.parse(raw),node:SceneNode={...createNode(input.kind,id),name:input.name,width:input.width,height:input.height,depth:input.depth,material:input.material,color:input.color,estimated:true,objectPhoto:{...input.photo,productName:input.name}};
 // Dimensions describe the overall object. A pendant starts directly beneath the current ceiling.
 node.y=input.kind==='pendant'?Math.max(0,scene.room.height-input.height-100):0;
 // Find a free conservative footprint near the middle. The result is still editable.
 const positions:[[number,number],...[number,number][]]=[[0,0]];
 for(let radius=500;radius<=Math.max(scene.room.width,scene.room.depth)/2;radius+=500)for(const [x,z]of [[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[-radius,radius],[radius,-radius],[-radius,-radius]])positions.push([x,z]);
 const fits=([x,z]:[number,number])=>Math.abs(x)+node.width/2<=scene.room.width/2-60&&Math.abs(z)+node.depth/2<=scene.room.depth/2-60;
 const available=positions.find(point=>fits(point)&&!scene.nodes.some(n=>{if(n.hidden||n.host||n.y>=node.y+node.height||n.y+n.height<=node.y)return false;const a=n.rotation*Math.PI/180,w=Math.abs(Math.cos(a))*n.width+Math.abs(Math.sin(a))*n.depth,d=Math.abs(Math.sin(a))*n.width+Math.abs(Math.cos(a))*n.depth;return Math.abs(n.x-point[0])<(w+node.width)/2+50&&Math.abs(n.z-point[1])<(d+node.depth)/2+50;}));
 const place=available??positions.find(fits);if(!place)throw new Error('물체가 현재 공간보다 큽니다. 가로·깊이를 확인하세요.');[node.x,node.z]=place;
 let nodes=[node];
 if(scene.nodes.length+Math.max(1,input.parts?.length??0)>300)throw new Error('장면 요소는 최대 300개입니다. 기존 요소를 줄이거나 AI 부품 구성을 끄세요.');
 if(input.parts?.length){
  const parts=photoPartLayout(input.parts,input),objectId=randomId(),group=parts.length>1?{id:randomId(),name:input.name}:undefined;
  if(parts.some(p=>Math.min(p.width,p.height,p.depth)<20-1e-6))throw new Error('일부 추정 부품이 20mm보다 얇습니다. AI 부품 구성을 끄고 기본형으로 만들거나 치수를 확인하세요.');
  nodes=parts.map((part,i)=>({...createNode(part.shape,i===0?id:randomId()),name:`${input.name.slice(0,46)} · ${part.name}`,x:part.x+place[0],y:part.y+node.y,z:part.z+place[1],width:part.width,height:part.height,depth:part.depth,material:part.material,color:part.color,estimated:true,...(group?{group}:{}),objectPhoto:{...input.photo,productName:input.name,representation:'parts' as const,objectId,partIndex:i,partCount:parts.length,sourceSize:{width:input.width,height:input.height,depth:input.depth}}}));
 }else node.objectPhoto={...input.photo,productName:input.name,representation:'parametric',sourceSize:{width:input.width,height:input.height,depth:input.depth}};
 return {scene:validateScene({...scene,nodes:[...scene.nodes,...nodes]}),node:nodes[0],nodes,ids:nodes.map(n=>n.id)};
}
export function photoObjectLabel(node:SceneNode){return node.objectPhoto?`${kindNames[node.kind]} · 사진 참고 기본형`:kindNames[node.kind];}
