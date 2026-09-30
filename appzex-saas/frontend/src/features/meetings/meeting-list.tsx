'use client';

import { ChevronDown, Lock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { VisibilityBadge } from '@/components/shared/badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/use-auth';
import { useDeleteMeeting } from '@/hooks/use-work';
import type { Meeting } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';
import { MeetingFormDialog } from './meeting-form-dialog';

/** Meeting timeline (agency view: summary + collapsible internal notes). */
export function MeetingList({ meetings, showProject = false }: { meetings: Meeting[]; showProject?: boolean }) {
  const { canEdit } = usePermissions();
  const deleteMeeting = useDeleteMeeting();
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState<Meeting | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <ol className="relative space-y-4 border-l border-border pl-6">
        {meetings.map((meeting) => (
          <li key={meeting.id} className="relative">
            <span className="absolute -left-[31px] top-4 size-2.5 rounded-full border-2 border-surface bg-primary ring-1 ring-primary/30" aria-hidden />
            <article className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{meeting.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={meeting.meetingDate}>{formatDateTime(meeting.meetingDate)}</time>
                    {showProject && (
                      <>
                        {' · '}
                        <Link href={`/app/projects/${meeting.project.id}`} className="hover:text-foreground hover:underline">
                          {meeting.project.name}
                        </Link>
                      </>
                    )}
                    {meeting.createdBy && ` · recorded by ${meeting.createdBy.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <VisibilityBadge clientVisible={meeting.clientVisible} />
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${meeting.title}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(meeting)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDeleting(meeting)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </header>
              {meeting.summary ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{meeting.summary}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No summary yet.</p>
              )}
              {meeting.notes && (
                <div className="mt-3 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === meeting.id ? null : meeting.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    aria-expanded={expanded === meeting.id}
                  >
                    <Lock className="size-3" aria-hidden /> Internal notes
                    <ChevronDown className={cn('size-3.5 transition-transform', expanded === meeting.id && 'rotate-180')} aria-hidden />
                  </button>
                  {expanded === meeting.id && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm text-slate-700">{meeting.notes}</p>}
                </div>
              )}
            </article>
          </li>
        ))}
      </ol>

      <MeetingFormDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} meeting={editing} projectId={editing?.projectId} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete meeting?"
        description={`“${deleting?.title}” and its notes will be permanently deleted.`}
        confirmLabel="Delete meeting"
        destructive
        loading={deleteMeeting.isPending}
        onConfirm={() =>
          deleting &&
          deleteMeeting.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Meeting deleted');
              setDeleting(null);
            },
          })
        }
      />
    </>
  );
}
