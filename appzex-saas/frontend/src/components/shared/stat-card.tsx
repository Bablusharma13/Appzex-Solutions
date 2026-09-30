import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  default: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: ReactNode;
  tone?: keyof typeof tones;
  href?: string;
}

/** Stat tile: label, value (proportional figures), optional hint. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default', href }: StatCardProps) {
  const content = (
    <div
      className={cn(
        'flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs',
        href && 'transition-colors hover:border-slate-300 hover:bg-slate-50/60',
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-snug text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tones[tone])} aria-hidden>
        <Icon className="size-4" />
      </span>
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {content}
    </Link>
  ) : (
    content
  );
}
