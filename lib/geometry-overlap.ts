export type OrientedBox={x:number;y:number;z:number;width:number;height:number;depth:number;rotation:number};

/** Oriented boxes with the editor's existing 2 mm overlap tolerance. */
export function boxesOverlap(a:OrientedBox,b:OrientedBox){
 if(a.y+a.height/2<=b.y-b.height/2+2||b.y+b.height/2<=a.y-a.height/2+2)return false;
 const ra=a.rotation*Math.PI/180,rb=b.rotation*Math.PI/180;
 const ax=[Math.cos(ra),-Math.sin(ra)],az=[Math.sin(ra),Math.cos(ra)],bx=[Math.cos(rb),-Math.sin(rb)],bz=[Math.sin(rb),Math.cos(rb)];
 const dot=(u:number[],v:number[])=>u[0]*v[0]+u[1]*v[1],diff=[b.x-a.x,b.z-a.z];
 return ![ax,az,bx,bz].some(v=>Math.abs(dot(diff,v))>=Math.abs(dot(ax,v))*a.width/2+Math.abs(dot(az,v))*a.depth/2+Math.abs(dot(bx,v))*b.width/2+Math.abs(dot(bz,v))*b.depth/2-2);
}

export function boxBounds(boxes:OrientedBox[]){
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const b of boxes){const r=b.rotation*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),dx=(c*b.width+s*b.depth)/2,dz=(s*b.width+c*b.depth)/2;
  min.x=Math.min(min.x,b.x-dx);max.x=Math.max(max.x,b.x+dx);min.y=Math.min(min.y,b.y-b.height/2);max.y=Math.max(max.y,b.y+b.height/2);min.z=Math.min(min.z,b.z-dz);max.z=Math.max(max.z,b.z+dz);
 }
 return{min,max};
}
