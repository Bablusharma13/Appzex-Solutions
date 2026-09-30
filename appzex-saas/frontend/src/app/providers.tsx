'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { ApiError, errorMessage, setSessionListener } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

function shouldRetry(failureCount: number, error: unknown) {
  // Client errors (auth, permission, validation, not found) will not fix themselves.
  if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
  return failureCount < 2;
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, refetchOnWindowFocus: false, retry: shouldRetry },
          mutations: { retry: false },
        },
        mutationCache: new MutationCache({
          // One place that surfaces failed mutations; forms may add field errors.
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.meta?.silent) return;
            toast.error(errorMessage(error));
          },
        }),
      }),
  );

  useEffect(() => {
    setSessionListener((event) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, null);
      if (!window.location.pathname.startsWith('/login')) {
        router.replace(`/login?reason=${event === 'suspended' ? 'suspended' : 'expired'}`);
      }
    });
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors closeButton toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  );
}
