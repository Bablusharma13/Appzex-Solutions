import { z } from 'zod';
import { paginationQuery } from '../utils/pagination';
import {
  feedbackStatusEnum,
  idSchema,
  milestoneStatusEnum,
  nullableDate,
  nullableId,
  nullableText,
  priorityEnum,
  queryBoolean,
  searchSchema,
  taskStatusEnum,
} from './common';

// ----- Milestones -------------------------------------------------------------

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(2, 'Milestone name is required').max(160),
  description: nullableText(5000),
  dueDate: nullableDate,
  status: milestoneStatusEnum.optional(),
  order: z.number().int().min(0).max(1000).optional(),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();

// ----- Tasks ------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required').max(200),
  description: nullableText(10000),
  assigneeId: nullableId,
  milestoneId: nullableId,
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: nullableDate,
  clientVisible: z.boolean().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const listTasksQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  status: taskStatusEnum.optional(),
  priority: priorityEnum.optional(),
  /** A user id, or "me" for the current user, or "unassigned". */
  assigneeId: idSchema.optional(),
  projectId: idSchema.optional(),
  milestoneId: idSchema.optional(),
  due: z.enum(['overdue', 'today', 'week', 'completed']).optional(),
  sort: z.enum(['dueDate', 'createdAt', 'priority', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const taskSummaryQuery = z.object({
  assigneeId: idSchema.optional(),
  projectId: idSchema.optional(),
});

// ----- Meetings ---------------------------------------------------------------

const meetingDate = z
  .string()
  .min(1, 'Meeting date is required')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time')
  .transform((value) => new Date(value));

export const createMeetingSchema = z.object({
  title: z.string().trim().min(2, 'Meeting title is required').max(200),
  meetingDate,
  notes: nullableText(20000),
  summary: nullableText(20000),
  clientVisible: z.boolean().optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();

export const listMeetingsQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  projectId: idSchema.optional(),
  clientVisible: queryBoolean,
});

// ----- Feedback ---------------------------------------------------------------

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(3, 'Feedback title is required').max(200),
  description: z.string().trim().min(5, 'Please describe the feedback').max(10000),
});

export const updateFeedbackSchema = z.object({
  status: feedbackStatusEnum,
});

export const listFeedbackQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  status: feedbackStatusEnum.optional(),
  projectId: idSchema.optional(),
  open: queryBoolean,
});

// ----- Files ------------------------------------------------------------------

/** Multipart form fields arrive as strings. */
const formBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const uploadFileFields = z.object({
  clientVisible: formBoolean,
  taskId: nullableId,
  feedbackId: nullableId,
});

export const clientUploadFileFields = z.object({
  feedbackId: nullableId,
});

export const updateFileSchema = z.object({
  clientVisible: z.boolean(),
});

export const listFilesQuery = z.object({
  ...paginationQuery,
  search: searchSchema,
  projectId: idSchema.optional(),
  clientVisible: queryBoolean,
});

// ----- Activity ---------------------------------------------------------------

export const listActivityQuery = z.object({
  ...paginationQuery,
  projectId: idSchema.optional(),
  entityType: z.string().trim().max(60).optional(),
  visibility: z.enum(['INTERNAL', 'CLIENT']).optional(),
});

// ----- AI ---------------------------------------------------------------------

export const projectHealthSchema = z.object({ projectId: idSchema });

export const meetingSummarySchema = z.object({
  projectId: idSchema,
  title: z.string().trim().max(200).optional(),
  notes: z.string().trim().min(20, 'Add at least a few sentences of notes to summarize').max(20000),
});
