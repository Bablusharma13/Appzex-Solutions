'use client';

import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { useActivity } from '@/hooks/use-agency';
import { cn } from '@/lib/utils';

const ENTITY_TYPES = [
  { value: '', label: 'All activity' },
  { value: 'project', label: 'Projects' },
  { value: 'task', label: 'Tasks' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'file', label: 'Files' },
  { value: 'client', label: 'Clients' },
  { value: 'user', label: 'Users' },
  { value: 'support_session', label: 'Platform support' },
  { value: 'agency', label: 'Agency' },
];

export default function ActivityPage() {
  const [entityType, setEntityType] = useState('');
  const [visibility, setVisibility] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [entityType, visibility]);
  const { data, isLoading, isError, error, refetch, isFetching } = useActivity({ page, pageSize: 25, entityType, visibility });

  return (
    <>
      <PageHeader
        title="Activity"
        description="Audit trail of everything that happens in your workspace, including platform support sessions."
      />
      <FilterBar>
        <Select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="sm:w-52" aria-label="Filter by type">
          {ENTITY_TYPES.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="sm:w-52" aria-label="Filter by visibility">
          <option value="">Internal and client-visible</option>
          <option value="CLIENT">Visible to clients</option>
          <option value="INTERNAL">Internal only</option>
        </Select>
      </FilterBar>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Card className="p-5">
          <ListSkeleton rows={8} />
        </Card>
      ) : data.items.length === 0 ? (
        <EmptyState icon={History} title="No activity found" description="Try a different filter." />
      ) : (
        <Card className={cn('p-5 transition-opacity', isFetching && 'opacity-70')}>
          <ActivityTimeline items={data.items} projectHref={(projectId) => `/app/projects/${projectId}`} />
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </Card>
      )}
    </>
  );
}
