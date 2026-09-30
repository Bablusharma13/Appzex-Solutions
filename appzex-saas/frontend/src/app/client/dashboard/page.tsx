'use client';

import { CheckSquare, Flag, FolderKanban, MessageSquare, MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { StatCard } from '@/components/shared/stat-card';
import { CardGridSkeleton, EmptyState, ErrorState, StatCardsSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FeedbackFormDialog } from '@/features/feedback/feedback-form-dialog';
import { PortalProjectCard } from '@/features/portal/portal-project-card';
import { usePermissions } from '@/hooks/use-auth';
import { usePortalDashboard, useSubmitPortalFeedback } from '@/hooks/use-portal';
import { cn, dueLabel, formatDate, isOverdue } from '@/lib/utils';

export default function ClientDashboardPage() {
  const { profile } = usePermissions();
  const { data, isLoading, isError, error, refetch } = usePortalDashboard();
  const submitFeedback = useSubmitPortalFeedback();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const firstName = profile?.user.name.split(' ')[0];

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">{data?.client.companyName ?? profile?.client?.companyName}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is the latest on your projects with {data?.agency.name ?? profile?.agency?.name}.
          </p>
        </div>
        <Button onClick={() => setFeedbackOpen(true)} disabled={!data || data.projects.length === 0}>
          <MessageSquarePlus /> Submit feedback
        </Button>
      </section>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={4} />
          <CardGridSkeleton count={2} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Active projects" value={data.stats.activeProjects} icon={FolderKanban} hint={`${data.stats.totalProjects} in total`} />
            <StatCard label="Upcoming milestones" value={data.stats.upcomingMilestones} icon={Flag} />
            <StatCard label="Pending actions" value={data.stats.pendingActions} icon={CheckSquare} tone={data.stats.pendingActions ? 'warning' : 'neutral'} hint="Items waiting on you" />
            <StatCard label="Open feedback" value={data.stats.openFeedback} icon={MessageSquare} href="/client/feedback" />
          </div>

          <section aria-labelledby="client-projects-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="client-projects-heading" className="text-base font-semibold">
                Your projects
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/client/projects">View all</Link>
              </Button>
            </div>
            {data.projects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No projects yet" description="Your agency has not shared any projects with you yet." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.projects.map((project) => (
                  <PortalProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Pending actions</CardTitle>
                <CardDescription>Things your agency needs from you</CardDescription>
              </CardHeader>
              <CardContent>
                {data.pendingActions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">You are all caught up.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.pendingActions.map((task) => (
                      <li key={task.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <Link href={`/client/projects/${task.project.id}`} className="hover:underline">
                            {task.project.name}
                          </Link>
                          {task.dueDate && (
                            <span className={cn(isOverdue(task.dueDate, false) && 'font-medium text-red-600')}> · {dueLabel(task.dueDate)}</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming milestones</CardTitle>
              </CardHeader>
              <CardContent>
                {data.upcomingMilestones.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No upcoming milestones.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.upcomingMilestones.map((milestone) => (
                      <li key={milestone.id} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground" aria-hidden>
                          <Flag className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{milestone.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {milestone.project?.name} · {formatDate(milestone.dueDate)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent updates</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentUpdates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  <ActivityTimeline items={data.recentUpdates.slice(0, 6)} projectHref={(projectId) => `/client/projects/${projectId}`} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <FeedbackFormDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        projects={data?.projects.map((project) => ({ id: project.id, name: project.name })) ?? []}
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
