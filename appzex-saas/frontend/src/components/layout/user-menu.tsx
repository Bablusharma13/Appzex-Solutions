'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import { RoleBadge } from '@/components/shared/badges';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { useLogout } from '@/hooks/use-auth';
import type { SessionProfile } from '@/lib/types';

export function UserMenu({ profile }: { profile: SessionProfile }) {
  const logout = useLogout();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-muted"
        aria-label="Open account menu"
      >
        <Avatar name={profile.user.name} />
        <span className="hidden min-w-0 md:block">
          <span className="block max-w-40 truncate text-sm font-medium text-foreground">{profile.user.name}</span>
          <span className="block max-w-40 truncate text-xs text-muted-foreground">{profile.user.jobTitle ?? profile.user.email}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="space-y-1.5 px-2.5 py-2">
          <p className="truncate text-sm font-medium">{profile.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.user.email}</p>
          <RoleBadge role={profile.user.role} />
        </div>
        {(profile.agency || profile.client) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {profile.client ? `${profile.client.companyName} · via ${profile.agency?.name}` : profile.agency?.name}
            </DropdownMenuLabel>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
