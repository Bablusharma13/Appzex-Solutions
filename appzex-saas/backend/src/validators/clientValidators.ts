import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';
import { emailSchema, nullableEmail, nullableText, passwordSchema, searchSchema } from './common';

export const listClientsQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  sort: z.enum(['companyName', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createClientSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(160),
  contactName: nullableText(120),
  email: nullableEmail,
  phone: nullableText(40),
  notes: nullableText(5000),
  portalEnabled: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const createPortalUserSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: emailSchema,
  password: passwordSchema,
});
