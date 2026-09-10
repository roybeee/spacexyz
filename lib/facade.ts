import {createNode,facadeSchema,validateScene,type FacadeData,type SceneData,type SceneNode} from './scene-model';

export function defaultFacade(scene:Pick<SceneData,'room'|'name'>):FacadeData {
    const {width,height}=scene.room,signHeight=Math.min(350,Math.round(height/8)),bottom=height-signHeight-50;
    return {sign:{enabled:true,text:scene.name.split('·')[0].trim().slice(0,60)||'YOUR STORE',font:'sans',width:width-300,height:signHeight,x:0,bottom,depth:120,material:'charcoal',color:'#202c3e',textColor:'#fff1d8',illuminated:false},awning:{enabled:height>=2700,width:width-400,x:0,mount:bottom-50,projection:900,drop:150,valance:120,color:'#202c3e',stripeColor:'#fff1d8',striped:true,stripeWidth:180}};
}

export function awningDimensions(a:FacadeData['awning']) {
    return {clearance:a.mount-a.drop-a.valance,frontHeight:a.mount-a.drop,fabricLength:Math.hypot(a.projection,a.drop),angle:Math.atan2(a.drop,a.projection)};
}

export function facadeProjection(scene:Pick<SceneData,'facade'>) {
    const f=scene.facade;
    return Math.max(f?.sign.enabled?60+f.sign.depth+3:0,f?.awning.enabled?100+f.awning.projection+20:0);
}

export type StorefrontOptions={doorPosition:'left'|'center'|'right';doorWidth:number;frameMaterial:'charcoal'|'oak'|'steel';};
export function createGlassStorefront(scene:SceneData,options:StorefrontOptions,idFactory=()=>crypto.randomUUID()):SceneData {
    if(!['left','center','right'].includes(options.doorPosition)||!['charcoal','oak','steel'].includes(options.frameMaterial)||!Number.isFinite(options.doorWidth)||options.doorWidth<700||options.doorWidth>1800)throw new Error('출입문 너비는 700~1,800mm로 입력하세요.');
    const replaced=scene.nodes.filter(n=>n.host==='front');
    if(replaced.some(n=>n.locked))throw new Error('잠긴 전면 문·창문이 있습니다. 잠금을 해제한 뒤 전면을 구성하세요.');
    const {width,height}=scene.room,half=width/2-100,dw=options.doorWidth;
    if(dw>width-700)throw new Error('출입문이 너무 넓습니다. 좌우 프레임과 창문 공간을 확보하세요.');
    const f=scene.facade;
    const top=Math.floor(Math.min(2200,height-100,f?.sign.enabled?f.sign.bottom-50:Infinity,f?.awning.enabled?awningDimensions(f.awning).clearance-50:Infinity));
    if(top<1800)throw new Error('간판·어닝 아래에 높이 1,800mm의 출입 공간이 부족합니다. 외관 높이를 조정하세요.');
    const x=options.doorPosition==='left'?-half+dw/2:options.doorPosition==='right'?half-dw/2:0;
    const frameFaces=(window:boolean)=>Object.fromEntries(['frame-1','frame1','frameTop',...(window?['frameBottom','divider']:[])].flatMap(part=>Array.from({length:6},(_,i)=>[`${part}:${i}`,options.frameMaterial])));
    const nodes:SceneNode[]=[{...createNode('door',idFactory(),x,0),name:'전면 유리 출입문',width:dw,height:top,host:'front',material:'glass',uniformMaterial:false,faces:frameFaces(false)}];
    function windows(start:number,end:number) {
        const span=end-start;
        if(span<250)return;
        const count=Math.max(1,Math.ceil((span+80)/1480)),windowWidth=Math.floor((span-80*(count-1))/count);
        if(windowWidth<250)return;
        for(let i=0;i<count;i++)nodes.push({...createNode('window',idFactory(),start+windowWidth/2+i*(windowWidth+80),0),name:`전면 유리창 ${nodes.length}`,host:'front',y:80,width:windowWidth,height:top-80,material:'glass',uniformMaterial:false,faces:frameFaces(true)});
    }
    windows(-half,x-dw/2-80);windows(x+dw/2+80,half);
    return validateScene({...scene,nodes:[...scene.nodes.filter(n=>n.host!=='front'),...nodes]});
}

export function facadeCandidate(scene:SceneData,facade:FacadeData,storefront?:StorefrontOptions) {
    const candidate={...scene,facade:facadeSchema.parse(facade)};
    return storefront?createGlassStorefront(candidate,storefront):validateScene(candidate);
}

export function facadeRows(scene:Pick<SceneData,'facade'>) {
    const f=scene.facade,rows:string[][]=[];
    if(f?.sign.enabled)rows.push(['간판',f.sign.text,`${Math.round(f.sign.width)} × ${Math.round(f.sign.height)} × ${Math.round(f.sign.depth)}`,`하단 ${Math.round(f.sign.bottom)}`,f.sign.color]);
    if(f?.awning.enabled)rows.push(['어닝',f.awning.striped?'스트라이프':'단색',`가로 ${Math.round(f.awning.width)} · 돌출 ${Math.round(f.awning.projection)}`,`설치 ${Math.round(f.awning.mount)} · 하단 ${Math.round(awningDimensions(f.awning).clearance)}`,`${f.awning.color}${f.awning.striped?' / '+f.awning.stripeColor:''}`]);
    return rows;
}
