'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {Check,ExternalLink,Search,LoaderCircle,PackageOpen,ChevronLeft,ChevronRight} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {materialProducts,materialProduct,searchMaterialProducts,type MaterialProduct} from '@/lib/material-products';
import {samhwaBooks,samhwaManifest} from '@/lib/samhwa-colors';
import './product-materials.css';
const PAGE_SIZE=60;
const brands=[...new Set(materialProducts.map(p=>p.brand))],categories=[...new Set(materialProducts.map(p=>p.appearance))];
export default function ProductMaterialDialog({currentId,target,onClose,onApply}:{currentId?:string|null;target:string;onClose:()=>void;onApply:(p:MaterialProduct)=>Promise<boolean>}){
 const [brand,setBrand]=useState(materialProduct(currentId)?.brand??'전체'),[category,setCategory]=useState('전체'),[book,setBook]=useState('전체'),[query,setQuery]=useState(''),[selected,setSelected]=useState(currentId??materialProducts[0]?.id),[loaded,setLoaded]=useState<string|null>(null),[imageError,setImageError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(()=>{const current=materialProduct(currentId);return current?Math.floor(Math.max(0,materialProducts.filter(p=>p.brand===current.brand).findIndex(p=>p.id===current.id))/PAGE_SIZE):0});
 const grid=useRef<HTMLDivElement>(null),flight=useRef(false);
 const filtered=useMemo(()=>searchMaterialProducts({brand,category,book,query}),[brand,category,book,query]);
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),safePage=Math.min(page,pageCount-1),visible=filtered.slice(safePage*PAGE_SIZE,(safePage+1)*PAGE_SIZE);
 const item=visible.find(p=>p.id===selected)??visible[0],isColor=item?.kind==='color',ready=!!item&&(isColor?!!item.previewColor:loaded===item.id);
 useEffect(()=>{setImageError(false);setError('');},[item?.id]);
 useEffect(()=>{if(grid.current)grid.current.scrollTop=0;},[safePage,brand,category,book,query]);
 function reset(){setQuery('');setBrand('전체');setCategory('전체');setBook('전체');setPage(0)}
 async function apply(){if(!item||!ready||flight.current)return;flight.current=true;setBusy(true);setError('');try{if(await onApply(item))onClose();}catch(e){setError(e instanceof Error?e.message:'소재를 적용하지 못했습니다.');}finally{flight.current=false;setBusy(false);}}
 return <Dialog open onOpenChange={o=>!o&&!busy&&onClose()}><DialogContent className="product-material-dialog" showCloseButton={!busy}>
  <DialogHeader><DialogTitle>실제 마감재 라이브러리</DialogTitle><DialogDescription>제조사 제품·색상 코드로 찾고, 선택한 면에 적용하세요.</DialogDescription></DialogHeader>
  <div className="product-library-layout"><section className="product-browser">
   <button className="samhwa-entry" disabled={busy} onClick={()=>{setBrand('삼화페인트');setBook('전체');setCategory('전체');setQuery('');setPage(0)}}><span className="samhwa-mini-swatches" aria-hidden="true"><i/><i/><i/><i/></span><span><b>삼화페인트 전체 컬러</b><small>{samhwaManifest.totalRecords.toLocaleString()}개 항목 · 컬러북별 공식 색상</small></span><ChevronRight size={17}/></button>
   <div className="product-search"><Search size={18}/><input autoFocus aria-label="브랜드 제품 코드 검색" placeholder="코드, 색상명, 컬러북 페이지, HEX 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} disabled={busy}/></div>
   <div className="product-filter"><label>브랜드<select aria-label="마감재 브랜드" value={brand} onChange={e=>{setBrand(e.target.value);setBook('전체');setPage(0)}} disabled={busy}>{['전체',...brands].map(b=><option key={b}>{b}</option>)}</select></label><label>무늬·소재<select aria-label="마감재 무늬와 소재" value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}} disabled={busy}>{['전체',...categories].map(c=><option key={c}>{c}</option>)}</select></label></div>
   {(brand==='삼화페인트'||brand==='전체')&&<label className="samhwa-book-filter">삼화 컬러북<select aria-label="삼화페인트 컬러북" value={book} disabled={busy} onChange={e=>{setBook(e.target.value);setPage(0)}}><option value="전체">전체 컬러북</option>{Object.entries(samhwaBooks).map(([key,label])=><option key={key} value={key}>{label} · {samhwaManifest.bookCounts[key as keyof typeof samhwaManifest.bookCounts].toLocaleString()}개</option>)}</select></label>}
   <p className="product-results" role="status">검색 {filtered.length.toLocaleString()}개 <span>{filtered.length?`${safePage*PAGE_SIZE+1}–${Math.min((safePage+1)*PAGE_SIZE,filtered.length)} 표시`:'0개 표시'} · {brands.length}개 브랜드</span></p>
   <div className="product-grid" ref={grid}>{visible.map(p=><button key={p.id} className={`product-card${item?.id===p.id?' selected':''}`} aria-pressed={item?.id===p.id} aria-label={`${p.brand} ${p.code} ${p.name} ${p.collection}`} onClick={()=>setSelected(p.id)} disabled={busy}>
    <div className={p.kind==='color'&&!p.previewColor?'color-unavailable':''} style={p.kind==='color'&&p.previewColor?{background:p.previewColor}:undefined}>{p.image&&<img src={p.image} alt={`${p.brand} ${p.code} 공식 제품 스와치`} loading="lazy"/>}{p.kind==='color'&&!p.previewColor&&<em>색상값 미제공</em>}{currentId===p.id&&<span><Check size={13}/>적용 중</span>}</div>
    <small>{p.kind==='color'?p.collection:`${p.brand} · ${p.appearance}`}</small><b>{p.code}</b><p>{p.name}</p>
   </button>)}</div>
   {!!filtered.length&&<nav className="product-pagination" aria-label="소재 검색 페이지"><button aria-label="이전 소재 페이지" disabled={busy||safePage===0} onClick={()=>setPage(safePage-1)}><ChevronLeft size={15}/>이전</button><label><select aria-label="소재 페이지 선택" disabled={busy} value={safePage} onChange={e=>setPage(Number(e.target.value))}>{Array.from({length:pageCount},(_,i)=><option key={i} value={i}>{i+1} / {pageCount} 페이지</option>)}</select></label><button aria-label="다음 소재 페이지" disabled={busy||safePage===pageCount-1} onClick={()=>setPage(safePage+1)}>다음<ChevronRight size={15}/></button></nav>}
   {!filtered.length&&<div className="product-empty"><PackageOpen/><b>검색 결과가 없습니다</b><p>다른 코드나 컬러북을 선택해 주세요.</p><button className="text-button" onClick={reset}>전체 제품 보기</button></div>}
  </section><aside className="product-detail">{item&&<>
   <div className={`product-hero${isColor&&!item.previewColor?' color-unavailable':''}`} style={isColor&&item.previewColor?{background:item.previewColor}:undefined}>{item.image&&<img key={item.id} src={item.image} alt={`${item.brand} ${item.code} 상세 스와치`} onLoad={()=>setLoaded(item.id)} onError={()=>{setImageError(true);setLoaded(null)}}/>}{imageError&&<p role="alert">제품 이미지를 불러오지 못했습니다.</p>}{isColor&&!item.previewColor&&<p>공식 색상값 확인 필요</p>}</div>
   <div className="product-detail-copy"><small>{item.brand} / {item.collection}</small><h3>{item.code}</h3><p>{item.name}</p>
    <div className="product-apply"><small>적용할 범위 · {target}</small><button className="primary-button full" disabled={busy||!ready} onClick={()=>void apply()}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} {busy?'소재 적용 중…':isColor?'이 페인트 색상 적용':'이 제품 소재 적용'}</button></div>
    <dl><div><dt>제품군</dt><dd>{item.category}</dd></div>{isColor?<><div><dt>HEX</dt><dd>{item.previewColor?.toUpperCase()??'미제공'}</dd></div>{item.previewColor&&<div><dt>RGB</dt><dd>{[1,3,5].map(i=>parseInt(item.previewColor!.slice(i,i+2),16)).join(', ')}</dd></div>}{item.pageCode&&<div><dt>컬러북 페이지</dt><dd>{item.pageCode}</dd></div>}</>:<div><dt>무늬</dt><dd>{item.appearance}</dd></div>}<div><dt>확인일</dt><dd>{item.checkedAt}</dd></div></dl>
    {item.codeHasVariants&&<p className="product-source-note">같은 코드가 다른 컬러북에도 있습니다. 이 컬러북에 게시된 화면 색상값을 적용합니다.</p>}
    {isColor&&!item.previewColor&&<p className="product-source-note" role="alert">공식 원본 값이 {item.sourceValue}로 표기되어 적용할 수 없습니다. 임의의 대체색을 사용하지 않습니다.</p>}
    <p className="product-spec">{item.specification}</p>{!isColor&&!item.imageWidthMm&&<p className="fineprint">스와치의 실물 축척은 미확인입니다. 초기 반복 폭은 900mm이며 적용 후 속성에서 조정할 수 있습니다.</p>}
    <a href={item.sourceUrl} target="_blank" rel="noreferrer">제조사 공식 {isColor?'컬러검색':'제품 정보'}<ExternalLink size={13}/></a>
    <p className="fineprint">{isColor?'화면용 색상입니다. 3D 조명·모니터·도료 종류·광택·바탕면에 따라 실물과 달라질 수 있으므로 최종 색상은 실물 색표와 도장 샘플로 확인하세요.':'공식 제품 스와치입니다. 화면 색상과 광택은 시각화 참고값이며, 판매 규격·시공 용도는 제조사 샘플과 제품 정보로 확인하세요.'}</p>{error&&<p className="form-error" role="alert">{error}</p>}
   </div></>}</aside></div>
 </DialogContent></Dialog>;
}
