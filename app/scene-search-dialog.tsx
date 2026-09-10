'use client';
import {useMemo,useRef,useState} from 'react';
import {Search,Box,Layers,EyeOff,Lock,ArrowUpRight,X} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {searchScene,sceneSearchFilters,type SceneSearchMode,type SceneSearchFilter,type SceneSearchRow} from '@/lib/scene-search';
import type {SceneData} from '@/lib/scene-model';
import './scene-search.css';

export default function SceneSearchDialog({scene,onClose,onChoose}:{scene:SceneData;onClose:()=>void;onChoose:(ids:string[])=>void}){
 const [query,setQuery]=useState(''),[mode,setMode]=useState<SceneSearchMode>('elements'),[filter,setFilter]=useState<SceneSearchFilter>('all');
 const input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
 const result=useMemo(()=>searchScene(scene,{query,mode,filter}),[scene,query,mode,filter]);
 const first=result.rows.find(row=>!row.disabled);
 function choose(row:SceneSearchRow){if(!row.disabled)onChoose([...row.ids]);}
 function focusResult(direction:number,current?:HTMLButtonElement){const buttons=Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button[data-search-result]:not(:disabled)')??[]);if(!buttons.length)return;const index=current?buttons.indexOf(current):-1,next=current?(index+direction+buttons.length)%buttons.length:direction>0?0:buttons.length-1;buttons[next].focus();}
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="scene-search-dialog" onOpenAutoFocus={event=>{event.preventDefault();input.current?.focus();}}><DialogHeader><DialogTitle>장면에서 찾기</DialogTitle><DialogDescription>가구 이름·종류·그룹·레이어로 검색하고 원하는 위치로 바로 이동하세요.</DialogDescription></DialogHeader>
  <div className="scene-search-input"><Search size={19}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 주방 카운터, 좌석, 미분류" aria-label="장면 요소 검색" maxLength={200} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.nativeEvent.keyCode===229)return;if(e.key==='Enter'&&first){e.preventDefault();choose(first);}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focusResult(e.key==='ArrowDown'?1:-1);}}}/>{query&&<button type="button" aria-label="검색어 지우기" onClick={()=>{setQuery('');input.current?.focus();}}><X size={16}/></button>}</div>
  <div className="scene-search-controls"><Tabs value={mode} onValueChange={value=>setMode(value as SceneSearchMode)}><TabsList><TabsTrigger value="elements"><Box size={14}/>개별 요소</TabsTrigger><TabsTrigger value="groups"><Layers size={14}/>그룹 전체</TabsTrigger></TabsList></Tabs><label><span className="sr-only">표시 및 잠금 필터</span><select value={filter} onChange={e=>setFilter(e.target.value as SceneSearchFilter)}>{Object.entries(sceneSearchFilters).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label></div>
  <div className="scene-search-result-heading"><b>{mode==='elements'?'요소':'그룹'} {result.total.toLocaleString()}개</b><span>{mode==='elements'?'그룹 안 가구도 개별 선택':'구성을 함께 선택'}</span></div>
  <div className="scene-search-results" ref={list} aria-label="검색 결과">
   {result.rows.map(row=><button type="button" data-search-result key={row.key} className="scene-search-result" disabled={row.disabled} onClick={()=>choose(row)} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();focusResult(e.key==='ArrowDown'?1:-1,e.currentTarget);}if(e.key==='Home'){e.preventDefault();focusResult(1);}if(e.key==='End'){e.preventDefault();focusResult(-1);}}}><span className="scene-search-kind">{row.mode==='groups'?<Layers size={18}/>:<Box size={18}/>}</span><span className="scene-search-result-copy"><strong>{row.name}</strong><span className="scene-search-badges">{row.mode==='groups'&&<span>{row.ids.length}개 구성</span>}<span>{row.kinds.join(' · ')}</span>{row.layers.map(layer=><span className="layer" key={layer}>{layer}</span>)}{row.groupName&&<span className="group"><Layers size={11}/>{row.groupName}</span>}</span>{row.hidden>0&&<small className="scene-search-hidden-note">{row.mode==='groups'?`숨긴 구성 ${row.hidden}개 · 레이어나 장면 목록에서 표시 후 선택`:'숨긴 요소 · 레이어나 장면 목록에서 표시 후 선택'}</small>}</span><span className="scene-search-result-state">{row.hidden>0&&<EyeOff size={15} aria-label="숨긴 요소 포함"/>}{row.locked>0&&<Lock size={15} aria-label="잠긴 요소 포함"/>}{!row.disabled&&<ArrowUpRight size={17} aria-hidden="true"/>}</span></button>)}
   {!result.rows.length&&<div className="scene-search-empty"><Search size={29}/><b>{query?'일치하는 항목이 없습니다':mode==='groups'?'저장된 그룹이 없습니다':'이 범위에 요소가 없습니다'}</b><p>{query?'가구 이름·종류·레이어 이름을 짧게 입력해 보세요.':mode==='groups'?'가구를 여러 개 선택해 그룹으로 묶을 수 있습니다.':'필터를 전체로 바꾸거나 가구를 추가해 보세요.'}</p>{(query||filter!=='all')&&<button className="outline-button" onClick={()=>{setQuery('');setFilter('all');input.current?.focus();}}>검색과 필터 초기화</button>}</div>}
  </div>
  {result.truncated&&<p className="scene-search-limit">검색 결과 중 {result.rows.length}개를 표시합니다. 검색어를 추가해 범위를 좁히세요.</p>}
  <div className="scene-search-footer"><p>{mode==='elements'?'개별 요소를 선택하면 그룹 안에서도 해당 가구를 편집합니다.':'숨긴 구성원이 포함된 그룹은 모두 표시한 뒤 선택할 수 있습니다.'}<br/>잠긴 요소는 찾아볼 수 있으며 잠금 상태가 유지됩니다.</p><span><kbd>↑ ↓</kbd> 이동 <kbd>Enter</kbd> 선택</span></div>
 </DialogContent></Dialog>;
}
