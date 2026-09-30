'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { ErrorState } from '@/components/shared/states';
import { useCurrentUser } from '@/hooks/use-auth';
import type { SessionProfile } from '@/lib/types';

export const canUseSuperAdmin = (profile: SessionProfile) => profile.user.role === 'SUPER_ADMIN';

export const canUseAgencyWorkspace = (profile: SessionProfile) =>
  profile.user.role === 'AGENCY_ADMIN' ||
  profile.user.role === 'AGENCY_MEMBER' ||
  (profile.user.role === 'SUPER_ADMIN' && Boolean(profile.supportSession));

export const canUseClientPortal = (profile: SessionProfile) => profile.user.role === 'CLIENT';

export function FullPageLoader({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground" role="status">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/**
 * Client-side route protection: sends signed-out users to /login and users of
 * another role to their own home. This is a UX layer only; the API enforces
 * the same rules on every request.
 */
export function RoleGate({ allow, children }: { allow: (profile: SessionProfile) => boolean; children: (profile: SessionProfile) => ReactNode }) {
  const { data: profile, isLoading, isError, error, refetch } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = profile ? allow(profile) : false;

  useEffect(() => {
    if (isLoading || isError) return;
    if (!profile) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(profile.home);
  }, [allowed, isError, isLoading, pathname, profile, router]);

  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <ErrorState error={error} onRetry={() => refetch()} title="We could not verify your session" className="w-full max-w-md" />
      </div>
    );
  }
  if (isLoading || !profile || !allowed) return <FullPageLoader />;
  return <>{children(profile)}</>;
}
