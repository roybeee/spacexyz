import * as T from 'three';
import {partitionCells,type PartitionShape} from './partition-openings-schema';

/** Exposed faces only: no interior tessellation faces, six stable BoxGeometry material regions. */
export function partitionWallGeometry(n:PartitionShape){
 const cells=partitionCells(n),filled=new Set(cells.map(c=>`${c.i}:${c.j}`)),depth=n.depth/2000,w=n.width/1000,h=n.height/1000,d=n.depth/1000;
 const normals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],faces=normals.map(()=>[] as number[][][]);
 for(const c of cells){
  const x0=(c.x-c.width/2)/1000,x1=(c.x+c.width/2)/1000,y0=(c.y-c.height/2)/1000,y1=(c.y+c.height/2)/1000,z0=-depth,z1=depth;
  if(!filled.has(`${c.i+1}:${c.j}`))faces[0].push([[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]]);
  if(!filled.has(`${c.i-1}:${c.j}`))faces[1].push([[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]);
  if(!filled.has(`${c.i}:${c.j+1}`))faces[2].push([[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]]);
  if(!filled.has(`${c.i}:${c.j-1}`))faces[3].push([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]]);
  faces[4].push([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]);
  faces[5].push([[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]]);
 }
 const positions:number[]=[],normal:number[]=[],uv:number[]=[],indices:number[]=[],geometry=new T.BufferGeometry();
 faces.forEach((quads,face)=>{
  const start=indices.length;
  for(const quad of quads){const offset=positions.length/3;for(const [x,y,z] of quad){positions.push(x,y,z);normal.push(...normals[face]);uv.push(...(face===0?[.5-z/d,y/h]:face===1?[.5+z/d,y/h]:face===2?[x/w+.5,.5-z/d]:face===3?[x/w+.5,z/d+.5]:face===4?[x/w+.5,y/h]:[.5-x/w,y/h]));}indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);}
  if(indices.length>start)geometry.addGroup(start,indices.length-start,face);
 });
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
