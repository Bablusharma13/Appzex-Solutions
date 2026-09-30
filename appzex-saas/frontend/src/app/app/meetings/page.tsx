'use client';

import { CalendarDays, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { MeetingFormDialog } from '@/features/meetings/meeting-form-dialog';
import { MeetingList } from '@/features/meetings/meeting-list';
import { ProjectSelect } from '@/features/shared/option-selects';
import { usePermissions } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMeetings } from '@/hooks/use-work';
import { cn } from '@/lib/utils';

export default function MeetingsPage() {
  const { canEdit } = usePermissions();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [projectId, setProjectId] = useState('');
  const [visibility, setVisibility] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => setPage(1), [debouncedSearch, projectId, visibility]);
  const { data, isLoading, isError, error, refetch, isFetching } = useMeetings({
    page,
    pageSize: 10,
    search: debouncedSearch,
    projectId,
    clientVisible: visibility,
  });
  const filtered = Boolean(debouncedSearch || projectId || visibility);

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Meeting timeline across all projects. Raw notes stay internal; summaries can be shared."
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Record meeting
            </Button>
          )
        }
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search meeting titles" label="Search meetings" />
        <ProjectSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-60" placeholder="All projects" aria-label="Filter by project" />
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="sm:w-44" aria-label="Filter by visibility">
          <option value="">All meetings</option>
          <option value="true">Shared with client</option>
          <option value="false">Internal only</option>
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={4} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtered ? 'No meetings match your filters' : 'No meetings recorded yet'}
          description={filtered ? 'Try clearing a filter.' : 'Record a meeting and let AI draft the summary and action items.'}
          action={!filtered && canEdit && <Button onClick={() => setCreateOpen(true)}><Plus /> Record meeting</Button>}
        />
      ) : (
        <div className={cn('transition-opacity', isFetching && 'opacity-70')}>
          <MeetingList meetings={data.items} showProject />
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <MeetingFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
