'use client';

import { toast } from 'sonner';
import { FeedbackStatusBadge } from '@/components/shared/badges';
import { FileList } from '@/components/shared/file-list';
import { ErrorState, ListSkeleton } from '@/components/shared/states';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/misc';
import { CommentThread } from '@/features/tasks/comment-thread';
import { useCurrentUser } from '@/hooks/use-auth';
import { useAddPortalComment, usePortalFeedbackDetail } from '@/hooks/use-portal';
import { formatDateTime } from '@/lib/utils';

/** Client view of one feedback item and the conversation with the agency. */
export function PortalFeedbackDialog({ feedbackId, onClose }: { feedbackId: string | null; onClose: () => void }) {
  const { data: profile } = useCurrentUser();
  const { data: feedback, isLoading, isError, error, refetch } = usePortalFeedbackDetail(feedbackId);
  const addComment = useAddPortalComment(feedbackId ?? '');

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
                {feedback.project.name} · submitted by {feedback.submittedBy.name} on {formatDateTime(feedback.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <FeedbackStatusBadge status={feedback.status} />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{feedback.description}</p>
              {feedback.files.length > 0 && <FileList files={feedback.files} />}
              <Separator />
              <section aria-labelledby="portal-feedback-thread" className="space-y-3">
                <h3 id="portal-feedback-thread" className="text-sm font-semibold">
                  Conversation with {profile?.agency?.name ?? 'your agency'}
                </h3>
                <CommentThread
                  comments={feedback.comments}
                  currentUserId={profile?.user.id}
                  submitting={addComment.isPending}
                  placeholder="Reply to your agency…"
                  emptyText="No replies yet. Your agency will respond here."
                  onSubmit={(content, reset) =>
                    addComment.mutate(content, {
                      onSuccess: () => {
                        reset();
                        toast.success('Reply sent');
                      },
                    })
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
