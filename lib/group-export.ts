import {Group} from 'three';
import type {Object3D} from 'three';
import type {SceneNode} from './scene-model';

/** Export-only parents keep the editor's world-space poses and model subtrees intact. */
export function groupExportNodes(root:Object3D,nodes:SceneNode[]){
 const groups=new Map<string,Group>();
 for(const child of [...root.children]){
  const node=nodes.find(n=>n.id===child.userData.nodeId);if(!node?.group)continue;
  let parent=groups.get(node.group.id);
  if(!parent){parent=new Group();parent.name=node.group.name;parent.userData.furnitureGroupId=node.group.id;root.add(parent);groups.set(node.group.id,parent)}
  parent.add(child);
 }
 root.updateMatrixWorld(true);
}
