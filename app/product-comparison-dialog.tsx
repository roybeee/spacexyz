'use client';
import {useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {MaterialProduct} from '@/lib/material-products';

function ComparisonImage({product:p}:{product:MaterialProduct}){
 const [failed,setFailed]=useState(false);
 return failed?<span role="alert">이미지를 불러오지 못했습니다.</span>:<img src={p.image} alt={`${p.brand} ${p.code} 비교 스와치`} onError={()=>setFailed(true)}/>;
}

export default function ProductComparisonDialog({products,onClose,onRemove,onSelect}:{products:MaterialProduct[];onClose:()=>void;onRemove:(id:string)=>void;onSelect:(product:MaterialProduct)=>void}){
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="product-comparison-dialog">
  <DialogHeader><DialogTitle>소재 나란히 비교</DialogTitle><DialogDescription>이미지와 규격을 비교한 뒤 원하는 소재의 상세를 열어 적용하세요.</DialogDescription></DialogHeader>
  <div className="product-comparison-grid">{products.map(p=><article key={p.id} className="product-comparison-item" aria-label={`${p.brand} ${p.code} 비교`}>
   <div className={`comparison-swatch${!p.image&&!p.previewColor?' color-unavailable':''}`} style={!p.image&&p.previewColor?{background:p.previewColor}:undefined}>
    {p.image?<ComparisonImage key={p.id} product={p}/>:!p.previewColor&&<span>공식 색상값 미제공</span>}
    <button aria-label={`${p.brand} ${p.code} 비교에서 제외`} onClick={()=>onRemove(p.id)}><X size={17}/></button>
   </div>
   <div className="comparison-copy"><small>{p.brand} · {p.collection}</small><h3>{p.code}</h3><p>{p.name}</p>
    <dl><div><dt>제품군</dt><dd>{p.category}</dd></div><div><dt>무늬</dt><dd>{p.appearance}</dd></div>{p.kind==='color'&&<div><dt>HEX</dt><dd>{p.previewColor?.toUpperCase()??'미제공'}</dd></div>}<div><dt>확인일</dt><dd>{p.checkedAt}</dd></div></dl>
    <p className="comparison-spec">{p.specification}</p>
    {!p.kind&&<p className="comparison-note">이미지의 실물 축척은 미확인입니다.</p>}
    <a href={p.sourceUrl} target="_blank" rel="noreferrer">공식 제품 정보 <ExternalLink size={14}/></a>
    <button className="primary-button full" onClick={()=>onSelect(p)}>이 소재 상세로</button>
   </div>
  </article>)}</div>
  {!products.length&&<p className="product-empty">비교할 소재가 없습니다.</p>}
  <button className="comparison-back" onClick={onClose}>소재 찾기로 돌아가기</button>
 </DialogContent></Dialog>;
}
