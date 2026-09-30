'use client';

import { Building2, LayoutDashboard, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { RoleGate, canUseSuperAdmin } from '@/components/layout/role-gate';
import { SupportBanner } from '@/components/layout/support-banner';
import { UserMenu } from '@/components/layout/user-menu';
import { WorkspaceShell } from '@/components/layout/workspace-shell';

const NAV = [
  { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super-admin/agencies', label: 'Agencies', icon: Building2 },
];

function AdminBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white" aria-hidden>
        A
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">AppZex</p>
        <p className="text-xs text-sidebar-muted">Platform Console</p>
      </div>
    </div>
  );
}

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allow={canUseSuperAdmin}>
      {(profile) => (
        <WorkspaceShell
          portal="admin"
          brand={<AdminBrand />}
          nav={NAV}
          banner={profile.supportSession ? <SupportBanner session={profile.supportSession} /> : undefined}
          sidebarFooter={
            <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-sidebar-muted">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Platform actions and support sessions are recorded in the audit log.
            </p>
          }
          topbar={
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">Platform Console</p>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">Manage every agency on AppZex</p>
              </div>
              <UserMenu profile={profile} />
            </>
          }
        >
          {children}
        </WorkspaceShell>
      )}
    </RoleGate>
  );
}
