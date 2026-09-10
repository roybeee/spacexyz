import * as T from 'three';
import {cloneModel} from './model-loader';
import {clearExportClipping} from './section-clipper';
import {groupExportNodes} from './group-export';
import {partitionOpeningSchema} from './partition-openings-schema';
import type {SceneData,SceneNode} from './scene-model';

// Compute current transforms without altering source matrix caches or visibility.
function currentWorldMatrix(object:T.Object3D){
    const chain:T.Object3D[]=[];for(let o:T.Object3D|null=object;o;o=o.parent)chain.unshift(o);
    const world=new T.Matrix4(),local=new T.Matrix4();
    for(const o of chain){if(o.matrixAutoUpdate)local.compose(o.position,o.quaternion,o.scale);else local.copy(o.matrix);world.multiply(local);}
    return world;
}
/** Export clones own GPU resources, but their decoded image pixels remain shared. */
function disposeClone(root:T.Object3D){
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    root.traverse(o=>{if(!(o instanceof T.Mesh))return;geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);}});
    textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());root.clear();
}
function scrubExportMetadata(root:T.Object3D,node:SceneNode){
    root.traverse(o=>{
        const source=o.userData,data:Record<string,unknown>={};
        if(source.nodeId===node.id)data.nodeId=node.id;
        if(typeof source.part==='string')data.part=source.part;
        if(source.doorParentId===node.id&&node.openings?.some(opening=>opening.id===source.doorOpeningId)){
            data.doorParentId=node.id;data.doorOpeningId=source.doorOpeningId;
        }
        o.userData=data;
        if(o instanceof T.Mesh){
            o.geometry.userData={};
            for(const material of Array.isArray(o.material)?o.material:[o.material]){
                material.userData={};
                for(const value of Object.values(material))if(value instanceof T.Texture)value.userData=value.userData.physicalImage?{physicalImage:true}:{};
            }
        }
    });
    root.userData.nodeId=node.id;
    if(node.host)root.userData.host=node.host;
    if(node.openings?.length)root.userData.partitionOpenings=partitionOpeningSchema.array().parse(node.openings);
}
function visibleBounds(root:T.Object3D){
    const bounds=new T.Box3();let meshes=0;
    root.traverseVisible(o=>{
        if(!(o instanceof T.Mesh))return;
        if(o.userData.unmeasurable)throw new Error('3D 모델을 다 불러온 뒤 선택 요소를 내보내세요.');
        if(!o.geometry.getAttribute('position')?.count)return;
        o.geometry.computeBoundingBox();if(!o.geometry.boundingBox||o.geometry.boundingBox.isEmpty())return;
        bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));meshes++;
    });
    if(!meshes||bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new Error('내보낼 3D 형상을 찾을 수 없습니다. 모델이 표시된 뒤 다시 시도하세요.');
    return bounds;
}

/**
 * Builds a static, independent selection clone. Caller must dispose its geometry,
 * materials and texture objects after export, without closing shared ImageBitmaps.
 * Exported position + originOffset (metres) restores the original world position.
 */
export function prepareSelectionExport(root:T.Object3D,scene:SceneData,ids:string[],origin:'world'|'center'='center'):T.Group{
    if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!id))throw new Error('내보낼 가구·파티션·문·창문을 선택하세요.');
    if(origin!=='world'&&origin!=='center')throw new Error('내보내기 원점은 중심 또는 원래 위치로 선택하세요.');
    const selected=[...new Set(ids)],idSet=new Set(selected),nodes=selected.map(id=>{
        const node=scene.nodes.find(n=>n.id===id);
        if(!node)throw new Error('선택한 요소를 찾을 수 없습니다. 벽·바닥 대신 가구·파티션·문·창문을 선택하세요.');
        if(node.hidden)throw new Error(`${node.name}: 숨김을 해제한 뒤 내보내세요.`);
        return node;
    });
    const sources=nodes.map(node=>{
        const matches=root.children.filter(child=>child.userData.nodeId===node.id);
        if(matches.length!==1)throw new Error(`${node.name}: 3D 화면이 갱신 중입니다. 다시 시도하세요.`);
        let pending=false;matches[0].traverse(o=>{if(o.userData.unmeasurable)pending=true;});
        if(pending)throw new Error(`${node.name}: 3D 모델을 다 불러온 뒤 내보내세요.`);
        return matches[0];
    });
    const output=new T.Group();output.name='선택 요소';
    try{
        for(let i=0;i<nodes.length;i++){
            const source=sources[i],copy=cloneModel(source as T.Group);
            output.add(copy);copy.visible=true;
            copy.matrix.copy(currentWorldMatrix(source));copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);copy.matrixAutoUpdate=false;
            scrubExportMetadata(copy,nodes[i]);
            // Each selected item must have exportable geometry; never silently omit it.
            output.updateMatrixWorld(true);visibleBounds(copy);
        }
        clearExportClipping(output);
        const completeGroups=new Set(nodes.filter(n=>n.group&&scene.nodes.filter(other=>other.group?.id===n.group!.id).every(other=>idSet.has(other.id))).map(n=>n.group!.id));
        const exportNodes=nodes.map(node=>{const copy={...node};if(copy.group&&!completeGroups.has(copy.group.id))delete copy.group;return copy;});
        const usedLayers=new Set(nodes.map(n=>n.layerId).filter(Boolean));
        groupExportNodes(output,exportNodes,(scene.layers??[]).filter(layer=>usedLayers.has(layer.id)));
        const bounds=visibleBounds(output),offset=origin==='center'?new T.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2):new T.Vector3();
        output.position.copy(offset).negate();
        output.userData={...output.userData,exportOrigin:origin,sourceSceneName:scene.name,originOffset:{x:offset.x,y:offset.y,z:offset.z,unit:'metre'}};
        output.updateMatrixWorld(true);return output;
    }catch(error){disposeClone(output);throw error;}
}
