import * as T from 'three';
import {awningDimensions} from './facade';
import type {FacadeData,MaterialId,SceneData} from './scene-model';

type MaterialFactory=(id:MaterialId,color?:string,repeat?:[number,number])=>T.Material;
export type FacadeTextureFactory=(kind:'sign'|'awning',data:FacadeData)=>T.Texture|null;

export function facadeTexture(kind:'sign'|'awning',data:FacadeData):T.Texture|null {
    const canvas=document.createElement('canvas');
    if(kind==='sign'){
        const s=data.sign;canvas.width=2048;canvas.height=Math.max(64,Math.min(1024,Math.round(2048*s.height/s.width)));
        const ctx=canvas.getContext('2d');if(!ctx)return null;
        const family=s.font==='serif'?"Georgia, 'Noto Serif KR', serif":s.font==='condensed'?"'Arial Narrow', Impact, sans-serif":"Arial, 'Noto Sans KR', sans-serif";
        let size=canvas.height*.73;ctx.font=`700 ${size}px ${family}`;
        const width=ctx.measureText(s.text).width;if(width>canvas.width*.94)size*=canvas.width*.94/width;
        ctx.font=`700 ${size}px ${family}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=s.textColor;ctx.fillText(s.text,canvas.width/2,canvas.height*.52);
    }else{
        const a=data.awning;canvas.width=2048;canvas.height=64;const ctx=canvas.getContext('2d');if(!ctx)return null;
        ctx.fillStyle=a.color;ctx.fillRect(0,0,2048,64);
        if(a.striped){const stripe=a.stripeWidth/a.width*2048;ctx.fillStyle=a.stripeColor;for(let x=0;x<2048;x+=stripe*2)ctx.fillRect(x,0,stripe,64)}
    }
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function buildFacade(scene:Pick<SceneData,'room'|'facade'>,material:MaterialFactory,textureFactory:FacadeTextureFactory=facadeTexture):T.Group {
    const root=new T.Group();root.name='매장 외관';root.userData.facade=true;
    const f=scene.facade;if(!f)return root;const front=scene.room.depth/2000;
    const mesh=(parent:T.Group,name:string,geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,id:string)=>{
        const m=new T.Mesh(geometry,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData={nodeId:id,facade:true};parent.add(m);return m;
    };
    if(f.sign.enabled){
        const s=f.sign,w=s.width/1000,h=s.height/1000,d=s.depth/1000,g=new T.Group();g.name='간판';g.userData.facadePart='sign';root.add(g);
        mesh(g,'간판 본체',new T.BoxGeometry(w,h,d),material(s.material,s.color,[w,h]),s.x/1000,(s.bottom+s.height/2)/1000,front+.06+d/2,'facade-sign');
        const map=textureFactory('sign',f);
        if(map){const lettering=new T.MeshStandardMaterial({map,transparent:true,alphaTest:.05,roughness:.55,metalness:0,emissive:s.illuminated?'#ffffff':'#000000',emissiveMap:s.illuminated?map:null,emissiveIntensity:s.illuminated?.8:0});const label=mesh(g,'간판 문자',new T.PlaneGeometry(w*.9,h*.82),lettering,s.x/1000,(s.bottom+s.height/2)/1000,front+.063+d,'facade-sign');label.castShadow=false;}
    }
    if(f.awning.enabled){
        const a=f.awning,dim=awningDimensions(a),w=a.width/1000,p=a.projection/1000,drop=a.drop/1000,edge=front+.1+p,g=new T.Group();g.name='어닝';g.userData.facadePart='awning';root.add(g);
        const map=textureFactory('awning',f),cloth=()=>new T.MeshStandardMaterial({color:map?'#ffffff':a.color,map:map?.clone()??null,roughness:1,metalness:0,side:T.DoubleSide});
        const top=mesh(g,'어닝 경사 천',new T.BoxGeometry(w,.018,dim.fabricLength/1000),cloth(),a.x/1000,(a.mount-a.drop/2)/1000,front+.1+p/2,'facade-awning');top.rotation.x=dim.angle;
        if(a.valance>0)mesh(g,'어닝 앞단',new T.BoxGeometry(w,a.valance/1000,.02),cloth(),a.x/1000,(dim.frontHeight-a.valance/2)/1000,edge,'facade-awning');
        map?.dispose();
        const rail=()=>material('steel','#6b7179');
        mesh(g,'어닝 벽 고정대',new T.BoxGeometry(w,.04,.04),rail(),a.x/1000,a.mount/1000,front+.08,'facade-awning');
        mesh(g,'어닝 앞 프레임',new T.BoxGeometry(w,.025,.025),rail(),a.x/1000,dim.frontHeight/1000-.016,edge-.02,'facade-awning');
        for(const side of [-1,1]){const arm=mesh(g,'어닝 지지대',new T.BoxGeometry(.02,.025,dim.fabricLength/1000),rail(),a.x/1000+side*(w/2-.07),(a.mount/1000-drop/2)-.025,front+.1+p/2,'facade-awning');arm.rotation.x=dim.angle;}
    }
    return root;
}
