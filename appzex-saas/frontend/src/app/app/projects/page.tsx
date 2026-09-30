'use client';

import { FolderKanban, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { ProjectCard } from '@/components/shared/project-card';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { CardGridSkeleton, EmptyState, ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { ClientSelect } from '@/features/shared/option-selects';
import { usePermissions } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useProjects } from '@/hooks/use-projects';
import { PRIORITY, PROJECT_STATUS, options } from '@/lib/constants';
import { cn } from '@/lib/utils';

const SORTS = {
  newest: { sort: 'createdAt', order: 'desc', label: 'Newest first' },
  due: { sort: 'dueDate', order: 'asc', label: 'Due date' },
  name: { sort: 'name', order: 'asc', label: 'Name A–Z' },
  priority: { sort: 'priority', order: 'desc', label: 'Priority' },
} as const;

export default function ProjectsPage() {
  const { canEdit } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [clientId, setClientId] = useState('');
  const [sortKey, setSortKey] = useState<keyof typeof SORTS>('newest');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, status, priority, clientId, sortKey]);

  const { data, isLoading, isError, error, refetch, isFetching } = useProjects({
    page,
    pageSize: 12,
    search: debouncedSearch,
    status,
    priority,
    clientId,
    sort: SORTS[sortKey].sort,
    order: SORTS[sortKey].order,
  });
  const filtered = Boolean(debouncedSearch || status || priority || clientId);

  return (
    <>
      <PageHeader
        title="Projects"
        description="All projects in your agency. Progress is derived from completed tasks."
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New project
            </Button>
          )
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects or clients" label="Search projects" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-36" aria-label="Filter by status">
          <option value="">All statuses</option>
          {options(PROJECT_STATUS).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="sm:w-36" aria-label="Filter by priority">
          <option value="">All priorities</option>
          {options(PRIORITY).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <ClientSelect value={clientId} onChange={(event) => setClientId(event.target.value)} className="sm:w-48" placeholder="All clients" aria-label="Filter by client" />
        <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as keyof typeof SORTS)} className="sm:ml-auto sm:w-40" aria-label="Sort projects">
          {Object.entries(SORTS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <CardGridSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={filtered ? 'No projects match your filters' : 'No projects yet'}
          description={filtered ? 'Try a different search or clear the filters.' : 'Create your first project to start tracking agency work.'}
          action={
            !filtered &&
            canEdit && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> New project
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-70')}>
            {data.items.map((project) => (
              <ProjectCard key={project.id} project={project} href={`/app/projects/${project.id}`} />
            ))}
          </div>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
