import {z} from 'zod';
export const objectPhotoSchema=z.object({
 imageId:z.string().uuid(),representation:z.enum(['parametric','parts']),analysis:z.enum(['manual','ai']),dimensions:z.enum(['entered','measured']),
 objectId:z.string().uuid().optional(),partIndex:z.number().int().min(0).max(15).optional(),partCount:z.number().int().min(1).max(16).optional(),sourceSize:z.object({width:z.number().positive().max(10000),depth:z.number().positive().max(10000),height:z.number().positive().max(10000)}).optional(),
 brand:z.string().trim().max(60).default(''),productCode:z.string().trim().max(60).default(''),notes:z.array(z.string().max(300)).max(5).default([])
});
export type ObjectPhoto=z.infer<typeof objectPhotoSchema>;

/** Measured status applies only while the current standard proxy retains the entered measured dimensions. */
export function photoDimensionsMeasured(n:{width:number;height:number;depth:number;objectPhoto?:ObjectPhoto}){const p=n.objectPhoto,s=p?.sourceSize;return p?.representation==='parametric'&&p.dimensions==='measured'&&!!s&&(['width','height','depth'] as const).every(k=>Math.abs(n[k]-s[k])<.001);}

export function samePhotoAssembly(a:{group?:{id:string};objectPhoto?:ObjectPhoto},b:{group?:{id:string};objectPhoto?:ObjectPhoto}){return !!a.group?.id&&a.group.id===b.group?.id&&a.objectPhoto?.representation==='parts'&&b.objectPhoto?.representation==='parts'&&!!a.objectPhoto.objectId&&a.objectPhoto.objectId===b.objectPhoto.objectId;}
