export type SnapSettings={translation:number;rotation:number};
export const defaultSnapSettings:Readonly<SnapSettings>=Object.freeze({translation:50,rotation:15});
/** Unknown or invalid persisted settings fall back independently, without coercing strings. */
export function normalizeSnapping(input:unknown):SnapSettings{
 const value=input&&typeof input==='object'&&!Array.isArray(input)?input as Partial<SnapSettings>:{};
 const valid=(n:unknown,max:number,fallback:number)=>typeof n==='number'&&Number.isFinite(n)&&n>=1&&n<=max?n:fallback;
 return{translation:valid(value.translation,1000,defaultSnapSettings.translation),rotation:valid(value.rotation,90,defaultSnapSettings.rotation)};
}
/** The renderer uses metres; settings and the stored scene use millimetres. */
export function snapFloorPoint(point:{x:number;z:number},enabled:boolean,translationMm:number=defaultSnapSettings.translation){
 if(!Number.isFinite(point.x)||!Number.isFinite(point.z))throw new Error('바닥 위치의 좌표를 확인하세요.');
 if(!enabled)return{x:point.x,z:point.z};
 const step=normalizeSnapping({translation:translationMm}).translation/1000;
 const snap=(v:number)=>{const snapped=Math.round(v/step)*step;if(!Number.isFinite(snapped))throw new Error('격자 범위 안의 바닥 위치를 선택하세요.');return Object.is(snapped,-0)?0:snapped;};
 return{x:snap(point.x),z:snap(point.z)};
}
