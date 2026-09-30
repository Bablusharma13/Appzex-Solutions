'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type QueryParams, apiClient } from '@/lib/api';
import { invalidate } from '@/lib/invalidate';
import { queryKeys } from '@/lib/query-keys';
import type { ClientDetail, ClientListItem, Paginated, PortalUser } from '@/lib/types';

export interface ClientInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  portalEnabled: boolean;
}

export function useClients(params: QueryParams) {
  return useQuery({
    queryKey: queryKeys.clients.list(params),
    queryFn: () => apiClient.get<Paginated<ClientListItem>>('/clients', params),
    placeholderData: keepPreviousData,
  });
}

/** All clients for dropdowns (small agencies; capped at 100). */
export function useClientOptions() {
  return useClients({ pageSize: 100, sort: 'companyName', order: 'asc' });
}

export function useClient(id: string) {
  return useQuery({ queryKey: queryKeys.clients.detail(id), queryFn: () => apiClient.get<ClientDetail>(`/clients/${id}`) });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => apiClient.post<{ id: string; companyName: string }>('/clients', input),
    onSuccess: () => invalidate(queryClient, 'clients', 'dashboard', 'activity'),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClientInput>) => apiClient.patch(`/clients/${id}`, input),
    onSuccess: () => invalidate(queryClient, 'clients', 'projects', 'activity'),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clients/${id}`),
    onSuccess: () => invalidate(queryClient, 'clients', 'dashboard', 'activity'),
  });
}

export function useCreatePortalUser(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      apiClient.post<PortalUser>(`/clients/${clientId}/portal-users`, input),
    onSuccess: () => invalidate(queryClient, 'clients', 'activity'),
  });
}
