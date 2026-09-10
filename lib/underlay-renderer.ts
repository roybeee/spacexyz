import * as T from 'three';
import {loadImageTexture} from './image-textures';
import {underlayDepth,type PlanUnderlay} from './underlay-schema';
export type UnderlayStatus={loading:boolean;error:string};
/** Reference drawing, independently loaded and kept outside editable/exportable geometry. */
export class UnderlayRenderer{
    group=new T.Group();mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}));
    private data?:PlanUnderlay;private source?:T.Texture;private controller?:AbortController;private job:Promise<void>=Promise.resolve();private generation=0;private disposed=false;private display=false;
    status:UnderlayStatus={loading:false,error:''};
    constructor(private onStatus:(status:UnderlayStatus)=>void=()=>{},private load=loadImageTexture){this.group.name='FLOORPLAN_REFERENCE';this.mesh.rotation.x=-Math.PI/2;this.group.add(this.mesh);this.group.visible=false;}
    update(data:PlanUnderlay|undefined){
        const changed=this.data?.imageId!==data?.imageId;this.data=data;
        if(!data){if(changed){this.generation++;this.controller?.abort();this.source?.dispose();this.source=undefined;this.mesh.material.map=null;this.mesh.material.needsUpdate=true;}this.status={loading:false,error:''};this.publish();return;}
        this.group.position.set(data.x/1000,.002,data.z/1000);this.group.rotation.y=data.rotation*Math.PI/180;this.group.scale.set(data.width/1000,1,underlayDepth(data)/1000);this.mesh.material.opacity=data.opacity;
        if(!changed){this.checkDimensions();this.publish();return;}
        this.generation++;const version=this.generation;this.controller?.abort();this.source?.dispose();this.source=undefined;this.mesh.material.map=null;this.mesh.material.needsUpdate=true;this.controller=new AbortController();this.status={loading:true,error:''};this.publish();
        this.job=this.load(data.imageId,this.controller.signal).then(source=>{if(this.disposed||version!==this.generation){source.dispose();return;}this.source=source;source.wrapS=source.wrapT=T.ClampToEdgeWrapping;source.flipY=true;source.needsUpdate=true;this.mesh.material.map=source;this.mesh.material.needsUpdate=true;this.status={loading:false,error:''};this.checkDimensions();this.publish();}).catch(error=>{if(this.disposed||version!==this.generation)return;this.status={loading:false,error:error instanceof Error?error.message:'도면 이미지를 불러오지 못했습니다.'};this.publish();});
    }
    private checkDimensions(){if(!this.data||!this.source)return;const image=this.source.image as {width:number;height:number};this.status.error=image.width!==this.data.pixelWidth||image.height!==this.data.pixelHeight?'도면 이미지 크기와 보정 정보가 다릅니다. 이미지를 다시 선택하세요.':'';}
    private publish(){this.group.visible=!!this.data?.visible&&this.display&&!!this.source&&!this.status.error;this.onStatus({...this.status});}
    setDisplay(value:boolean){this.display=value;this.group.visible=!!this.data?.visible&&value&&!!this.source&&!this.status.error;}
    async ready(){const version=this.generation;await this.job;if(this.disposed||version!==this.generation)throw new Error('도면 배경이 바뀌었습니다. 다시 저장하세요.');if(this.status.error)throw new Error(this.status.error);if(!this.source||!this.data)throw new Error('도면 이미지를 먼저 선택하세요.');}
    retry(){const data=this.data;this.data=undefined;if(data)this.update(data);}
    dispose(){this.disposed=true;this.generation++;this.controller?.abort();this.source?.dispose();this.group.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
