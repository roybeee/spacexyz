import {finishTextureKey,finishLabel} from './material-products';
import {finishSchema,materialIds,materials,nodeAppearance,selectionAppearance,surfaceNames,validateScene,type MaterialFinish,type MaterialId,type SceneData} from './scene-model';
import type {MaterialSlot} from './material-catalog';
export type FinishChoice={material:MaterialId;finish:MaterialFinish};
export type MaterialUse={key:string;id:string;face?:string;name:string;layerId?:string;hidden:boolean;locked:boolean;hasUv:boolean};
export type MaterialRow=FinishChoice&{key:string;name:string;color:string;original:boolean;uses:MaterialUse[]};
export type MaterialScope={kind:'all'|'room'|'nodes'|'selection'|'layer';ids?:string[];layerId?:string|null;includeHidden:boolean};
export type MaterialPlan={baseScene:string;scene:SceneData;changedRegions:number;changedElements:number;reviewPrices:number};
export function finishKey(choice:FinishChoice){
    const b=materials.find(m=>m.id===choice.material)!;const f=choice.finish;
    // Image pixels replace tint. Explicit defaults and absent defaults render identically.
    return JSON.stringify([choice.material,finishTextureKey(f),finishTextureKey(f)?null:(f.color??b.color).toLowerCase(),f.roughness??b.roughness,f.metalness??b.metalness,f.scale??900,f.rotation??0]);
}
export function materialRows(scene:SceneData,catalog:MaterialSlot[]):MaterialRow[]{
    const rows=new Map<string,MaterialRow>(),nodes=new Map(scene.nodes.map(n=>[n.id,n])),seen=new Set<string>();
    const add=(key:string,choice:FinishChoice,use:MaterialUse,original=false,name?:string,color?:string)=>{
        if(seen.has(use.key))return;seen.add(use.key);
        let row=rows.get(key);if(!row){const base=materials.find(m=>m.id===choice.material)!;row={...choice,key,name:name??finishLabel(choice.finish,base.name),color:color??choice.finish.color??base.color,original,uses:[]};rows.set(key,row);}row.uses.push(use);
    };
    for(const id of Object.keys(surfaceNames)){const a=selectionAppearance(scene,{id})!;add(finishKey(a),a,{key:JSON.stringify(['room',id]),id,name:surfaceNames[id],hidden:false,locked:false,hasUv:true});}
    for(const slot of catalog){const n=nodes.get(slot.nodeId);if(!n)continue;const a=nodeAppearance(n,slot.face);
        const key=a.original?JSON.stringify(['original',n.assetId,slot.face,a.finish.color?.toLowerCase()??null,a.finish.roughness??null,a.finish.metalness??null]):finishKey(a);
        add(key,a,{key:JSON.stringify(['node',n.id,slot.face]),id:n.id,face:slot.face,name:n.name,layerId:n.layerId,hidden:n.hidden,locked:n.locked,hasUv:slot.hasUv},a.original,a.original?slot.nativeName:undefined,a.original?slot.nativeColor:undefined);
    }
    return [...rows.values()];
}
export function scopedMaterialUses(row:MaterialRow,scope:MaterialScope){return row.uses.filter(u=>(scope.includeHidden||!u.hidden)&&(scope.kind==='all'||scope.kind==='room'&&!u.face||scope.kind==='nodes'&&!!u.face||scope.kind==='selection'&&scope.ids?.includes(u.id)||scope.kind==='layer'&&!!u.face&&(u.layerId??null)===(scope.layerId??null)));}
export function planMaterialReplacement(scene:SceneData,catalog:MaterialSlot[],sourceKey:string,useKeys:string[],replacement:FinishChoice):MaterialPlan{
    if(!materialIds.includes(replacement.material))throw new Error('교체할 소재를 선택하세요.');
    const choice={material:replacement.material,finish:finishSchema.parse(replacement.finish)};
    const row=materialRows(scene,catalog).find(r=>r.key===sourceKey);if(!row)throw new Error('원래 소재를 찾을 수 없습니다. 소재 관리를 다시 여세요.');
    const keys=new Set(useKeys);if(!keys.size)throw new Error('교체할 요소를 선택하세요.');
    const uses=row.uses.filter(u=>keys.has(u.key));if(uses.length!==keys.size)throw new Error('소재 적용 대상이 변경되었습니다. 다시 선택하세요.');
    if(uses.some(u=>u.locked))throw new Error('잠긴 요소가 포함되어 있습니다. 잠금을 해제하거나 대상에서 제외하세요.');
    if(finishTextureKey(choice.finish)&&uses.some(u=>!u.hasUv))throw new Error('선택한 모델에 이미지 좌표(UV)가 없는 부위가 있습니다. 해당 요소를 제외하거나 기본 소재를 선택하세요.');
    const baseScene=JSON.stringify(scene);
    if(!row.original&&finishKey(row)===finishKey(choice))return {baseScene,scene,changedRegions:0,changedElements:0,reviewPrices:0};
    const next=structuredClone(scene),nodes=new Map(next.nodes.map(n=>[n.id,n])),changed=new Set<string>();
    for(const u of uses){changed.add(u.id);if(u.face){const n=nodes.get(u.id)!;n.faces[u.face]=choice.material;n.faceFinishes={...n.faceFinishes,[u.face]:structuredClone(choice.finish)};}else{next.room.surfaces[u.id as keyof SceneData['room']['surfaces']]={material:choice.material,finish:structuredClone(choice.finish)};}}
    return {baseScene,scene:validateScene(next),changedRegions:uses.length,changedElements:changed.size,reviewPrices:next.nodes.filter(n=>changed.has(n.id)&&n.estimate?.unitPrice!==undefined).length};
}
export function acceptMaterialPlan(scene:SceneData,plan:MaterialPlan,currentSession:number,planSession:number){
    if(currentSession!==planSession||JSON.stringify(scene)!==plan.baseScene)throw new Error('공간이 변경되었습니다. 소재 교체를 다시 미리보기하세요.');
    return validateScene(plan.scene);
}
