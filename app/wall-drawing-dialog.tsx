'use client';
import {useEffect,useId,useMemo,useRef,useState,type PointerEvent} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Check,Eye,PanelTop,Plus,RotateCcw,Undo2,ZoomIn,ZoomOut} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {materials,type MaterialId,type SceneData} from '@/lib/scene-model';
import {openingSpan} from '@/lib/floor-plan';
import {underlayDepth} from '@/lib/underlay-schema';
import {planWalls,snapWallPoint,validateWallPath,wallSegments,type WallPoint,type WallPlan,type WallDrawingRequest} from '@/lib/wall-drawing';

const number=(s:string)=>s.trim()?Number(s):NaN;
const display=(n:number)=>Math.round(n*10)/10;
const explain=(e:unknown)=>e instanceof Error&&e.name!=='ZodError'?e.message:'좌표와 입력 범위를 확인하세요.';

export default function WallDrawingDialog({scene,initial,onClose,onPreview}:{scene:SceneData;initial?:WallDrawingRequest;onClose:()=>void;onPreview:(plan:WallPlan)=>void}){
 const [base]=useState(()=>structuredClone(scene));
 const [points,setPoints]=useState<WallPoint[]>(()=>structuredClone(initial?.points??[])),[closed,setClosed]=useState(initial?.closed??false);
 const [name,setName]=useState(initial?.name??'새 파티션'),[thickness,setThickness]=useState(String(initial?.thickness??120)),[height,setHeight]=useState(String(initial?.height??1200)),[material,setMaterial]=useState<MaterialId>(initial?.material??'plaster'),[layerId,setLayerId]=useState(initial?.layerId??'');
 const [grid,setGrid]=useState(true),[orthogonal,setOrthogonal]=useState(true),[zoom,setZoom]=useState(1),[hover,setHover]=useState<WallPoint|null>(null),[error,setError]=useState('');
 const [x,setX]=useState('0'),[z,setZ]=useState('0'),[length,setLength]=useState('1000');
 const [showUnderlay,setShowUnderlay]=useState(base.underlay?.visible??false),[imageStatus,setImageStatus]=useState<'loading'|'ready'|'error'>('loading'),[retry,setRetry]=useState(0);
 const pointer=useRef<{x:number;y:number;id:number}|null>(null),clip=useId().replace(/:/g,''),pattern=`${clip}-grid`;
 const room=base.room,u=base.underlay;
 useEffect(()=>{
  if(!u)return;let active=true;const image=new Image();setImageStatus('loading');
  image.onload=()=>{if(active)setImageStatus(image.naturalWidth===u.pixelWidth&&image.naturalHeight===u.pixelHeight?'ready':'error');};
  image.onerror=()=>{if(active)setImageStatus('error');};image.src=`/api/assets?id=${u.imageId}`;
  return()=>{active=false;image.onload=null;image.onerror=null;image.src='';};
 },[u,retry]);
 const candidate=useMemo(()=>{
  if(points.length<2)return {plan:null,error:''};
  try{return {plan:planWalls(base,{points,closed,name,thickness:number(thickness),height:number(height),material,...(layerId?{layerId}:{})}),error:''};}
  catch(e){return {plan:null,error:explain(e)};}
 },[base,points,closed,name,thickness,height,material,layerId]);
 const plan=candidate.plan,segments=wallSegments(points,closed),last=points.at(-1),stale=JSON.stringify(scene)!==JSON.stringify(base);
 const affected=new Set(plan?.overlaps.flatMap(c=>[c.a,c.b])??[]),size=Math.max(room.width,room.depth),pad=size*.065,font=size/53/zoom,pointRadius=size/110/zoom;
 const materialColor=materials.find(m=>m.id===material)!.color;
 function append(p:WallPoint){
  if(closed){setError('닫힌 모양을 더 그리려면 마지막 작업 취소로 연결을 여세요.');return;}
  try{
   const next=validateWallPath([...points,p]);
   if(Math.abs(p.x)>room.width/2-60||Math.abs(p.z)>room.depth/2-60)throw new Error('실내 벽 안쪽에 점을 지정하세요.');
   setPoints(next);setX(String(p.x));setZ(String(p.z));setHover(null);setError('');
  }catch(e){setError(explain(e));}
 }
 function closePath(){try{validateWallPath(points,true);setClosed(true);setHover(null);setError('');}catch(e){setError(explain(e));}}
 function undoPoint(){if(closed)setClosed(false);else setPoints(p=>p.slice(0,-1));setHover(null);setError('');}
 function pointerPoint(e:PointerEvent<SVGSVGElement>){
  const matrix=e.currentTarget.getScreenCTM();if(!matrix)return null;
  const position=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  if(Math.abs(position.x)>room.width/2||Math.abs(position.y)>room.depth/2)return null;
  return snapWallPoint({x:position.x,z:position.y},last,grid,orthogonal);
 }
 function extend(dx:number,dz:number){
  const n=number(length);if(!last)return;
  if(!Number.isFinite(n)||n<100||n>20000){setError('추가 길이는 100~20,000mm로 입력하세요.');return;}
  append({x:last.x+dx*n,z:last.z+dz*n});
 }
 return <Dialog open onOpenChange={o=>!o&&onClose()}><DialogContent className="wall-workbench"><DialogHeader><DialogTitle>벽·파티션 연속 그리기</DialogTitle><DialogDescription>평면에서 모서리를 차례로 찍거나 정확한 길이를 입력하세요. 3D로 확인한 뒤 한 번에 적용합니다.</DialogDescription></DialogHeader>
 <div className="wall-layout"><section className="wall-canvas-panel">
  <div className="wall-step-heading"><b><span>1</span>벽 중심선 그리기</b><div className="wall-zoom"><button aria-label="그리기 평면 축소" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-.5))}><ZoomOut size={17}/></button><span>{zoom*100}%</span><button aria-label="그리기 평면 확대" disabled={zoom>=3} onClick={()=>setZoom(Math.min(3,zoom+.5))}><ZoomIn size={17}/></button></div></div>
  <div className="wall-snap-options"><label><input type="checkbox" checked={orthogonal} onChange={e=>{setOrthogonal(e.target.checked);setHover(null);}}/>수평·수직</label><label><input type="checkbox" checked={grid} onChange={e=>{setGrid(e.target.checked);setHover(null);}}/>50mm 스냅</label>{u&&<label><input type="checkbox" checked={showUnderlay} onChange={e=>setShowUnderlay(e.target.checked)}/>도면 배경</label>}</div>
  <div className="wall-canvas-scroll"><svg className="wall-canvas" style={{width:`${zoom*100}%`,height:380*zoom}} viewBox={`${-room.width/2-pad} ${-room.depth/2-pad} ${room.width+2*pad} ${room.depth+2*pad}`} role="img" aria-label="벽 중심선 그리기 평면. 아래의 좌표와 방향·길이 입력으로도 그릴 수 있습니다."
   onPointerDown={e=>{pointer.current=e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;}}
   onPointerMove={e=>{if(!closed)setHover(pointerPoint(e));}}
   onPointerLeave={()=>{setHover(null);pointer.current=null;}}
   onPointerCancel={()=>{pointer.current=null;setHover(null);}}
   onPointerUp={e=>{const start=pointer.current;pointer.current=null;if(!start||start.id!==e.pointerId||e.button!==0||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;const p=pointerPoint(e);if(p)append(p);}}>
   <defs><clipPath id={clip}><rect x={-room.width/2+60} y={-room.depth/2+60} width={room.width-120} height={room.depth-120}/></clipPath><pattern id={pattern} width={500} height={500} patternUnits="userSpaceOnUse"><path d="M500 0H0V500" fill="none" stroke="#b4bec6" strokeOpacity={.32} strokeWidth={1} vectorEffect="non-scaling-stroke"/></pattern></defs>
   <rect x={-room.width/2} y={-room.depth/2} width={room.width} height={room.depth} fill="#fcfcfa" stroke="#b9b6c0" strokeWidth={120}/>
   <g clipPath={`url(#${clip})`}>
    {u&&showUnderlay&&imageStatus==='ready'&&<g transform={`translate(${u.x} ${u.z}) rotate(${-u.rotation})`} opacity={u.opacity}><image href={`/api/assets?id=${u.imageId}`} x={-u.width/2} y={-underlayDepth(u)/2} width={u.width} height={underlayDepth(u)} preserveAspectRatio="none"/></g>}
    <rect x={-room.width/2} y={-room.depth/2} width={room.width} height={room.depth} fill={`url(#${pattern})`}/>
   </g>
    {base.nodes.filter(n=>!n.hidden).map(n=>{
     const color=affected.has(n.id)?'#c7792e':'#929ca7';
     if(n.host){const p=openingSpan(n,room);return <rect key={n.id} x={(p.horizontal?p.along:p.cross)-(p.horizontal?p.width:120)/2} y={(p.horizontal?p.cross:p.along)-(p.horizontal?120:p.width)/2} width={p.horizontal?p.width:120} height={p.horizontal?120:p.width} fill={color}/>;}
     return <g key={n.id} transform={`translate(${n.x} ${n.z}) rotate(${-n.rotation})`} fill={color} fillOpacity={.25} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke"><title>{n.name}</title>{['round-table','cylinder','plant','pendant'].includes(n.kind)?<ellipse rx={n.width/2} ry={n.depth/2}/>:<rect x={-n.width/2} y={-n.depth/2} width={n.width} height={n.depth}/>}</g>;
    })}
   {segments.map(({start,end},i)=><g key={i}><line x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke={materialColor} strokeWidth={Number.isFinite(number(thickness))?Math.max(20,Math.min(500,number(thickness))):120}/><line x1={start.x} y1={start.z} x2={end.x} y2={end.z} stroke={plan&&affected.has(plan.addedIds[i])?'#c7792e':'#7860a4'} strokeWidth={1.5} vectorEffect="non-scaling-stroke"/><text x={(start.x+end.x)/2} y={(start.z+end.z)/2-font*.7} textAnchor="middle" fontSize={font*.8} fill="#634a8e" stroke="#fff" strokeWidth={font*.16} paintOrder="stroke">{Math.round(Math.hypot(end.x-start.x,end.z-start.z))}</text></g>)}
   {last&&hover&&!closed&&<line x1={last.x} y1={last.z} x2={hover.x} y2={hover.z} stroke="#9071b5" strokeDasharray="5 4" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>}
   {points.map((p,i)=><g key={i} transform={`translate(${p.x} ${p.z})`}><circle r={pointRadius} fill={i===0?'#278775':'#7d5caf'} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke"/><text y={font*.28} textAnchor="middle" fontSize={font*.7} fill="white" fontWeight={700}>{i+1}</text></g>)}
   {hover&&!closed&&<circle cx={hover.x} cy={hover.z} r={pointRadius*.65} fill="none" stroke="#785aa1" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>}
   <text x={0} y={-room.depth/2-pad*.45} textAnchor="middle" fontSize={font*.85} fill="#7b7386">{room.width.toLocaleString()} × {room.depth.toLocaleString()} mm</text><text x={0} y={room.depth/2+pad*.72} textAnchor="middle" fontSize={font*.8} fill="#7b7386">입구 방향 · +Z</text>
  </svg></div>
  <div className="wall-canvas-status" aria-live="polite"><span>{closed?'시작점과 연결됨':points.length?`점 ${points.length+1} 위치를 지정하세요`:'첫 모서리를 클릭하세요'} · {segments.length}/30구간</span><span>{hover?`X ${display(hover.x)} · Z ${display(hover.z)}`:'연한 격자 500mm · 단위 mm'}</span></div>
  {u&&showUnderlay&&imageStatus!=='ready'&&<p className="wall-image-status" role="status">{imageStatus==='loading'?'도면 이미지를 불러오는 중입니다.':'도면을 읽지 못했거나 이미지 크기가 달라 배경을 숨겼습니다.'}{imageStatus==='error'&&<button onClick={()=>setRetry(v=>v+1)}>다시 불러오기</button>}</p>}
  {u&&showUnderlay&&imageStatus==='ready'&&!u.calibration&&<p className="fineprint">실측 보정 전 도면입니다. 도면 배경 설정에서 축척을 맞추면 실제 치수에 따라 그릴 수 있습니다.</p>}
  <div className="wall-path-actions"><button className="outline-button" disabled={!points.length} onClick={undoPoint}><Undo2 size={15}/>마지막 작업 취소</button><button className="outline-button" disabled={points.length<3||closed} onClick={closePath}><Check size={15}/>시작점과 연결</button><button className="text-button" disabled={!points.length} onClick={()=>{setPoints([]);setClosed(false);setHover(null);setError('');}}><RotateCcw size={14}/>다시 그리기</button></div>
  <details className="wall-coordinate-details" open={!points.length}><summary>좌표로 {points.length?'다음 점':'첫 점'} 지정하기</summary><form className="wall-coordinate-form" onSubmit={e=>{e.preventDefault();append({x:number(x),z:number(z)});}}><label className="field-label">X (mm)<input className="text-input" type="number" step="any" value={x} onChange={e=>setX(e.target.value)} disabled={closed}/></label><label className="field-label">Z (mm)<input className="text-input" type="number" step="any" value={z} onChange={e=>setZ(e.target.value)} disabled={closed}/></label><button className="outline-button" disabled={closed}><Plus size={14}/>점 추가</button></form><p className="fineprint">공간 중심이 (0, 0)입니다. X는 오른쪽, Z는 입구쪽이 +입니다. 입력 좌표에는 스냅을 적용하지 않습니다.</p></details>
  {points.length>0&&<div className="wall-length-entry"><label className="field-label">마지막 점에서 추가할 길이 (mm)<input className="text-input" type="number" min={100} max={20000} step="any" value={length} onChange={e=>setLength(e.target.value)} disabled={closed}/></label><div className="wall-directions">{([{dx:-1,dz:0,label:'왼쪽',Icon:ArrowLeft},{dx:0,dz:-1,label:'안쪽',Icon:ArrowUp},{dx:0,dz:1,label:'입구쪽',Icon:ArrowDown},{dx:1,dz:0,label:'오른쪽',Icon:ArrowRight}]).map(({dx,dz,label,Icon})=><button className="outline-button" key={label} disabled={closed} onClick={()=>extend(dx,dz)} aria-label={`${label}으로 입력 길이만큼 추가`}><Icon size={16}/>{label}</button>)}</div></div>}
 </section>
 <aside className="wall-settings"><div className="wall-step-heading"><b><span>2</span>두께와 마감 설정</b></div><label className="field-label">구성 이름<input className="text-input" value={name} maxLength={65} onChange={e=>setName(e.target.value)}/></label><div className="wall-dimensions"><label className="field-label">두께 (mm)<input className="text-input" type="number" min={20} max={500} value={thickness} onChange={e=>setThickness(e.target.value)}/></label><label className="field-label">높이 (mm)<input className="text-input" type="number" min={100} max={room.height} value={height} onChange={e=>setHeight(e.target.value)}/></label></div><div className="wall-height-presets"><button onClick={()=>setHeight('1200')}>낮은 파티션 1,200</button><button onClick={()=>setHeight(String(room.height))}>천장까지 {room.height.toLocaleString()}</button></div>
 <label className="field-label">소재<select className="text-input" value={material} onChange={e=>setMaterial(e.target.value as MaterialId)}>{materials.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="wall-material-preview"><i style={{background:materialColor}}/><span>적용 후 속성 또는 그룹 안 편집에서<br/>면 소재를 바꿀 수 있습니다.</span></div>
 <label className="field-label">레이어<select className="text-input" value={layerId} onChange={e=>setLayerId(e.target.value)}><option value="">미분류</option>{base.layers?.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <div className="wall-result" aria-live="polite"><PanelTop size={21}/><b>{segments.length?`벽 ${segments.length}구간`:'그릴 준비가 되었습니다'}</b><span>{plan?`중심선 합계 ${Math.round(plan.totalLength).toLocaleString()} mm`:points.length<2?'모서리를 두 점 이상 지정하세요.':'입력값과 경계 안내를 확인하세요.'}</span><p>두 구간 이상은 한 그룹으로 묶습니다. 적용 후 그룹 안 편집으로 구간별 길이·높이를 바꿀 수 있습니다.</p></div>
 {plan&&<div className={`wall-overlaps ${plan.overlaps.length?'has-overlaps':''}`}><b>새 외곽 겹침 {plan.overlaps.length}곳</b>{plan.overlaps.slice(0,4).map(c=><p key={`${c.a}-${c.b}`}>{c.names[0]} ↔ {c.names[1]}</p>)}{plan.overlaps.length>4&&<p>외 {plan.overlaps.length-4}곳</p>}<small>가구 외곽 기준입니다. 연결된 벽의 모서리 겹침은 이 미리보기에서 제외합니다.</small></div>}
 <p className="fineprint">각 구간은 별도 파티션입니다. 모서리 면 합치기는 지원하지 않습니다. 통로·문·창문은 적용 후 파티션 속성에서 추가하세요. 길이는 벽 중심선 기준입니다.</p></aside></div>
 {(error||candidate.error||stale)&&<p className="form-error" role="alert">{stale?'장면이 변경되었습니다. 창을 닫고 다시 그리세요.':[...new Set([error,candidate.error].filter(Boolean))].join(' ')}</p>}
 <div className="wall-footer"><p><span>3</span>3D에서 확인하고 적용하세요.</p><div><button className="outline-button" onClick={onClose}>취소</button><button className="primary-button" disabled={!plan||stale} onClick={()=>plan&&!stale&&onPreview(plan)}><Eye size={16}/>3D에서 확인</button></div></div>
 </DialogContent></Dialog>;
}
