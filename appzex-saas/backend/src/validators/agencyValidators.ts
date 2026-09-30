import { z } from 'zod';
import { emailSchema, nullableText, passwordSchema } from './common';

export const updateAgencySettingsSchema = z.object({
  name: z.string().trim().min(2, 'Agency name is required').max(120).optional(),
  contactEmail: emailSchema.optional(),
  phone: nullableText(40),
  website: nullableText(191),
});

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: emailSchema,
  role: z.enum(['AGENCY_ADMIN', 'AGENCY_MEMBER']).default('AGENCY_MEMBER'),
  jobTitle: nullableText(120),
  password: passwordSchema,
});
