import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';
import { emailSchema, nullableText, passwordSchema, searchSchema } from './common';

export const agencyStatusEnum = z.enum(['ACTIVE', 'SUSPENDED']);
export const agencyPlanEnum = z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']);

export const listAgenciesQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  status: agencyStatusEnum.optional(),
  plan: agencyPlanEnum.optional(),
  sort: z.enum(['name', 'createdAt', 'status', 'plan']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const updateAgencyStatusSchema = z.object({
  status: agencyStatusEnum,
  reason: z.string().trim().max(255).optional(),
});

export const createAgencySchema = z.object({
  name: z.string().trim().min(2, 'Agency name is required').max(120),
  contactEmail: emailSchema,
  phone: nullableText(40),
  plan: agencyPlanEnum.default('STARTER'),
  adminName: z.string().trim().min(2, 'Admin name is required').max(120),
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
});

export const startSupportSessionSchema = z.object({
  reason: z.string().trim().max(255).optional(),
});
