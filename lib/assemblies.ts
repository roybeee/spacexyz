import {randomId} from '@/lib/random-id';
import {z} from 'zod';
import {nodeSchema,cloneUngroupedNode,initialScene,validateScene,createNode,collisions,type SceneData,type SceneNode} from './scene-model';
import {groupBounds,selectedNodes} from './selection';

export const assemblyCategories={seating:'좌석',counter:'카운터',display:'진열',equipment:'설비',custom:'기타'} as const;
export const assemblySchema=z.object({version:z.literal(1),name:z.string().trim().min(1).max(80),note:z.string().max(400),category:z.enum(['seating','counter','display','equipment','custom']),elevation:z.number().finite().min(0).max(6000),nodes:z.array(nodeSchema).min(1).max(30)});
export type Assembly=z.infer<typeof assemblySchema>;
export type AssemblySummary={id:string;name:string;note:string;category:Assembly['category'];count:number;width:number;depth:number;height:number;created_at:string};
export type AssemblyPlacement={x:number;y:number;z:number;rotation:number};
const yaw=(v:number)=>((v+180)%360+360)%360-180;

export function detachedAssemblyNode(node:SceneNode){const copy=cloneUngroupedNode(node);delete copy.layerId;delete copy.estimate;return copy;}
export function validateAssembly(input:unknown):Assembly {
    const a=assemblySchema.parse(input);a.nodes=a.nodes.map(detachedAssemblyNode);
    if(a.nodes.some(n=>n.host||n.kind==='door'||n.kind==='window'))throw new Error('문·창문은 벽에 연결되어 있어 가구 세트에 포함할 수 없습니다.');
    if(a.nodes.some(n=>n.hidden||n.locked))throw new Error('세트에는 표시된 편집 가능 요소만 보관할 수 있습니다.');
    const bounds=groupBounds(a.nodes);
    if(Math.abs(bounds.center.x)>.01||Math.abs(bounds.center.z)>.01||Math.abs(bounds.min.y)>.01)throw new Error('세트의 기준 위치를 확인하세요. 선택한 가구로 다시 저장해 주세요.');
    const base=initialScene();validateScene({...base,room:{...base.room,width:20000,depth:20000,height:6000},nodes:a.nodes.map(n=>({...n,y:n.y+a.elevation}))});
    if(new TextEncoder().encode(JSON.stringify(a)).length>200000)throw new Error('세트 데이터가 너무 큽니다. 선택 요소나 면별 소재 설정을 줄여 주세요.');
    return a;
}

export function captureAssembly(scene:SceneData,ids:string[],name:string,note='',category:Assembly['category']='custom'):Assembly {
    if(!ids.length||ids.length>30||new Set(ids).size!==ids.length)throw new Error('서로 다른 가구 1~30개를 선택하세요.');
    const selected=selectedNodes(scene,ids,'state');
    if(selected.some(n=>n.hidden))throw new Error('숨긴 가구를 표시하거나 선택에서 제외하세요.');
    if(selected.some(n=>n.host||n.kind==='door'||n.kind==='window'))throw new Error('문·창문을 선택에서 제외한 뒤 저장하세요.');
    const bounds=groupBounds(selected);
    return validateAssembly({version:1,name,note,category,elevation:bounds.min.y,nodes:selected.map((n,i)=>({...detachedAssemblyNode(n),id:`part-${i+1}`,x:n.x-bounds.center.x,y:n.y-bounds.min.y,z:n.z-bounds.center.z,rotation:yaw(n.rotation),locked:false,hidden:false}))});
}

export function assemblySummary(id:string,a:Assembly,created_at=''):AssemblySummary {
    const b=groupBounds(a.nodes);return {id,name:a.name,note:a.note,category:a.category,count:a.nodes.length,width:b.width,depth:b.depth,height:b.height,created_at};
}

export function placedAssembly(a:Assembly,p:AssemblyPlacement,idFactory=()=>randomId()):SceneNode[] {
    if(!Object.values(p).every(Number.isFinite)||p.y<0||Math.abs(p.rotation)>360)throw new Error('위치·높이·회전 값을 확인하세요.');
    const angle=yaw(p.rotation)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    return a.nodes.map(n=>({...detachedAssemblyNode(n),id:idFactory(),x:p.x+n.x*c+n.z*s,y:p.y+n.y,z:p.z-n.x*s+n.z*c,rotation:yaw(n.rotation+p.rotation),locked:false,hidden:false}));
}

export function insertAssembly(scene:SceneData,input:unknown,p:AssemblyPlacement,idFactory=()=>randomId()) {
    const a=validateAssembly(input),added=placedAssembly(a,p,idFactory);
    if(added.length>1){const group={id:randomId(),name:a.name};for(const n of added)n.group=group;}
    const next=validateScene({...scene,nodes:[...scene.nodes,...added]}),ids=added.map(n=>n.id),set=new Set(ids);
    const overlaps=collisions(next).filter(c=>set.has(c.a)||set.has(c.b));
    return {scene:next,ids,overlaps};
}

/** Wall presets translate the intact set, never resize individual pieces to make it fit. */
export function assemblyAnchor(scene:SceneData,a:Assembly,rotation:number,edge:'center'|'back'|'left'|'right'|'front'):Pick<AssemblyPlacement,'x'|'z'> {
    const b=groupBounds(placedAssembly(a,{x:0,y:0,z:0,rotation},()=>'')),gap=100;
    if(b.width>scene.room.width+1e-6||b.depth>scene.room.depth+1e-6)throw new Error('이 방향으로는 세트가 공간에 들어가지 않습니다. 회전하거나 더 작은 세트를 선택하세요.');
    return {x:edge==='left'?-scene.room.width/2-b.min.x+Math.min(gap,Math.max(0,(scene.room.width-b.width)/2)):edge==='right'?scene.room.width/2-b.max.x-Math.min(gap,Math.max(0,(scene.room.width-b.width)/2)):-b.center.x,
        z:edge==='back'?-scene.room.depth/2-b.min.z+Math.min(gap,Math.max(0,(scene.room.depth-b.depth)/2)):edge==='front'?scene.room.depth/2-b.max.z-Math.min(gap,Math.max(0,(scene.room.depth-b.depth)/2)):-b.center.z};
}

export function builtinAssemblies():Array<Assembly&{id:string}> {
    const scene=initialScene();
    const make=(id:string,name:string,note:string,category:Assembly['category'],nodes:SceneNode[])=>({id,...captureAssembly({...scene,nodes},nodes.map(n=>n.id),name,note,category)});
    return [
        make('builtin-pair','2인 테이블 세트','테이블 1개와 마주 보는 의자 2개','seating',[createNode('table','table'),{...createNode('chair','chair-a',0,-650),rotation:180},createNode('chair','chair-b',0,650)]),
        make('builtin-bench','붙박이 좌석 · 테이블 3개','3.6m 벤치와 나란히 배치한 테이블','seating',[{...createNode('bench','bench',0,450),width:3600,depth:550},...[-1150,0,1150].map((x,i)=>({...createNode('table',`table-${i}`,x,-400),width:700,depth:700}))]),
        make('builtin-counter','카운터 · 뒤쪽 진열장','스틸 카운터와 우드 선반의 기본 구성','counter',[createNode('counter','counter',0,300),{...createNode('shelf','shelf',0,-1100),width:1800,depth:350}])
    ];
}
