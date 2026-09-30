'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCreatePortalUser } from '@/hooks/use-clients';
import { useOnOpen } from '@/hooks/use-on-open';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
});
type Values = z.infer<typeof schema>;

export function PortalUserDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; companyName: string; contactName: string | null; email: string | null };
}) {
  const createUser = useCreatePortalUser(client.id);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', password: '' } });
  const { errors } = form.formState;

  useOnOpen(open, () => form.reset({ name: client.contactName ?? '', email: client.email ?? '', password: '' }));

  const onSubmit = form.handleSubmit((values) =>
    createUser.mutate(values, {
      onSuccess: (user) => {
        toast.success(`${user.name} can now sign in to the client portal`);
        onOpenChange(false);
      },
      onError: (error) => applyServerErrors(form, error),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Invite portal user</DialogTitle>
            <DialogDescription>
              Gives someone at {client.companyName} access to their own projects only.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField label="Full name" htmlFor="portal-name" error={errors.name?.message} required>
              <Input {...fieldProps('portal-name', errors.name?.message)} {...form.register('name')} />
            </FormField>
            <FormField label="Email" htmlFor="portal-email" error={errors.email?.message} required>
              <Input type="email" autoComplete="off" {...fieldProps('portal-email', errors.email?.message)} {...form.register('email')} />
            </FormField>
            <FormField label="Temporary password" htmlFor="portal-password" error={errors.password?.message} required hint="Share it securely with the client.">
              <Input type="password" autoComplete="new-password" {...fieldProps('portal-password', errors.password?.message)} {...form.register('password')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createUser.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createUser.isPending}>
              Create access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
