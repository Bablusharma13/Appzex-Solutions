'use client';

import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { FilterBar, SearchInput } from '@/components/shared/search-input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, Label, Select } from '@/components/ui/input';
import { ProjectSelect, TeamSelect } from '@/features/shared/option-selects';
import { TaskDetailDialog } from '@/features/tasks/task-detail-dialog';
import { TaskFormDialog } from '@/features/tasks/task-form-dialog';
import { TaskTable } from '@/features/tasks/task-table';
import { usePermissions } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTaskSummary, useTasks } from '@/hooks/use-tasks';
import { PRIORITY, TASK_STATUS, options } from '@/lib/constants';
import type { TaskSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

type Bucket = 'all' | 'overdue' | 'today' | 'week' | 'completed';

const BUCKETS: { key: Bucket; label: string; summaryKey: keyof TaskSummary; tone?: string }[] = [
  { key: 'all', label: 'All tasks', summaryKey: 'all' },
  { key: 'overdue', label: 'Overdue', summaryKey: 'overdue', tone: 'text-red-600' },
  { key: 'today', label: 'Due today', summaryKey: 'today' },
  { key: 'week', label: 'Due this week', summaryKey: 'week' },
  { key: 'completed', label: 'Completed', summaryKey: 'completed' },
];

export default function TasksPage() {
  const { canEdit } = usePermissions();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const assignee = mine ? 'me' : assigneeId;
  useEffect(() => setPage(1), [bucket, assignee, debouncedSearch, status, priority, projectId]);

  const summary = useTaskSummary({ assigneeId: assignee, projectId });
  const { data, isLoading, isError, error, refetch, isFetching } = useTasks({
    page,
    pageSize: 20,
    due: bucket === 'all' ? '' : bucket,
    assigneeId: assignee,
    search: debouncedSearch,
    status,
    priority,
    projectId,
    sort: bucket === 'completed' ? 'createdAt' : 'dueDate',
    order: bucket === 'completed' ? 'desc' : 'asc',
  });
  const filtered = Boolean(debouncedSearch || status || priority || assignee || projectId || bucket !== 'all');

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything your team is working on, across every project."
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New task
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Due date" className="scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {BUCKETS.map((item) => {
          const active = bucket === item.key;
          const count = summary.data?.[item.summaryKey];
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={active}
              onClick={() => setBucket(item.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-slate-600 hover:bg-muted',
              )}
            >
              {item.label}
              <span className={cn('rounded-full bg-muted px-1.5 text-xs tabular-nums', !active && item.tone, active && 'bg-surface')}>{count ?? '·'}</span>
            </button>
          );
        })}
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search task titles" label="Search tasks" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-36" aria-label="Filter by status">
          <option value="">All statuses</option>
          {options(TASK_STATUS).map((option) => (
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
        <ProjectSelect value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-56" placeholder="All projects" aria-label="Filter by project" />
        <TeamSelect value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="sm:w-44" placeholder="All assignees" aria-label="Filter by assignee" disabled={mine} />
        <Label className="flex items-center gap-2 font-normal sm:ml-auto">
          <Checkbox checked={mine} onChange={(event) => setMine(event.target.checked)} />
          My tasks
        </Label>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton columns={7} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={bucket === 'overdue' ? 'Nothing overdue' : filtered ? 'No tasks match these filters' : 'No tasks yet'}
          description={bucket === 'overdue' ? 'Great work — every open task is on schedule.' : filtered ? 'Try clearing a filter.' : 'Create a task inside a project to get started.'}
          action={!filtered && canEdit && <Button onClick={() => setCreateOpen(true)}><Plus /> New task</Button>}
        />
      ) : (
        <>
          <Card className={cn('overflow-hidden transition-opacity', isFetching && 'opacity-70')}>
            <TaskTable tasks={data.items} onOpen={setOpenTaskId} showProject showMilestone={false} />
          </Card>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}
