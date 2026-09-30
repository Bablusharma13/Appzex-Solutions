'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type { Activity, AgencyDashboard, AgencySettings, Paginated, Role, TeamMember } from '@/lib/types';

export function useAgencyDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => apiClient.get<AgencyDashboard>('/dashboard') });
}

export function useAgencySettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => apiClient.get<AgencySettings>('/agency') });
}

export function useUpdateAgencySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; contactEmail: string; phone: string; website: string }) =>
      apiClient.patch<AgencySettings>('/agency', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      invalidate(queryClient, 'activity');
    },
  });
}

export function useTeam() {
  return useQuery({ queryKey: queryKeys.team, queryFn: () => apiClient.get<TeamMember[]>('/team'), staleTime: 60_000 });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; role: Extract<Role, 'AGENCY_ADMIN' | 'AGENCY_MEMBER'>; jobTitle: string; password: string }) =>
      apiClient.post('/team', input),
    onSuccess: () => invalidate(queryClient, 'team', 'activity'),
  });
}

export function useActivity(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.activity.list(params),
    queryFn: () => apiClient.get<Paginated<Activity>>('/activity', params),
    placeholderData: keepPreviousData,
  });
}

export function useAIStatus() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: () => apiClient.get<{ enabled: boolean; model: string | null }>('/ai/status'),
    staleTime: 10 * 60_000,
  });
}
