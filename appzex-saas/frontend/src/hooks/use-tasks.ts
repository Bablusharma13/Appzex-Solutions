'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type { Comment, Paginated, Priority, Progress, Task, TaskMutationResult, TaskStatus, TaskSummary } from '@/lib/types';

export interface TaskInput {
  title: string;
  description: string;
  assigneeId: string;
  milestoneId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  clientVisible: boolean;
}

export function useTasks(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => apiClient.get<Paginated<Task>>('/tasks', params),
    placeholderData: keepPreviousData,
  });
}

/** GET /projects/:projectId/tasks — 404s for projects outside the caller's agency. */
export function useProjectTasks(projectId: string, params: QueryParams) {
  return useQuery({
    queryKey: ['tasks', 'project', projectId, params],
    queryFn: () => apiClient.get<Paginated<Task>>(`/projects/${projectId}/tasks`, params),
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => apiClient.get<Task>(`/tasks/${id}`),
    enabled: Boolean(id),
  });
}

export function useTaskSummary(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.tasks.summary(params),
    queryFn: () => apiClient.get<TaskSummary>('/tasks/summary', params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...input }: Partial<TaskInput> & { projectId: string; title: string }) =>
      apiClient.post<TaskMutationResult>(`/projects/${projectId}/tasks`, input),
    onSuccess: () => invalidate(queryClient, 'tasks', 'projects', 'milestones', 'dashboard', 'activity'),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TaskInput> & { id: string }) =>
      apiClient.patch<TaskMutationResult>(`/tasks/${id}`, input),
    onSuccess: () => invalidate(queryClient, 'tasks', 'projects', 'milestones', 'dashboard', 'activity'),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<{ projectProgress: Progress }>(`/tasks/${id}`),
    onSuccess: () => invalidate(queryClient, 'tasks', 'projects', 'milestones', 'dashboard', 'activity'),
  });
}

export function useTaskComments(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.tasks.comments(taskId ?? ''),
    queryFn: () => apiClient.get<Comment[]>(`/tasks/${taskId}/comments`),
    enabled: Boolean(taskId),
  });
}

export function useAddTaskComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => apiClient.post<Comment>(`/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.comments(taskId) });
      invalidate(queryClient, 'tasks', 'activity');
    },
  });
}
