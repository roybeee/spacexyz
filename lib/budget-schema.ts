import {z} from 'zod';
export const estimateSchema=z.object({unitPrice:z.number().int().min(0).max(1000000000).optional(),basis:z.string().regex(/^[0-9a-f]{16}$/).optional(),excluded:z.boolean().optional(),note:z.string().max(160).optional()});
export const budgetExtraSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),amount:z.number().int().min(0).max(1000000000)});
export const budgetSchema=z.object({target:z.number().int().min(0).max(1000000000000).optional(),extras:z.array(budgetExtraSchema).max(12).default([])});
