import {Group} from 'three';
import type {Object3D} from 'three';
import type {SceneNode,SceneLayer} from './scene-model';

/** Export-only parents keep the editor's world-space poses and model subtrees intact. */
export function groupExportNodes(root:Object3D,nodes:SceneNode[],layers:SceneLayer[]=[]){
 const groups=new Map<string,Group>();
 if(layers.length)root.userData.designLayers=layers.map(layer=>({...layer}));
 for(const child of [...root.children]){
  const node=nodes.find(n=>n.id===child.userData.nodeId),layer=layers.find(l=>l.id===node?.layerId);if(layer)Object.assign(child.userData,{designLayerId:layer.id,designLayerName:layer.name,designLayerColor:layer.color});if(!node?.group)continue;
  let parent=groups.get(node.group.id);
  if(!parent){parent=new Group();parent.name=node.group.name;parent.userData.furnitureGroupId=node.group.id;if(layer)Object.assign(parent.userData,{designLayerId:layer.id,designLayerName:layer.name,designLayerColor:layer.color});root.add(parent);groups.set(node.group.id,parent)}
  parent.add(child);
 }
 root.updateMatrixWorld(true);
}
