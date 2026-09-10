'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Bookmark,Save,Search,Trash2,RefreshCw,LoaderCircle,Check,ImageIcon,Palette,ArrowDownToLine} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {materials,type MaterialFinish,type MaterialId} from '@/lib/scene-model';
import {validateMaterialPreset,toMaterialSample,type MaterialPreset,type MaterialPresetRow} from '@/lib/material-presets';
import type {MaterialSample} from '@/lib/material-transfer';
import './material-presets.css';

class PresetRequestError extends Error{constructor(message:string,public status?:number){super(message);}}
async function request<T>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,options),data=await response.json().catch(()=>null);
 if(!response.ok)throw new PresetRequestError(response.status===401?'로그인이 필요합니다. 앱을 새로고침한 뒤 보관함을 다시 여세요.':data?.error||'소재 보관함 요청을 처리하지 못했습니다.',response.status);
 if(data===null&&response.status!==204)throw new PresetRequestError('서버 응답을 확인하지 못했습니다. 다시 시도하세요.');
 return data as T;
}
function Swatch({material,finish,large=false}:{material:MaterialId;finish:MaterialFinish;large?:boolean}){
 const base=materials.find(m=>m.id===material)!,[failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[finish.textureId]);
 return <span className={`material-preset-swatch pattern-${base.pattern}${large?' large':''}`} style={{backgroundColor:finish.color??base.color}}>{finish.textureId&&!failed&&<img src={`/api/assets?id=${finish.textureId}`} alt="저장한 소재 이미지" loading="lazy" onError={()=>setFailed(true)}/>}<span className="material-preset-swatch-label">{finish.textureId?<><ImageIcon size={12}/>{failed?'이미지 미리보기 없음':'이미지 소재'}</>:base.group}</span></span>;
}
function FinishSummary({preset}:{preset:Pick<MaterialPreset,'material'|'finish'>}){
 const base=materials.find(m=>m.id===preset.material)!,f=preset.finish;
 return <dl className="material-preset-finish"><div><dt>기본 소재</dt><dd>{base.name}</dd></div><div><dt>반복 크기</dt><dd>{(f.scale??900).toLocaleString()} mm</dd></div><div><dt>결 방향</dt><dd>{f.rotation??0}°</dd></div><div><dt>거칠기 / 금속성</dt><dd>{Math.round((f.roughness??base.roughness)*100)}% / {Math.round((f.metalness??base.metalness)*100)}%</dd></div></dl>;
}
const normalized=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\s+/gu,'');

export default function MaterialPresetsDialog({sample,initialSave=false,onClose,onChoose}:{sample:MaterialSample|null;initialSave?:boolean;onClose:()=>void;onChoose:(sample:MaterialSample)=>void}){
 const [source]=useState(()=>sample?structuredClone(sample):null),[tab,setTab]=useState(initialSave?'save':'browse');
 const [name,setName]=useState(()=>(sample?.sourceName||materials.find(m=>m.id===sample?.material)?.name||'새 소재').slice(0,80)),[note,setNote]=useState('');
 const [items,setItems]=useState<MaterialPresetRow[]>([]),[selectedId,setSelectedId]=useState(''),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[remove,setRemove]=useState<MaterialPresetRow|null>(null);
 const alive=useRef(true),listSequence=useRef(0),operationSequence=useRef(0),flight=useRef(false),listController=useRef<AbortController|null>(null),operationController=useRef<AbortController|null>(null),saveAttempt=useRef<{id:string;preset:MaterialPreset}|null>(null);
 const captured=useMemo(()=>{if(!source)return{preset:null,error:''};try{return{preset:validateMaterialPreset({version:1,name,note,material:source.material,finish:structuredClone(source.finish)}),error:''};}catch(e){return{preset:null,error:e instanceof Error&&e.name!=='ZodError'?e.message:'소재 이름 1~80자와 메모 200자 이내를 확인하세요.'};}},[source,name,note]);
 const filtered=useMemo(()=>{const tokens=query.normalize('NFKC').trim().split(/\s+/u).filter(Boolean).map(normalized);return items.filter(({preset})=>{const fields=[preset.name,preset.note,materials.find(m=>m.id===preset.material)?.name??'',preset.material].map(normalized);return tokens.every(token=>fields.some(field=>field.includes(token)));});},[items,query]);
 const selected=filtered.find(item=>item.id===selectedId)??null;
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;listSequence.current++;operationSequence.current++;listController.current?.abort();operationController.current?.abort();};},[]);
 function invalidateList(){listSequence.current++;listController.current?.abort();setLoading(false);}
 function saved(row:MaterialPresetRow){setItems(old=>[row,...old.filter(item=>item.id!==row.id)]);setSelectedId(row.id);setQuery('');setTab('browse');setNotice(`‘${row.preset.name}’ 소재를 보관했습니다.`);setError('');setUncertain(false);saveAttempt.current=null;}
 async function load(){
  if(flight.current)return;const seq=++listSequence.current;listController.current?.abort();listController.current=new AbortController();setLoading(true);setError('');
  try{const data=await request<{presets:MaterialPresetRow[]}>('/api/material-presets',{signal:listController.current.signal});if(!Array.isArray(data.presets))throw new Error('보관함 목록을 읽지 못했습니다. 다시 불러오세요.');if(!alive.current||seq!==listSequence.current)return;setItems(data.presets);setSelectedId(id=>data.presets.some(item=>item.id===id)?id:data.presets[0]?.id??'');const confirmed=saveAttempt.current&&data.presets.find(item=>item.id===saveAttempt.current!.id);if(confirmed)saved(confirmed);
  }catch(e){if(alive.current&&seq===listSequence.current)setError(e instanceof Error?e.message:'소재를 불러오지 못했습니다.');}finally{if(alive.current&&seq===listSequence.current)setLoading(false);}
 }
 async function save(){
  if(flight.current||!source||(!saveAttempt.current&&!captured.preset))return;
  if(!saveAttempt.current)saveAttempt.current={id:crypto.randomUUID(),preset:structuredClone(captured.preset!)};
  const attempt=saveAttempt.current,seq=++operationSequence.current;flight.current=true;setBusy(true);setError('');setNotice('');invalidateList();operationController.current=new AbortController();
  try{const row=await request<MaterialPresetRow>('/api/material-presets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt),signal:operationController.current.signal});if(row?.id!==attempt.id||!row.preset)throw new Error('저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인하세요.');if(alive.current&&seq===operationSequence.current)saved(row);
  }catch(e){if(alive.current&&seq===operationSequence.current){const rejected=e instanceof PresetRequestError&&e.status!==undefined&&e.status>=400&&e.status<500&&e.status!==408;if(rejected){saveAttempt.current=null;setUncertain(false);}else setUncertain(true);setError(e instanceof Error?e.message:'소재 저장에 실패했습니다.');}}
  finally{if(seq===operationSequence.current){flight.current=false;if(alive.current)setBusy(false);}}
 }
 async function deletePreset(item:MaterialPresetRow){
  if(flight.current)return;const seq=++operationSequence.current;flight.current=true;setBusy(true);setError('');setNotice('');invalidateList();operationController.current=new AbortController();
  try{await request(`/api/material-presets?id=${item.id}`,{method:'DELETE',signal:operationController.current.signal});if(alive.current&&seq===operationSequence.current){setItems(old=>old.filter(row=>row.id!==item.id));setSelectedId(id=>id===item.id?'':id);setRemove(null);setNotice(`‘${item.preset.name}’을 보관함에서 삭제했습니다.`);}}
  catch(e){if(alive.current&&seq===operationSequence.current)setError(e instanceof Error?e.message:'소재를 삭제하지 못했습니다.');}
  finally{if(seq===operationSequence.current){flight.current=false;if(alive.current)setBusy(false);}}
 }
 function choose(){if(!selected||busy)return;try{onChoose(toMaterialSample(selected.preset,selected.id));}catch(e){setError(e instanceof Error?e.message:'소재를 가져오지 못했습니다. 보관함을 다시 불러오세요.');}}
 return <><Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="material-presets-dialog"><DialogHeader><DialogTitle>내 소재 보관함</DialogTitle><DialogDescription>매장에서 자주 쓰는 소재·색상·결 설정을 보관하고 다른 프로젝트에서도 꺼내 쓰세요.</DialogDescription></DialogHeader>
  <div className="material-presets-toolbar"><Tabs value={tab} onValueChange={value=>{setTab(value);setError('');}}><TabsList><TabsTrigger value="browse"><Bookmark size={15}/>보관한 소재 {items.length}</TabsTrigger><TabsTrigger value="save" disabled={!source}><Save size={15}/>복사한 소재 보관</TabsTrigger></TabsList></Tabs><button className="text-button" type="button" disabled={busy||loading} onClick={()=>void load()}><RefreshCw size={14}/>새로고침</button></div>
  {notice&&<p className="material-preset-notice" role="status"><Check size={15}/>{notice}</p>}
  {error&&<div className="material-preset-error" role="alert"><p>{error}</p>{!busy&&tab==='browse'&&<button className="text-button" onClick={()=>void load()}>다시 불러오기</button>}</div>}
  {tab==='save'?source?<div className="material-preset-save-layout"><section className="material-preset-source"><Swatch material={source.material} finish={source.finish} large/><span className="material-preset-source-label">복사 당시 소재</span><h3>{source.sourceName}</h3><FinishSummary preset={source}/><p>이 창을 열 때 복사한 소재를 보관합니다. 색상·이미지·반복 크기·결 방향·광택 설정이 함께 저장됩니다.</p></section><section className="material-preset-save-fields"><label className="field-label">소재 이름<input className="text-input" value={name} onChange={e=>{setName(e.target.value);setNotice('');}} maxLength={80} disabled={busy||uncertain} placeholder="예: OFD 카운터 오크"/></label><label className="field-label">사용 메모<textarea className="text-input" value={note} onChange={e=>setNote(e.target.value)} maxLength={200} rows={5} disabled={busy||uncertain} placeholder="적용 부위, 브랜드, 색상 참고 등"/><span className="material-preset-note-count">{note.length}/200</span></label><p className="fineprint">내 계정에 최대 100개를 보관합니다. 저장 후 ‘이 소재 가져오기’를 눌러 선택한 면이나 가구에 붙일 수 있습니다.</p>{captured.error&&!uncertain&&<p className="form-error" role="alert">{captured.error}</p>}{uncertain&&<p className="material-preset-pending">저장 결과를 아직 확인하지 못했습니다. 아래 버튼으로 같은 요청을 다시 확인하거나 보관함을 새로고침하세요.</p>}<button className="primary-button" type="button" disabled={busy||(!captured.preset&&!uncertain)||(items.length>=100&&!uncertain)} onClick={()=>void save()}>{busy?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>} {busy?'저장 확인 중…':uncertain?'같은 소재 저장 다시 확인':'소재 보관하기'}</button>{items.length>=100&&!uncertain&&<p className="fineprint">100개를 보관 중입니다. 사용하지 않는 소재를 삭제한 뒤 저장하세요.</p>}</section></div>:<div className="material-presets-empty"><Palette size={33}/><b>먼저 사용할 소재를 복사하세요</b><p>장면의 면이나 가구에서 ‘소재 복사’를 누른 뒤 보관함을 다시 여세요.</p></div>:<>
   <div className="material-presets-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} maxLength={200} placeholder="소재 이름·메모·기본 소재로 검색" aria-label="보관한 소재 검색"/><span>{filtered.length}개</span></div>
   <div className="material-presets-grid">{loading?<div className="material-presets-empty"><LoaderCircle className="spin" size={25}/><p>소재를 불러오는 중입니다.</p></div>:error&&!items.length?<div className="material-presets-empty"><RefreshCw size={28}/><b>소재 목록을 확인하지 못했습니다</b><p>다시 불러와 보관한 소재를 확인하세요.</p><button className="outline-button" onClick={()=>void load()}>다시 불러오기</button></div>:filtered.length?filtered.map(item=><article key={item.id} className={`material-preset-card${item.id===selectedId?' selected':''}`}><button type="button" className="material-preset-card-main" disabled={busy} aria-pressed={item.id===selectedId} onClick={()=>setSelectedId(item.id)}><Swatch material={item.preset.material} finish={item.preset.finish}/><span className="material-preset-card-title"><b>{item.preset.name}</b>{item.id===selectedId&&<Check size={14}/>}</span><small>{materials.find(m=>m.id===item.preset.material)?.name} · {(item.preset.finish.scale??900).toLocaleString()} mm</small>{item.preset.note&&<p>{item.preset.note}</p>}</button><button className="material-preset-delete" type="button" disabled={busy} aria-label={`${item.preset.name} 소재 삭제`} onClick={()=>{setRemove(item);setError('');}}><Trash2 size={14}/></button></article>):<div className="material-presets-empty"><Bookmark size={33}/><b>{query?'검색한 소재가 없습니다':'아직 보관한 소재가 없습니다'}</b><p>{query?'이름이나 메모를 짧게 입력해 보세요.':'장면에서 소재를 복사한 뒤 ‘복사한 소재 보관’에서 저장하세요.'}</p>{query?<button className="outline-button" onClick={()=>setQuery('')}>검색어 지우기</button>:source&&<button className="outline-button" onClick={()=>setTab('save')}>복사한 소재 보관하기</button>}</div>}</div>
   {selected&&!loading&&<div className="material-preset-selected"><div><h3>{selected.preset.name}</h3><FinishSummary preset={selected.preset}/>{selected.preset.note&&<p>{selected.preset.note}</p>}</div><button className="primary-button" type="button" disabled={busy} onClick={choose}><ArrowDownToLine size={16}/>이 소재 가져오기</button></div>}
   <p className="material-presets-help">소재를 가져오면 복사한 소재로 준비됩니다. 적용할 면이나 가구를 선택하고 ‘소재 붙이기’를 누르세요.</p>
  </>}
 </DialogContent></Dialog><AlertDialog open={!!remove} onOpenChange={open=>{if(!open&&!busy)setRemove(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>보관한 소재를 삭제할까요?</AlertDialogTitle><AlertDialogDescription>‘{remove?.preset.name}’을 보관함에서 삭제합니다. 이미 프로젝트에 적용한 소재와 원본 이미지는 유지됩니다.</AlertDialogDescription></AlertDialogHeader>{error&&<p className="form-error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>취소</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event=>{event.preventDefault();if(remove)void deletePreset(remove);}}>{busy?'삭제 중…':'소재 삭제'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
