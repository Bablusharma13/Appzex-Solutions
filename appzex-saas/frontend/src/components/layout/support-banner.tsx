'use client';

import { LifeBuoy, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEndSupportSession } from '@/hooks/use-super-admin';
import type { SupportSessionInfo } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

/** Always-visible banner while a super admin views an agency workspace. */
export function SupportBanner({ session }: { session: SupportSessionInfo }) {
  const endSession = useEndSupportSession();
  return (
    <div role="status" className="shrink-0 border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex items-start gap-2.5 sm:items-center">
          <LifeBuoy className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">
              Super Admin Support Mode — Viewing Agency: <span className="underline decoration-amber-500 underline-offset-2">{session.agencyName}</span>
            </p>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-amber-900">
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" aria-hidden /> Read-only: changes are blocked by the API
              </span>
              <span>Session is audited · expires {formatDateTime(session.expiresAt)}</span>
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-amber-950 text-white hover:bg-amber-900"
          loading={endSession.isPending}
          onClick={() => endSession.mutate({ sessionId: session.id, agencyId: session.agencyId })}
        >
          Exit Support Mode
        </Button>
      </div>
    </div>
  );
}
