import {z} from 'zod';
import {finishSchema,kindNames,materialIds,nodeAppearance,selectionAppearance,surfaceNames,validateScene,type MaterialFinish,type MaterialId,type SceneData,type SceneNode,type Selection} from './scene-model';
import {finishKey} from './material-board';
import {selectionIds} from './selection';
import type {MaterialSlot} from './material-catalog';

/** A scene-local snapshot. It contains no reference to mutable source objects. */
export type MaterialSample={material:MaterialId;finish:MaterialFinish;sourceName:string;sourceId:string;sourceFace?:string};
const sampleSchema=z.object({material:z.enum(materialIds),finish:finishSchema,sourceName:z.string().min(1).max(80),sourceId:z.string().min(1).max(80),sourceFace:z.string().min(1).max(60).optional()});
type Appearance={material:MaterialId;finish:MaterialFinish;original?:boolean};

function selectedIds(selection:Selection){
    const ids=selectionIds(selection);
    if(!selection||!ids.length)throw new Error('소재를 복사하거나 붙일 면·요소를 선택하세요.');
    if(!ids.includes(selection.id))throw new Error('선택한 요소가 변경되었습니다. 다시 선택하세요.');
    if(ids.some(id=>Object.hasOwn(surfaceNames,id))&&ids.length!==1)throw new Error('벽·바닥은 하나씩 선택해 소재를 붙이세요.');
    return ids;
}
function roomFace(selection:NonNullable<Selection>){
    if(selection.face&&!/^surface:[0-5]$/.test(selection.face))throw new Error('벽·바닥의 면을 다시 선택하세요.');
}
function sourceNode(scene:SceneData,id:string){
    const node=scene.nodes.find(n=>n.id===id);
    if(!node)throw new Error('선택한 요소를 찾을 수 없습니다. 다시 선택하세요.');
    if(node.hidden)throw new Error(`${node.name||kindNames[node.kind]}: 숨김을 해제한 뒤 소재를 선택하세요.`);
    return node;
}
function slotsFor(node:SceneNode,catalog:MaterialSlot[]){
    // Keep duplicate entries conservative: every mesh sharing a region must have UVs.
    const slots=new Map<string,MaterialSlot>();
    for(const slot of catalog){if(slot.nodeId!==node.id)continue;const old=slots.get(slot.face);slots.set(slot.face,{...slot,hasUv:slot.hasUv&&(old?.hasUv??true)});}
    if(!slots.size)throw new Error(`${node.name||kindNames[node.kind]}: 3D 모델이 표시된 뒤 다시 시도하세요.`);
    return [...slots.values()];
}
function selectedSlot(node:SceneNode,face:string|undefined,catalog:MaterialSlot[]){
    if(!face)throw new Error('면 선택 모드에서 3D 면을 클릭하세요. 요소 전체에는 전체 붙이기를 사용하세요.');
    const slot=slotsFor(node,catalog).find(s=>s.face===face);
    if(!slot)throw new Error('선택한 면이 더 이상 존재하지 않습니다. 3D 화면에서 면을 다시 선택하세요.');
    return slot;
}
function copyable(appearance:Appearance,slots:MaterialSlot[]){
    if(appearance.original)throw new Error('가져온 모델의 원본 소재는 직접 복사할 수 없습니다. 기본 소재나 업로드 이미지를 적용한 뒤 복사하세요.');
    if(appearance.finish.textureId&&slots.some(s=>!s.hasUv))throw new Error('이미지 좌표(UV)가 없는 면의 이미지 소재는 복사할 수 없습니다. 기본 소재를 먼저 적용하세요.');
}
function sameAppearance(appearance:Appearance,sample:MaterialSample){return !appearance.original&&finishKey(appearance)===finishKey(sample);}

export function sampleMaterial(scene:SceneData,selection:Selection,catalog:MaterialSlot[]):MaterialSample{
    const ids=selectedIds(selection);
    if(ids.length!==1)throw new Error('소재를 복사할 면이나 요소 하나를 선택하세요. 그룹은 그룹 안 편집으로 들어가 면을 선택하세요.');
    const id=ids[0];let appearance:Appearance,sourceName:string,sourceFace:string|undefined;
    if(Object.hasOwn(surfaceNames,id)){
        roomFace(selection!);appearance=selectionAppearance(scene,{id})!;sourceName=surfaceNames[id];
    }else{
        const node=sourceNode(scene,id);sourceName=node.name||kindNames[node.kind];
        if(selection!.face){const slot=selectedSlot(node,selection!.face,catalog);appearance=nodeAppearance(node,slot.face);copyable(appearance,[slot]);sourceFace=slot.face;}
        else{
            const slots=slotsFor(node,catalog),appearances=slots.map(slot=>nodeAppearance(node,slot.face));
            // Native model materials cannot be represented by the built-in material ID.
            for(let i=0;i<appearances.length;i++)copyable(appearances[i],[slots[i]]);
            if(new Set(appearances.map(finishKey)).size!==1)throw new Error('여러 소재가 섞인 요소입니다. 면 선택 모드에서 복사할 면을 클릭하세요.');
            appearance=appearances[0];
        }
    }
    return sampleSchema.parse({material:appearance.material,finish:structuredClone(appearance.finish),sourceName,sourceId:id,...(sourceFace?{sourceFace}:{})});
}

/** Applies the exact snapshot atomically; normalized group selection IDs remain intact. */
export function pasteMaterial(scene:SceneData,selection:Selection,sample:MaterialSample,scope:'face'|'object',catalog:MaterialSlot[]):SceneData{
    const choice=sampleSchema.parse(sample),ids=selectedIds(selection);
    if(scope!=='face'&&scope!=='object')throw new Error('소재를 붙일 범위를 확인하세요.');
    if(scope==='face'&&ids.length!==1)throw new Error('면 하나를 선택하거나 선택 요소 전체에 붙이세요.');
    if(Object.hasOwn(surfaceNames,ids[0])){
        roomFace(selection!);const appearance=selectionAppearance(scene,{id:ids[0]})!;
        if(sameAppearance(appearance,choice))return scene;
        const next=structuredClone(scene);
        next.room.surfaces[ids[0] as keyof SceneData['room']['surfaces']]={material:choice.material,finish:structuredClone(choice.finish)};
        return validateScene(next);
    }
    const targets=ids.map(id=>{
        const node=sourceNode(scene,id);
        if(node.locked)throw new Error(`${node.name||kindNames[node.kind]}: 잠금을 해제한 뒤 소재를 붙이세요.`);
        const slots=scope==='face'?[selectedSlot(node,selection!.face,catalog)]:slotsFor(node,catalog);
        if(choice.finish.textureId&&slots.some(s=>!s.hasUv))throw new Error(`${node.name||kindNames[node.kind]}: 이미지 좌표(UV)가 없는 면이 있습니다. 해당 요소를 제외하거나 기본 소재를 복사하세요.`);
        return {node,slots,changed:slots.some(slot=>!sameAppearance(nodeAppearance(node,slot.face),choice))};
    });
    if(!targets.some(target=>target.changed))return scene;
    const next=structuredClone(scene),byId=new Map(next.nodes.map(n=>[n.id,n]));
    for(const target of targets){
        if(!target.changed)continue;
        const node=byId.get(target.node.id)!;
        if(scope==='face'){
            const face=target.slots[0].face;
            node.faces[face]=choice.material;
            node.faceFinishes={...node.faceFinishes,[face]:structuredClone(choice.finish)};
        }else{
            node.material=choice.material;node.uniformMaterial=true;node.faces={};node.faceFinishes={};node.finish=structuredClone(choice.finish);delete node.color;
        }
    }
    return validateScene(next);
}
