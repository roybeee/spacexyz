import {z} from 'zod';
import {finishSchema,materialIds,validateScene,type SceneData} from './scene-model';
import {materialProduct,productFinish} from './material-products';
import {brandGrades,type BrandGrade,type BrandReport,type Entrance} from './brand-application';
import {planBrandStore,defaultLayoutOptions,type LayoutOptions,type PlanBand} from './brand-layout';

/** Material roles a brand standard assigns. Every generated part maps to one of these. */
export const brandRoles=['floor','wall','accent','counterFront','counterTop','wood','metal','fabric'] as const;
export type BrandRole=typeof brandRoles[number];
export const brandRoleNames:Record<BrandRole,string>={floor:'바닥',wall:'기본 벽',accent:'안쪽 포인트 벽',counterFront:'카운터 전면',counterTop:'카운터·플린스 상판',wood:'가구 목재',metal:'금속 디테일',fabric:'좌석 패브릭'};

const slotSchema=z.object({
  material:z.enum(materialIds),
  finish:finishSchema.strict().refine(f=>!f.textureId,'브랜드 표준에는 제조사 제품 또는 색상을 선택하세요.'),
  note:z.string().trim().max(300),
}).strict();
const defaultFabric=()=>({material:'linen' as const,finish:{color:'#2B4C7E',roughness:.9},note:'블루 패브릭 시각화 색상 · 마틴데일 30,000회 이상 · 제조사 코드는 본사 지정 후 입력.'});

const moduleSchema=z.object({
  enabled:z.boolean(),
  width:z.number().int().min(600).max(5000),
  height:z.number().int().min(400).max(2400),
  depth:z.number().int().min(300).max(1200),
  note:z.string().trim().max(300),
}).strict();
type BrandModule=z.infer<typeof moduleSchema>;
const moduleSpec=(width:number,height:number,depth:number,note:string,enabled=true):BrandModule=>({enabled,width,height,depth,note});

/** Equipment modules in service-flow order: display → order → beverage → pickup → back-of-house → seating. */
export const moduleNames={
  showcase:'진열 쇼케이스 (플린스)',
  counter:'주문 카운터 (POS)',
  beverage:'음료 제조대',
  pickup:'픽업대',
  backbar:'후방 수납·작업대',
  seating:'벽면 벤치·테이블',
  windowBar:'창가 바 좌석',
} as const;
export type ModuleKey=keyof typeof moduleNames;
export const moduleGrades:Record<ModuleKey,BrandGrade>={showcase:'F',counter:'F',beverage:'O',pickup:'S',backbar:'O',seating:'O',windowBar:'O'};
export const moduleHints:Record<ModuleKey,string>={
  showcase:'폭은 선호 모듈(600·900·1200) · 높이는 플린스 상판 높이 · 깊이는 플린스 깊이. 유리 쇼케이스는 상판 위에 올라갑니다.',
  counter:'폭은 POS 카운터 길이 · 높이는 상판 높이. 폭이 넓은 상가에서는 그대로, 좁으면 900mm까지 자동 축소.',
  beverage:'에스프레소 머신 자리를 포함한 작업대. 좁으면 900mm까지 자동 축소.',
  pickup:'서비스 라인 끝의 픽업 카운터. 좁으면 600mm까지 자동 축소.',
  backbar:'뒷벽 작업대. 남는 뒷벽은 SUS 보관랙으로 채웁니다.',
  seating:'출입구 반대쪽 벽면 벤치. 폭은 최대 벤치 길이이며 공간에 맞춰 줄어듭니다.',
  windowBar:'전면 창가 바. 폭은 최대 길이 · 높이는 바 상판 높이 · 깊이는 바 깊이.',
};
const defaultModules=()=>({
  showcase:moduleSpec(1200,900,800,'[F] 유리 쇼케이스 + 목재 베이스, 콘크리트 기단. 플린스 GL+900(±20)·깊이 800·모듈 600/900/1200·상판 천연석재 20mm↑·몸통 무늬목 0.5mm↑(시트지 불가).'),
  counter:moduleSpec(1200,1050,800,'[F] 상판 GL+1,050 · 플린스와 동일 석재 · 하부 전면 도어형. POS 단말 자리 포함.'),
  beverage:moduleSpec(1200,900,800,'[O] 에스프레소 머신·제빙기·싱크 자리. 지정 모델 확보 후 치수 확정.'),
  pickup:moduleSpec(900,1050,800,'[S] 서비스 라인 끝 픽업 카운터. 대기열과 분리된 픽업 동선.'),
  backbar:moduleSpec(2400,900,450,'[O] 후방 작업대 + 상판. 부통로 900mm 뒤에 배치.'),
  seating:moduleSpec(2400,800,600,'[O] 블루 패브릭 벤치 + SUS 테이블 + 체어. 테이블 1개당 1,200mm.'),
  windowBar:moduleSpec(3600,1050,400,'[O] 창가 바 상판 + SUS 프레임 + SUS 바 스툴 600mm 간격.'),
});

const zoneRule=z.object({min:z.number().min(0).max(100),max:z.number().min(0).max(100)}).strict().refine(z=>z.min<=z.max,'최소 비율이 최대 비율보다 큽니다.');
export const brandRulesSchema=z.object({
  source:z.string().trim().max(120),
  aisleMain:z.number().int().min(600).max(3000),
  aisleSub:z.number().int().min(600).max(3000),
  queueDepth:z.number().int().min(0).max(6000),
  doorWidth:z.number().int().min(700).max(2400),
  lightingWarmth:z.number().int().min(2700).max(6500),
  zones:z.object({display:zoneRule,counter:zoneRule,back:zoneRule,pickup:zoneRule}).strict(),
  checklist:z.array(z.object({grade:z.enum(brandGrades),label:z.string().trim().min(1).max(80)}).strict()).max(12),
}).strict();
export type BrandRules=z.infer<typeof brandRulesSchema>;
export const ruleNames:Record<'aisleMain'|'aisleSub'|'queueDepth'|'doorWidth'|'lightingWarmth',string>={aisleMain:'주통로 폭',aisleSub:'부통로 폭',queueDepth:'대기열 깊이',doorWidth:'출입문 폭',lightingWarmth:'조명 색온도'};
export const zoneRuleNames:Record<keyof BrandRules['zones'],string>={display:'Z2 진열',counter:'Z3 카운터·음료',back:'Z6 후방',pickup:'Z4 픽업'};
/** OFD 인테리어·시공 매뉴얼 v1.0 (2026.08) 기준값. 다른 브랜드는 이 값을 출발점으로 수정합니다. */
export const defaultBrandRules=():BrandRules=>({
  source:'OFD 인테리어·시공 매뉴얼 v1.0 (2026.08)',
  aisleMain:1200,aisleSub:900,queueDepth:2400,doorWidth:1000,lightingWarmth:3000,
  zones:{display:{min:20,max:100},counter:{min:15,max:20},back:{min:15,max:20},pickup:{min:5,max:10}},
  checklist:[
    {grade:'F',label:'진열대 직상부 공조 취출 금지 (제품 건조·변질)'},
    {grade:'F',label:'컬러 면적비 중성 8 : 목재 1.5 : 브랜드 0.5 · 틸 3%↓ · 오렌지 2%↓'},
    {grade:'F',label:'진열 조명 1,500~2,000lux · CRI90↑ · 빔각 24~36° · 진열/객석 디밍 회로 분리'},
    {grade:'F',label:'플린스 몸통 목재 무늬목 0.5mm↑ · 시트지 절대 불가'},
    {grade:'F',label:'금속 SUS 304 헤어라인 공통 · 미러·유광·컬러 분체도장 금지'},
    {grade:'S',label:'목재 월넛 표준 · 라왕 우드 루버 조건부 대체'},
    {grade:'S',label:'블루 패브릭 마틴데일 30,000회↑'},
    {grade:'S',label:'한국 민화 그래픽 최대 2개소 · 본사 지정 원화 한정'},
    {grade:'S',label:'전기 Type C 10kW · 쇼케이스 전용 회로'},
  ],
});

export const brandStandardSchema=z.object({
  version:z.literal(1),
  name:z.string().trim().min(1).max(80),
  note:z.string().trim().max(1000),
  status:z.enum(['draft','reviewed']),
  referenceUrl:z.string().max(500).refine(v=>!v||/^https:\/\//.test(v),'https 참고 주소를 입력하세요.'),
  materials:z.object({
    floor:slotSchema,wall:slotSchema,accent:slotSchema,counterFront:slotSchema,counterTop:slotSchema,wood:slotSchema,metal:slotSchema,
    fabric:slotSchema.default(defaultFabric),
  }).strict(),
  modules:z.object({
    counter:moduleSchema,backbar:moduleSchema,seating:moduleSchema,
    showcase:moduleSchema.default(()=>defaultModules().showcase),
    beverage:moduleSchema.default(()=>defaultModules().beverage),
    pickup:moduleSchema.default(()=>defaultModules().pickup),
    windowBar:moduleSchema.default(()=>defaultModules().windowBar),
  }).strict(),
  rules:brandRulesSchema.default(defaultBrandRules),
}).strict();
export type BrandStandard=z.infer<typeof brandStandardSchema>;
export type BrandRow={id:string;standard:BrandStandard;revision:number;updated_at:string};

export function validateBrand(input:unknown){return brandStandardSchema.parse(input)}

const productSlot=(id:string,note:string)=>{const p=materialProduct(id);if(!p)throw new Error('표준 소재 제품을 찾을 수 없습니다.');return {material:p.base,finish:productFinish(p),note}};

/** Old Ferry Donut standard as read from the 2026.08 construction manual. Fixed [F] items must not be changed. */
export function ofdBrand():BrandStandard{return validateBrand({
  version:1,name:'올드페리도넛',status:'draft',referenceUrl:'https://www.oldferrydonut.kr/',
  note:'OFD 인테리어·시공 매뉴얼 v1.0(2026.08) 기준의 브랜드 스튜디오 표준입니다. [F] 고정 사양은 변경 불가·위반 시 재시공 대상이며, 설비 개별 치수는 설계 기준값으로 본사 지정 모델 확보 후 교체합니다. 제조사 코드가 없는 부위는 본사 지정 전 시각화 색상입니다. 본사 공식 시공 표준 문서를 대체하지 않습니다.',
  materials:{
    floor:productSlot('lx-101748','[O] 중성 톤 바닥 시각화 · PTT6950 미스티 콘크리트 LVT 제안. 매뉴얼 미지정 · 바탕면·미끄럼·상업공간 적합성 확인.'),
    wall:{material:'plaster',finish:{color:'#F4F1EA',roughness:.85},note:'[S] 화이트 페인팅 마감 (입면도 C · White Painting Finish). 컬러 면적비 중성 8.'},
    accent:{material:'walnut',finish:{color:'#5A3A2A',roughness:.7},note:'[S] 월넛 우드 루버 표준 · 라왕(Lauan) 우드 루버 조건부 대체. 목재 면적비 1.5.'},
    counterFront:{material:'walnut',finish:{color:'#5A3A2A',roughness:.65},note:'[F] 카운터·플린스 몸통 목재 무늬목 0.5mm↑ · 시트지 절대 불가 · 하부 전면 도어형.'},
    counterTop:{material:'concrete',finish:{color:'#D9D3C7',roughness:.45},note:'[F] 천연석재 20mm↑ · 카운터와 플린스 동일 석재. 석종은 본사 지정 · 밝은 석재 톤 시각화.'},
    wood:{material:'walnut',finish:{color:'#5A3A2A',roughness:.7},note:'[S] 월넛 표준 · 라왕 조건부. 가구 목재 공통.'},
    metal:{material:'steel',finish:{color:'#C9CCCF',roughness:.35,metalness:.85},note:'[F] SUS 304 헤어라인 전 가구 공통 · 미러·유광·컬러 분체도장 금지.'},
    fabric:defaultFabric(),
  },
  modules:defaultModules(),
  rules:defaultBrandRules(),
})}

export const brandRoomSchema=z.object({width:z.number().int().min(2400).max(20000),depth:z.number().int().min(2400).max(20000),height:z.number().int().min(2200).max(6000)}).strict();
export type BrandRoom=z.infer<typeof brandRoomSchema>;
export type {LayoutOptions,PlanBand};
export {defaultLayoutOptions};

export function brandReplacementItems(s:SceneData):string[]{return [s.nodes.length?`기존 요소 ${s.nodes.length}개`:'',s.photoId?'참고 사진':'',s.underlay?'도면 배경':'',s.facade?'외관':'',s.measurements?.length?'치수':'',s.budget?'예산':'',s.layers?.length?'레이어':'',s.cameras.length?'저장 시점':'',s.renders?.length?'렌더 결과':'',s.palette?.length?'팔레트':'',s.draft?'이전 시안 설명':''].filter(Boolean)}

/** Plan details for the studio dialog: report, zone bands and the entrance aisle, without building a scene. */
export function brandPlan(brand:BrandStandard,room:BrandRoom,options:LayoutOptions=defaultLayoutOptions):{report:BrandReport;bands:PlanBand[];aisle:{x0:number;x1:number}}{
  const {report,bands,aisle}=planBrandStore(validateBrand(brand),brandRoomSchema.parse(room),options);
  return {report,bands,aisle};
}

export function brandScene(source:SceneData,brand:BrandStandard,identity:{id:string;revision:number},mode:'surfaces'|'layout',room:BrandRoom,replaceExisting=false,options:LayoutOptions=defaultLayoutOptions):SceneData{
  const s=validateScene(source),b=validateBrand(brand),r=brandRoomSchema.parse(room);
  const surfaces={floor:structuredClone(b.materials.floor),back:structuredClone(b.materials.accent),left:structuredClone(b.materials.wall),right:structuredClone(b.materials.wall),front:structuredClone(b.materials.wall)};
  let next:SceneData={...s,room:{...s.room,surfaces}};
  let report:BrandReport|undefined;
  if(mode==='layout'){
    if(brandReplacementItems(s).length&&!replaceExisting)throw new Error('기존 배치가 있습니다. 빈 상가로 교체하는 데 동의하거나 새 프로젝트에서 시작하세요.');
    const plan=planBrandStore(b,r,options);
    report=plan.report;
    next={version:1,name:s.name,room:{...r,source:'entered',surfaces},nodes:plan.nodes,lighting:plan.lighting,cameras:[],...(s.variants?{variants:s.variants}:{}),...(s.materialShortlist?{materialShortlist:s.materialShortlist}:{})};
  }
  next.brandApplication={...identity,name:b.name,status:b.status,mode,appliedAt:new Date().toISOString(),...(mode==='layout'?{entrance:options.entrance as Entrance,seating:options.seating,report}:{})};
  return validateScene(next);
}

export function assertBrandSnapshot(scene:SceneData,base:string,session:number,expected:number){if(session!==expected||JSON.stringify(scene)!==base)throw new Error('프로젝트가 변경되었습니다. 브랜드 적용을 다시 미리보기하세요.');}
