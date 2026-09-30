import { CalendarDays, Flag } from 'lucide-react';
import Link from 'next/link';
import { ProjectStatusBadge } from '@/components/shared/badges';
import { ProjectProgress } from '@/components/shared/progress-bar';
import type { PortalProject } from '@/lib/types';
import { dueLabel } from '@/lib/utils';

export function PortalProjectCard({ project }: { project: PortalProject }) {
  const done = project.status === 'COMPLETED';
  return (
    <Link
      href={`/client/projects/${project.id}`}
      className="group flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-primary">{project.name}</h3>
          {project.manager && <p className="truncate text-sm text-muted-foreground">Project lead: {project.manager.name}</p>}
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <ProjectProgress progress={project.progress} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {project.dueDate ? dueLabel(project.dueDate, done) : 'No due date'}
        </span>
        {project.nextMilestone && (
          <span className="inline-flex items-center gap-1 truncate">
            <Flag className="size-3.5" aria-hidden /> Next: {project.nextMilestone.name}
          </span>
        )}
      </div>
    </Link>
  );
}
