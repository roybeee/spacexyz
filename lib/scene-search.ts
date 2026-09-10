import {kindNames,type SceneData,type SceneNode} from './scene-model';
import {sceneGroups} from './selection';
import {layerName} from './layers';

export type SceneSearchMode='elements'|'groups';
export type SceneSearchFilter='all'|'visible'|'hidden'|'locked';
export type SceneSearchRow={key:string;mode:SceneSearchMode;name:string;ids:string[];kinds:string[];layers:string[];groupName?:string;hidden:number;locked:number;disabled:boolean};
export const sceneSearchFilters={all:'전체',visible:'표시 중',hidden:'숨김',locked:'잠김'} as const;
export function normalizeSceneQuery(text:string){return text.normalize('NFKC').toLowerCase().replace(/\s+/gu,'');}
/** Words may match different fields; spacing inside Korean names is ignored as well. */
export function matchesSceneQuery(fields:string[],query:string){
 const tokens=query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(Boolean),normalized=fields.map(normalizeSceneQuery);
 return tokens.every(token=>normalized.some(field=>field.includes(normalizeSceneQuery(token))));
}
export function searchScene(scene:SceneData,{query='',mode='elements',filter='all',limit=300}:{query?:string;mode?:SceneSearchMode;filter?:SceneSearchFilter;limit?:number}={}){
 const make=(nodes:SceneNode[],mode:SceneSearchMode,name:string,key:string):SceneSearchRow=>{
  const hidden=nodes.filter(n=>n.hidden).length,locked=nodes.filter(n=>n.locked).length;
  return {key,mode,name,ids:nodes.map(n=>n.id),kinds:[...new Set(nodes.map(n=>kindNames[n.kind]))],layers:[...new Set(nodes.map(n=>layerName(scene,n)))],...(mode==='elements'&&nodes[0].group?{groupName:nodes[0].group.name}:{}),hidden,locked,disabled:hidden>0};
 };
 const candidates=mode==='groups'?sceneGroups(scene).map(g=>({row:make(g.nodes,'groups',g.name,`group:${g.id}`),nodes:g.nodes})):scene.nodes.map(n=>({row:make([n],'elements',n.name||'이름 없는 요소',`node:${n.id}`),nodes:[n]}));
 const compact=normalizeSceneQuery(query),matches=candidates.filter(({row,nodes})=>{
  if(filter==='visible'&&row.hidden>0||filter==='hidden'&&row.hidden===0||filter==='locked'&&row.locked===0)return false;
  return matchesSceneQuery([row.name,row.groupName??'',...row.kinds,...row.layers,...nodes.flatMap(n=>[n.name,n.kind])],query);
 }).map((entry,index)=>({row:entry.row,index,rank:!compact?0:normalizeSceneQuery(entry.row.name)===compact?0:normalizeSceneQuery(entry.row.name).startsWith(compact)?1:normalizeSceneQuery(entry.row.name).includes(compact)?2:3})).sort((a,b)=>a.rank-b.rank||a.index-b.index);
 const maximum=Number.isFinite(limit)?Math.max(1,Math.min(300,Math.floor(limit))):300,rows=matches.slice(0,maximum).map(entry=>entry.row);
 return {rows,total:matches.length,truncated:matches.length>rows.length};
}
