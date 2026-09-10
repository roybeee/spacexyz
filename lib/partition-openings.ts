import {randomId} from '@/lib/random-id';
import {partitionOpeningSchema,validatePartitionOpenings,openingParts,openingKindNames,type PartitionOpening} from './partition-openings-schema';
import {validateScene,type SceneData,type SceneNode} from './scene-model';
export function partitionTarget(scene:SceneData,id:string){
 const node=scene.nodes.find(n=>n.id===id);if(!node||node.kind!=='partition')throw new Error('편집할 파티션을 선택하세요.');
 if(node.locked)throw new Error('파티션 잠금을 해제한 뒤 문·창문을 편집하세요.');
 if(node.hidden)throw new Error('파티션을 표시한 뒤 문·창문을 편집하세요.');return node;
}
export function newPartitionOpening(n:SceneNode,kind:PartitionOpening['kind'],id=randomId()):PartitionOpening{
 const window=kind==='window',bottom=window?Math.min(900,Math.max(100,n.height-700)):0;
 const o={id,name:openingKindNames[kind],kind,x:0,bottom,width:Math.min(window?1200:900,n.width-200),height:Math.min(window?1200:2100,n.height-bottom-100),...(kind==='door'?{door:{hinge:'left' as const,side:'positive' as const,angle:0}}:{})};
 const parsed=partitionOpeningSchema.parse(o),minimum=window?200:300,lo=-n.width/2+100,hi=n.width/2-100;
 const blocking=(n.openings??[]).filter(p=>Math.max(p.bottom,o.bottom)-Math.min(p.bottom+p.height,o.bottom+o.height)<100-1e-6).map(p=>[p.x-p.width/2-100,p.x+p.width/2+100]).sort((a,b)=>a[0]-b[0]);
 const gaps:number[][]=[];let cursor=lo;for(const [a,b] of blocking){if(a>cursor)gaps.push([cursor,Math.min(a,hi)]);cursor=Math.max(cursor,b);}if(cursor<hi)gaps.push([cursor,hi]);
 const candidates=gaps.map(([a,b])=>{const width=Math.min(o.width,b-a);return {...parsed,width,x:Math.max(a+width/2,Math.min(b-width/2,0))};}).filter(p=>p.width>=minimum).sort((a,b)=>b.width-a.width||Math.abs(a.x)-Math.abs(b.x));
 for(const placed of candidates){try{validatePartitionOpenings({...n,openings:[...(n.openings??[]),placed]});return placed;}catch{}}

 throw new Error('기본 크기를 넣을 여유가 없습니다. 기존 개구부 크기·위치를 조정하거나 더 긴 파티션을 선택하세요.');
}
export function planPartitionOpenings(scene:SceneData,id:string,input:PartitionOpening[]){
 const target=partitionTarget(scene,id),openings=partitionOpeningSchema.array().max(8).parse(input),next=structuredClone(scene),n=next.nodes.find(n=>n.id===id)!;
 if(openings.length)n.openings=openings;else delete n.openings;
 const oldParts=new Set((target.openings??[]).flatMap(openingParts)),newParts=new Set(openings.flatMap(openingParts));
 // Clear only roles removed by this edit, so other openings keep their painted faces and images.
 const removed=(key:string)=>oldParts.has(key.split(':')[0])&&!newParts.has(key.split(':')[0]);
 for(const key of Object.keys(n.faces))if(removed(key))delete n.faces[key];
 if(n.faceFinishes){let removedAny=false;for(const key of Object.keys(n.faceFinishes))if(removed(key)){delete n.faceFinishes[key];removedAny=true;}if(removedAny&&!Object.keys(n.faceFinishes).length)delete n.faceFinishes;}
 const valid=validateScene(next);
 return {scene:valid,baseScene:JSON.stringify(scene),nodeId:id,openings,unchanged:JSON.stringify(valid)===JSON.stringify(scene),summary:`${target.name} · 통로 ${openings.filter(o=>o.kind==='passage').length} / 문 ${openings.filter(o=>o.kind==='door').length} / 창 ${openings.filter(o=>o.kind==='window').length}개`};
}
export type PartitionOpeningPlan=ReturnType<typeof planPartitionOpenings>;
export function acceptPartitionOpenings(current:SceneData,plan:PartitionOpeningPlan,currentSession:number,plannedSession:number){
 if(currentSession!==plannedSession||JSON.stringify(current)!==plan.baseScene)throw new Error('미리보기 중 프로젝트나 배치가 바뀌었습니다. 파티션 개구부 편집을 다시 여세요.');
 partitionTarget(current,plan.nodeId);return validateScene(plan.scene);
}
