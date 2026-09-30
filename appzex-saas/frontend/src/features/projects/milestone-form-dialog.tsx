'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useCreateMilestone, useUpdateMilestone } from '@/hooks/use-projects';
import { useOnOpen } from '@/hooks/use-on-open';
import { MILESTONE_STATUS, options } from '@/lib/constants';
import type { Milestone } from '@/lib/types';
import { toDateInput } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Milestone name is required').max(160),
  description: z.string().max(5000),
  dueDate: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
});
type Values = z.infer<typeof schema>;

const empty: Values = { name: '', description: '', dueDate: '', status: 'PENDING' };

export function MilestoneFormDialog({
  open,
  onOpenChange,
  projectId,
  milestone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  milestone?: Milestone | null;
}) {
  const createMilestone = useCreateMilestone(projectId);
  const updateMilestone = useUpdateMilestone();
  const pending = createMilestone.isPending || updateMilestone.isPending;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });
  const { errors } = form.formState;

  useOnOpen(open, () => {
    form.reset(
      milestone
        ? { name: milestone.name, description: milestone.description ?? '', dueDate: toDateInput(milestone.dueDate), status: milestone.status }
        : empty,
    );
  });

  const onSubmit = form.handleSubmit((values) => {
    const callbacks = {
      onSuccess: () => {
        toast.success(milestone ? 'Milestone updated' : 'Milestone added');
        onOpenChange(false);
      },
      onError: (error: unknown) => applyServerErrors(form, error),
    };
    if (milestone) updateMilestone.mutate({ id: milestone.id, ...values }, callbacks);
    else createMilestone.mutate(values, callbacks);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{milestone ? 'Edit milestone' : 'New milestone'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="milestone-name" error={errors.name?.message} required className="sm:col-span-2">
              <Input autoFocus placeholder="e.g. Client Review" {...fieldProps('milestone-name', errors.name?.message)} {...form.register('name')} />
            </FormField>
            <FormField label="Due date" htmlFor="milestone-due" error={errors.dueDate?.message}>
              <Input type="date" {...fieldProps('milestone-due', errors.dueDate?.message)} {...form.register('dueDate')} />
            </FormField>
            <FormField label="Status" htmlFor="milestone-status">
              <Select id="milestone-status" {...form.register('status')}>
                {options(MILESTONE_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Description" htmlFor="milestone-description" className="sm:col-span-2">
              <Textarea rows={3} id="milestone-description" {...form.register('description')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {milestone ? 'Save changes' : 'Add milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
