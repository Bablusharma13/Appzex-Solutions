'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type {
  Activity,
  HealthFacts,
  Milestone,
  MilestoneStatus,
  Paginated,
  Priority,
  ProjectDetail,
  ProjectListItem,
  ProjectStatus,
} from '@/lib/types';

export interface ProjectInput {
  name: string;
  description: string;
  clientId: string;
  startDate: string;
  dueDate: string;
  status: ProjectStatus;
  priority: Priority;
  managerId: string;
  createDefaultMilestones?: boolean;
}

export function useProjects(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: () => apiClient.get<Paginated<ProjectListItem>>('/projects', params),
    placeholderData: keepPreviousData,
  });
}

/** Projects for dropdowns. */
export function useProjectOptions() {
  return useProjects({ pageSize: 100, sort: 'name', order: 'asc' });
}

export function useProject(id: string) {
  return useQuery({ queryKey: queryKeys.projects.detail(id), queryFn: () => apiClient.get<ProjectDetail>(`/projects/${id}`) });
}

export function useProjectHealth(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.health(id),
    queryFn: () => apiClient.get<HealthFacts>(`/projects/${id}/health`),
  });
}

export function useProjectActivity(id: string, params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.activity.project(id, params),
    queryFn: () => apiClient.get<Paginated<Activity>>(`/projects/${id}/activity`, params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => apiClient.post<{ id: string; name: string }>('/projects', input),
    onSuccess: () => invalidate(queryClient, 'projects', 'clients', 'dashboard', 'activity'),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) => apiClient.patch(`/projects/${id}`, input),
    onSuccess: () => invalidate(queryClient, 'projects', 'clients', 'dashboard', 'activity', 'tasks'),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${id}`),
    onSuccess: () => invalidate(queryClient, 'projects', 'clients', 'dashboard', 'activity', 'tasks'),
  });
}

// ----- Milestones -----------------------------------------------------------------

export interface MilestoneInput {
  name: string;
  description: string;
  dueDate: string;
  status: MilestoneStatus;
  order?: number;
}

export function useMilestones(projectId: string) {
  return useQuery({
    queryKey: queryKeys.milestones.project(projectId),
    queryFn: () => apiClient.get<Milestone[]>(`/projects/${projectId}/milestones`),
    enabled: Boolean(projectId),
  });
}

export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MilestoneInput) => apiClient.post<Milestone>(`/projects/${projectId}/milestones`, input),
    onSuccess: () => invalidate(queryClient, 'milestones', 'projects', 'dashboard', 'activity'),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<MilestoneInput> & { id: string }) => apiClient.patch<Milestone>(`/milestones/${id}`, input),
    onSuccess: () => invalidate(queryClient, 'milestones', 'projects', 'dashboard', 'activity'),
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/milestones/${id}`),
    onSuccess: () => invalidate(queryClient, 'milestones', 'tasks', 'projects', 'activity'),
  });
}
