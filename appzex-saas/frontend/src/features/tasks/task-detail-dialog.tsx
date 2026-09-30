'use client';

import { Calendar, Flag, FolderKanban, Milestone as MilestoneIcon, Pencil, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PriorityBadge, VisibilityBadge } from '@/components/shared/badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState, ListSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Separator } from '@/components/ui/misc';
import { TeamSelect } from '@/features/shared/option-selects';
import { usePermissions } from '@/hooks/use-auth';
import { useAddTaskComment, useDeleteTask, useTask, useTaskComments, useUpdateTask } from '@/hooks/use-tasks';
import { TASK_STATUS, options } from '@/lib/constants';
import type { TaskStatus } from '@/lib/types';
import { cn, dueLabel, formatDate, isOverdue } from '@/lib/utils';
import { CommentThread } from './comment-thread';
import { TaskFormDialog } from './task-form-dialog';

export function TaskDetailDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { canEdit, userId } = usePermissions();
  const { data: task, isLoading, isError, error, refetch } = useTask(taskId);
  const { data: comments = [], isLoading: commentsLoading } = useTaskComments(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addComment = useAddTaskComment(taskId ?? '');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const change = (input: { status?: TaskStatus; assigneeId?: string }) => {
    if (!task) return;
    updateTask.mutate(
      { id: task.id, ...input },
      { onSuccess: (result) => toast.success(`Task updated · project ${result.projectProgress.percent}% complete`) },
    );
  };

  return (
    <>
      <Dialog open={Boolean(taskId) && !editing} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="lg">
          {isError ? (
            <DialogBody>
              <DialogTitle className="sr-only">Task</DialogTitle>
              <ErrorState error={error} onRetry={() => refetch()} />
            </DialogBody>
          ) : isLoading || !task ? (
            <DialogBody>
              <DialogTitle className="sr-only">Loading task</DialogTitle>
              <ListSkeleton rows={3} />
            </DialogBody>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{task.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <VisibilityBadge clientVisible={task.clientVisible} />
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-5">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Flag className="size-3.5" aria-hidden /> Status
                    </dt>
                    <dd>
                      <Select
                        aria-label="Task status"
                        value={task.status}
                        disabled={!canEdit || updateTask.isPending}
                        onChange={(event) => change({ status: event.target.value as TaskStatus })}
                      >
                        {options(TASK_STATUS).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </dd>
                  </div>
                  <div className="space-y-1.5">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <User className="size-3.5" aria-hidden /> Assignee
                    </dt>
                    <dd>
                      <TeamSelect
                        aria-label="Assignee"
                        value={task.assignee?.id ?? ''}
                        disabled={!canEdit || updateTask.isPending}
                        onChange={(event) => change({ assigneeId: event.target.value })}
                      />
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FolderKanban className="size-3.5" aria-hidden /> Project
                    </dt>
                    <dd>
                      <Link href={`/app/projects/${task.project.id}`} className="font-medium hover:underline" onClick={onClose}>
                        {task.project.name}
                      </Link>
                      <span className="text-muted-foreground"> · {task.project.client.companyName}</span>
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MilestoneIcon className="size-3.5" aria-hidden /> Milestone
                    </dt>
                    <dd>{task.milestone?.name ?? <span className="text-muted-foreground">None</span>}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Calendar className="size-3.5" aria-hidden /> Due
                    </dt>
                    <dd className={cn(isOverdue(task.dueDate, task.status === 'COMPLETED') && 'font-medium text-red-600')}>
                      {task.dueDate ? `${formatDate(task.dueDate)} · ${dueLabel(task.dueDate, task.status === 'COMPLETED')}` : 'No due date'}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Created</dt>
                    <dd className="text-muted-foreground">
                      {formatDate(task.createdAt)}
                      {task.createdBy && ` by ${task.createdBy.name}`}
                    </dd>
                  </div>
                </dl>

                {task.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
                  </div>
                )}

                <Separator />

                <section aria-labelledby="task-comments-heading" className="space-y-3">
                  <h3 id="task-comments-heading" className="text-sm font-semibold">
                    Comments <span className="font-normal text-muted-foreground">({comments.length})</span>
                  </h3>
                  {commentsLoading ? (
                    <ListSkeleton rows={2} />
                  ) : (
                    <CommentThread
                      comments={comments}
                      currentUserId={userId}
                      submitting={addComment.isPending}
                      placeholder="Add an internal comment…"
                      emptyText="No comments yet. Comments are internal to your team."
                      onSubmit={canEdit ? (content, reset) => addComment.mutate(content, { onSuccess: reset }) : undefined}
                    />
                  )}
                </section>
              </DialogBody>
              {canEdit && (
                <DialogFooter className="sm:justify-between">
                  <Button variant="ghost" className="text-destructive hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Edit task
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {task && <TaskFormDialog open={editing} onOpenChange={setEditing} task={task} projectId={task.projectId} />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete task?"
        description={`“${task?.title}” and its comments will be permanently deleted. Project progress will be recalculated.`}
        confirmLabel="Delete task"
        destructive
        loading={deleteTask.isPending}
        onConfirm={() =>
          task &&
          deleteTask.mutate(task.id, {
            onSuccess: (result) => {
              toast.success(`Task deleted · project ${result.projectProgress.percent}% complete`);
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </>
  );
}
