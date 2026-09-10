import rows from './data/samhwa-colors.json';
import manifest from './data/samhwa-manifest.json';
import type {MaterialProduct} from './material-products';
export const samhwaManifest=manifest;
export const samhwaBooks:Record<string,string>={'1200':'SAMHWA 1200','950':'SAMHWA-NCS 950','600':'SAMHWA-NCS 600',other:'기타 색상 (A–E)'};
const duplicateCodes=new Set(manifest.duplicateCodeDifferentHex);
export const samhwaColors:MaterialProduct[]=rows.map(([sourceId,book,code,name,hex,pageCode,keywords])=>({
 id:`samhwa-${sourceId}`,brand:'삼화페인트',collection:samhwaBooks[book],code,name,
 category:'페인트 색상',appearance:'단색',base:'plaster',kind:'color',colorBook:book,pageCode,keywords,
 image:'',sourceImageUrl:'',sourceUrl:manifest.sourceUrl,imageWidthMm:null,
 previewColor:/^#[0-9a-f]{6}$/i.test(hex)?hex.toLowerCase():undefined,
 sourceValue:hex,codeHasVariants:duplicateCodes.has(code),
 specification:'공식 컬러검색의 화면용 HEX 값. 도료 상품·조색 배합·광택 등급을 뜻하지 않습니다. 도료 종류와 시공 부위는 별도로 확인하세요.',
 checkedAt:manifest.checkedAt
}));
