'use client';

import { FolderKanban, LayoutDashboard, CalendarDays, FileText, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { usePortalTheme } from '@/hooks/use-portal-theme';
import type { SessionProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

const NAV = [
  { href: '/client/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/client/projects', label: 'Projects', icon: FolderKanban },
  { href: '/client/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/client/meetings', label: 'Meetings', icon: CalendarDays },
  { href: '/client/files', label: 'Files', icon: FileText },
];

/** Client portal: simple top navigation, no agency chrome. */
export function ClientShell({ profile, children }: { profile: SessionProfile; children: ReactNode }) {
  const pathname = usePathname();
  usePortalTheme('client');
  return (
    <div data-portal="client" className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:px-6">
          <Link href="/client/dashboard" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
              {profile.agency?.name.charAt(0) ?? 'A'}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{profile.agency?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">Client portal · {profile.client?.companyName}</span>
            </span>
          </Link>
          <nav aria-label="Client portal" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-slate-600 hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <UserMenu profile={profile} />
        </div>
        <nav aria-label="Client portal" className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                  active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-slate-600',
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
