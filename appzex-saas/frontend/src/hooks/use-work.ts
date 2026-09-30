'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type {
  AIHealthResult,
  Comment,
  Feedback,
  FeedbackDetail,
  FeedbackStatus,
  FileItem,
  Meeting,
  MeetingSummaryResult,
  Paginated,
} from '@/lib/types';

// ----- Meetings -------------------------------------------------------------------

export interface MeetingInput {
  title: string;
  meetingDate: string;
  notes: string;
  summary: string;
  clientVisible: boolean;
}

export function useMeetings(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.meetings.list(params),
    queryFn: () => apiClient.get<Paginated<Meeting>>('/meetings', params),
    placeholderData: keepPreviousData,
  });
}

export function useProjectMeetings(projectId: string) {
  return useQuery({
    queryKey: queryKeys.meetings.project(projectId),
    queryFn: () => apiClient.get<Meeting[]>(`/projects/${projectId}/meetings`),
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...input }: MeetingInput & { projectId: string }) =>
      apiClient.post<Meeting>(`/projects/${projectId}/meetings`, input),
    onSuccess: () => invalidate(queryClient, 'meetings', 'activity'),
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<MeetingInput> & { id: string }) => apiClient.patch<Meeting>(`/meetings/${id}`, input),
    onSuccess: () => invalidate(queryClient, 'meetings', 'activity'),
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/meetings/${id}`),
    onSuccess: () => invalidate(queryClient, 'meetings', 'activity'),
  });
}

// ----- Feedback -------------------------------------------------------------------

export function useFeedbackList(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.feedback.list(params),
    queryFn: () => apiClient.get<Paginated<Feedback>>('/feedback', params),
    placeholderData: keepPreviousData,
  });
}

export function useProjectFeedback(projectId: string) {
  return useQuery({
    queryKey: queryKeys.feedback.project(projectId),
    queryFn: () => apiClient.get<Feedback[]>(`/projects/${projectId}/feedback`),
  });
}

export function useFeedbackDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.feedback.detail(id ?? ''),
    queryFn: () => apiClient.get<FeedbackDetail>(`/feedback/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...input }: { projectId: string; title: string; description: string }) =>
      apiClient.post<Feedback>(`/projects/${projectId}/feedback`, input),
    onSuccess: () => invalidate(queryClient, 'feedback', 'projects', 'dashboard', 'activity'),
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) => apiClient.patch<FeedbackDetail>(`/feedback/${id}`, { status }),
    onSuccess: () => invalidate(queryClient, 'feedback', 'projects', 'dashboard', 'activity'),
  });
}

export function useAddFeedbackComment(feedbackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => apiClient.post<Comment>(`/feedback/${feedbackId}/comments`, { content }),
    onSuccess: () => invalidate(queryClient, 'feedback', 'activity'),
  });
}

// ----- Files ----------------------------------------------------------------------

export function useFiles(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.files.list(params),
    queryFn: () => apiClient.get<Paginated<FileItem>>('/files', params),
    placeholderData: keepPreviousData,
  });
}

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: queryKeys.files.project(projectId),
    queryFn: () => apiClient.get<FileItem[]>(`/projects/${projectId}/files`),
  });
}

export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, file, clientVisible, taskId }: { projectId: string; file: File; clientVisible: boolean; taskId?: string }) => {
      const form = new FormData();
      form.append('clientVisible', String(clientVisible));
      if (taskId) form.append('taskId', taskId);
      form.append('file', file);
      return apiClient.upload<FileItem>(`/projects/${projectId}/files`, form);
    },
    onSuccess: () => invalidate(queryClient, 'files', 'tasks', 'activity'),
  });
}

export function useUpdateFileVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientVisible }: { id: string; clientVisible: boolean }) => apiClient.patch<FileItem>(`/files/${id}`, { clientVisible }),
    onSuccess: () => invalidate(queryClient, 'files', 'activity'),
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/files/${id}`),
    onSuccess: () => invalidate(queryClient, 'files', 'tasks', 'feedback', 'activity'),
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.download(id, name),
  });
}

// ----- AI -------------------------------------------------------------------------

export function useProjectHealthAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiClient.post<AIHealthResult>('/ai/project-health', { projectId }),
    meta: { silent: true },
    onSuccess: () => invalidate(queryClient, 'activity'),
  });
}

export function useMeetingSummaryAI() {
  return useMutation({
    mutationFn: (input: { projectId: string; title?: string; notes: string }) =>
      apiClient.post<MeetingSummaryResult>('/ai/meeting-summary', input),
    meta: { silent: true },
  });
}
