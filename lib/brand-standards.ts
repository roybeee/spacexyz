import {z} from 'zod';
import {createNode,finishSchema,materialIds,validateScene,type SceneData,type SceneNode} from './scene-model';
import {materialProduct,productFinish} from './material-products';
import {randomId} from './random-id';

export const brandRoles=['floor','wall','accent','counterFront','counterTop','wood','metal'] as const;
export type BrandRole=typeof brandRoles[number];
export const brandRoleNames:Record<BrandRole,string>={floor:'바닥',wall:'기본 벽',accent:'안쪽 포인트 벽',counterFront:'카운터 전면',counterTop:'카운터 상판',wood:'가구 목재',metal:'금속 디테일'};
const slotSchema=z.object({material:z.enum(materialIds),finish:finishSchema.strict().refine(f=>!f.textureId,'브랜드 표준에는 제조사 제품 또는 색상을 선택하세요.'),note:z.string().trim().max(300)}).strict();
const moduleSchema=z.object({enabled:z.boolean(),width:z.number().int().min(600).max(5000),height:z.number().int().min(400).max(2400),depth:z.number().int().min(300).max(1200),note:z.string().trim().max(300)}).strict();
export const brandStandardSchema=z.object({version:z.literal(1),name:z.string().trim().min(1).max(80),note:z.string().trim().max(1000),status:z.enum(['draft','reviewed']),referenceUrl:z.string().max(500).refine(v=>!v||/^https:\/\//.test(v),'https 참고 주소를 입력하세요.'),materials:z.object({floor:slotSchema,wall:slotSchema,accent:slotSchema,counterFront:slotSchema,counterTop:slotSchema,wood:slotSchema,metal:slotSchema}).strict(),modules:z.object({counter:moduleSchema,backbar:moduleSchema,seating:moduleSchema}).strict()}).strict();
export type BrandStandard=z.infer<typeof brandStandardSchema>;
export type BrandRow={id:string;standard:BrandStandard;revision:number;updated_at:string};
export const moduleNames={counter:'주문·픽업 카운터',backbar:'후면 수납·작업대',seating:'벽면 벤치·테이블'};
export function validateBrand(input:unknown){return brandStandardSchema.parse(input)}
const productSlot=(id:string,note:string)=>{const p=materialProduct(id);if(!p)throw new Error('표준 소재 제품을 찾을 수 없습니다.');return {material:p.base,finish:productFinish(p),note}};
export function ofdBrand():BrandStandard{return validateBrand({version:1,name:'올드페리도넛',status:'draft',referenceUrl:'https://www.oldferrydonut.kr/',note:'OFD 매장 기획용 편집 초안입니다. 색상·제품 코드·치수는 디자이너 제안이며 본사 공식 시공 표준 또는 납품 이력이 아닙니다. 본사 매뉴얼과 실물 샘플 확인 후 수정하세요.',materials:{floor:productSlot('lx-101748','PTT6950 미스티 콘크리트 · LVT 제안. 바탕면·미끄럼·상업공간 적합성 확인.'),wall:{material:'plaster',finish:{color:'#F1E9D8',roughness:.85},note:'크림 색상 시안 · 제조사 조색 코드 미지정.'},accent:{material:'charcoal',finish:{color:'#1C304A',roughness:.75},note:'네이비 색상 시안 · 공식 브랜드 컬러가 아닙니다.'},counterFront:{material:'charcoal',finish:{color:'#1C304A',roughness:.65},note:'도장 전면 제안 · 조색·하부 구조·내구성 검토.'},counterTop:productSlot('hanex-vm-004','VM-004 인조대리석 제안 · 식품 접촉·이음·두께 별도 검토.'),wood:productSlot('egger-h1180-st37','H1180 ST37 우드 데코 제안 · 심재·두께·엣지 별도 지정.'),metal:productSlot('lx-101457','SAM01 메탈 장식 보드 제안 · 실제 스테인리스 강판 사양과 다릅니다.')},modules:{counter:{enabled:true,width:2600,height:1000,depth:800,note:'몸체 + 40mm 상판 + 전면 하부 디테일. 쇼케이스·POS·설비는 별도 설계.'},backbar:{enabled:true,width:2400,height:900,depth:450,note:'후면 작업대 + 상판. 카운터와 계획상 1,000mm 간격.'},seating:{enabled:true,width:2400,height:800,depth:600,note:'오른쪽 벤치 + 2인 테이블 2개. 좌석 운영·접근성은 현장 확인.'}}})}
export const brandRoomSchema=z.object({width:z.number().int().min(2400).max(20000),depth:z.number().int().min(2400).max(20000),height:z.number().int().min(2200).max(6000)}).strict();
export type BrandRoom=z.infer<typeof brandRoomSchema>;
export function brandReplacementItems(s:SceneData):string[]{return [s.nodes.length?`기존 요소 ${s.nodes.length}개`:'',s.photoId?'참고 사진':'',s.underlay?'도면 배경':'',s.facade?'외관':'',s.measurements?.length?'치수':'',s.budget?'예산':'',s.layers?.length?'레이어':'',s.cameras.length?'저장 시점':'',s.renders?.length?'렌더 결과':'',s.palette?.length?'팔레트':'',s.draft?'이전 시안 설명':''].filter(Boolean)}
export function brandScene(source:SceneData,brand:BrandStandard,identity:{id:string;revision:number},mode:'surfaces'|'layout',room:BrandRoom,replaceExisting=false):SceneData{
 const s=validateScene(source),b=validateBrand(brand),r=brandRoomSchema.parse(room);
 const surfaces={floor:structuredClone(b.materials.floor),back:structuredClone(b.materials.accent),left:structuredClone(b.materials.wall),right:structuredClone(b.materials.wall),front:structuredClone(b.materials.wall)};
 let next:SceneData={...s,room:{...s.room,surfaces}};
 if(mode==='layout'){
  if(brandReplacementItems(s).length&&!replaceExisting)throw new Error('기존 배치가 있습니다. 빈 상가로 교체하는 데 동의하거나 새 프로젝트에서 시작하세요.');
  next={version:1,name:s.name,room:{...r,source:'entered',surfaces},nodes:[],lighting:{intensity:1,warmth:3500},cameras:[],...(s.variants?{variants:s.variants}:{}),...(s.materialShortlist?{materialShortlist:s.materialShortlist}:{})};
  const add=(kind:SceneNode['kind'],name:string,x:number,z:number,width:number,height:number,depth:number,role:BrandRole,y=0,group?:{id:string;name:string},rotation=0)=>{
   if(kind==='model')throw new Error('지원하지 않는 모듈입니다.');const slot=b.materials[role];
   next.nodes.push({...createNode(kind,randomId(),x,z),name,width,height,depth,y,rotation,material:slot.material,finish:structuredClone(slot.finish),uniformMaterial:true,...(group?{group}:{})});
  };
  const {counter,backbar,seating}=b.modules;
  let backEdge=-r.depth/2+100;
  if(backbar.enabled){const group={id:randomId(),name:moduleNames.backbar};add('box','후면 작업대 몸체',0,backEdge+backbar.depth/2,backbar.width,backbar.height-40,backbar.depth,'wood',0,group);add('box','후면 작업대 상판',0,backEdge+backbar.depth/2,backbar.width,40,backbar.depth,'counterTop',backbar.height-40,group);backEdge+=backbar.depth+1000;}
  if(counter.enabled){const group={id:randomId(),name:moduleNames.counter};add('box','주문·픽업 몸체',0,backEdge+counter.depth/2,counter.width,counter.height-40,counter.depth,'counterFront',0,group);add('box','주문·픽업 상판',0,backEdge+counter.depth/2,counter.width,40,counter.depth,'counterTop',counter.height-40,group);add('box','카운터 하부 디테일',0,backEdge+counter.depth+10,counter.width,80,20,'metal',0,group);backEdge+=counter.depth+20;}
  if(seating.enabled){
   const start=r.depth/2-200-seating.width;
   if(start<backEdge+900)throw new Error('상가 깊이가 부족합니다. 벤치 모듈을 끄거나 길이·카운터 깊이를 줄이세요. 카운터와 좌석 사이 900mm 계획 여유가 필요합니다.');
   if(r.width<seating.depth+2300)throw new Error('좌석 배치를 위한 상가 폭이 부족합니다. 벤치 깊이를 줄이거나 좌석 모듈을 끄세요.');
   if(seating.width<1600)throw new Error('테이블 2개가 포함된 벤치 모듈은 길이 1,600mm 이상이 필요합니다.');
   const group={id:randomId(),name:moduleNames.seating};add('bench','벽면 벤치',r.width/2-100-seating.depth/2,start+seating.width/2,seating.width,seating.height,seating.depth,'wood',0,group,90);
   for(let i=0;i<2;i++){const z=start+seating.width*(i?.75:.25),x=r.width/2-100-seating.depth-425;add('table',`좌석 테이블 ${i+1}`,x,z,650,740,650,'counterTop',0,group);}
  }
  if(backEdge>r.depth/2-1200)throw new Error('카운터 앞 공간이 부족합니다. 모듈 깊이를 줄이거나 상가 깊이를 늘리세요.');
  const entrance={...createNode('door',randomId(),-r.width/2+700,0),name:'출입구 위치 초안',host:'front' as const,width:1000,height:2100,material:'glass' as const};next.nodes.push(entrance);
 }
 next.brandApplication={...identity,name:b.name,status:b.status,mode,appliedAt:new Date().toISOString()};
 return validateScene(next);
}
export function assertBrandSnapshot(scene:SceneData,base:string,session:number,expected:number){if(session!==expected||JSON.stringify(scene)!==base)throw new Error('프로젝트가 변경되었습니다. 브랜드 적용을 다시 미리보기하세요.');}
