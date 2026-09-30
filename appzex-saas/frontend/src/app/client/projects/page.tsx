'use client';

import { FolderKanban } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/shared/states';
import { PortalProjectCard } from '@/features/portal/portal-project-card';
import { usePortalProjects } from '@/hooks/use-portal';

export default function ClientProjectsPage() {
  const { data: projects, isLoading, isError, error, refetch } = usePortalProjects();

  return (
    <>
      <PageHeader title="Projects" description="Projects your agency is delivering for you." />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !projects ? (
        <CardGridSkeleton count={3} />
      ) : projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Projects appear here as soon as your agency creates them." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <PortalProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
