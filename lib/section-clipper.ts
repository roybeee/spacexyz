import * as T from 'three';
import {sectionPlane,sectionGuidePoints,type SectionView,type SectionRoom} from './section-view';
type OriginalClip={planes:T.Plane[]|null;shadows:boolean;intersection:boolean};
/** Owns transient renderer material state, never scene data or mesh geometry. */
export class SectionClipper{
    plane=new T.Plane();private planes=[this.plane];private originals=new WeakMap<T.Material,OriginalClip>();
    guide=new T.LineLoop(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xed9c38,depthTest:false,depthWrite:false,toneMapped:false}));
    active=false;private guideKey='';
    constructor(){this.guide.name='SECTION_GUIDE';this.guide.renderOrder=110;this.guide.visible=false;}
    update(room:SectionRoom,section:SectionView|null,roots:(T.Object3D|undefined)[]){
        this.active=!!section;
        if(section){this.plane.copy(sectionPlane(room,section));const key=JSON.stringify([room.width,room.depth,room.height,section.axis,section.position]);if(key!==this.guideKey){this.guide.geometry.dispose();this.guide.geometry=new T.BufferGeometry().setFromPoints(sectionGuidePoints(room,section));this.guideKey=key;}}
        this.guide.visible=!!section?.guide;for(const root of roots)if(root)this.bind(root);
    }
    bind(root:T.Object3D){root.traverse(o=>{if(!('material' in o))return;const material=o.material as T.Material|T.Material[];for(const m of Array.isArray(material)?material:[material]){
        if(this.active){if(!this.originals.has(m)){this.originals.set(m,{planes:m.clippingPlanes,shadows:m.clipShadows,intersection:m.clipIntersection});m.clippingPlanes=this.planes;m.clipShadows=true;m.clipIntersection=false;m.needsUpdate=true;}}
        else {const old=this.originals.get(m);if(old){m.clippingPlanes=old.planes;m.clipShadows=old.shadows;m.clipIntersection=old.intersection;m.needsUpdate=true;this.originals.delete(m);}}
    }});}
    dispose(){this.guide.removeFromParent();this.guide.geometry.dispose();this.guide.material.dispose();}
}
export function clearExportClipping(root:T.Object3D){root.traverse(o=>{if('material' in o)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.clippingPlanes=null;m.clipShadows=false;m.clipIntersection=false;}});}
