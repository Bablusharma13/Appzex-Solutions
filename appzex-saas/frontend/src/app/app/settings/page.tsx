'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LifeBuoy, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AgencyStatusBadge, PlanBadge, RoleBadge } from '@/components/shared/badges';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { PageHeader } from '@/components/shared/page-header';
import { DetailSkeleton, ErrorState, InlineAlert } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-auth';
import { useAgencySettings, useUpdateAgencySettings } from '@/hooks/use-agency';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Agency name is required').max(120),
  contactEmail: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().max(40),
  website: z.union([z.literal(''), z.string().trim().url('Enter a full URL, e.g. https://example.com').max(191)]),
});
type Values = z.infer<typeof schema>;

export default function SettingsPage() {
  const { profile, isAgencyAdmin } = usePermissions();
  const { data: settings, isLoading, isError, error, refetch } = useAgencySettings();
  const update = useUpdateAgencySettings();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', contactEmail: '', phone: '', website: '' } });
  const { errors, isDirty } = form.formState;

  useEffect(() => {
    if (settings) {
      form.reset({ name: settings.name, contactEmail: settings.contactEmail, phone: settings.phone ?? '', website: settings.website ?? '' });
    }
  }, [form, settings]);

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => toast.success('Agency settings saved'),
      onError: (mutationError) => applyServerErrors(form, mutationError),
    }),
  );

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !settings) return <DetailSkeleton />;

  return (
    <>
      <PageHeader title="Settings" description="Agency profile and workspace information." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form onSubmit={onSubmit} noValidate>
            <CardHeader>
              <CardTitle>Agency profile</CardTitle>
              <CardDescription>{isAgencyAdmin ? 'Shown to your team and in the client portal.' : 'Only agency admins can change these details.'}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField label="Agency name" htmlFor="settings-name" error={errors.name?.message} required className="sm:col-span-2">
                <Input disabled={!isAgencyAdmin} {...fieldProps('settings-name', errors.name?.message)} {...form.register('name')} />
              </FormField>
              <FormField label="Contact email" htmlFor="settings-email" error={errors.contactEmail?.message} required>
                <Input type="email" disabled={!isAgencyAdmin} {...fieldProps('settings-email', errors.contactEmail?.message)} {...form.register('contactEmail')} />
              </FormField>
              <FormField label="Phone" htmlFor="settings-phone" error={errors.phone?.message}>
                <Input disabled={!isAgencyAdmin} {...fieldProps('settings-phone', errors.phone?.message)} {...form.register('phone')} />
              </FormField>
              <FormField label="Website" htmlFor="settings-website" error={errors.website?.message} className="sm:col-span-2">
                <Input type="url" placeholder="https://" disabled={!isAgencyAdmin} {...fieldProps('settings-website', errors.website?.message)} {...form.register('website')} />
              </FormField>
            </CardContent>
            {isAgencyAdmin && (
              <CardFooter className="justify-end gap-2">
                <Button type="button" variant="outline" disabled={!isDirty || update.isPending} onClick={() => form.reset()}>
                  Reset
                </Button>
                <Button type="submit" loading={update.isPending} disabled={!isDirty}>
                  Save changes
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <AgencyStatusBadge status={settings.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <PlanBadge plan={settings.plan} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Workspace ID</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{settings.slug}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span>{settings.owner?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(settings.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{profile?.user.name}</p>
              <p className="text-muted-foreground">{profile?.user.email}</p>
              {profile && <RoleBadge role={profile.user.role} />}
            </CardContent>
          </Card>

          <InlineAlert tone="info" title="Data isolation">
            <span className="mt-1 flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Your workspace data is isolated from every other agency on the server. Clients only see what you share with them.
            </span>
            <span className="mt-2 flex items-start gap-2">
              <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
              Platform support can only view your workspace in read-only mode, and every session appears in Activity.
            </span>
          </InlineAlert>
        </div>
      </div>
    </>
  );
}
