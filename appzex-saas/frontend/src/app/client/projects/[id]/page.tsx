'use client';

import { CalendarDays, Check, CheckSquare, FileText, Flag, FolderKanban, MessageSquarePlus, Upload, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { MilestoneStatusBadge, ProjectStatusBadge, TaskStatusBadge } from '@/components/shared/badges';
import { FileList } from '@/components/shared/file-list';
import { PageHeader } from '@/components/shared/page-header';
import { ProgressBar } from '@/components/shared/progress-bar';
import { DetailSkeleton, EmptyState, ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackFormDialog } from '@/features/feedback/feedback-form-dialog';
import { FeedbackList } from '@/features/feedback/feedback-list';
import { FileUploadDialog } from '@/features/files/file-upload-dialog';
import { PortalFeedbackDialog } from '@/features/portal/portal-feedback-dialog';
import { usePortalProject, usePortalUpload, useSubmitPortalFeedback } from '@/hooks/use-portal';
import { ApiError } from '@/lib/api';
import { cn, daysLeftLabel, dueLabel, formatDate, formatDateTime, isOverdue } from '@/lib/utils';

export default function ClientProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, error, refetch } = usePortalProject(id);
  const submitFeedback = useSubmitPortalFeedback();
  const upload = usePortalUpload();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [openFeedbackId, setOpenFeedbackId] = useState<string | null>(null);

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="This project does not exist or is not shared with your company."
          action={
            <Button variant="outline" asChild>
              <Link href="/client/projects">Back to projects</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !project) return <DetailSkeleton />;

  const done = project.status === 'COMPLETED';
  const openActions = project.sharedTasks.filter((task) => task.status !== 'COMPLETED');

  return (
    <>
      <PageHeader
        back={{ href: '/client/projects', label: 'Projects' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.name}
            <ProjectStatusBadge status={project.status} />
          </span>
        }
        description={project.description}
        meta={
          <>
            {project.manager && (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-4" aria-hidden /> Project lead: {project.manager.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {formatDate(project.startDate)} → {formatDate(project.dueDate)}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload /> Share a file
            </Button>
            <Button onClick={() => setFeedbackOpen(true)}>
              <MessageSquarePlus /> Submit feedback
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Overall progress</p>
                <p className="text-3xl font-semibold tracking-tight">{project.progress.percent}%</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {project.progress.completedTasks} of {project.progress.totalTasks} tasks completed
              </p>
            </div>
            <ProgressBar value={project.progress.percent} size="lg" label="Project progress" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="text-sm text-muted-foreground">Expected completion</p>
            <p className="font-semibold">{formatDate(project.dueDate)}</p>
            <p className="text-xs text-muted-foreground">{daysLeftLabel(project.dueDate, done)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({project.meetings.length})</TabsTrigger>
          <TabsTrigger value="files">Files ({project.files.length})</TabsTrigger>
          <TabsTrigger value="feedback">Feedback ({project.feedback.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
                <CardDescription>Project phases and where things stand</CardDescription>
              </CardHeader>
              <CardContent>
                {project.milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Milestones will appear here once planned.</p>
                ) : (
                  <ol className="relative space-y-5 border-l border-border pl-6">
                    {project.milestones.map((milestone) => {
                      const complete = milestone.status === 'COMPLETED';
                      return (
                        <li key={milestone.id} className="relative">
                          <span
                            className={cn(
                              'absolute -left-[33px] top-0.5 flex size-5 items-center justify-center rounded-full border-2 border-surface',
                              complete ? 'bg-emerald-500 text-white' : milestone.status === 'IN_PROGRESS' ? 'bg-primary' : 'bg-slate-300',
                            )}
                            aria-hidden
                          >
                            {complete && <Check className="size-3" />}
                          </span>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{milestone.name}</p>
                            <MilestoneStatusBadge status={milestone.status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {complete && milestone.completedAt ? `Completed ${formatDate(milestone.completedAt)}` : milestone.dueDate ? `Due ${formatDate(milestone.dueDate)}` : 'Date to be confirmed'}
                          </p>
                          {milestone.description && <p className="mt-1 text-sm text-slate-600">{milestone.description}</p>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="size-4 text-muted-foreground" aria-hidden /> Action items for you
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.sharedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing needed from you right now.</p>
                  ) : (
                    <ul className="space-y-3">
                      {project.sharedTasks.map((task) => (
                        <li key={task.id} className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm font-medium', task.status === 'COMPLETED' && 'text-muted-foreground line-through')}>{task.title}</p>
                            <TaskStatusBadge status={task.status} />
                          </div>
                          {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                          {task.dueDate && task.status !== 'COMPLETED' && (
                            <p className={cn('text-xs', isOverdue(task.dueDate, false) ? 'font-medium text-red-600' : 'text-muted-foreground')}>{dueLabel(task.dueDate)}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {openActions.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Questions? Reply through feedback.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="size-4 text-muted-foreground" aria-hidden /> Upcoming deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.upcomingDeadlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
                  ) : (
                    <ul className="space-y-2">
                      {project.upcomingDeadlines.map((deadline) => (
                        <li key={`${deadline.type}-${deadline.id}`} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{deadline.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(deadline.dueDate)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="updates">
          <Card className="p-5">
            {project.updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <ActivityTimeline items={project.updates} showProject={false} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          {project.meetings.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No shared meetings yet" description="Meeting summaries your agency shares will appear here." />
          ) : (
            <div className="space-y-4">
              {project.meetings.map((meeting) => (
                <Card key={meeting.id}>
                  <CardHeader>
                    <CardTitle>{meeting.title}</CardTitle>
                    <CardDescription>{formatDateTime(meeting.meetingDate)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{meeting.summary || 'Summary coming soon.'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="files">
          {project.files.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No shared files yet"
              description="Files your agency shares, and files you upload, appear here."
              action={<Button variant="outline" onClick={() => setUploadOpen(true)}><Upload /> Share a file</Button>}
            />
          ) : (
            <FileList files={project.files} />
          )}
        </TabsContent>

        <TabsContent value="feedback">
          {project.feedback.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              title="No feedback yet"
              description="Request changes or ask questions — your agency will reply here."
              action={<Button onClick={() => setFeedbackOpen(true)}><MessageSquarePlus /> Submit feedback</Button>}
            />
          ) : (
            <FeedbackList items={project.feedback} onOpen={setOpenFeedbackId} />
          )}
        </TabsContent>
      </Tabs>

      <FeedbackFormDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        projects={[{ id: project.id, name: project.name }]}
        defaultProjectId={project.id}
        pending={submitFeedback.isPending}
        onSubmit={(values, finish, fail) =>
          submitFeedback.mutate(values, {
            onSuccess: () => {
              toast.success('Feedback sent to your agency');
              finish();
            },
            onError: fail,
          })
        }
      />
      <FileUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={project.id}
        allowVisibilityChoice={false}
        pending={upload.isPending}
        onUpload={(input, finish, fail) =>
          upload.mutate(
            { projectId: input.projectId, file: input.file },
            {
              onSuccess: (file) => {
                toast.success(`${file.originalName} shared with your agency`);
                finish();
              },
              onError: fail,
            },
          )
        }
      />
      <PortalFeedbackDialog feedbackId={openFeedbackId} onClose={() => setOpenFeedbackId(null)} />
    </>
  );
}
