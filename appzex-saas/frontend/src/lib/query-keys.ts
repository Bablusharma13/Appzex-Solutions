import type { QueryParams } from './api';

/** Central query-key factory so invalidation after mutations stays consistent. */
export const queryKeys = {
  me: ['me'] as const,
  aiStatus: ['ai-status'] as const,

  superAdmin: {
    all: ['super-admin'] as const,
    dashboard: ['super-admin', 'dashboard'] as const,
    agencies: (params: QueryParams) => ['super-admin', 'agencies', params] as const,
    agency: (id: string) => ['super-admin', 'agency', id] as const,
  },

  dashboard: ['dashboard'] as const,
  settings: ['agency-settings'] as const,
  team: ['team'] as const,

  clients: {
    all: ['clients'] as const,
    list: (params: QueryParams) => ['clients', 'list', params] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    activity: (id: string, params: QueryParams) => ['clients', 'activity', id, params] as const,
  },

  projects: {
    all: ['projects'] as const,
    list: (params: QueryParams) => ['projects', 'list', params] as const,
    detail: (id: string) => ['projects', 'detail', id] as const,
    health: (id: string) => ['projects', 'health', id] as const,
  },

  milestones: {
    all: ['milestones'] as const,
    project: (projectId: string) => ['milestones', projectId] as const,
  },

  tasks: {
    all: ['tasks'] as const,
    list: (params: QueryParams) => ['tasks', 'list', params] as const,
    summary: (params: QueryParams) => ['tasks', 'summary', params] as const,
    comments: (taskId: string) => ['tasks', 'comments', taskId] as const,
  },

  meetings: {
    all: ['meetings'] as const,
    list: (params: QueryParams) => ['meetings', 'list', params] as const,
    project: (projectId: string) => ['meetings', 'project', projectId] as const,
  },

  feedback: {
    all: ['feedback'] as const,
    list: (params: QueryParams) => ['feedback', 'list', params] as const,
    project: (projectId: string) => ['feedback', 'project', projectId] as const,
    detail: (id: string) => ['feedback', 'detail', id] as const,
  },

  files: {
    all: ['files'] as const,
    list: (params: QueryParams) => ['files', 'list', params] as const,
    project: (projectId: string) => ['files', 'project', projectId] as const,
  },

  activity: {
    all: ['activity'] as const,
    list: (params: QueryParams) => ['activity', 'list', params] as const,
    project: (projectId: string, params: QueryParams) => ['activity', 'project', projectId, params] as const,
  },

  portal: {
    all: ['portal'] as const,
    dashboard: ['portal', 'dashboard'] as const,
    projects: ['portal', 'projects'] as const,
    project: (id: string) => ['portal', 'project', id] as const,
    feedback: (params: QueryParams) => ['portal', 'feedback', params] as const,
    feedbackDetail: (id: string) => ['portal', 'feedback-detail', id] as const,
    meetings: (params: QueryParams) => ['portal', 'meetings', params] as const,
    files: (params: QueryParams) => ['portal', 'files', params] as const,
  },
};
