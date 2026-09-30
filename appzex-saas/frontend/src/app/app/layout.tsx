'use client';

import {
  Activity,
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  MessageSquare,
  Settings,
  UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { PlanBadge } from '@/components/shared/badges';
import { RoleGate, canUseAgencyWorkspace } from '@/components/layout/role-gate';
import { SupportBanner } from '@/components/layout/support-banner';
import { UserMenu } from '@/components/layout/user-menu';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Badge } from '@/components/ui/badge';
import type { SessionProfile } from '@/lib/types';

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/projects', label: 'Projects', icon: FolderKanban },
  { href: '/app/clients', label: 'Clients', icon: Building2 },
  { href: '/app/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/app/meetings', label: 'Meetings', icon: CalendarDays },
  { href: '/app/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/app/files', label: 'Files', icon: FileText },
  { href: '/app/team', label: 'Team', icon: UsersRound },
  { href: '/app/activity', label: 'Activity', icon: Activity },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

function AgencyBrand({ agency }: { agency: NonNullable<SessionProfile['agency']> }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
        {agency.name.charAt(0)}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-foreground">{agency.name}</p>
        <p className="text-xs text-muted-foreground">Agency workspace</p>
      </div>
    </div>
  );
}

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allow={canUseAgencyWorkspace}>
      {(profile) => (
        <WorkspaceShell
          portal="agency"
          brand={profile.agency ? <AgencyBrand agency={profile.agency} /> : null}
          nav={NAV}
          banner={profile.supportSession ? <SupportBanner session={profile.supportSession} /> : undefined}
          sidebarFooter={
            profile.agency && (
              <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                <span className="truncate">Plan</span>
                <PlanBadge plan={profile.agency.plan} />
              </div>
            )
          }
          topbar={
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground lg:hidden">{profile.agency?.name}</p>
              </div>
              {profile.supportSession && (
                <Badge tone="amber" className="hidden gap-1 sm:inline-flex">
                  <Lock className="size-3" aria-hidden /> Read-only
                </Badge>
              )}
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
