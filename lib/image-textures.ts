import * as T from 'three';
import {inspectImage,IMAGE_LIMIT} from './image-assets';

/** Only same-origin, owner-authorized assets are decoded. Never load a supplied URL. */
export async function loadImageTexture(id:string,signal:AbortSignal):Promise<T.Texture> {
    const response=await fetch(`/api/assets?id=${encodeURIComponent(id)}`,{signal});
    if(!response.ok)throw new Error('소재·로고 이미지를 불러오지 못했습니다. 같은 계정의 이미지인지 확인하세요.');
    if(Number(response.headers.get('Content-Length'))>IMAGE_LIMIT)throw new Error('이미지 크기가 허용 범위를 넘었습니다.');
    const bytes=new Uint8Array(await response.arrayBuffer()),info=inspectImage(bytes);
    const url=URL.createObjectURL(new Blob([bytes],{type:info.mime}));
    try {
        const img=new Image();img.src=url;await img.decode();
        if(signal.aborted)throw new Error('이미지 불러오기가 취소되었습니다.');
        const texture=new T.Texture(img);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true;return texture;
    }finally{URL.revokeObjectURL(url);}
}

/** Repeat width is in metres; height follows the source aspect ratio. */
export function materialImage(source:T.Texture,size:[number,number],scaleMm=900,rotation=0,flipY=true):T.Texture {
    const map=source.clone(),image=source.image as {width:number;height:number};
    const width=scaleMm/1000,height=width*image.height/image.width;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(size[0]/width,size[1]/height);
    map.center.set(.5,.5);map.rotation=rotation*Math.PI/180;map.flipY=flipY;
    // Rotate in physical metres, then convert to image tiles. Normalized UV rotation stretches rectangular faces.
    const c=Math.cos(map.rotation),s=Math.sin(map.rotation),ux=c*size[0]/width,uy=s*size[1]/width,vx=-s*size[0]/height,vy=c*size[1]/height;
    map.matrixAutoUpdate=false;map.matrix.set(ux,uy,.5-(ux+uy)/2,vx,vy,.5-(vx+vy)/2,0,0,1);
    map.userData.physicalImage=true;map.needsUpdate=true;return map;
}

export function fitLogo(width:number,height:number,imageWidth:number,imageHeight:number):[number,number] {
    const scale=Math.min(width/imageWidth,height/imageHeight);return [imageWidth*scale,imageHeight*scale];
}

/** Segments around doors/windows share one wall coordinate system. */
export function wallImageUV(geometry:T.BufferGeometry,cx:number,cy:number,width:number,height:number) {
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
        const u=Math.abs(normal.getX(i))>.5?cx+z:x+cx;
        const v=Math.abs(normal.getY(i))>.5?cy+z:y+cy;
        uv.setXY(i,(u+width/2)/width,v/height);
    }
    uv.needsUpdate=true;
}

/** Mutates only an independent export clone: glTF texture transforms cannot represent physical UV shear/centre. */
export function bakeImageTransforms(root:T.Object3D) {
    root.traverse(o=>{
        if(!(o instanceof T.Mesh))return;
        const list:T.Material[]=Array.isArray(o.material)?o.material:[o.material];
        const maps=list.map(m=>m instanceof T.MeshStandardMaterial&&m.map?.userData.physicalImage?m.map:null);
        if(!maps.some(Boolean))return;
        if(!o.geometry.getAttribute('uv'))throw new Error('이미지를 적용할 모델의 UV 좌표가 없습니다.');
        if(o.geometry.index){const old=o.geometry;o.geometry=old.toNonIndexed();old.dispose();}
        const uv=o.geometry.getAttribute('uv'),groups=Array.isArray(o.material)?o.geometry.groups:[{start:0,count:uv.count,materialIndex:0}],v=new T.Vector2();
        for(const group of groups){const map=maps[group.materialIndex??0];if(!map)continue;
            for(let i=group.start;i<Math.min(uv.count,group.start+group.count);i++){v.fromBufferAttribute(uv,i).applyMatrix3(map.matrix);uv.setXY(i,v.x,v.y);}
        }
        uv.needsUpdate=true;
        for(const map of maps)if(map){map.offset.set(0,0);map.repeat.set(1,1);map.center.set(0,0);map.rotation=0;map.matrix.identity();map.matrixAutoUpdate=true;delete map.userData.physicalImage;}
    });
}
