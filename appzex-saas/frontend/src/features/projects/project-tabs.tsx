'use client';

import { CalendarDays, Check, FileText, Flag, History, ListTodo, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { MilestoneStatusBadge } from '@/components/shared/badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FileList } from '@/components/shared/file-list';
import { Pagination } from '@/components/shared/pagination';
import { ProgressBar } from '@/components/shared/progress-bar';
import { FilterBar } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton, TableSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select } from '@/components/ui/input';
import { FeedbackDetailDialog } from '@/features/feedback/feedback-detail-dialog';
import { FeedbackFormDialog } from '@/features/feedback/feedback-form-dialog';
import { FeedbackList } from '@/features/feedback/feedback-list';
import { FileUploadDialog } from '@/features/files/file-upload-dialog';
import { MeetingFormDialog } from '@/features/meetings/meeting-form-dialog';
import { MeetingList } from '@/features/meetings/meeting-list';
import { TeamSelect } from '@/features/shared/option-selects';
import { TaskDetailDialog } from '@/features/tasks/task-detail-dialog';
import { TaskFormDialog } from '@/features/tasks/task-form-dialog';
import { TaskTable } from '@/features/tasks/task-table';
import { usePermissions } from '@/hooks/use-auth';
import { useDeleteMilestone, useMilestones, useProjectActivity, useUpdateMilestone } from '@/hooks/use-projects';
import { useProjectTasks } from '@/hooks/use-tasks';
import { useCreateFeedback, useProjectFeedback, useProjectFiles, useProjectMeetings, useUploadFile } from '@/hooks/use-work';
import { MILESTONE_STATUS, TASK_STATUS, options } from '@/lib/constants';
import type { Milestone, MilestoneStatus } from '@/lib/types';
import { cn, dueLabel, formatDate, isOverdue } from '@/lib/utils';
import { MilestoneFormDialog } from './milestone-form-dialog';

function TabHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ----- Milestones -------------------------------------------------------------------

export function MilestonesTab({ projectId }: { projectId: string }) {
  const { canEdit } = usePermissions();
  const { data: milestones, isLoading, isError, error, refetch } = useMilestones(projectId);
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [deleting, setDeleting] = useState<Milestone | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <TabHeader
        title="Milestones"
        description="Major phases of the project. Clients can see milestone progress."
        action={
          canEdit && (
            <Button onClick={openCreate}>
              <Plus /> Add milestone
            </Button>
          )
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !milestones ? (
        <ListSkeleton rows={4} />
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones yet"
          description="Break the project into phases such as Planning, Design, Development and Launch."
          action={canEdit && <Button onClick={openCreate}><Plus /> Add milestone</Button>}
        />
      ) : (
        <ol className="space-y-3">
          {milestones.map((milestone, index) => {
            const done = milestone.status === 'COMPLETED';
            const overdue = isOverdue(milestone.dueDate, done);
            return (
              <li key={milestone.id} className="flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    done ? 'bg-emerald-100 text-emerald-700' : milestone.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600',
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium">{milestone.name}</h3>
                      <p className={cn('text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                        {milestone.dueDate ? `${formatDate(milestone.dueDate)} · ${dueLabel(milestone.dueDate, done)}` : 'No due date'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <Select
                          aria-label={`Status of ${milestone.name}`}
                          className="h-8 w-36 text-xs"
                          value={milestone.status}
                          disabled={updateMilestone.isPending}
                          onChange={(event) =>
                            updateMilestone.mutate(
                              { id: milestone.id, status: event.target.value as MilestoneStatus },
                              { onSuccess: () => toast.success(`${milestone.name} updated`) },
                            )
                          }
                        >
                          {options(MILESTONE_STATUS).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <MilestoneStatusBadge status={milestone.status} />
                      )}
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${milestone.name}`}>
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onSelect={() => {
                                setEditing(milestone);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive onSelect={() => setDeleting(milestone)}>
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  {milestone.description && <p className="text-sm text-muted-foreground">{milestone.description}</p>}
                  <div className="flex items-center gap-3">
                    <ProgressBar value={milestone.progress.percent} size="sm" label={`${milestone.name} progress`} className="max-w-xs" />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {milestone.progress.totalTasks === 0 ? 'No tasks' : `${milestone.progress.completedTasks}/${milestone.progress.totalTasks} tasks`}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <MilestoneFormDialog open={formOpen} onOpenChange={setFormOpen} projectId={projectId} milestone={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete milestone?"
        description={`“${deleting?.name}” will be removed. Its tasks are kept but no longer linked to a milestone.`}
        confirmLabel="Delete milestone"
        destructive
        loading={deleteMilestone.isPending}
        onConfirm={() =>
          deleting &&
          deleteMilestone.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Milestone deleted');
              setDeleting(null);
            },
          })
        }
      />
    </>
  );
}

// ----- Tasks --------------------------------------------------------------------------

export function TasksTab({ projectId }: { projectId: string }) {
  const { canEdit } = usePermissions();
  const [status, setStatus] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data, isLoading, isError, error, refetch, isFetching } = useProjectTasks(projectId, {
    status,
    milestoneId,
    assigneeId,
    page,
    pageSize: 25,
    sort: 'dueDate',
    order: 'asc',
  });
  const filtered = Boolean(status || milestoneId || assigneeId);
  const update = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <TabHeader
        title="Tasks"
        description="Tick a task to complete it — project progress updates instantly."
        action={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Add task
            </Button>
          )
        }
      />
      <FilterBar>
        <Select value={status} onChange={(event) => update(setStatus)(event.target.value)} className="sm:w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          {options(TASK_STATUS).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={milestoneId} onChange={(event) => update(setMilestoneId)(event.target.value)} className="sm:w-48" aria-label="Filter by milestone">
          <option value="">All milestones</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.name}
            </option>
          ))}
        </Select>
        <TeamSelect value={assigneeId} onChange={(event) => update(setAssigneeId)(event.target.value)} className="sm:w-48" placeholder="All assignees" aria-label="Filter by assignee" />
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton columns={6} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={filtered ? 'No tasks match these filters' : 'No tasks yet'}
          description={filtered ? 'Try clearing a filter.' : 'Add tasks to start tracking progress. Progress is calculated from completed tasks.'}
          action={!filtered && canEdit && <Button onClick={() => setCreateOpen(true)}><Plus /> Add task</Button>}
        />
      ) : (
        <>
          <Card className={cn('overflow-hidden transition-opacity', isFetching && 'opacity-70')}>
            <TaskTable tasks={data.items} onOpen={setOpenTaskId} />
          </Card>
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
      <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

// ----- Meetings -------------------------------------------------------------------------

export function MeetingsTab({ projectId }: { projectId: string }) {
  const { canEdit } = usePermissions();
  const { data: meetings, isLoading, isError, error, refetch } = useProjectMeetings(projectId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <TabHeader
        title="Meetings"
        description="Record meeting notes and turn them into a client-ready summary with AI."
        action={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Record meeting
            </Button>
          )
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !meetings ? (
        <ListSkeleton rows={3} />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No meetings recorded"
          description="Capture kickoffs, reviews and check-ins so decisions are never lost."
          action={canEdit && <Button onClick={() => setCreateOpen(true)}><Plus /> Record meeting</Button>}
        />
      ) : (
        <MeetingList meetings={meetings} />
      )}
      <MeetingFormDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
    </>
  );
}

// ----- Feedback --------------------------------------------------------------------------

export function FeedbackTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { canEdit } = usePermissions();
  const { data: items, isLoading, isError, error, refetch } = useProjectFeedback(projectId);
  const createFeedback = useCreateFeedback();
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <TabHeader
        title="Feedback & change requests"
        description="Client feedback with status tracking. Replies are visible to the client."
        action={
          canEdit && (
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus /> Log feedback
            </Button>
          )
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !items ? (
        <ListSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback yet" description="Feedback submitted by the client from their portal appears here." />
      ) : (
        <FeedbackList items={items} onOpen={setOpenId} />
      )}

      <FeedbackDetailDialog feedbackId={openId} onClose={() => setOpenId(null)} />
      <FeedbackFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={[{ id: projectId, name: projectName }]}
        defaultProjectId={projectId}
        title="Log feedback"
        description="Record feedback received by email or phone. It is visible to the client."
        submitLabel="Log feedback"
        pending={createFeedback.isPending}
        onSubmit={(values, done, fail) =>
          createFeedback.mutate(values, {
            onSuccess: () => {
              toast.success('Feedback logged');
              done();
            },
            onError: fail,
          })
        }
      />
    </>
  );
}

// ----- Files -----------------------------------------------------------------------------

export function FilesTab({ projectId }: { projectId: string }) {
  const { canEdit, isAgencyAdmin, userId } = usePermissions();
  const { data: files, isLoading, isError, error, refetch } = useProjectFiles(projectId);
  const upload = useUploadFile();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <TabHeader
        title="Files"
        description="Private by default. Only files marked “client visible” appear in the client portal."
        action={
          canEdit && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Upload file
            </Button>
          )
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !files ? (
        <ListSkeleton rows={3} />
      ) : files.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No files yet"
          description="Upload briefs, designs, estimates or deliverables."
          action={canEdit && <Button onClick={() => setUploadOpen(true)}><Upload /> Upload file</Button>}
        />
      ) : (
        <FileList files={files} manage={canEdit ? { currentUserId: userId, isAdmin: isAgencyAdmin } : null} />
      )}
      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        pending={upload.isPending}
        onUpload={(input, done, fail) =>
          upload.mutate(input, {
            onSuccess: (file) => {
              toast.success(`${file.originalName} uploaded`);
              done();
            },
            onError: fail,
          })
        }
      />
    </>
  );
}

// ----- Activity --------------------------------------------------------------------------

export function ActivityTab({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useProjectActivity(projectId, { page, pageSize: 20 });

  return (
    <>
      <TabHeader title="Activity" description="Every change on this project, newest first." />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={6} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" />
      ) : (
        <Card className="p-5">
          <ActivityTimeline items={data.items} showProject={false} />
          <Pagination pagination={data.pagination} onPageChange={setPage} />
        </Card>
      )}
    </>
  );
}
