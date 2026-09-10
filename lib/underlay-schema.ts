import {z} from 'zod';
export const imagePointSchema=z.tuple([z.number().finite().min(0).max(1),z.number().finite().min(0).max(1)]);
export const underlaySchema=z.object({imageId:z.string().uuid(),name:z.string().trim().min(1).max(100),pixelWidth:z.number().int().min(1).max(2048),pixelHeight:z.number().int().min(1).max(2048),width:z.number().finite().min(100).max(100000),x:z.number().finite().min(-50000).max(50000),z:z.number().finite().min(-50000).max(50000),rotation:z.number().finite().min(-180).max(180),opacity:z.number().finite().min(.05).max(1),visible:z.boolean(),calibration:z.object({start:imagePointSchema,end:imagePointSchema,distance:z.number().finite().min(100).max(100000)}).optional()});
export type PlanUnderlay=z.infer<typeof underlaySchema>;
export type ImagePoint=z.infer<typeof imagePointSchema>;
export function underlayDepth(u:PlanUnderlay){return u.width*u.pixelHeight/u.pixelWidth;}
export function calibratedWidth(u:Pick<PlanUnderlay,'pixelWidth'|'pixelHeight'>,start:ImagePoint,end:ImagePoint,distance:number){
    imagePointSchema.parse(start);imagePointSchema.parse(end);
    if(!Number.isFinite(distance)||distance<100||distance>100000)throw new Error('실제 거리는 100~100,000mm로 입력하세요.');
    const pixels=Math.hypot((end[0]-start[0])*u.pixelWidth,(end[1]-start[1])*u.pixelHeight);
    if(pixels<8)throw new Error('두 점을 이미지에서 8px 이상 떨어뜨려 지정하세요.');
    return distance/pixels*u.pixelWidth;
}
export function validateUnderlay(input:unknown):PlanUnderlay{
    const u=underlaySchema.parse(input),depth=underlayDepth(u);
    if(depth<100||depth>100000)throw new Error('도면의 가로·세로 크기는 각각 100~100,000mm 범위여야 합니다.');
    if(u.calibration&&Math.abs(calibratedWidth(u,u.calibration.start,u.calibration.end,u.calibration.distance)-u.width)>1e-5)throw new Error('보정 거리와 도면 축척이 일치하지 않습니다. 축척을 다시 맞추세요.');
    return u;
}
