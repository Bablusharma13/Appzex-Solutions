'use client';

import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { FeedbackDetailDialog } from '@/features/feedback/feedback-detail-dialog';
import { FeedbackList } from '@/features/feedback/feedback-list';
import { ProjectSelect } from '@/features/shared/option-selects';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFeedbackList } from '@/hooks/use-work';
import { FEEDBACK_STATUS, options } from '@/lib/constants';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [{ value: 'open', label: 'Needs attention' }, { value: '', label: 'All' }, ...options(FEEDBACK_STATUS)];

export default function FeedbackPage() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => setPage(1), [statusFilter, projectId, debouncedSearch]);
  const { data, isLoading, isError, error, refetch, isFetching } = useFeedbackList({
    page,
    pageSize: 15,
    projectId,
    search: debouncedSearch,
    open: statusFilter === 'open' ? 'true' : '',
    status: statusFilter !== 'open' ? statusFilter : '',
  });

  return (
    <>
      <PageHeader title="Feedback" description="Client feedback and change requests across every project. Status changes and replies are visible to the client." />

      <div className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Feedback status">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value || 'all'}
            role="tab"
            aria-selected={statusFilter === option.value}
            onClick={() => setStatusFilter(option.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === option.value ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-slate-600 hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search feedback titles" label="Search feedback" />
        <ProjectSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-60" placeholder="All projects" aria-label="Filter by project" />
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={5} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={statusFilter === 'open' ? 'No feedback waiting on you' : 'No feedback found'}
          description="Clients submit feedback from their portal; it appears here instantly."
        />
      ) : (
        <div className={cn('transition-opacity', isFetching && 'opacity-70')}>
          <FeedbackList items={data.items} onOpen={setOpenId} showProject />
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </div>
      )}

      <FeedbackDetailDialog feedbackId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
