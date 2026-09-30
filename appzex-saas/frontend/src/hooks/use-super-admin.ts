'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type QueryParams, apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  AgencyDetail,
  AgencyListItem,
  AgencyPlan,
  AgencyStatus,
  Paginated,
  PlatformDashboard,
  SessionProfile,
} from '@/lib/types';

export function useSuperAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.superAdmin.dashboard,
    queryFn: () => apiClient.get<PlatformDashboard>('/super-admin/dashboard'),
  });
}

export function useSuperAdminAgencies(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.superAdmin.agencies(params),
    queryFn: () => apiClient.get<Paginated<AgencyListItem>>('/super-admin/agencies', params),
    placeholderData: keepPreviousData,
  });
}

export function useSuperAdminAgency(id: string) {
  return useQuery({
    queryKey: queryKeys.superAdmin.agency(id),
    queryFn: () => apiClient.get<AgencyDetail>(`/super-admin/agencies/${id}`),
  });
}

export function useUpdateAgencyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: AgencyStatus; reason?: string }) =>
      apiClient.patch(`/super-admin/agencies/${id}/status`, { status, reason: reason || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.all }),
  });
}

export interface CreateAgencyInput {
  name: string;
  contactEmail: string;
  phone?: string;
  plan: AgencyPlan;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export function useCreateAgency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgencyInput) => apiClient.post<{ id: string; name: string }>('/super-admin/agencies', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.superAdmin.all }),
  });
}

interface SupportResponse {
  session: { id: string; agencyId: string };
  profile: SessionProfile;
}

export function useStartSupportSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ agencyId, reason }: { agencyId: string; reason?: string }) =>
      apiClient.post<SupportResponse>(`/super-admin/agencies/${agencyId}/support-session`, { reason: reason || undefined }),
    onSuccess: (data) => {
      // Start from a clean cache so no data from another context is reused.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, data.profile);
      router.push('/app/dashboard');
    },
  });
}

export function useEndSupportSession() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ sessionId }: { sessionId: string; agencyId: string }) =>
      apiClient.post<SupportResponse>(`/super-admin/support-session/${sessionId}/end`),
    onSuccess: (data, variables) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, data.profile);
      router.push(`/super-admin/agencies/${variables.agencyId}`);
    },
  });
}
