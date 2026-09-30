'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField, applyServerErrors, fieldProps } from '@/components/shared/form-field';
import { InlineAlert } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox, Input, Label, Textarea } from '@/components/ui/input';
import { ProjectSelect } from '@/features/shared/option-selects';
import { useOnOpen } from '@/hooks/use-on-open';
import { useCreateTask } from '@/hooks/use-tasks';
import { useCreateMeeting, useMeetingSummaryAI, useUpdateMeeting } from '@/hooks/use-work';
import { ApiError } from '@/lib/api';
import type { Meeting, MeetingSummaryResult } from '@/lib/types';

const schema = z.object({
  projectId: z.string().min(1, 'Select a project'),
  title: z.string().trim().min(2, 'Meeting title is required').max(200),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  notes: z.string().max(20000),
  summary: z.string().max(20000),
  clientVisible: z.boolean(),
});
type Values = z.infer<typeof schema>;

type ActionItem = MeetingSummaryResult['result']['actionItems'][number] & { selected: boolean };

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Formats the reviewed AI output as the shareable meeting summary. */
function composeSummary(result: MeetingSummaryResult['result']) {
  const sections = [result.summary.trim()];
  if (result.keyDecisions.length) sections.push(`Key decisions:\n${result.keyDecisions.map((item) => `- ${item}`).join('\n')}`);
  if (result.actionItems.length) {
    sections.push(
      `Action items:\n${result.actionItems
        .map((item) => `- ${item.title}${item.owner ? ` (${item.owner})` : ''}${item.dueDate ? ` — due ${item.dueDate}` : ''}`)
        .join('\n')}`,
    );
  }
  if (result.deadlines.length) sections.push(`Deadlines:\n${result.deadlines.map((item) => `- ${item}`).join('\n')}`);
  return sections.join('\n\n');
}

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  meeting?: Meeting | null;
}

export function MeetingFormDialog({ open, onOpenChange, projectId, meeting }: MeetingFormDialogProps) {
  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const createTask = useCreateTask();
  const summarize = useMeetingSummaryAI();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { projectId: projectId ?? '', title: '', meetingDate: '', notes: '', summary: '', clientVisible: false },
  });
  const { errors } = form.formState;
  const notes = form.watch('notes');
  const selectedProject = form.watch('projectId');

  useOnOpen(open, () => {
    summarize.reset();
    setActionItems([]);
    form.reset(
      meeting
        ? {
            projectId: meeting.projectId,
            title: meeting.title,
            meetingDate: toLocalInput(meeting.meetingDate),
            notes: meeting.notes ?? '',
            summary: meeting.summary ?? '',
            clientVisible: meeting.clientVisible,
          }
        : { projectId: projectId ?? '', title: '', meetingDate: toLocalInput(new Date().toISOString()), notes: '', summary: '', clientVisible: false },
    );
  });

  const generateSummary = () => {
    const values = form.getValues();
    summarize.mutate(
      { projectId: values.projectId, title: values.title || undefined, notes: values.notes },
      {
        onSuccess: (data) => {
          form.setValue('summary', composeSummary(data.result), { shouldDirty: true });
          setActionItems(data.result.actionItems.map((item) => ({ ...item, selected: true })));
        },
      },
    );
  };

  const onSubmit = form.handleSubmit(async ({ projectId: chosenProject, meetingDate, ...values }) => {
    const payload = { ...values, meetingDate: new Date(meetingDate).toISOString() };
    setSaving(true);
    try {
      if (meeting) {
        await updateMeeting.mutateAsync({ id: meeting.id, ...payload });
      } else {
        await createMeeting.mutateAsync({ projectId: chosenProject, ...payload });
      }
      const toCreate = actionItems.filter((item) => item.selected);
      for (const item of toCreate) {
        await createTask.mutateAsync({
          projectId: chosenProject,
          title: item.title.slice(0, 200),
          description: item.owner ? `Action item from “${values.title}” — owner: ${item.owner}` : `Action item from “${values.title}”`,
          dueDate: item.dueDate ?? '',
        });
      }
      toast.success(
        `${meeting ? 'Meeting updated' : 'Meeting recorded'}${toCreate.length ? ` · ${toCreate.length} task${toCreate.length === 1 ? '' : 's'} created` : ''}`,
      );
      onOpenChange(false);
    } catch (error) {
      applyServerErrors(form, error);
    } finally {
      setSaving(false);
    }
  });

  const aiError = summarize.error;
  const aiNotConfigured = aiError instanceof ApiError && aiError.code === 'AI_NOT_CONFIGURED';
  const canSummarize = Boolean(selectedProject) && notes.trim().length >= 20;

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent size="xl">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{meeting ? 'Edit meeting' : 'Record meeting'}</DialogTitle>
            <DialogDescription>Raw notes always stay internal. Only the reviewed summary can be shared with the client.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {!projectId && !meeting && (
                <FormField label="Project" htmlFor="meeting-project" error={errors.projectId?.message} required>
                  <ProjectSelect {...fieldProps('meeting-project', errors.projectId?.message)} {...form.register('projectId')} />
                </FormField>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Title" htmlFor="meeting-title" error={errors.title?.message} required>
                  <Input placeholder="e.g. Design review" {...fieldProps('meeting-title', errors.title?.message)} {...form.register('title')} />
                </FormField>
                <FormField label="Date & time" htmlFor="meeting-date" error={errors.meetingDate?.message} required>
                  <Input type="datetime-local" {...fieldProps('meeting-date', errors.meetingDate?.message)} {...form.register('meetingDate')} />
                </FormField>
              </div>
              <FormField label="Raw notes (internal)" htmlFor="meeting-notes" error={errors.notes?.message} hint="Paste or type what was discussed.">
                <Textarea rows={10} {...fieldProps('meeting-notes', errors.notes?.message)} {...form.register('notes')} />
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="soft" onClick={generateSummary} loading={summarize.isPending} disabled={!canSummarize || summarize.isPending}>
                  {!summarize.isPending && <Sparkles />}
                  {summarize.isPending ? 'Summarizing notes…' : summarize.data ? 'Regenerate AI summary' : 'Generate AI Summary'}
                </Button>
                {!canSummarize && <span className="text-xs text-muted-foreground">Add at least a few sentences of notes first.</span>}
              </div>
              {aiError &&
                (aiNotConfigured ? (
                  <InlineAlert tone="info" title="AI is not configured">
                    AI service is not configured. Add OPENAI_API_KEY to enable this feature.
                  </InlineAlert>
                ) : (
                  <InlineAlert tone="danger" title="Summary failed">
                    <span className="flex flex-wrap items-center gap-2">
                      Unable to generate AI insights right now. Please try again.
                      <Button type="button" size="sm" variant="outline" onClick={generateSummary}>
                        <RefreshCw /> Retry
                      </Button>
                    </span>
                  </InlineAlert>
                ))}
            </div>

            <div className="space-y-4">
              <FormField
                label="Summary"
                htmlFor="meeting-summary"
                error={errors.summary?.message}
                hint={summarize.data ? 'AI draft — review and edit before saving.' : 'Write a summary or generate one from your notes.'}
              >
                <Textarea rows={12} {...fieldProps('meeting-summary', errors.summary?.message)} {...form.register('summary')} />
              </FormField>

              {actionItems.length > 0 && (
                <fieldset className="space-y-2 rounded-lg border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Create tasks from action items</legend>
                  {actionItems.map((item, index) => (
                    <Label key={`${item.title}-${index}`} className="flex items-start gap-2 font-normal">
                      <Checkbox
                        className="mt-0.5"
                        checked={item.selected}
                        onChange={(event) =>
                          setActionItems((items) => items.map((current, i) => (i === index ? { ...current, selected: event.target.checked } : current)))
                        }
                      />
                      <span className="text-sm">
                        {item.title}
                        <span className="block text-xs text-muted-foreground">
                          {[item.owner && `Owner: ${item.owner}`, item.dueDate && `Due ${item.dueDate}`].filter(Boolean).join(' · ') || 'No owner or date mentioned'}
                        </span>
                      </span>
                    </Label>
                  ))}
                  <p className="text-xs text-muted-foreground">Selected items become To-do tasks in this project when you save.</p>
                </fieldset>
              )}

              <Label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 font-normal">
                <Checkbox className="mt-0.5" {...form.register('clientVisible')} />
                <span>
                  <span className="block text-sm font-medium">Share summary with the client</span>
                  <span className="text-xs text-muted-foreground">The client sees the title, date and summary — never the raw notes.</span>
                </span>
              </Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {meeting ? 'Save changes' : 'Save meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
