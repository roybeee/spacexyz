import {z} from 'zod';
import {finishSchema,materialIds} from './scene-model';
import type {MaterialSample} from './material-transfer';

export const materialPresetSchema=z.object({
    version:z.literal(1),
    name:z.string().trim().min(1).max(80),
    note:z.string().trim().max(200).default(''),
    material:z.enum(materialIds),
    finish:finishSchema.strict()
}).strict();
export type MaterialPreset=z.infer<typeof materialPresetSchema>;
export type MaterialPresetRow={id:string;preset:MaterialPreset;created_at:string};
export function validateMaterialPreset(input:unknown):MaterialPreset{return materialPresetSchema.parse(input);}
/** The reusable preset is copied into the editor's existing session material buffer. */
export function toMaterialSample(preset:MaterialPreset,id:string):MaterialSample{
    const checked=validateMaterialPreset(preset),key=z.string().uuid().parse(id);
    return {material:checked.material,finish:structuredClone(checked.finish),sourceName:checked.name,sourceId:`preset:${key}`};
}
