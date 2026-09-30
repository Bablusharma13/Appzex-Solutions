'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { useCreateTeamMember } from '@/hooks/use-agency';
import { useOnOpen } from '@/hooks/use-on-open';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(['AGENCY_ADMIN', 'AGENCY_MEMBER']),
  jobTitle: z.string().trim().max(120),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
});
type Values = z.infer<typeof schema>;

const empty: Values = { name: '', email: '', role: 'AGENCY_MEMBER', jobTitle: '', password: '' };

export function TeamMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createMember = useCreateTeamMember();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });
  const { errors } = form.formState;
  useOnOpen(open, () => form.reset(empty));

  const onSubmit = form.handleSubmit((values) =>
    createMember.mutate(values, {
      onSuccess: () => {
        toast.success(`${values.name} was added to your team`);
        onOpenChange(false);
      },
      onError: (error) => applyServerErrors(form, error),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>New members join your agency workspace only.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="member-name" error={errors.name?.message} required>
              <Input {...fieldProps('member-name', errors.name?.message)} {...form.register('name')} />
            </FormField>
            <FormField label="Email" htmlFor="member-email" error={errors.email?.message} required>
              <Input type="email" autoComplete="off" {...fieldProps('member-email', errors.email?.message)} {...form.register('email')} />
            </FormField>
            <FormField label="Role" htmlFor="member-role">
              <Select id="member-role" {...form.register('role')}>
                <option value="AGENCY_MEMBER">Team member</option>
                <option value="AGENCY_ADMIN">Agency admin</option>
              </Select>
            </FormField>
            <FormField label="Job title" htmlFor="member-title" error={errors.jobTitle?.message}>
              <Input placeholder="e.g. Designer" {...fieldProps('member-title', errors.jobTitle?.message)} {...form.register('jobTitle')} />
            </FormField>
            <FormField label="Temporary password" htmlFor="member-password" error={errors.password?.message} required hint="Min. 8 characters with a letter and a number." className="sm:col-span-2">
              <Input type="password" autoComplete="new-password" {...fieldProps('member-password', errors.password?.message)} {...form.register('password')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMember.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createMember.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
