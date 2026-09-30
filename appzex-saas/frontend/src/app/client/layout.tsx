'use client';

import type { ReactNode } from 'react';
import { ClientShell } from '@/components/layout/client-shell';
import { RoleGate, canUseClientPortal } from '@/components/layout/role-gate';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allow={canUseClientPortal}>{(profile) => <ClientShell profile={profile}>{children}</ClientShell>}</RoleGate>
  );
}
