'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { LucideIcon } from 'lucide-react';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { usePortalTheme } from '@/hooks/use-portal-theme';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface WorkspaceShellProps {
  portal: 'admin' | 'agency';
  brand: ReactNode;
  nav: NavItem[];
  topbar: ReactNode;
  banner?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

function SidebarNav({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-active text-sidebar-active-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
            )}
          >
            <item.icon className={cn('size-[18px] shrink-0', active ? 'opacity-100' : 'opacity-70')} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * App frame shared by the platform console and the agency workspace:
 * fixed sidebar on desktop, slide-over sidebar on mobile, sticky top bar and
 * an optional banner (support mode) that stays visible while scrolling.
 */
export function WorkspaceShell({ portal, brand, nav, topbar, banner, sidebarFooter, children }: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  usePortalTheme(portal);

  useEffect(() => {
    setMobileOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">{brand}</div>
      <SidebarNav nav={nav} onNavigate={onNavigate} />
      {sidebarFooter && <div className="border-t border-sidebar-border p-3">{sidebarFooter}</div>}
    </div>
  );

  return (
    <div data-portal={portal} className="flex h-dvh flex-col bg-background">
      {banner}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">{sidebar()}</aside>

        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" />
            <DialogPrimitive.Content data-portal={portal} className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl outline-none lg:hidden">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              {sidebar(() => setMobileOpen(false))}
              <DialogPrimitive.Close
                className="absolute right-3 top-4 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            {topbar}
          </header>
          <main ref={mainRef} id="main-content" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
