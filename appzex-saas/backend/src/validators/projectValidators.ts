import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';
import {
  idSchema,
  nullableDate,
  nullableId,
  nullableText,
  priorityEnum,
  projectStatusEnum,
  searchSchema,
} from './common';

export const listProjectsQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  status: projectStatusEnum.optional(),
  priority: priorityEnum.optional(),
  // Filters only narrow results that are already scoped to the caller's agency.
  clientId: idSchema.optional(),
  managerId: idSchema.optional(),
  sort: z.enum(['createdAt', 'dueDate', 'name', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const projectFields = {
  name: z.string().trim().min(2, 'Project name is required').max(160),
  description: nullableText(10000),
  clientId: idSchema,
  startDate: nullableDate,
  dueDate: nullableDate,
  status: projectStatusEnum.optional(),
  priority: priorityEnum.optional(),
  managerId: nullableId,
};

function datesInOrder(value: { startDate?: Date | null; dueDate?: Date | null }) {
  return !value.startDate || !value.dueDate || value.dueDate >= value.startDate;
}

const dateOrderIssue = { message: 'Expected completion must be on or after the start date', path: ['dueDate'] };

export const createProjectSchema = z
  .object({ ...projectFields, createDefaultMilestones: z.boolean().optional() })
  .refine(datesInOrder, dateOrderIssue);

export const updateProjectSchema = z
  .object({ ...projectFields, clientId: idSchema.optional(), name: projectFields.name.optional() })
  .refine(datesInOrder, dateOrderIssue);
