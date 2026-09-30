'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type {
  Comment,
  Feedback,
  FeedbackDetail,
  FileItem,
  PortalDashboard,
  PortalMeeting,
  PortalProject,
  PortalProjectDetail,
} from '@/lib/types';

export function usePortalDashboard() {
  return useQuery({ queryKey: queryKeys.portal.dashboard, queryFn: () => apiClient.get<PortalDashboard>('/portal/dashboard') });
}

export function usePortalProjects() {
  return useQuery({ queryKey: queryKeys.portal.projects, queryFn: () => apiClient.get<PortalProject[]>('/portal/projects') });
}

export function usePortalProject(id: string) {
  return useQuery({
    queryKey: queryKeys.portal.project(id),
    queryFn: () => apiClient.get<PortalProjectDetail>(`/portal/projects/${id}`),
  });
}

export function usePortalFeedback(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.portal.feedback(params),
    queryFn: () => apiClient.get<Feedback[]>('/portal/feedback', params),
  });
}

export function usePortalFeedbackDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.portal.feedbackDetail(id ?? ''),
    queryFn: () => apiClient.get<FeedbackDetail>(`/portal/feedback/${id}`),
    enabled: Boolean(id),
  });
}

export function useSubmitPortalFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...input }: { projectId: string; title: string; description: string }) =>
      apiClient.post<Feedback>(`/portal/projects/${projectId}/feedback`, input),
    onSuccess: () => invalidate(queryClient, 'portal'),
  });
}

export function useAddPortalComment(feedbackId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => apiClient.post<Comment>(`/portal/feedback/${feedbackId}/comments`, { content }),
    onSuccess: () => invalidate(queryClient, 'portal'),
  });
}

export function usePortalMeetings(params: QueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.portal.meetings(params),
    queryFn: () => apiClient.get<PortalMeeting[]>('/portal/meetings', params),
  });
}

export function usePortalFiles(params: QueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.portal.files(params),
    queryFn: () => apiClient.get<FileItem[]>('/portal/files', params),
  });
}

export function usePortalUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, file, feedbackId }: { projectId: string; file: File; feedbackId?: string }) => {
      const form = new FormData();
      if (feedbackId) form.append('feedbackId', feedbackId);
      form.append('file', file);
      return apiClient.upload<FileItem>(`/portal/projects/${projectId}/files`, form);
    },
    onSuccess: () => invalidate(queryClient, 'portal'),
  });
}
