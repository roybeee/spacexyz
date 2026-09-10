import {z} from 'zod';

export const partitionOpeningSchema=z.object({
 id:z.string().uuid(),name:z.string().trim().min(1).max(60),kind:z.enum(['passage','door','window']),
 x:z.number().finite().min(-10000).max(10000),bottom:z.number().finite().min(0).max(12000),
 width:z.number().finite().min(200).max(19800),height:z.number().finite().min(200).max(11900)
});
export type PartitionOpening=z.infer<typeof partitionOpeningSchema>;
export type PartitionShape={kind:string;width:number;height:number;depth:number;openings?:PartitionOpening[]};
export const openingKindNames={passage:'빈 통로',door:'닫힌 문',window:'유리창'} as const;
export function validatePartitionOpenings(n:PartitionShape){
 if(n.openings===undefined)return;
 if(n.kind!=='partition')throw new Error('파티션에만 실내 문·창문을 만들 수 있습니다.');
 if(n.openings.length>8)throw new Error('파티션 한 구간에는 개구부 8개까지 만들 수 있습니다.');
 const ids=new Set<string>();
 for(const o of n.openings){
  if(ids.has(o.id))throw new Error('파티션 안의 개구부 ID가 중복되었습니다.');ids.add(o.id);
  if(o.kind!=='window'&&(o.bottom!==0||o.width<300||o.height<800))throw new Error('통로·문은 파티션 바닥에서 시작하며 폭 300mm, 높이 800mm 이상이어야 합니다.');
  if(o.kind==='window'&&o.bottom<100)throw new Error('창문 아래에 벽 100mm 이상을 남겨 주세요.');
  if(Math.abs(o.x)+o.width/2>n.width/2-100+1e-6||o.bottom+o.height>n.height-100+1e-6)throw new Error('개구부 양끝과 위쪽에 벽 100mm 이상을 남겨 주세요.');
 }
 for(let i=0;i<n.openings.length;i++)for(let j=i+1;j<n.openings.length;j++){
  const a=n.openings[i],b=n.openings[j],horizontal=Math.abs(a.x-b.x)-(a.width+b.width)/2;
  const vertical=Math.max(a.bottom,b.bottom)-Math.min(a.bottom+a.height,b.bottom+b.height);
  if(horizontal<100-1e-6&&vertical<100-1e-6)throw new Error('개구부 사이에 벽 100mm 이상의 간격이 필요합니다.');
 }
}
export type PartitionCell={x:number;y:number;width:number;height:number;i:number;j:number};
/** Exact local millimetre cells. Shared by rendering and conservative walk collision. */
export function partitionCells(n:PartitionShape):PartitionCell[]{
 const xs=new Set([-n.width/2,n.width/2]),ys=new Set([0,n.height]);
 for(const o of n.openings??[]){xs.add(o.x-o.width/2);xs.add(o.x+o.width/2);ys.add(o.bottom);ys.add(o.bottom+o.height);}
 const xa=[...xs].sort((a,b)=>a-b),ya=[...ys].sort((a,b)=>a-b),out:PartitionCell[]=[];
 for(let i=0;i<xa.length-1;i++)for(let j=0;j<ya.length-1;j++){
  const x=(xa[i]+xa[i+1])/2,y=(ya[j]+ya[j+1])/2;
  if(!(n.openings??[]).some(o=>x>o.x-o.width/2&&x<o.x+o.width/2&&y>o.bottom&&y<o.bottom+o.height))out.push({x,y,width:xa[i+1]-xa[i],height:ya[j+1]-ya[j],i,j});
 }
 return out;
}
export function openingParts(o:PartitionOpening){return o.kind==='passage'?[]:['frameL','frameR','frameTop','panel',...(o.kind==='window'?['frameBottom']:['handle'])].map(role=>`op-${o.id}-${role}`);}
