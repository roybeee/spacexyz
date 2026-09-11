import {z} from 'zod';

/** Manual grades: [F] fixed brand core (rework on violation) · [S] standard (HQ written approval to substitute) · [O] contractor discretion. */
export const brandGrades=['F','S','O'] as const;
export type BrandGrade=typeof brandGrades[number];
export const brandGradeNames:Record<BrandGrade,string>={F:'고정',S:'표준',O:'재량'};

const statusSchema=z.enum(['ok','warn','fail','manual']);
export type BrandCheckStatus=z.infer<typeof statusSchema>;

const zoneSchema=z.object({
  id:z.string().max(4),
  name:z.string().max(24),
  areaM2:z.number().min(0),
  ratio:z.number().min(0).max(100),
  min:z.number().min(0).max(100),
  max:z.number().min(0).max(100),
  status:statusSchema,
}).strict();

const aisleSchema=z.object({name:z.string().max(40),required:z.number().int().min(0),actual:z.number().int().min(0),status:statusSchema}).strict();
const equipmentSchema=z.object({name:z.string().max(40),count:z.number().int().min(0),grade:z.enum(brandGrades),note:z.string().max(160)}).strict();
const checkSchema=z.object({grade:z.enum(brandGrades),label:z.string().max(120),status:statusSchema}).strict();

/** Validation report produced by the brand store planner and stored with the applied scene. */
export const brandReportSchema=z.object({
  manual:z.string().max(120),
  storeType:z.enum(['A','B','C','D']),
  storeTypeName:z.string().max(40),
  areaM2:z.number().min(0),
  pyeong:z.number().min(0),
  zones:z.array(zoneSchema).max(6),
  aisles:z.array(aisleSchema).max(6),
  seats:z.object({windowBar:z.number().int().min(0),bench:z.number().int().min(0),total:z.number().int().min(0)}).strict(),
  equipment:z.array(equipmentSchema).max(24),
  checks:z.array(checkSchema).max(16),
  warnings:z.array(z.string().max(200)).max(12),
}).strict();
export type BrandReport=z.infer<typeof brandReportSchema>;

export const entranceSides=['left','center','right'] as const;
export type Entrance=typeof entranceSides[number];
export const entranceNames:Record<Entrance,string>={left:'왼쪽',center:'중앙',right:'오른쪽'};

export const brandApplicationSchema=z.object({
  id:z.string().max(80),
  name:z.string().max(80),
  revision:z.number().int().min(0),
  status:z.enum(['draft','reviewed']),
  mode:z.enum(['surfaces','layout']),
  appliedAt:z.string().datetime(),
  entrance:z.enum(entranceSides).optional(),
  seating:z.boolean().optional(),
  report:brandReportSchema.optional(),
}).strict();
export type BrandApplication=z.infer<typeof brandApplicationSchema>;
