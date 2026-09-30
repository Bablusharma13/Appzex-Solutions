import { LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/misc';
import { describeActivity } from '@/lib/activity';
import type { Activity } from '@/lib/types';
import { cn, formatDateTime, timeAgo } from '@/lib/utils';

interface ActivityTimelineProps {
  items: Activity[];
  /** Link project names to this base path (omit to render plain text). */
  projectHref?: (projectId: string) => string;
  showProject?: boolean;
  showAgency?: boolean;
  className?: string;
}

export function ActivityTimeline({ items, projectHref, showProject = true, showAgency = false, className }: ActivityTimelineProps) {
  return (
    <ol className={cn('relative space-y-5', className)}>
      {items.map((item, index) => {
        const actorName = item.actorType === 'SUPER_ADMIN' ? 'Platform support' : item.actor?.name ?? 'System';
        return (
          <li key={item.id} className="relative flex gap-3">
            {index < items.length - 1 && <span className="absolute left-4 top-9 -bottom-5 w-px bg-border" aria-hidden />}
            {item.actorType === 'SUPER_ADMIN' ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700" aria-hidden>
                <LifeBuoy className="size-4" />
              </span>
            ) : (
              <Avatar name={actorName} />
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm leading-snug text-foreground">
                <span className="font-medium">{actorName}</span> <span className="text-slate-600">{describeActivity(item)}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                  {timeAgo(item.createdAt)}
                </time>
                {showProject && item.project && (
                  <>
                    <span aria-hidden>·</span>
                    {projectHref ? (
                      <Link href={projectHref(item.project.id)} className="hover:text-foreground hover:underline">
                        {item.project.name}
                      </Link>
                    ) : (
                      <span>{item.project.name}</span>
                    )}
                  </>
                )}
                {showAgency && item.agency && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{item.agency.name}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
