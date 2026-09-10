import {z} from 'zod';
const ratio=z.number().finite().min(-20).max(20);
export const measurementAnchorSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('node'),nodeId:z.string().min(1).max(80),point:z.tuple([ratio,ratio,ratio])}),
 z.object({kind:z.literal('room'),surface:z.enum(['floor','back','left','right','front']),u:z.number().finite().min(-.001).max(1.001),v:z.number().finite().min(-.001).max(1.001),offset:z.number().finite().min(-150).max(60)})
]);
export const measurementSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),start:measurementAnchorSchema,end:measurementAnchorSchema,hidden:z.boolean().default(false)});
export type MeasurementAnchor=z.infer<typeof measurementAnchorSchema>;
export type Measurement=z.infer<typeof measurementSchema>;
