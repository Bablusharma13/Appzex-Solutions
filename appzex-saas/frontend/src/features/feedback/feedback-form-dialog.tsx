'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useOnOpen } from '@/hooks/use-on-open';

const schema = z.object({
  projectId: z.string().min(1, 'Select a project'),
  title: z.string().trim().min(3, 'Feedback title is required').max(200),
  description: z.string().trim().min(5, 'Please describe the feedback').max(10000),
});
export type FeedbackFormValues = z.infer<typeof schema>;

interface FeedbackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Projects the user may submit feedback on. */
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: (values: FeedbackFormValues, done: () => void, fail: (error: unknown) => void) => void;
}

/** Shared by the client portal ("Submit feedback") and agency ("Log feedback"). */
export function FeedbackFormDialog({
  open,
  onOpenChange,
  projects,
  defaultProjectId,
  title = 'Submit feedback',
  description = 'Share a change request, question or issue with your agency.',
  submitLabel = 'Submit feedback',
  pending,
  onSubmit,
}: FeedbackFormDialogProps) {
  const form = useForm<FeedbackFormValues>({ resolver: zodResolver(schema), defaultValues: { projectId: '', title: '', description: '' } });
  const { errors } = form.formState;

  useOnOpen(open, () => form.reset({ projectId: defaultProjectId ?? (projects.length === 1 ? projects[0].id : ''), title: '', description: '' }));

  const submit = form.handleSubmit((values) =>
    onSubmit(
      values,
      () => onOpenChange(false),
      (error) => applyServerErrors(form, error),
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {defaultProjectId ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Project: </span>
                <span className="font-medium">{projects.find((project) => project.id === defaultProjectId)?.name}</span>
              </p>
            ) : (
              <FormField label="Project" htmlFor="feedback-project" error={errors.projectId?.message} required>
                <Select {...fieldProps('feedback-project', errors.projectId?.message)} {...form.register('projectId')}>
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Title" htmlFor="feedback-title" error={errors.title?.message} required>
              <Input placeholder="e.g. Update the hero headline" {...fieldProps('feedback-title', errors.title?.message)} {...form.register('title')} />
            </FormField>
            <FormField label="Details" htmlFor="feedback-description" error={errors.description?.message} required>
              <Textarea rows={5} {...fieldProps('feedback-description', errors.description?.message)} {...form.register('description')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
