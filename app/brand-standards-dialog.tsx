'use client';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Store,Plus,Copy,Save,Trash2,ArrowRight,RefreshCw,ExternalLink,X} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {brandRoles,brandRoleNames,moduleNames,moduleGrades,moduleHints,ruleNames,zoneRuleNames,ofdBrand,validateBrand,brandScene,brandPlan,brandReplacementItems,type BrandRole,type BrandStandard,type BrandRow,type BrandRules,type ModuleKey,type PlanBand} from '@/lib/brand-standards';
import {brandGrades,brandGradeNames,entranceSides,entranceNames,type BrandGrade,type BrandReport,type BrandCheckStatus,type Entrance} from '@/lib/brand-application';
import {materialProduct,productFinish} from '@/lib/material-products';
import {materials,type SceneData} from '@/lib/scene-model';
import {randomId} from '@/lib/random-id';
import ProductMaterialDialog from './product-material-dialog';
import './brand-standards.css';

class BrandError extends Error{constructor(message:string,public status?:number){super(message)}}
async function api<T=unknown>(url:string,options?:RequestInit):Promise<T>{
  const r=await fetch(url,options),data=await r.json().catch(()=>null);
  if(!r.ok)throw new BrandError(data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'브랜드 저장소에 연결하지 못했습니다.',r.status);
  if(!data)throw new BrandError('저장 결과를 확인하지 못했습니다.');
  return data as T;
}
function checkedRow(v:BrandRow):BrandRow{
  if(!v.id||!Number.isInteger(v.revision)||v.revision<1)throw new Error('브랜드 응답을 확인하지 못했습니다.');
  return {...v,standard:validateBrand(v.standard)};
}

const ROOM_PRESETS:[number,number,string][]=[[5000,6600,'약 10평'],[6000,8300,'약 15평'],[7200,9200,'약 20평']];
const STATUS_LABEL:Record<BrandCheckStatus,string>={ok:'충족',warn:'조정 권장',fail:'미달',manual:'현장 확인'};
const BAND_FILL:Record<string,string>={Z6:'#e8e3d6',
  'Z2·Z3·Z4':'#f5e7c9',대기열:'#e4ecf3',Z5:'#e6efe4'};

export function Grade({grade}:{grade:BrandGrade}){return <span className={`brand-grade brand-grade-${grade}`} title={`${grade} · ${brandGradeNames[grade]}`}>{grade}</span>}
function Status({status}:{status:BrandCheckStatus}){return <span className={`brand-status brand-status-${status}`}>{STATUS_LABEL[status]}</span>}

/** Plan view of a candidate scene with the zone bands and the entrance aisle the planner reserved. */
export function BrandPlan({scene,bands,aisle}:{scene:SceneData;bands?:PlanBand[];aisle?:{x0:number;x1:number}}){
  const {width:w,depth:d}=scene.room;
  const toX=(x:number)=>x+w/2,toZ=(z:number)=>z+d/2;
  return <svg className="brand-plan" viewBox={`-350 -350 ${w+700} ${d+700}`} role="img" aria-label={`브랜드 배치 평면 미리보기, 가로 ${w}mm 세로 ${d}mm`}>
    <rect width={w} height={d} fill="#f2eee5" stroke="#6c7581" strokeWidth="40"/>
    {bands?.map(b=><g key={b.id}><rect x={60} y={toZ(b.z0)} width={w-120} height={b.z1-b.z0} fill={BAND_FILL[b.id]??'#eee'} opacity=".9"/><text x={w-110} y={toZ(b.z0)+150} textAnchor="end" fontSize="115" fill="#7c8595">{b.id} · {b.name}</text></g>)}
    {aisle&&<rect x={toX(aisle.x0)} y={toZ(bands?bands[bands.length-1].z0:0)} width={aisle.x1-aisle.x0} height={bands?bands[bands.length-1].z1-bands[bands.length-1].z0:d/2} fill="#ffffff" opacity=".55" stroke="#9aa5b5" strokeWidth="12" strokeDasharray="60 40"/>}
    {scene.nodes.filter(n=>!n.hidden).map(n=>{
      const x=n.host==='left'?0:n.host==='right'?w:n.x+w/2,z=n.host==='front'?d:n.host==='back'?0:n.z+d/2,rotation=n.host==='left'||n.host==='right'?90:-n.rotation;
      const fill=n.material==='glass'?'#cfe3ec':n.finish?.color??materials.find(m=>m.id===n.material)?.color??'#abb1bc';
      return <g key={n.id} transform={`translate(${x} ${z}) rotate(${rotation})`}><rect x={-n.width/2} y={-n.depth/2} width={n.width} height={n.depth} fill={fill} stroke="#3c4d62" strokeWidth={n.kind==='pendant'?6:16} opacity={n.kind==='pendant'?.6:1}/><title>{`${n.group?`${n.group.name} · `:''}${n.name} · ${n.width} × ${n.depth}mm`}</title></g>;
    })}
    <text x={w/2} y={-100} textAnchor="middle" fontSize="150" fill="#586273">{w.toLocaleString()} mm</text>
    <text x={w/2} y={d+230} textAnchor="middle" fontSize="150" fill="#586273">입구 · {d.toLocaleString()} mm 깊이</text>
  </svg>;
}

/** The planner's validation report: zones, circulation, seats, equipment, manual checks and warnings. */
export function BrandReportView({report}:{report:BrandReport}){
  return <div className="brand-report" aria-label="브랜드 배치 검증 리포트">
    <div className="brand-report-head">
      <b>Type {report.storeType} · {report.storeTypeName}</b>
      <span>{report.pyeong}평 · {report.areaM2}㎡ · 좌석 {report.seats.total}석{report.seats.total?` (창가 ${report.seats.windowBar} · 벤치 ${report.seats.bench})`:''}</span>
      <small>{report.manual} 기준</small>
    </div>
    {report.warnings.length>0&&<ul className="brand-report-warnings">{report.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
    <h4>존 면적 배분 <small>내부 유효면적 기준 · 진열 존은 대기열 앞 공간 포함</small></h4>
    <div className="brand-zones">{report.zones.map(z=><div className="brand-zone" key={z.id}>
      <span className="brand-zone-name">{z.id} {z.name}</span>
      <span className="brand-zone-bar"><i style={{width:`${Math.min(100,z.ratio)}%`}} className={`brand-status-bg-${z.status}`}/></span>
      <span className="brand-zone-value">{z.ratio}% <small>{z.max>=100?`${z.min}%↑`:`${z.min}~${z.max}%`}</small></span>
      <Status status={z.status}/>
    </div>)}</div>
    <h4>동선</h4>
    <div className="brand-aisles">{report.aisles.map(a=><div key={a.name}><span>{a.name}</span><b>{a.actual.toLocaleString()}mm</b><small>기준 {a.required.toLocaleString()}</small><Status status={a.status}/></div>)}</div>
    <h4>설비 구성</h4>
    <ul className="brand-equipment">{report.equipment.map(e=><li key={e.name} title={e.note}><Grade grade={e.grade}/><span>{e.name}</span><b>×{e.count}</b><small>{e.note}</small></li>)}</ul>
    <h4>매뉴얼 체크 <small>고정 [F] · 표준 [S] · 재량 [O]</small></h4>
    <ul className="brand-checks">{report.checks.map(c=><li key={c.label}><Grade grade={c.grade}/><span>{c.label}</span><Status status={c.status}/></li>)}</ul>
  </div>;
}

function NumberField({label,value,min,max,step=10,onChange,children}:{label:ReactNode;value:number;min:number;max:number;step?:number;onChange:(v:number)=>void;children?:ReactNode}){
  return <label>{label}{children}<input type="number" className="text-input" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}

export default function BrandStandardsDialog({scene,onClose,onPreview}:{scene:SceneData;onClose:()=>void;onPreview:(candidate:SceneData,title:string,details:string)=>void}){
  const [items,setItems]=useState<BrandRow[]>([]);
  const [standard,setStandard]=useState<BrandStandard>(ofdBrand);
  const [record,setRecord]=useState<{id:string;revision:number}>({id:'ofd-starter',revision:0});
  const [saved,setSaved]=useState(()=>JSON.stringify(ofdBrand()));
  const [tab,setTab]=useState('apply');
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [picker,setPicker]=useState<BrandRole|null>(null);
  const [pending,setPending]=useState(false);
  const [confirm,setConfirm]=useState<{title:string;description:string;action:()=>void}|null>(null);
  const [room,setRoom]=useState({width:scene.room.width,depth:scene.room.depth,height:scene.room.height});
  const [mode,setMode]=useState<'surfaces'|'layout'>('layout');
  const [entrance,setEntrance]=useState<Entrance>('left');
  const [seating,setSeating]=useState(true);
  const [replace,setReplace]=useState(false);
  const flight=useRef(false),mounted=useRef(true),saveAttempt=useRef<{id:string;revision:number;standard:BrandStandard}|null>(null),loadSequence=useRef(0);
  const dirty=JSON.stringify(standard)!==saved,replacementItems=brandReplacementItems(scene),needsReplacement=replacementItems.length>0;

  async function load(signal?:AbortSignal){
    const seq=++loadSequence.current;
    try{const data=await api<{brands:BrandRow[]}>('/api/brands',{signal});if(mounted.current&&seq===loadSequence.current){setItems(data.brands.map(checkedRow));setError('');}}
    catch(e){if(mounted.current&&seq===loadSequence.current&&!(e instanceof Error&&e.name==='AbortError'))setError((e as Error).message+' OFD 표준은 바로 편집·미리보기할 수 있습니다.');}
    finally{if(mounted.current&&seq===loadSequence.current)setLoading(false)}
  }
  useEffect(()=>{
    mounted.current=true;
    const abort=new AbortController();
    queueMicrotask(()=>{if(mounted.current)void load(abort.signal)}); // the fetch resolves asynchronously; nothing sets state during the effect itself
    return()=>{mounted.current=false;abort.abort()};
  },[]);

  function choose(s:BrandStandard,id='ofd-starter',revision=0){
    const action=()=>{setStandard(structuredClone(s));setRecord({id,revision});setSaved(JSON.stringify(s));setNotice('');setError('');setPending(false);saveAttempt.current=null;setConfirm(null)};
    if(dirty||pending)setConfirm({title:'편집 중인 내용을 닫을까요?',description:'저장하지 않은 브랜드 변경은 사라집니다. 저장된 브랜드와 현재 도면은 유지됩니다.',action});else action();
  }
  function close(){if(busy)return;if(dirty||pending)setConfirm({title:'브랜드 편집을 닫을까요?',description:'저장하지 않은 변경은 사라집니다. 저장 결과를 확인하지 못했다면 먼저 같은 요청을 다시 확인하세요.',action:onClose});else onClose()}
  function patch(value:Partial<BrandStandard>){setStandard(s=>({...s,...value}));setNotice('')}
  function updateSlot(role:BrandRole,value:Partial<BrandStandard['materials'][BrandRole]>){patch({materials:{...standard.materials,[role]:{...standard.materials[role],...value}}})}
  function updateModule(key:ModuleKey,value:Partial<BrandStandard['modules'][ModuleKey]>){patch({modules:{...standard.modules,[key]:{...standard.modules[key],...value}}})}
  function updateRules(value:Partial<BrandRules>){patch({rules:{...standard.rules,...value}})}
  function updateZone(zone:keyof BrandRules['zones'],value:Partial<BrandRules['zones'][keyof BrandRules['zones']]>){updateRules({zones:{...standard.rules.zones,[zone]:{...standard.rules.zones[zone],...value}}})}
  function updateChecklist(list:BrandRules['checklist']){updateRules({checklist:list})}

  async function save(copy=false){
    if(flight.current)return;
    let payload=saveAttempt.current;
    try{if(!payload){payload={id:copy||record.revision===0?randomId():record.id,revision:copy?0:record.revision,standard:validateBrand(standard)};saveAttempt.current=payload;}}
    catch{setError('이름, 소재 설정, 모듈 치수, 배치 규칙 범위를 확인하세요.');return}
    flight.current=true;setBusy(true);setError('');
    try{
      const result=checkedRow(await api<BrandRow>('/api/brands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
      if(!mounted.current)return;
      loadSequence.current++;setLoading(false);
      setItems(list=>[result,...list.filter(i=>i.id!==result.id)]);setStandard(result.standard);setRecord({id:result.id,revision:result.revision});setSaved(JSON.stringify(result.standard));setPending(false);saveAttempt.current=null;setNotice(`내 계정에 저장됨 · v${result.revision}`);
    }catch(e){
      if(!mounted.current)return;
      if(e instanceof BrandError&&e.status&&e.status<500&&e.status!==408){saveAttempt.current=null;setPending(false);}else setPending(true);
      setError((e as Error).message);
    }finally{flight.current=false;if(mounted.current)setBusy(false)}
  }
  function remove(){
    setConfirm({title:`‘${standard.name}’을 삭제할까요?`,description:'브랜드 보관함에서 삭제합니다. 이미 적용한 프로젝트의 소재와 배치는 유지됩니다.',action:()=>void (async()=>{
      if(flight.current)return;flight.current=true;loadSequence.current++;setLoading(false);setBusy(true);
      try{await api(`/api/brands?id=${record.id}&revision=${record.revision}`,{method:'DELETE'});setItems(list=>list.filter(i=>i.id!==record.id));const s=ofdBrand();setStandard(s);setSaved(JSON.stringify(s));setRecord({id:'ofd-starter',revision:0});setConfirm(null);setError('');setNotice('브랜드를 삭제했습니다.');}
      catch(e){setError((e as Error).message);setConfirm(null)}
      finally{flight.current=false;if(mounted.current)setBusy(false)}
    })()});
  }

  const options=useMemo(()=>({entrance,seating}),[entrance,seating]);
  const planned=useMemo(()=>{
    try{
      const candidate=brandScene(scene,standard,{id:record.id,revision:dirty?0:record.revision},mode,room,true,options);
      const plan=mode==='layout'?brandPlan(standard,room,options):null;
      return {scene:candidate,report:plan?.report??null,bands:plan?.bands,aisle:plan?.aisle,error:''};
    }catch(e){return {scene:null,report:null,bands:undefined,aisle:undefined,error:e instanceof Error&&e.name!=='ZodError'?e.message:'상가·모듈 치수, 배치 규칙, 소재 설정을 확인하세요.'}}
  },[scene,standard,record,dirty,mode,room,options]);

  function preview(){
    if(!planned.scene)return;
    if(mode==='layout'&&needsReplacement&&!replace){setError('기존 배치를 표준 매장 시안으로 교체하는 항목에 동의하세요.');return}
    const r=planned.report;
    const summary=mode==='layout'&&r
      ?`${room.width.toLocaleString()} × ${room.depth.toLocaleString()} mm · Type ${r.storeType} ${r.pyeong}평 · 출입구 ${entranceNames[entrance]} · 좌석 ${r.seats.total}석 · 진열 ${r.zones[0].ratio}% · 요소 ${planned.scene.nodes.length}개${r.warnings.length?` · 확인 ${r.warnings.length}건`:''} · ${replacementItems.length?replacementItems.join(' · ')+' 교체·초기화':'빈 상가에 새 배치'}`
      :'바닥과 벽 5면 변경 · 기존 가구 유지';
    onPreview(planned.scene,`${standard.name} · ${mode==='layout'?'표준 매장 배치':'마감 적용'}`,`${summary} · ${record.revision&&!dirty?'보관본 v'+record.revision:'저장 전 초안'} · ${standard.status==='draft'?'브랜드 검토 필요':'사용자 검토 완료'}`);
  }

  const checklist=standard.rules.checklist;
  return <>
    <Dialog open={!picker&&!confirm} onOpenChange={o=>!o&&!picker&&!confirm&&close()}>
      <DialogContent className="brand-dialog" showCloseButton={!busy}>
        <DialogHeader><DialogTitle><Store size={21}/>브랜드 스튜디오</DialogTitle><DialogDescription>브랜드의 소재·설비·배치 규칙을 보관하고, 상가 치수와 출입구 위치만으로 표준 매장을 생성합니다.</DialogDescription></DialogHeader>
        <div className="brand-workspace">
          <aside className="brand-sidebar">
            <div className="brand-side-label">브랜드별 관리 <button aria-label="브랜드 목록 새로고침" disabled={busy||pending} onClick={()=>{setLoading(true);void load()}}><RefreshCw size={14}/></button></div>
            <input className="text-input" aria-label="브랜드 검색" placeholder="브랜드 검색" value={query} onChange={e=>setQuery(e.target.value)}/>
            <button className={`brand-list-item ${record.id==='ofd-starter'?'active':''}`} disabled={busy} onClick={()=>choose(ofdBrand())}><b>올드페리도넛</b><small>시공매뉴얼 v1.0 기준 표준</small></button>
            {items.filter(r=>r.standard.name.toLowerCase().includes(query.toLowerCase())).map(r=><button key={r.id} disabled={busy} className={`brand-list-item ${record.id===r.id?'active':''}`} onClick={()=>choose(r.standard,r.id,r.revision)}><b>{r.standard.name}</b><small>v{r.revision} · {r.standard.status==='draft'?'검토 중':'사용자 검토 완료'}</small></button>)}
            {loading&&<p className="fineprint">보관한 브랜드 불러오는 중…</p>}
            <button className="outline-button full" disabled={busy||pending} onClick={()=>{const s=ofdBrand();s.name='새 브랜드';s.note='브랜드의 소재·설비·배치 규칙을 입력하세요. 초기 소재·치수·동선값은 OFD 매뉴얼 기준 제안값이며 현장 확인 항목은 비어 있습니다.';s.referenceUrl='';s.rules={...s.rules,source:'',checklist:[]};choose(s,'new-brand')}}><Plus size={15}/>새 브랜드</button>
            <p className="fineprint">내 계정에 최대 50개<br/>브랜드 저장과 프로젝트 저장은 별개입니다.</p>
          </aside>
          <section className="brand-main">
            <div className="brand-title-row">
              <div><h2>{standard.name}</h2><span className="brand-badge">{standard.status==='draft'?'디자이너 초안 · 검토 필요':'사용자 검토 완료'}</span><small>{dirty?'저장하지 않은 변경':record.revision?`보관본 v${record.revision}`:'아직 보관하지 않은 초안'}</small></div>
              <button className="primary-button" disabled={busy} onClick={()=>void save()}><Save size={15}/>{busy?'저장 확인 중…':pending?'같은 저장 다시 확인':'브랜드 저장'}</button>
            </div>
            {error&&<p className="brand-error" role="alert">{error}</p>}{notice&&<p className="brand-notice" role="status">{notice}</p>}{pending&&<p className="brand-error">저장 결과가 불확실합니다. 입력은 유지되며, 같은 저장 요청을 다시 확인할 수 있습니다.</p>}
            <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="apply">1. 표준 매장 만들기</TabsTrigger><TabsTrigger value="standards">2. 브랜드 표준 편집</TabsTrigger></TabsList></Tabs>

            {tab==='standards'?<fieldset disabled={busy||pending} className="brand-fields">
              <div className="brand-info">
                <label className="field-label">브랜드 이름<input className="text-input" value={standard.name} maxLength={80} onChange={e=>patch({name:e.target.value})}/></label>
                <label className="field-label">검토 상태<select className="text-input" value={standard.status} onChange={e=>patch({status:e.target.value as BrandStandard['status']})}><option value="draft">디자이너 초안</option><option value="reviewed">사용자 검토 완료</option></select></label>
                <label className="field-label brand-wide">기준·주의사항<textarea className="text-input" rows={2} maxLength={1000} value={standard.note} onChange={e=>patch({note:e.target.value})}/></label>
                <label className="field-label brand-wide">브랜드 참고 주소<input className="text-input" placeholder="https://" value={standard.referenceUrl} maxLength={500} onChange={e=>patch({referenceUrl:e.target.value})}/></label>
              </div>

              <div className="brand-section-title"><h3>표준 소재 {brandRoles.length}개 부위</h3><span>제품 이미지를 눌러 코드 변경</span></div>
              <div className="brand-materials">{brandRoles.map(role=>{const s=standard.materials[role],p=materialProduct(s.finish.catalogId);return <article className="brand-material" key={role}>
                <button className="brand-swatch" onClick={()=>setPicker(role)} aria-label={`${brandRoleNames[role]} 제품 변경`} style={{background:s.finish.color??'#e6e0d4'}}>{p?.image?<img src={p.image} alt={`${p.brand} ${p.code}`} loading="lazy"/>:<span>{s.finish.color}</span>}</button>
                <div><h4>{brandRoleNames[role]}</h4><b>{p?`${p.brand} · ${p.code}`:'조색 코드 미지정'}</b><small>{p?.name??'시각화용 제안 색상'}</small><button className="text-button" onClick={()=>setPicker(role)}>제품 선택</button>{p&&<a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-button">제조사 <ExternalLink size={11}/></a>}
                  <label className="brand-color"><input type="color" aria-label={`${brandRoleNames[role]} 제안 색상`} value={s.finish.color??'#eeeeee'} onChange={e=>updateSlot(role,{material:role==='metal'?'steel':role==='fabric'?'linen':role==='wood'||role==='counterFront'||role==='accent'?'walnut':'plaster',finish:{color:e.target.value},note:'직접 지정한 시각화 색상 · 제조사 조색 코드 미지정.'})}/>직접 색상 지정</label></div>
                <label className="field-label brand-wide">적용 기준<textarea className="text-input" rows={2} aria-label={`${brandRoleNames[role]} 적용 기준`} maxLength={300} value={s.note} onChange={e=>updateSlot(role,{note:e.target.value})}/></label>
              </article>})}</div>

              <div className="brand-section-title"><h3>배치 규칙</h3><span>{standard.rules.source||'출처 미기재'} · 단위 mm</span></div>
              <div className="brand-rules">
                <label className="brand-wide">규칙 출처<input className="text-input" maxLength={120} value={standard.rules.source} onChange={e=>updateRules({source:e.target.value})}/></label>
                <div className="brand-dimensions brand-rule-grid">
                  <NumberField label={<>{ruleNames.aisleMain} <Grade grade="F"/></>} value={standard.rules.aisleMain} min={600} max={3000} onChange={v=>updateRules({aisleMain:v})}/>
                  <NumberField label={<>{ruleNames.aisleSub} <Grade grade="F"/></>} value={standard.rules.aisleSub} min={600} max={3000} onChange={v=>updateRules({aisleSub:v})}/>
                  <NumberField label={<>{ruleNames.queueDepth} <Grade grade="F"/></>} value={standard.rules.queueDepth} min={0} max={6000} onChange={v=>updateRules({queueDepth:v})}/>
                  <NumberField label={<>{ruleNames.doorWidth} <Grade grade="O"/></>} value={standard.rules.doorWidth} min={700} max={2400} onChange={v=>updateRules({doorWidth:v})}/>
                  <NumberField label={<>{ruleNames.lightingWarmth} K <Grade grade="F"/></>} value={standard.rules.lightingWarmth} min={2700} max={6500} step={100} onChange={v=>updateRules({lightingWarmth:v})}/>
                </div>
                <div className="brand-zone-rules">{(Object.keys(zoneRuleNames) as (keyof BrandRules['zones'])[]).map(zone=><div key={zone}><span>{zoneRuleNames[zone]} <Grade grade="F"/></span>
                  <NumberField label="최소 %" value={standard.rules.zones[zone].min} min={0} max={100} step={1} onChange={v=>updateZone(zone,{min:v})}/>
                  <NumberField label="최대 %" value={standard.rules.zones[zone].max} min={0} max={100} step={1} onChange={v=>updateZone(zone,{max:v})}/></div>)}</div>
                <p className="fineprint">진열 존 최소 비율은 고정 규칙입니다. 확보되지 않으면 배치를 생성하지 않고 필요한 폭을 안내합니다. 다른 존은 목표 범위를 벗어나면 조정 권장으로 표시합니다.</p>
                <div className="brand-section-title"><h3>현장 확인 항목</h3><span>3D로 검증할 수 없는 사양 · 리포트에 그대로 표시</span></div>
                <ul className="brand-checklist">{checklist.map((c,i)=><li key={i}>
                  <select className="text-input" aria-label={`항목 ${i+1} 등급`} value={c.grade} onChange={e=>updateChecklist(checklist.map((x,j)=>j===i?{...x,grade:e.target.value as BrandGrade}:x))}>{brandGrades.map(g=><option key={g} value={g}>{g} · {brandGradeNames[g]}</option>)}</select>
                  <input className="text-input" aria-label={`항목 ${i+1} 내용`} maxLength={80} value={c.label} onChange={e=>updateChecklist(checklist.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
                  <button className="text-button" aria-label={`항목 ${i+1} 삭제`} onClick={()=>updateChecklist(checklist.filter((_,j)=>j!==i))}><X size={13}/></button>
                </li>)}</ul>
                {checklist.length<12&&<button className="outline-button" onClick={()=>updateChecklist([...checklist,{grade:'S',label:'새 확인 항목'}])}><Plus size={14}/>항목 추가</button>}
              </div>

              <div className="brand-section-title"><h3>설비 모듈</h3><span>단위 mm · 좁은 상가에서는 표시된 최소 폭까지 자동 축소</span></div>
              <div className="brand-modules">{(Object.keys(moduleNames) as ModuleKey[]).map(key=>{const m=standard.modules[key];return <article key={key}>
                <label className="brand-toggle"><input type="checkbox" checked={m.enabled} disabled={key==='showcase'||key==='counter'} onChange={e=>updateModule(key,{enabled:e.target.checked})}/><b>{moduleNames[key]}</b><Grade grade={moduleGrades[key]}/></label>
                <p className="fineprint">{moduleHints[key]}</p>
                <div className="brand-dimensions">{([['width',key==='seating'||key==='windowBar'?'최대 길이':key==='showcase'?'선호 모듈 폭':'가로',600,5000,key==='showcase'?300:10],['height','높이',400,2400,10],['depth','깊이',300,1200,10]] as const).map(([prop,label,min,max,step])=><NumberField key={prop} label={label} value={m[prop]} min={min} max={max} step={step} onChange={v=>updateModule(key,{[prop]:v})}/>)}</div>
                <textarea className="text-input" aria-label={`${moduleNames[key]} 기준 메모`} rows={2} value={m.note} maxLength={300} onChange={e=>updateModule(key,{note:e.target.value})}/>
              </article>})}</div>
              <div className="brand-manage-actions"><button className="outline-button" onClick={()=>void save(true)}><Copy size={15}/>다른 브랜드로 복제 저장</button><button className="text-button" disabled={!record.revision} onClick={remove}><Trash2 size={14}/>이 브랜드 삭제</button></div>
              <p className="fineprint">‘사용자 검토 완료’는 본사 공식 인증을 뜻하지 않습니다. 제품 채택·수량·시공 적합성은 별도로 확인하세요.</p>
            </fieldset>

            :<div className="brand-apply">
              <div>
                <h3>상가 조건</h3>
                <label className="field-label">적용 방법<select className="text-input" aria-label="브랜드 적용 방법" value={mode} onChange={e=>{setMode(e.target.value as typeof mode);setReplace(false)}}><option value="layout">빈 상가에 표준 매장 생성 (소재 + 설비 배치)</option><option value="surfaces">현재 공간의 바닥·벽만 교체</option></select></label>
                {mode==='layout'&&<>
                  <div className="brand-room-presets">{ROOM_PRESETS.map(([w,d,label])=><button className={`outline-button ${room.width===w&&room.depth===d?'active':''}`} key={label} onClick={()=>setRoom(r=>({...r,width:w,depth:d}))}>{label}</button>)}</div>
                  <div className="brand-dimensions">{([['width','가로',2400,20000],['depth','세로',2400,20000],['height','층고',2200,6000]] as const).map(([key,label,min,max])=><label key={key}>{label} mm<input className="text-input" type="number" aria-label={`상가 ${label}`} value={room[key]} min={min} max={max} onChange={e=>setRoom({...room,[key]:Number(e.target.value)})}/></label>)}</div>
                  <p>{(room.width*room.depth/1e6).toFixed(2)} ㎡ · 약 {(room.width*room.depth/3305785).toFixed(1)}평</p>
                  <div className="brand-store-options">
                    <label className="field-label">출입구 위치 (전면)<select className="text-input" aria-label="출입구 위치" value={entrance} onChange={e=>setEntrance(e.target.value as Entrance)}>{entranceSides.map(side=><option key={side} value={side}>{entranceNames[side]}</option>)}</select></label>
                    <label className="brand-toggle"><input type="checkbox" checked={seating} onChange={e=>setSeating(e.target.checked)}/><b>좌석 포함</b><small>창가 바 · 벽면 벤치</small></label>
                  </div>
                  <p className="fineprint">직사각형 계획 치수입니다. 출입구는 전면 벽 기준이며 진열은 출입구 쪽부터 시작합니다. 실제 벽·기둥·설비·출입 조건은 실측 후 조정하세요.</p>
                  {needsReplacement&&<label className="brand-replace"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/><span>{replacementItems.join(' · ')}을 새 배치로 교체·초기화합니다. 적용 후 실행 취소할 수 있습니다.</span></label>}
                </>}
                <div className="brand-apply-note"><b>{standard.status==='draft'?'검토 중인 디자인 초안':'사용자가 검토한 기준'}</b><p>{standard.note}</p>{standard.referenceUrl.startsWith('https://')&&<a href={standard.referenceUrl} target="_blank" rel="noreferrer">브랜드 참고 페이지 <ExternalLink size={12}/></a>}</div>
                {mode==='layout'&&planned.report&&<BrandReportView report={planned.report}/>}
              </div>
              <div className="brand-plan-panel">
                {planned.scene?<BrandPlan scene={planned.scene} bands={planned.bands} aisle={planned.aisle}/>:<div className="brand-plan-error" role="alert">{planned.error}</div>}
                <p>배치 검토용 평면 · 띠는 존 구분, 점선은 출입구 주통로 · 소재 결·실제 시공 치수는 3D와 도면에서 확인</p>
                <button className="primary-button full" disabled={busy||pending||!planned.scene||(mode==='layout'&&needsReplacement&&!replace)} onClick={preview}>이 구성으로 미리보기 <ArrowRight size={16}/></button>
                <p className="fineprint">미리보기의 ‘이대로 적용’을 눌러야 현재 디자인이 변경됩니다.</p>
              </div>
            </div>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
    {picker&&<ProductMaterialDialog selectionOnly shortlist={[]} onShortlistChange={()=>false} currentId={standard.materials[picker].finish.catalogId} target={`${standard.name} · ${brandRoleNames[picker]}`} onClose={()=>setPicker(null)} onApply={async p=>{updateSlot(picker,{material:p.base,finish:productFinish(p),note:`${p.brand} ${p.code} ${p.name} 제안 · 적용 사양과 실물 샘플 확인.`});return true}}/>}
    <AlertDialog open={!!confirm} onOpenChange={open=>!open&&!busy&&setConfirm(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>취소</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();confirm?.action()}}>계속</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
