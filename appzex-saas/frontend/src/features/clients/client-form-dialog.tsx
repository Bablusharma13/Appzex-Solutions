'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Input, Label, Textarea } from '@/components/ui/input';
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients';
import { useOnOpen } from '@/hooks/use-on-open';
import type { ClientDetail } from '@/lib/types';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(160),
  contactName: z.string().trim().max(120),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address')]),
  phone: z.string().trim().max(40),
  notes: z.string().max(5000),
  portalEnabled: z.boolean(),
});
type Values = z.infer<typeof schema>;

const empty: Values = { companyName: '', contactName: '', email: '', phone: '', notes: '', portalEnabled: true };

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientDetail | null;
  onCreated?: (client: { id: string }) => void;
}

export function ClientFormDialog({ open, onOpenChange, client, onCreated }: ClientFormDialogProps) {
  const isEdit = Boolean(client);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(client?.id ?? '');
  const mutation = isEdit ? updateClient : createClient;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty });
  const { errors } = form.formState;

  useOnOpen(open, () => {
    form.reset(
      client
        ? {
            companyName: client.companyName,
            contactName: client.contactName ?? '',
            email: client.email ?? '',
            phone: client.phone ?? '',
            notes: client.notes ?? '',
            portalEnabled: client.portalEnabled,
          }
        : empty,
    );
  });

  const onSubmit = form.handleSubmit((values) => {
    const options = { onError: (error: unknown) => applyServerErrors(form, error) };
    if (isEdit) {
      updateClient.mutate(values, {
        ...options,
        onSuccess: () => {
          toast.success('Client updated');
          onOpenChange(false);
        },
      });
    } else {
      createClient.mutate(values, {
        ...options,
        onSuccess: (created) => {
          toast.success(`${created.companyName} added`);
          onOpenChange(false);
          onCreated?.(created);
        },
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit client' : 'New client'}</DialogTitle>
            <DialogDescription>Clients belong to your agency only and are never visible to other agencies.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company name" htmlFor="client-company" error={errors.companyName?.message} required className="sm:col-span-2">
              <Input autoFocus {...fieldProps('client-company', errors.companyName?.message)} {...form.register('companyName')} />
            </FormField>
            <FormField label="Primary contact" htmlFor="client-contact" error={errors.contactName?.message}>
              <Input {...fieldProps('client-contact', errors.contactName?.message)} {...form.register('contactName')} />
            </FormField>
            <FormField label="Email" htmlFor="client-email" error={errors.email?.message}>
              <Input type="email" {...fieldProps('client-email', errors.email?.message)} {...form.register('email')} />
            </FormField>
            <FormField label="Phone" htmlFor="client-phone" error={errors.phone?.message}>
              <Input type="tel" {...fieldProps('client-phone', errors.phone?.message)} {...form.register('phone')} />
            </FormField>
            <div className="flex items-end pb-2">
              <Label className="flex items-center gap-2 font-normal">
                <Checkbox {...form.register('portalEnabled')} />
                Client portal enabled
              </Label>
            </div>
            <FormField label="Internal notes" htmlFor="client-notes" error={errors.notes?.message} hint="Only your team sees these notes." className="sm:col-span-2">
              <Textarea rows={3} {...fieldProps('client-notes', errors.notes?.message)} {...form.register('notes')} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
