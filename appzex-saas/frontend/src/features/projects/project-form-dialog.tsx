'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Input, Label, Select, Textarea } from '@/components/ui/input';
import { ClientSelect, TeamSelect } from '@/features/shared/option-selects';
import { useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import { useOnOpen } from '@/hooks/use-on-open';
import { PRIORITY, PROJECT_STATUS, options } from '@/lib/constants';
import type { ProjectDetail } from '@/lib/types';
import { toDateInput } from '@/lib/utils';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Project name is required').max(160),
    description: z.string().max(10000),
    clientId: z.string().min(1, 'Select a client'),
    startDate: z.string(),
    dueDate: z.string(),
    status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    managerId: z.string(),
    createDefaultMilestones: z.boolean(),
  })
  .refine((value) => !value.startDate || !value.dueDate || value.dueDate >= value.startDate, {
    message: 'Expected completion must be on or after the start date',
    path: ['dueDate'],
  });
type Values = z.infer<typeof schema>;

const empty: Values = {
  name: '',
  description: '',
  clientId: '',
  startDate: '',
  dueDate: '',
  status: 'ACTIVE',
  priority: 'MEDIUM',
  managerId: '',
  createDefaultMilestones: true,
};

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectDetail | null;
  defaultClientId?: string;
}

export function ProjectFormDialog({ open, onOpenChange, project, defaultClientId }: ProjectFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject(project?.id ?? '');
  const mutation = isEdit ? updateProject : createProject;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });
  const { errors } = form.formState;

  useOnOpen(open, () => {
    form.reset(
      project
        ? {
            name: project.name,
            description: project.description ?? '',
            clientId: project.client.id,
            startDate: toDateInput(project.startDate),
            dueDate: toDateInput(project.dueDate),
            status: project.status,
            priority: project.priority,
            managerId: project.manager?.id ?? '',
            createDefaultMilestones: false,
          }
        : { ...empty, clientId: defaultClientId ?? '' },
    );
  });

  const onSubmit = form.handleSubmit(({ createDefaultMilestones, ...values }) => {
    const handleError = (error: unknown) => applyServerErrors(form, error);
    if (isEdit) {
      updateProject.mutate(values, {
        onError: handleError,
        onSuccess: () => {
          toast.success('Project updated');
          onOpenChange(false);
        },
      });
    } else {
      createProject.mutate(
        { ...values, createDefaultMilestones },
        {
          onError: handleError,
          onSuccess: (created) => {
            toast.success(`${created.name} created`);
            onOpenChange(false);
            router.push(`/app/projects/${created.id}`);
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
            <DialogTitle>{isEdit ? 'Edit project' : 'New project'}</DialogTitle>
            <DialogDescription>Progress is calculated automatically from completed tasks.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Project name" htmlFor="project-name" error={errors.name?.message} required className="sm:col-span-2">
              <Input autoFocus {...fieldProps('project-name', errors.name?.message)} {...form.register('name')} />
            </FormField>
            <FormField label="Client" htmlFor="project-client" error={errors.clientId?.message} required>
              <ClientSelect {...fieldProps('project-client', errors.clientId?.message)} {...form.register('clientId')} />
            </FormField>
            <FormField label="Project manager" htmlFor="project-manager" error={errors.managerId?.message}>
              <TeamSelect placeholder="No manager" {...fieldProps('project-manager', errors.managerId?.message)} {...form.register('managerId')} />
            </FormField>
            <FormField label="Start date" htmlFor="project-start" error={errors.startDate?.message}>
              <Input type="date" {...fieldProps('project-start', errors.startDate?.message)} {...form.register('startDate')} />
            </FormField>
            <FormField label="Expected completion" htmlFor="project-due" error={errors.dueDate?.message}>
              <Input type="date" {...fieldProps('project-due', errors.dueDate?.message)} {...form.register('dueDate')} />
            </FormField>
            <FormField label="Status" htmlFor="project-status">
              <Select id="project-status" {...form.register('status')}>
                {options(PROJECT_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Priority" htmlFor="project-priority">
              <Select id="project-priority" {...form.register('priority')}>
                {options(PRIORITY).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Description" htmlFor="project-description" error={errors.description?.message} className="sm:col-span-2">
              <Textarea rows={3} {...fieldProps('project-description', errors.description?.message)} {...form.register('description')} />
            </FormField>
            {!isEdit && (
              <Label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 font-normal sm:col-span-2">
                <Checkbox className="mt-0.5" {...form.register('createDefaultMilestones')} />
                <span>
                  <span className="block text-sm font-medium">Add standard milestones</span>
                  <span className="text-xs text-muted-foreground">
                    Planning, Design, Development, Testing, Client Review and Launch, spread across the timeline.
                  </span>
                </span>
              </Label>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
