'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar } from '@/components/shared/search-input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { FeedbackFormDialog } from '@/features/feedback/feedback-form-dialog';
import { FeedbackList } from '@/features/feedback/feedback-list';
import { PortalFeedbackDialog } from '@/features/portal/portal-feedback-dialog';
import { usePortalFeedback, usePortalProjects, useSubmitPortalFeedback } from '@/hooks/use-portal';
import { FEEDBACK_STATUS, options } from '@/lib/constants';

export default function ClientFeedbackPage() {
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: projects = [] } = usePortalProjects();
  const { data: items, isLoading, isError, error, refetch } = usePortalFeedback({ projectId, status });
  const submitFeedback = useSubmitPortalFeedback();

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Change requests and questions you have shared with your agency."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={projects.length === 0}>
            <MessageSquarePlus /> Submit feedback
          </Button>
        }
      />
      <FilterBar>
        <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="sm:w-60" aria-label="Filter by project">
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="sm:w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          {options(FEEDBACK_STATUS).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterBar>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !items ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquarePlus}
          title={projectId || status ? 'No feedback matches these filters' : 'No feedback yet'}
          description="Need a change or have a question? Submit feedback and your agency will reply here."
          action={!projectId && !status && <Button onClick={() => setCreateOpen(true)}><MessageSquarePlus /> Submit feedback</Button>}
        />
      ) : (
        <FeedbackList items={items} onOpen={setOpenId} showProject />
      )}

      <PortalFeedbackDialog feedbackId={openId} onClose={() => setOpenId(null)} />
      <FeedbackFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        pending={submitFeedback.isPending}
        onSubmit={(values, done, fail) =>
          submitFeedback.mutate(values, {
            onSuccess: () => {
              toast.success('Feedback sent to your agency');
              done();
            },
            onError: fail,
          })
        }
      />
    </>
  );
}
