import * as T from 'three';
import type {SceneNode} from './scene-model';
export type MaterialSlot={nodeId:string;face:string;hasUv:boolean;nativeName:string;nativeColor:string};
/** Material regions actually used by geometry. Hidden furniture remains in the catalog. */
export function renderedMaterialSlots(root:T.Object3D,nodes:SceneNode[]):MaterialSlot[]{
    const ids=new Set(nodes.map(n=>n.id)),slots=new Map<string,MaterialSlot>();
    root.traverse(o=>{
        if(!(o instanceof T.Mesh)||!ids.has(o.userData.nodeId)||typeof o.userData.part!=='string'||o.userData.unmeasurable)return;
        const list=Array.isArray(o.material)?o.material:[o.material];
        const used=Array.isArray(o.material)?new Set((o.geometry as T.BufferGeometry).groups.filter(g=>g.count>0).map(g=>g.materialIndex??0)):new Set([0]);
        for(const index of used){const mat=list[index];if(!mat)continue;
            const face=`${o.userData.part}:${index}`,key=JSON.stringify([o.userData.nodeId,face]);
            const hasUv=!!o.geometry.getAttribute('uv');
            slots.set(key,{nodeId:o.userData.nodeId,face,hasUv:hasUv&&(slots.get(key)?.hasUv??true),nativeName:mat.name?.slice(0,80)||'모델 원본 소재',nativeColor:'color' in mat&&mat.color instanceof T.Color?`#${mat.color.getHexString()}`:'#a5a3ad'});
        }
    });
    return [...slots.values()];
}
