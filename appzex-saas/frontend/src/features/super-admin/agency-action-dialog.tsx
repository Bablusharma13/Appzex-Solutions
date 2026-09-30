'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormField } from '@/components/shared/form-field';
import { Input, Textarea } from '@/components/ui/input';
import { useStartSupportSession, useUpdateAgencyStatus } from '@/hooks/use-super-admin';

export interface AgencyAction {
  type: 'suspend' | 'activate' | 'support';
  agency: { id: string; name: string };
}

/** Confirmation for every status-changing / privileged agency action. */
export function AgencyActionDialog({ action, onClose }: { action: AgencyAction | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const updateStatus = useUpdateAgencyStatus();
  const startSupport = useStartSupportSession();

  useEffect(() => setReason(''), [action]);

  const name = action?.agency.name ?? '';
  const loading = updateStatus.isPending || startSupport.isPending;

  const confirm = () => {
    if (!action) return;
    if (action.type === 'support') {
      startSupport.mutate(
        { agencyId: action.agency.id, reason },
        { onSuccess: () => toast.success(`Support session started for ${name}`) },
      );
      return;
    }
    const status = action.type === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
    updateStatus.mutate(
      { id: action.agency.id, status, reason },
      {
        onSuccess: () => {
          toast.success(status === 'SUSPENDED' ? `${name} has been suspended` : `${name} is active again`);
          onClose();
        },
      },
    );
  };

  const copy = {
    suspend: {
      title: `Suspend ${name}?`,
      description: 'Are you sure you want to suspend this agency? All agency users and clients will lose access.',
      confirmLabel: 'Suspend agency',
      reasonLabel: 'Reason (recorded in the audit log)',
    },
    activate: {
      title: `Activate ${name}?`,
      description: 'The agency team and its client portal users will regain access immediately.',
      confirmLabel: 'Activate agency',
      reasonLabel: 'Note (optional)',
    },
    support: {
      title: `Enter ${name} in support mode?`,
      description:
        'You will view this agency workspace in read-only mode. The session is recorded in the agency activity log and expires automatically.',
      confirmLabel: 'Enter workspace',
      reasonLabel: 'Reason for access (visible to the agency)',
    },
  }[action?.type ?? 'suspend'];

  return (
    <ConfirmDialog
      open={Boolean(action)}
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive={action?.type === 'suspend'}
      loading={loading}
      onConfirm={confirm}
    >
      <FormField label={copy.reasonLabel} htmlFor="agency-action-reason">
        {action?.type === 'support' ? (
          <Input id="agency-action-reason" value={reason} maxLength={255} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Customer asked for help with client portal" />
        ) : (
          <Textarea id="agency-action-reason" rows={2} value={reason} maxLength={255} onChange={(event) => setReason(event.target.value)} />
        )}
      </FormField>
    </ConfirmDialog>
  );
}
