'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { FeedbackStatusBadge } from '@/components/shared/badges';
import { FileList } from '@/components/shared/file-list';
import { ErrorState, ListSkeleton } from '@/components/shared/states';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Separator } from '@/components/ui/misc';
import { CommentThread } from '@/features/tasks/comment-thread';
import { usePermissions } from '@/hooks/use-auth';
import { useAddFeedbackComment, useFeedbackDetail, useUpdateFeedbackStatus } from '@/hooks/use-work';
import { FEEDBACK_STATUS, options } from '@/lib/constants';
import type { FeedbackStatus } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

/** Agency view of a feedback item: status workflow + client-visible reply thread. */
export function FeedbackDetailDialog({ feedbackId, onClose }: { feedbackId: string | null; onClose: () => void }) {
  const { canEdit, isAgencyAdmin, userId } = usePermissions();
  const { data: feedback, isLoading, isError, error, refetch } = useFeedbackDetail(feedbackId);
  const updateStatus = useUpdateFeedbackStatus();
  const addComment = useAddFeedbackComment(feedbackId ?? '');

  return (
    <Dialog open={Boolean(feedbackId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        {isError ? (
          <DialogBody>
            <DialogTitle className="sr-only">Feedback</DialogTitle>
            <ErrorState error={error} onRetry={() => refetch()} />
          </DialogBody>
        ) : isLoading || !feedback ? (
          <DialogBody>
            <DialogTitle className="sr-only">Loading feedback</DialogTitle>
            <ListSkeleton rows={3} />
          </DialogBody>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">{feedback.title}</DialogTitle>
              <DialogDescription>
                <Link href={`/app/projects/${feedback.project.id}`} className="hover:underline" onClick={onClose}>
                  {feedback.project.name}
                </Link>
                {feedback.project.client && ` · ${feedback.project.client.companyName}`} · submitted by {feedback.submittedBy.name}
                {feedback.submittedBy.role === 'CLIENT' ? ' (client)' : ''} on {formatDateTime(feedback.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <FeedbackStatusBadge status={feedback.status} />
                </div>
                {canEdit && (
                  <Select
                    aria-label="Change feedback status"
                    className="sm:w-48"
                    value={feedback.status}
                    disabled={updateStatus.isPending}
                    onChange={(event) =>
                      updateStatus.mutate(
                        { id: feedback.id, status: event.target.value as FeedbackStatus },
                        { onSuccess: () => toast.success('Status updated — the client can see the change') },
                      )
                    }
                  >
                    {options(FEEDBACK_STATUS).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.description}</p>

              {feedback.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                  <FileList files={feedback.files} manage={canEdit ? { currentUserId: userId, isAdmin: isAgencyAdmin } : null} />
                </div>
              )}

              <Separator />

              <section aria-labelledby="feedback-thread" className="space-y-3">
                <h3 id="feedback-thread" className="text-sm font-semibold">
                  Conversation <span className="font-normal text-muted-foreground">· visible to the client</span>
                </h3>
                <CommentThread
                  comments={feedback.comments}
                  currentUserId={userId}
                  submitting={addComment.isPending}
                  placeholder="Reply to the client…"
                  emptyText="No replies yet."
                  onSubmit={
                    canEdit
                      ? (content, reset) =>
                          addComment.mutate(content, {
                            onSuccess: () => {
                              reset();
                              toast.success('Reply sent');
                            },
                          })
                      : undefined
                  }
                />
              </section>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
