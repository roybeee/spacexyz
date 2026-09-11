import {materialProduct} from './material-products';
import {validateScene,type SceneData} from './scene-model';

export function setMaterialShortlist(scene:SceneData,ids:string[]):SceneData{
 const next=validateScene({...scene,materialShortlist:ids});
 return JSON.stringify(next.materialShortlist)===JSON.stringify(scene.materialShortlist??[])?scene:next;
}
export function materialShortlistCsv(ids:string[]){
 const cell=(value:string)=>'"'+(/^[\s]*[=+@-]/.test(value)?"'"+value:value).replaceAll('"','""')+'"';
 const rows=[['브랜드','제품 코드','제품명','제품군','컬렉션','규격','공식 제품 정보','확인일','상태'],...ids.map(id=>{const p=materialProduct(id);if(!p)throw new Error('등록되지 않은 소재입니다.');return [p.brand,p.code,p.name,p.category,p.collection,p.specification,p.sourceUrl,p.checkedAt,'검토 후보 · 시공 확정 아님'];})];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
