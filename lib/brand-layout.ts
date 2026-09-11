import {createNode,type SceneNode} from './scene-model';
import {randomId} from './random-id';
import {brandReportSchema,entranceNames,type BrandReport,type BrandGrade,type BrandCheckStatus,type Entrance} from './brand-application';
import type {BrandStandard,BrandRole,BrandRoom} from './brand-standards';

/**
 * Brand store planner.
 *
 * Turns a brand standard (materials, equipment modules, circulation and zone rules) plus a rectangular
 * shop and an entrance position into a complete, validated store layout. The rules are the ones a
 * brand's construction manual states; the planner applies them so a non-expert gets a layout that a
 * store designer would accept as a starting point.
 *
 * Frame: x runs left → right, z runs back wall (−depth/2) → storefront (+depth/2). Everything is planned
 * for a left or centre entrance and mirrored for a right entrance.
 */

export type LayoutOptions={entrance:Entrance;seating:boolean};
export const defaultLayoutOptions:LayoutOptions={entrance:'left',seating:true};

export type PlanBand={id:string;name:string;z0:number;z1:number};
export type StorePlan={
  nodes:SceneNode[];
  lighting:{intensity:number;warmth:number};
  report:BrandReport;
  bands:PlanBand[];
  aisle:{x0:number;x1:number};
};

/** Inner face of a 120mm wall measured from the centreline the room dimensions describe. */
const WALL_INSET=60;
/** Display plinth module widths allowed by the manual, largest first. */
export const plinthModuleWidths=[1200,900,600] as const;
/** Design reference minimums (설계 기준값) the planner may shrink service units to when the display share is short. */
const MIN_POS=900,MIN_BEVERAGE=900,MIN_PICKUP=600;
const TOP_SLAB=30;
const BLOCK_HEIGHT=150;
const SHOWCASE_HEIGHT=450,SHOWCASE_INSET=60;
const SPOT=160,SPOT_HEIGHT=120;
const STOOL=350,STOOL_HEIGHT=700,STOOL_PITCH=600;
const BAR_DEPTH=400,STOOL_ZONE=500,BAR_TOP=40,BAR_LEG=40;
const TABLE=650,TABLE_HEIGHT=740,CHAIR_WIDTH=460,CHAIR_DEPTH=480,CHAIR_HEIGHT=800;
const BENCH_DEPTH=600,TABLE_PITCH=1200,MAX_BENCH_TABLES=2;
const RACK_DEPTH=450,RACK_HEIGHT=1800,MAX_RACKS=6;
/** A display leg shorter than this is not worth wrapping the corner for. */
const MIN_LEG=1200;
const POS_UNIT=[320,250,300] as const;
const MACHINE=[700,500,550] as const;

const SQUARE_METRES_PER_PYEONG=3.305785;
const round1=(v:number)=>Math.round(v*10)/10;
/** Planning tolerances: the band model rounds plinth modules to 600mm steps, so hold the display floor to 0.5 point and other zone targets to 1 point. */
const DISPLAY_TOLERANCE=.5,ZONE_TOLERANCE=1;

type Material={material:SceneNode['material'];finish?:SceneNode['finish'];uniformMaterial?:boolean};

/** Fill `width` with plinth modules: least leftover first, then most of the preferred module, then fewest modules. */
export function fillPlinthModules(width:number,preferred:number):number[]{
  let best:{modules:number[];leftover:number;preferredCount:number}|null=null;
  const [a,b,c]=plinthModuleWidths;
  for(let na=0;na*a<=width;na++)for(let nb=0;na*a+nb*b<=width;nb++){
    const nc=Math.floor((width-na*a-nb*b)/c);
    const modules=[...Array(na).fill(a),...Array(nb).fill(b),...Array(nc).fill(c)] as number[];
    if(!modules.length)continue;
    const leftover=width-modules.reduce((s,m)=>s+m,0);
    const preferredCount=modules.filter(m=>m===preferred).length;
    const better=!best||leftover<best.leftover||(leftover===best.leftover&&(preferredCount>best.preferredCount||(preferredCount===best.preferredCount&&modules.length<best.modules.length)));
    if(better)best={modules,leftover,preferredCount};
  }
  return best?best.modules:[];
}

function classify(raw:number):{storeType:BrandReport['storeType'];storeTypeName:string}{
  const pyeong=round1(raw);
  if(pyeong>=40)return {storeType:'A',storeTypeName:'플래그십 · 40평 이상'};
  if(pyeong>=20)return {storeType:'B',storeTypeName:'스탠다드 · 20~40평'};
  if(pyeong>=10)return {storeType:'C',storeTypeName:'컴팩트 · 10~20평'};
  return {storeType:'D',storeTypeName:'인스토어·소형 · 10평 미만'};
}


export function planBrandStore(brand:BrandStandard,room:BrandRoom,options:LayoutOptions=defaultLayoutOptions,idFactory:()=>string=randomId):StorePlan{
  const {rules,modules}=brand;
  const mirror=options.entrance==='right';
  const usableWidth=room.width-2*WALL_INSET,usableDepth=room.depth-2*WALL_INSET;
  const xLeft=-usableWidth/2,xRight=usableWidth/2;
  const zBack=-room.depth/2+WALL_INSET,zFront=room.depth/2-WALL_INSET;
  const warnings:string[]=[];

  const showcase=modules.showcase;
  if(!plinthModuleWidths.includes(showcase.width as typeof plinthModuleWidths[number]))
    throw new Error(`진열 플린스 모듈 폭은 ${plinthModuleWidths.join('·')}mm 중 하나여야 합니다. 현재 ${showcase.width}mm.`);
  const plinthHeight=showcase.height,plinthDepth=showcase.depth,counterHeight=modules.counter.height;
  const serviceDepth=plinthDepth+rules.queueDepth;

  // ── Depth bands: back-of-house, service line, queue, then the remainder for seating and the display leg.
  const backDepth=modules.backbar.enabled?modules.backbar.depth:RACK_DEPTH;
  const backBand=backDepth+rules.aisleSub;
  const zLineStart=zBack+backBand,zLineCenter=zLineStart+plinthDepth/2,zQueueEnd=zLineStart+plinthDepth+rules.queueDepth;
  const frontBand=zFront-zQueueEnd;
  if(frontBand<0)
    throw new Error(`상가 깊이가 부족합니다. 후방 ${backBand.toLocaleString()} + 진열·카운터 ${plinthDepth.toLocaleString()} + 대기열 ${rules.queueDepth.toLocaleString()} = ${(backBand+plinthDepth+rules.queueDepth+2*WALL_INSET).toLocaleString()}mm 이상의 깊이가 필요합니다 (현재 ${room.depth.toLocaleString()}mm).`);

  // ── Entrance geometry: door on the storefront, a straight aisle into the shop and a clear entry zone.
  const doorX=options.entrance==='center'?0:xLeft+250+rules.doorWidth/2;
  const exclusion=Math.max(rules.doorWidth,rules.aisleMain)/2;
  const aisle={x0:doorX-exclusion,x1:doorX+exclusion};
  const entryClearance=Math.max(rules.aisleMain,rules.doorWidth+200);

  // ── Display leg options. The display may wrap the entrance-side corner and run along that wall, stopping
  //    short of the entry zone. Customers browse it from a strip one main aisle wide; only the part beyond
  //    the queue band adds display area, which is what lets mid-size shops keep full-width counters.
  const browsing=plinthDepth+rules.aisleMain;
  const zLegStart=zLineStart+plinthDepth,legMax=zFront-entryClearance-zLegStart;
  const legAllowed=rules.displayWrap==='auto'&&(options.entrance!=='center'||xLeft+browsing<=aisle.x0);
  const sum=(list:number[])=>list.reduce((s,m)=>s+m,0);
  const legOptions:number[][]=[[]];
  if(legAllowed)for(let target=MIN_LEG;target<=legMax;target+=600){
    const fill=fillPlinthModules(target,showcase.width),length=sum(fill);
    if(length>=MIN_LEG&&!legOptions.some(o=>sum(o)===length))legOptions.push(fill);
  }

  // ── Service line widths. The display share is the hard rule (the manual rejects layouts that eat display
  //    space for seats). POS, beverage and pickup widths are searched from a design minimum through the
  //    brand's value up to two growth steps, with or without a display leg, and the plan that meets the most
  //    zone targets while staying closest to the brand's own widths wins.
  const innerArea=usableWidth*usableDepth;
  const share=(mm2:number)=>mm2/innerArea*100;
  const choices=(enabled:boolean,value:number,min:number)=>enabled?[...new Set([Math.min(value,min),value,Math.min(5000,value+600),Math.min(5000,value+1200)])]:[0];
  const wanted={pos:modules.counter.width,beverage:modules.beverage.enabled?modules.beverage.width:0,pickup:modules.pickup.enabled?modules.pickup.width:0};
  type Candidate={pos:number;beverage:number;pickup:number;modules:number[];leg:number[];displayArea:number;violations:number;closeness:number;legLength:number};
  const candidates:Candidate[]=[];
  const outside=(value:number,zone:{min:number;max:number})=>value+ZONE_TOLERANCE<zone.min||value-ZONE_TOLERANCE>zone.max?1:0;
  for(const leg of legOptions)
  for(const pos of choices(true,modules.counter.width,MIN_POS))
  for(const beverage of choices(modules.beverage.enabled,modules.beverage.width,MIN_BEVERAGE))
  for(const pickup of choices(modules.pickup.enabled,modules.pickup.width,MIN_PICKUP)){
    const fill=fillPlinthModules(usableWidth-pos-beverage-pickup,showcase.width),lineWidth=sum(fill),legLength=sum(leg);
    if(!fill.length)continue;
    if(legLength&&lineWidth<browsing)continue; // the corner run must cover the leg's browsing strip so zone areas never double count
    const gap=usableWidth-lineWidth-pos-beverage-pickup;
    const overlap=Math.min(lineWidth,Math.max(0,browsing-gap))*Math.min(legLength,rules.queueDepth);
    const displayArea=lineWidth*serviceDepth+legLength*browsing-overlap;
    if(share(displayArea)+DISPLAY_TOLERANCE<rules.zones.display.min)continue;
    const violations=outside(share((pos+beverage)*serviceDepth),rules.zones.counter)+outside(share(pickup*serviceDepth),rules.zones.pickup);
    const closeness=Math.abs(pos-wanted.pos)+Math.abs(beverage-wanted.beverage)+Math.abs(pickup-wanted.pickup);
    candidates.push({pos,beverage,pickup,modules:fill,leg,displayArea,violations,closeness,legLength});
  }
  candidates.sort((a,b)=>a.violations-b.violations||a.closeness-b.closeness||a.legLength-b.legLength||b.displayArea-a.displayArea);
  const chosen=candidates[0];
  if(!chosen){
    const minimalService=Math.min(modules.counter.width,MIN_POS)+(modules.beverage.enabled?MIN_BEVERAGE:0)+(modules.pickup.enabled?MIN_PICKUP:0);
    const neededDisplay=Math.ceil(rules.zones.display.min/100*innerArea/serviceDepth/300)*300; // plinth modules fill any multiple of 300mm from 600mm up
    const currentDisplay=sum(fillPlinthModules(Math.max(0,usableWidth-minimalService),showcase.width));
    const sideDoorHint=rules.displayWrap==='auto'&&options.entrance==='center'&&legMax>=MIN_LEG?' 출입구를 왼쪽이나 오른쪽에 두면 진열을 측벽으로 L자 연장할 수 있어 해결될 수 있습니다.':'';
    throw new Error(`진열 존 ${rules.zones.display.min}%를 확보할 수 없습니다. 폭 ${room.width.toLocaleString()}mm에서는 카운터·음료·픽업을 최소로 줄여도 진열 ${currentDisplay.toLocaleString()}mm(${round1(share(currentDisplay*serviceDepth))}%)입니다. 폭 ${(neededDisplay+minimalService+2*WALL_INSET).toLocaleString()}mm 이상이 필요하거나 음료 제조대·픽업대 모듈을 끄세요.${sideDoorHint}`);
  }
  const posWidth=chosen.pos,beverageWidth=chosen.beverage,pickupWidth=chosen.pickup,displayModules=chosen.modules,displayWidth=sum(displayModules),legModules=chosen.leg,legLength=chosen.legLength;
  const unitNames=[['POS 카운터',posWidth,wanted.pos],['음료 제조대',beverageWidth,wanted.beverage],['픽업대',pickupWidth,wanted.pickup]] as const;
  const reduced=unitNames.filter(([,actual,want])=>actual<want),grown=unitNames.filter(([,actual,want])=>actual>want);
  if(reduced.length)warnings.push(`진열 존 ${rules.zones.display.min}% 확보를 위해 ${reduced.map(([name,actual])=>`${name} ${actual.toLocaleString()}mm`).join(' · ')}로 줄였습니다. 상가 폭이 넓어지면 브랜드 표준 폭으로 되돌아갑니다.`);
  if(grown.length)warnings.push(`카운터·픽업 존 목표에 맞추기 위해 ${grown.map(([name,actual])=>`${name} ${actual.toLocaleString()}mm`).join(' · ')}로 늘렸습니다. 브랜드 표준 폭으로 되돌리려면 설비 모듈 폭을 확인하세요.`);
  const cornerGap=usableWidth-displayWidth-posWidth-beverageWidth-pickupWidth;

  // ── Node factory. Everything is placed in the left-entrance frame and mirrored at the end.
  const nodes:SceneNode[]=[];
  const slot=(role:BrandRole):Material=>({material:brand.materials[role].material,finish:structuredClone(brand.materials[role].finish),uniformMaterial:true});
  const plain=(material:SceneNode['material'],finish?:SceneNode['finish']):Material=>({material,...(finish?{finish}:{}),uniformMaterial:true});
  const glass=plain('glass'),concrete=plain('concrete',{color:'#B8B3AB',roughness:.92});
  const group=(name:string)=>({id:idFactory(),name});
  const put=(kind:SceneNode['kind'],name:string,x:number,z:number,width:number,height:number,depth:number,material:Material,y=0,rotation=0,g?:{id:string;name:string})=>{
    if(kind==='model')throw new Error('지원하지 않는 요소입니다.');
    if(y+height>room.height)throw new Error(`${name} 상단이 천장 높이 ${room.height.toLocaleString()}mm를 넘습니다.`);
    const node:SceneNode={...createNode(kind as Exclude<SceneNode['kind'],'model'>,idFactory(),x,z),name,width,height,depth,y,rotation,...material,...(g?{group:g}:{})};
    nodes.push(node);
    return node;
  };
  const equipment:BrandReport['equipment']=[];
  const count=(name:string,n:number,grade:BrandGrade,note:string)=>{if(n>0)equipment.push({name,count:n,grade,note})};

  // ── Service line, left → right: corner gap · display modules · POS · beverage · pickup.
  let cursor=xLeft+cornerGap;
  displayModules.forEach((m,i)=>{
    const x=cursor+m/2,g=group(`진열 모듈 ${i+1} · ${m}mm`);
    put('box','콘크리트 기단 블록',x,zLineCenter,Math.round(m*.6),BLOCK_HEIGHT,Math.round(plinthDepth*.7),concrete,0,0,g);
    put('box','플린스 몸체 (목재 무늬목)',x,zLineCenter,m,plinthHeight-BLOCK_HEIGHT-TOP_SLAB,plinthDepth,slot('wood'),BLOCK_HEIGHT,0,g);
    put('box','플린스 상판 (석재)',x,zLineCenter,m,TOP_SLAB,plinthDepth,slot('counterTop'),plinthHeight-TOP_SLAB,0,g);
    put('box','유리 쇼케이스',x,zLineCenter,m-SHOWCASE_INSET,SHOWCASE_HEIGHT,plinthDepth-100,glass,plinthHeight,0,g);
    put('pendant',`진열 스포트 ${rules.lightingWarmth.toLocaleString()}K`,x,zLineCenter+plinthDepth/2-100,SPOT,SPOT_HEIGHT,SPOT,slot('metal'),room.height-SPOT_HEIGHT-20,0,g);
    cursor+=m;
  });
  const serviceStart=cursor;
  {
    const x=cursor+posWidth/2,g=group('주문 카운터 (POS)');
    put('box','카운터 몸체 (하부 도어형)',x,zLineCenter,posWidth,counterHeight-TOP_SLAB,plinthDepth,slot('counterFront'),0,0,g);
    put('box','카운터 상판 (석재)',x,zLineCenter,posWidth,TOP_SLAB,plinthDepth,slot('counterTop'),counterHeight-TOP_SLAB,0,g);
    put('box','POS 단말',x,zLineCenter-plinthDepth/2+POS_UNIT[2]/2+120,...POS_UNIT,slot('metal'),counterHeight,0,g);
    cursor+=posWidth;
  }
  if(beverageWidth){
    const x=cursor+beverageWidth/2,g=group('음료 제조대'),h=modules.beverage.height;
    put('box','음료 제조대 몸체',x,zLineCenter,beverageWidth,h-TOP_SLAB,plinthDepth,slot('wood'),0,0,g);
    put('box','음료 제조대 상판 (석재)',x,zLineCenter,beverageWidth,TOP_SLAB,plinthDepth,slot('counterTop'),h-TOP_SLAB,0,g);
    if(beverageWidth>=MACHINE[0]+100)put('box','에스프레소 머신 자리',x,zLineCenter-60,...MACHINE,slot('metal'),h,0,g);
    cursor+=beverageWidth;
  }
  if(pickupWidth){
    const x=cursor+pickupWidth/2,g=group('픽업대'),h=modules.pickup.height;
    put('box','픽업대 몸체',x,zLineCenter,pickupWidth,h-TOP_SLAB,plinthDepth,slot('counterFront'),0,0,g);
    put('box','픽업대 상판 (석재)',x,zLineCenter,pickupWidth,TOP_SLAB,plinthDepth,slot('counterTop'),h-TOP_SLAB,0,g);
    cursor+=pickupWidth;
  }
  const serviceCenter=(serviceStart+cursor-pickupWidth)/2;

  // ── Display leg along the entrance-side wall, continuing the corner module toward the storefront.
  let legCursor=zLegStart;
  legModules.forEach((m,i)=>{
    const z=legCursor+m/2,x=xLeft+plinthDepth/2,g=group(`측벽 진열 모듈 ${i+1} · ${m}mm`);
    put('box','콘크리트 기단 블록',x,z,Math.round(m*.6),BLOCK_HEIGHT,Math.round(plinthDepth*.7),concrete,0,90,g);
    put('box','플린스 몸체 (목재 무늬목)',x,z,m,plinthHeight-BLOCK_HEIGHT-TOP_SLAB,plinthDepth,slot('wood'),BLOCK_HEIGHT,90,g);
    put('box','플린스 상판 (석재)',x,z,m,TOP_SLAB,plinthDepth,slot('counterTop'),plinthHeight-TOP_SLAB,90,g);
    put('box','유리 쇼케이스',x,z,m-SHOWCASE_INSET,SHOWCASE_HEIGHT,plinthDepth-100,glass,plinthHeight,90,g);
    put('pendant',`진열 스포트 ${rules.lightingWarmth.toLocaleString()}K`,xLeft+plinthDepth-100,z,SPOT,SPOT_HEIGHT,SPOT,slot('metal'),room.height-SPOT_HEIGHT-20,0,g);
    legCursor+=m;
  });

  // ── Back-of-house along the back wall: work counter behind the service units, storage racks in the rest.
  let workWidth=0,rackCount=0;
  const zBackCenter=zBack+backDepth/2;
  if(modules.backbar.enabled){
    workWidth=Math.min(modules.backbar.width,usableWidth);
    const x=Math.min(Math.max(serviceCenter,xLeft+workWidth/2),xRight-workWidth/2),g=group('후방 수납·작업대'),h=modules.backbar.height;
    put('box','후방 작업대 몸체',x,zBackCenter,workWidth,h-TOP_SLAB,backDepth,slot('wood'),0,0,g);
    put('box','후방 작업대 상판',x,zBackCenter,workWidth,TOP_SLAB,backDepth,slot('counterTop'),h-TOP_SLAB,0,g);
    for(const [from,to] of [[xLeft,x-workWidth/2],[x+workWidth/2,xRight]] as const)rackCount+=fillRacks(from,to);
  }else rackCount=fillRacks(xLeft,xRight);
  function fillRacks(from:number,to:number){
    let placed=0,at=from;
    for(const w of plinthModuleWidths)while(to-at>=w&&rackCount+placed<MAX_RACKS){
      put('shelf','후방 보관랙 (SUS)',at+w/2,zBack+RACK_DEPTH/2,w,Math.min(RACK_HEIGHT,room.height-200),RACK_DEPTH,slot('metal'));
      at+=w;placed++;
    }
    return placed;
  }

  // ── Entrance door on the storefront.
  put('door',`출입문 (유리) · ${entranceNames[options.entrance]}`,doorX,0,rules.doorWidth,2100,160,glass);
  nodes[nodes.length-1].host='front';
  nodes[nodes.length-1].y=0;

  // ── Seating in the front band: window bar on the storefront, bench unit on the wall opposite the entrance.
  let stools=0,benchTables=0;
  const barZone=BAR_DEPTH+STOOL_ZONE;
  const obstacles:[number,number][]=[];
  let barOnRight=false;
  if(options.seating&&modules.windowBar.enabled){
    if(frontBand<barZone)warnings.push(`창가 바 좌석을 생략했습니다. 전면 여유 ${frontBand.toLocaleString()}mm는 바 ${BAR_DEPTH} + 스툴 ${STOOL_ZONE}mm보다 작습니다.`);
    else for(const [from,to,side] of [[xLeft,aisle.x0,'left'],[aisle.x1,xRight,'right']] as const){
      const length=Math.min(modules.windowBar.width,to-from);
      if(length<2*STOOL_PITCH||(legLength&&side==='left'))continue; // keep the display corner and its browsing strip clear
      const seats=Math.floor(length/STOOL_PITCH),x=side==='left'?to-length/2:from+length/2,g=group(`창가 바 · ${seats}석`),barHeight=modules.windowBar.height;
      put('box','창가 바 상판 (목재)',x,zFront-BAR_DEPTH/2,length,BAR_TOP,BAR_DEPTH,slot('wood'),barHeight-BAR_TOP,0,g);
      for(const end of [-1,1])put('box','바 지지 프레임 (SUS)',x+end*(length/2-BAR_LEG/2-20),zFront-BAR_DEPTH/2,BAR_LEG,barHeight-BAR_TOP,BAR_DEPTH-20,slot('metal'),0,0,g);
      for(let i=0;i<seats;i++)put('cylinder','바 스툴 (SUS)',x-length/2+STOOL_PITCH*(i+.5)+(length-seats*STOOL_PITCH)/2,zFront-BAR_DEPTH-100-STOOL/2,STOOL,STOOL_HEIGHT,STOOL,slot('metal'),0,0,g);
      obstacles.push([x-length/2,x+length/2]);
      stools+=seats;
      if(side==='right')barOnRight=true;
    }
    if(!stools&&frontBand>=barZone)warnings.push(`창가 바 좌석을 생략했습니다. 출입구 주통로를 제외한 전면 구간이 ${(2*STOOL_PITCH).toLocaleString()}mm 미만이거나 브랜드의 창가 바 최대 길이가 짧습니다.`);
  }
  if(options.seating&&modules.seating.enabled){
    const unitDepth=BENCH_DEPTH+100+TABLE+120+CHAIR_DEPTH;
    const zEnd=zFront-(barOnRight?barZone:0)-100,zStart=zQueueEnd+100;
    const length=Math.min(modules.seating.width,zEnd-zStart);
    if(length<TABLE_PITCH)warnings.push(`벽면 벤치·테이블을 생략했습니다. 객석 여유 길이 ${Math.max(0,Math.round(zEnd-zStart)).toLocaleString()}mm는 테이블 1개 기준 ${TABLE_PITCH.toLocaleString()}mm 미만입니다.`);
    else if(xRight-unitDepth<aisle.x1)warnings.push('벽면 벤치·테이블을 생략했습니다. 출입구 주통로와 겹칩니다.');
    else{
      benchTables=Math.min(MAX_BENCH_TABLES,Math.floor(length/TABLE_PITCH));
      const zCenter=zEnd-length/2,g=group(`벽면 벤치 · ${benchTables*2}석`);
      put('bench','벽면 벤치 (패브릭)',xRight-BENCH_DEPTH/2,zCenter,length,modules.seating.height,BENCH_DEPTH,slot('fabric'),0,90,g);
      for(let i=0;i<benchTables;i++){
        const z=zEnd-length*((i+.5)/benchTables),tableX=xRight-BENCH_DEPTH-100-TABLE/2;
        put('table',`벤치 테이블 ${i+1} (SUS)`,tableX,z,TABLE,TABLE_HEIGHT,TABLE,slot('metal'),0,0,g);
        put('chair','다이닝 체어',tableX-TABLE/2-120-CHAIR_DEPTH/2,z,CHAIR_WIDTH,CHAIR_HEIGHT,CHAIR_DEPTH,slot('wood'),0,-90,g);
      }
      obstacles.push([xRight-unitDepth,xRight]);
    }
  }

  // ── Mirror for a right-hand entrance.
  if(mirror){
    const negate=(v:number)=>v===0?0:-v; // keep +0 so mirrored scenes round-trip through JSON unchanged
    for(const n of nodes){n.x=negate(n.x);n.rotation=negate(n.rotation)}
    const swap=([a,b]:[number,number]):[number,number]=>[negate(b),negate(a)];
    obstacles.splice(0,obstacles.length,...obstacles.map(swap));
    const [x0,x1]=swap([aisle.x0,aisle.x1]);aisle.x0=x0;aisle.x1=x1;
  }

  // ── Report.
  const area=room.width*room.depth/1e6,pyeong=area/SQUARE_METRES_PER_PYEONG,{storeType,storeTypeName}=classify(pyeong);
  if(storeType==='D')warnings.push('10평 미만은 인스토어(Type D) 기준으로 검토하세요. 임대처 가이드를 우선하되 플린스 재질·조명 사양은 유지합니다.');
  const ratio=(mm2:number)=>round1(mm2/innerArea*100);
  const zoneStatus=(value:number,min:number,max:number,hard=false):BrandCheckStatus=>hard?(value+DISPLAY_TOLERANCE<min?'fail':'ok'):value+ZONE_TOLERANCE<min?'warn':value-ZONE_TOLERANCE>max?'warn':'ok';
  const displayArea=chosen.displayArea,counterArea=(posWidth+beverageWidth)*serviceDepth,pickupArea=pickupWidth*serviceDepth,backArea=usableWidth*backBand;
  const seatingArea=innerArea-displayArea-counterArea-pickupArea-backArea;
  const zones:BrandReport['zones']=[
    {id:'Z2',name:'진열',areaM2:round1(displayArea/1e6),ratio:ratio(displayArea),min:rules.zones.display.min,max:rules.zones.display.max,status:zoneStatus(ratio(displayArea),rules.zones.display.min,rules.zones.display.max,true)},
    {id:'Z3',name:'카운터·음료',areaM2:round1(counterArea/1e6),ratio:ratio(counterArea),min:rules.zones.counter.min,max:rules.zones.counter.max,status:zoneStatus(ratio(counterArea),rules.zones.counter.min,rules.zones.counter.max)},
    {id:'Z4',name:'픽업',areaM2:round1(pickupArea/1e6),ratio:ratio(pickupArea),min:rules.zones.pickup.min,max:rules.zones.pickup.max,status:zoneStatus(ratio(pickupArea),rules.zones.pickup.min,rules.zones.pickup.max)},
    {id:'Z6',name:'후방',areaM2:round1(backArea/1e6),ratio:ratio(backArea),min:rules.zones.back.min,max:rules.zones.back.max,status:zoneStatus(ratio(backArea),rules.zones.back.min,rules.zones.back.max)},
    {id:'Z5',name:'객석·여유',areaM2:round1(seatingArea/1e6),ratio:ratio(seatingArea),min:0,max:100,status:'ok'},
  ];
  const advice:Record<string,[string,string]>={Z3:['주문 카운터·음료 제조대 폭을 늘리거나 서비스 라인을 L자로 연장하면 개선됩니다.','주문 카운터·음료 제조대 폭을 줄이면 개선됩니다.'],Z4:['픽업대 폭을 늘리면 개선됩니다.','픽업대 폭을 줄이면 개선됩니다.'],Z6:['후방 작업대 깊이를 늘리면 개선됩니다.','후방 작업대 깊이를 줄이면 개선됩니다. 부통로 900mm는 유지됩니다.']};
  for(const z of zones)if(z.status==='warn')warnings.push(`${z.id} ${z.name} ${z.ratio}% · 목표 ${z.min}~${z.max}%. ${advice[z.id]?.[z.ratio<z.min?0:1]??''}`.trim());

  const doorAxis=mirror?-doorX:doorX;
  let free0=mirror?-xRight:xLeft,free1=mirror?-xLeft:xRight;
  for(const [a,b] of obstacles){if(b<=doorAxis)free0=Math.max(free0,b);if(a>=doorAxis)free1=Math.min(free1,a)}
  const mainAisle=Math.round(free1-free0),queueActual=Math.round(zFront-(zLineCenter+plinthDepth/2));
  const aisles:BrandReport['aisles']=[
    {name:'주통로 · 출입구→카운터',required:rules.aisleMain,actual:mainAisle,status:mainAisle>=rules.aisleMain?'ok':'fail'},
    {name:'부통로 · 후방 작업',required:rules.aisleSub,actual:rules.aisleSub,status:'ok'},
    {name:'대기열 · 카운터 앞 깊이',required:rules.queueDepth,actual:queueActual,status:queueActual>=rules.queueDepth?'ok':'fail'},
    ...(legLength?[{name:'측벽 진열 앞 통로',required:rules.aisleMain,actual:rules.aisleMain,status:'ok' as const}]:[]),
  ];

  count('진열 쇼케이스 플린스',displayModules.length+legModules.length,'F',`라인 ${displayModules.join('+')}mm${legLength?` · 측벽 L자 연장 ${legModules.join('+')}mm (출입구 쪽 코너, 진열 앞 통로 ${rules.aisleMain}mm)`:''} · GL+${plinthHeight} · 깊이 ${plinthDepth}mm · 유리 쇼케이스+목재 베이스+콘크리트 기단`);
  count('주문 카운터 (POS)',1,'F',`폭 ${posWidth}mm · 상판 GL+${counterHeight}mm · 하부 전면 도어형`);
  count('음료 제조대',beverageWidth?1:0,'O',`폭 ${beverageWidth}mm · 에스프레소 머신·제빙기·싱크는 본사 지정 모델 확인`);
  count('픽업대',pickupWidth?1:0,'S',`폭 ${pickupWidth}mm · 픽업 동선 끝단`);
  count('후방 수납·작업대',workWidth?1:0,'O',`폭 ${workWidth}mm · 깊이 ${backDepth}mm`);
  count('후방 보관랙 (SUS)',rackCount,'O',`깊이 ${RACK_DEPTH} · 높이 ${Math.min(RACK_HEIGHT,room.height-200)}mm`);
  count('창가 바 좌석',stools,'O',`바 깊이 ${BAR_DEPTH} · 스툴 간격 ${STOOL_PITCH}mm`);
  count('벽면 벤치·테이블',benchTables,'O',`테이블 ${TABLE}mm ${benchTables}개 · 벤치 깊이 ${BENCH_DEPTH}mm`);
  count('진열 스포트',displayModules.length+legModules.length,'F',`${rules.lightingWarmth.toLocaleString()}K 진열 강조등 · 모듈당 1개`);
  count('출입문',1,'O',`폭 ${rules.doorWidth}mm · ${entranceNames[options.entrance]} 위치`);

  const checks:BrandReport['checks']=[
    {grade:'F',label:`진열 플린스 GL+${plinthHeight}mm · 깊이 ${plinthDepth}mm · 모듈 ${plinthModuleWidths.join('/')}`,status:'ok'},
    {grade:'F',label:`카운터 상판 GL+${counterHeight}mm`,status:'ok'},
    {grade:'F',label:`조명 ${rules.lightingWarmth.toLocaleString()}K 통일 · 진열 강조`,status:'ok'},
    {grade:'F',label:`동선 · 주통로 ${rules.aisleMain} / 부통로 ${rules.aisleSub} / 대기열 ${rules.queueDepth}mm`,status:aisles.every(a=>a.status==='ok')?'ok':'fail'},
    ...rules.checklist.map(c=>({grade:c.grade,label:c.label,status:'manual' as const})),
  ];

  const report=brandReportSchema.parse({
    manual:rules.source,storeType,storeTypeName,areaM2:round1(area),pyeong:round1(pyeong),
    zones,aisles,seats:{windowBar:stools,bench:benchTables*2,total:stools+benchTables*2},
    equipment:equipment.slice(0,24),checks:checks.slice(0,16),warnings:warnings.slice(0,12),
  });
  const bands:PlanBand[]=[
    {id:'Z6',name:'후방 · 작업 통로',z0:zBack,z1:zLineStart},
    {id:'Z2·Z3·Z4',name:'진열 · 카운터 · 픽업',z0:zLineStart,z1:zLineStart+plinthDepth},
    {id:'대기열',name:`대기열 ${rules.queueDepth.toLocaleString()}mm`,z0:zLineStart+plinthDepth,z1:zQueueEnd},
    {id:'Z5',name:'객석 · 여유',z0:zQueueEnd,z1:zFront},
  ];
  return {nodes,lighting:{intensity:1,warmth:rules.lightingWarmth},report,bands,aisle};
}
