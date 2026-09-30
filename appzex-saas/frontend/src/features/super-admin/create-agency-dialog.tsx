'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { useCreateAgency } from '@/hooks/use-super-admin';
import { PLAN, options } from '@/lib/constants';

const schema = z.object({
  name: z.string().trim().min(2, 'Agency name is required').max(120),
  contactEmail: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(40),
  plan: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']),
  adminName: z.string().trim().min(2, 'Admin name is required').max(120),
  adminEmail: z.string().trim().email('Enter a valid email address'),
  adminPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Za-z]/, 'Include a letter')
    .regex(/[0-9]/, 'Include a number'),
});
type Values = z.infer<typeof schema>;

const defaults: Values = { name: '', contactEmail: '', phone: '', plan: 'STARTER', adminName: '', adminEmail: '', adminPassword: '' };

export function CreateAgencyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createAgency = useCreateAgency();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    createAgency.mutate(values, {
      onSuccess: (agency) => {
        toast.success(`${agency.name} created. The admin can sign in now.`);
        form.reset(defaults);
        onOpenChange(false);
      },
      onError: (error) => applyServerErrors(form, error),
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New agency</DialogTitle>
            <DialogDescription>Creates an isolated workspace and its first agency admin.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Agency name" htmlFor="agency-name" error={errors.name?.message} required className="sm:col-span-2">
              <Input {...fieldProps('agency-name', errors.name?.message)} {...form.register('name')} />
            </FormField>
            <FormField label="Contact email" htmlFor="agency-email" error={errors.contactEmail?.message} required>
              <Input type="email" {...fieldProps('agency-email', errors.contactEmail?.message)} {...form.register('contactEmail')} />
            </FormField>
            <FormField label="Phone" htmlFor="agency-phone" error={errors.phone?.message}>
              <Input {...fieldProps('agency-phone', errors.phone?.message)} {...form.register('phone')} />
            </FormField>
            <FormField label="Plan" htmlFor="agency-plan" className="sm:col-span-2">
              <Select id="agency-plan" {...form.register('plan')}>
                {options(PLAN).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="border-t border-border pt-4 sm:col-span-2">
              <p className="text-sm font-medium">First agency admin</p>
              <p className="text-xs text-muted-foreground">Share these credentials securely; the admin can invite their team.</p>
            </div>
            <FormField label="Admin name" htmlFor="admin-name" error={errors.adminName?.message} required>
              <Input {...fieldProps('admin-name', errors.adminName?.message)} {...form.register('adminName')} />
            </FormField>
            <FormField label="Admin email" htmlFor="admin-email" error={errors.adminEmail?.message} required>
              <Input type="email" autoComplete="off" {...fieldProps('admin-email', errors.adminEmail?.message)} {...form.register('adminEmail')} />
            </FormField>
            <FormField label="Temporary password" htmlFor="admin-password" error={errors.adminPassword?.message} required hint="Min. 8 characters with a letter and a number." className="sm:col-span-2">
              <Input type="password" autoComplete="new-password" {...fieldProps('admin-password', errors.adminPassword?.message)} {...form.register('adminPassword')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createAgency.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createAgency.isPending}>
              Create agency
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
