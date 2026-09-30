import { CalendarDays, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { PriorityBadge, ProjectStatusBadge } from '@/components/shared/badges';
import { ProjectProgress } from '@/components/shared/progress-bar';
import { Avatar } from '@/components/ui/misc';
import type { ProjectListItem } from '@/lib/types';
import { cn, dueLabel, isOverdue } from '@/lib/utils';

export function ProjectCard({ project, href }: { project: ProjectListItem; href: string }) {
  const done = project.status === 'COMPLETED';
  const overdue = isOverdue(project.dueDate, done);
  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground group-hover:text-primary">{project.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{project.client.companyName}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <ProjectProgress progress={project.progress} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-red-600')}>
          <CalendarDays className="size-3.5" aria-hidden />
          {project.dueDate ? dueLabel(project.dueDate, done) : 'No due date'}
        </span>
        <span className="flex items-center gap-2">
          {project.openFeedbackCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Open feedback">
              <MessageSquare className="size-3.5" aria-hidden /> {project.openFeedbackCount}
            </span>
          )}
          <PriorityBadge priority={project.priority} />
          {project.manager && (
            <span title={`Managed by ${project.manager.name}`}>
              <Avatar name={project.manager.name} className="size-6 text-[10px]" />
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
