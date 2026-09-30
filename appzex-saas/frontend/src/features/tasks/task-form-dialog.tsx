'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Input, Label, Select, Textarea } from '@/components/ui/input';
import { ProjectSelect, TeamSelect } from '@/features/shared/option-selects';
import { useMilestones } from '@/hooks/use-projects';
import { useOnOpen } from '@/hooks/use-on-open';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';
import { PRIORITY, TASK_STATUS, options } from '@/lib/constants';
import type { Task } from '@/lib/types';
import { toDateInput } from '@/lib/utils';

const schema = z.object({
  projectId: z.string().min(1, 'Select a project'),
  title: z.string().trim().min(2, 'Task title is required').max(200),
  description: z.string().max(10000),
  assigneeId: z.string(),
  milestoneId: z.string(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  dueDate: z.string(),
  clientVisible: z.boolean(),
});
type Values = z.infer<typeof schema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed project (project page). When omitted the user picks one. */
  projectId?: string;
  task?: Task | null;
  defaults?: Partial<Values>;
}

export function TaskFormDialog({ open, onOpenChange, projectId, task, defaults }: TaskFormDialogProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const pending = createTask.isPending || updateTask.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: projectId ?? '',
      title: '',
      description: '',
      assigneeId: '',
      milestoneId: '',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: '',
      clientVisible: false,
    },
  });
  const { errors } = form.formState;
  const selectedProject = form.watch('projectId');
  const { data: milestones = [] } = useMilestones(selectedProject);

  useOnOpen(open, () => {
    form.reset(
      task
        ? {
            projectId: task.projectId,
            title: task.title,
            description: task.description ?? '',
            assigneeId: task.assignee?.id ?? '',
            milestoneId: task.milestoneId ?? '',
            status: task.status,
            priority: task.priority,
            dueDate: toDateInput(task.dueDate),
            clientVisible: task.clientVisible,
          }
        : {
            projectId: projectId ?? '',
            title: '',
            description: '',
            assigneeId: '',
            milestoneId: '',
            status: 'TODO',
            priority: 'MEDIUM',
            dueDate: '',
            clientVisible: false,
            ...defaults,
          },
    );
  });

  const onSubmit = form.handleSubmit(({ projectId: chosenProject, ...values }) => {
    const handleError = (error: unknown) => applyServerErrors(form, error);
    if (task) {
      updateTask.mutate(
        { id: task.id, ...values },
        {
          onError: handleError,
          onSuccess: (result) => {
            toast.success(`Task saved · project ${result.projectProgress.percent}% complete`);
            onOpenChange(false);
          },
        },
      );
    } else {
      createTask.mutate(
        { projectId: chosenProject, ...values },
        {
          onError: handleError,
          onSuccess: () => {
            toast.success('Task created');
            onOpenChange(false);
          },
        },
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
            <DialogDescription>Completing tasks updates project progress automatically.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {!projectId && !task && (
              <FormField label="Project" htmlFor="task-project" error={errors.projectId?.message} required className="sm:col-span-2">
                <ProjectSelect activeOnly {...fieldProps('task-project', errors.projectId?.message)} {...form.register('projectId', { onChange: () => form.setValue('milestoneId', '') })} />
              </FormField>
            )}
            <FormField label="Title" htmlFor="task-title" error={errors.title?.message} required className="sm:col-span-2">
              <Input autoFocus {...fieldProps('task-title', errors.title?.message)} {...form.register('title')} />
            </FormField>
            <FormField label="Assignee" htmlFor="task-assignee" error={errors.assigneeId?.message}>
              <TeamSelect {...fieldProps('task-assignee', errors.assigneeId?.message)} {...form.register('assigneeId')} />
            </FormField>
            <FormField label="Milestone" htmlFor="task-milestone" error={errors.milestoneId?.message}>
              <Select {...fieldProps('task-milestone', errors.milestoneId?.message)} disabled={!selectedProject} {...form.register('milestoneId')}>
                <option value="">No milestone</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="task-status">
              <Select id="task-status" {...form.register('status')}>
                {options(TASK_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="task-priority">
              <Select id="task-priority" {...form.register('priority')}>
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Due date" htmlFor="task-due" error={errors.dueDate?.message}>
              <Input type="date" {...fieldProps('task-due', errors.dueDate?.message)} {...form.register('dueDate')} />
            </FormField>
            <div className="flex items-end pb-2">
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox {...form.register('clientVisible')} />
                Show to client (e.g. an approval they owe)
              </Label>
            </div>
            <FormField label="Description" htmlFor="task-description" className="sm:col-span-2">
              <Textarea rows={3} id="task-description" {...form.register('description')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {task ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
