'use client';

import { Eye, MessageSquare, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { PriorityBadge, TaskStatusBadge } from '@/components/shared/badges';
import { Avatar, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { usePermissions } from '@/hooks/use-auth';
import { useUpdateTask } from '@/hooks/use-tasks';
import type { Task } from '@/lib/types';
import { cn, dueLabel, isOverdue } from '@/lib/utils';

interface TaskTableProps {
  tasks: Task[];
  onOpen: (taskId: string) => void;
  showProject?: boolean;
  showMilestone?: boolean;
}

export function TaskTable({ tasks, onOpen, showProject = false, showMilestone = true }: TaskTableProps) {
  const { canEdit } = usePermissions();
  const updateTask = useUpdateTask();

  const toggle = (task: Task) => {
    const status = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    updateTask.mutate(
      { id: task.id, status },
      {
        onSuccess: (result) =>
          toast.success(
            `${status === 'COMPLETED' ? 'Completed' : 'Reopened'} “${task.title}” · ${task.project.name} is now ${result.projectProgress.percent}% complete`,
          ),
      },
    );
  };

  return (
    <Table>
      <THead>
        <tr>
          <TH className="w-10">
            <span className="sr-only">Done</span>
          </TH>
          <TH>Task</TH>
          {showProject && <TH>Project</TH>}
          {showMilestone && <TH>Milestone</TH>}
          <TH>Assignee</TH>
          <TH>Priority</TH>
          <TH>Due</TH>
          <TH>Status</TH>
        </tr>
      </THead>
      <tbody>
        {tasks.map((task) => {
          const pending = updateTask.isPending && updateTask.variables?.id === task.id;
          // Optimistic: reflect the click immediately while the server confirms.
          const done = pending && updateTask.variables?.status ? updateTask.variables.status === 'COMPLETED' : task.status === 'COMPLETED';
          const overdue = isOverdue(task.dueDate, done);
          return (
            <TR key={task.id} className={cn('cursor-pointer', done && 'bg-muted/20')} onClick={() => onOpen(task.id)}>
              <TD onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={done}
                  disabled={!canEdit || pending}
                  onChange={() => toggle(task)}
                  className="size-4 rounded border-input accent-[var(--primary)]"
                  aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} as completed`}
                />
              </TD>
              <TD>
                <button
                  type="button"
                  className={cn('text-left font-medium hover:underline', done && 'text-muted-foreground line-through')}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(task.id);
                  }}
                >
                  {task.title}
                </button>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {task.clientVisible && (
                    <span className="inline-flex items-center gap-1 text-teal-700">
                      <Eye className="size-3" aria-hidden /> Client visible
                    </span>
                  )}
                  {task.commentCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" aria-hidden /> {task.commentCount}
                    </span>
                  )}
                  {task.fileCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3" aria-hidden /> {task.fileCount}
                    </span>
                  )}
                </div>
              </TD>
              {showProject && (
                <TD>
                  <p className="text-sm">{task.project.name}</p>
                  <p className="text-xs text-muted-foreground">{task.project.client.companyName}</p>
                </TD>
              )}
              {showMilestone && <TD className="text-muted-foreground">{task.milestone?.name ?? '—'}</TD>}
              <TD>
                {task.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={task.assignee.name} className="size-6 text-[10px]" />
                    <span className="whitespace-nowrap text-sm">{task.assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TD>
              <TD>
                <PriorityBadge priority={task.priority} />
              </TD>
              <TD className={cn('whitespace-nowrap text-sm', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
                {task.dueDate ? dueLabel(task.dueDate, done) : '—'}
              </TD>
              <TD>
                <TaskStatusBadge status={task.status} />
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
