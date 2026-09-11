import {z} from 'zod';
export const brandApplicationSchema=z.object({id:z.string().max(80),name:z.string().max(80),revision:z.number().int().min(0),status:z.enum(['draft','reviewed']),mode:z.enum(['surfaces','layout']),appliedAt:z.string().datetime()}).strict();
