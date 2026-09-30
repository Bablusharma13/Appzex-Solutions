'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ApiError, apiClient } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { SessionProfile } from '@/lib/types';

async function fetchSession(): Promise<SessionProfile | null> {
  try {
    return await apiClient.get<SessionProfile>('/auth/me');
  } catch (error) {
    // Not logged in (401) or locked out (403, e.g. suspended agency)
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export function useCurrentUser() {
  return useQuery({ queryKey: queryKeys.me, queryFn: fetchSession, staleTime: 5 * 60_000, retry: false });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => apiClient.post<SessionProfile>('/auth/login', input),
    meta: { silent: true },
    onSuccess: (profile) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, profile);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    meta: { silent: true },
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
      router.replace('/login');
    },
  });
}

/**
 * UI-level permission hints (hide buttons the user cannot use).
 * These are cosmetic: every rule is enforced again by the API.
 */
export function usePermissions() {
  const { data } = useCurrentUser();
  const role = data?.user.role;
  const readOnly = Boolean(data?.supportSession);
  return {
    profile: data ?? null,
    userId: data?.user.id ?? null,
    readOnly,
    isAgencyAdmin: role === 'AGENCY_ADMIN' && !readOnly,
    canEdit: (role === 'AGENCY_ADMIN' || role === 'AGENCY_MEMBER') && !readOnly,
  };
}
