import type {
  AgencyPlan,
  AgencyStatus,
  FeedbackStatus,
  HealthLevel,
  MilestoneStatus,
  Priority,
  ProjectStatus,
  Role,
  TaskStatus,
} from './types';

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'orange' | 'teal';

interface Meta {
  label: string;
  tone: Tone;
}

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  ACTIVE: { label: 'Active', tone: 'blue' },
  ON_HOLD: { label: 'On hold', tone: 'amber' },
  COMPLETED: { label: 'Completed', tone: 'green' },
};

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  TODO: { label: 'To do', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
};

export const MILESTONE_STATUS: Record<MilestoneStatus, Meta> = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
};

export const FEEDBACK_STATUS: Record<FeedbackStatus, Meta> = {
  OPEN: { label: 'Open', tone: 'amber' },
  IN_REVIEW: { label: 'In review', tone: 'violet' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
  DECLINED: { label: 'Declined', tone: 'neutral' },
};

export const PRIORITY: Record<Priority, Meta> = {
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'sky' },
  HIGH: { label: 'High', tone: 'orange' },
  URGENT: { label: 'Urgent', tone: 'red' },
};

export const AGENCY_STATUS: Record<AgencyStatus, Meta> = {
  ACTIVE: { label: 'Active', tone: 'green' },
  SUSPENDED: { label: 'Suspended', tone: 'red' },
};

export const PLAN: Record<AgencyPlan, Meta> = {
  STARTER: { label: 'Starter', tone: 'neutral' },
  GROWTH: { label: 'Growth', tone: 'blue' },
  ENTERPRISE: { label: 'Enterprise', tone: 'violet' },
};

export const HEALTH: Record<HealthLevel, Meta & { description: string }> = {
  ON_TRACK: { label: 'On track', tone: 'green', description: 'No significant risks detected.' },
  AT_RISK: { label: 'At risk', tone: 'amber', description: 'Needs attention to stay on schedule.' },
  CRITICAL: { label: 'Critical', tone: 'red', description: 'Immediate action required.' },
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  AGENCY_ADMIN: 'Agency Admin',
  AGENCY_MEMBER: 'Team Member',
  CLIENT: 'Client',
};

export const options = <T extends string>(map: Record<T, Meta>) =>
  (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }));
