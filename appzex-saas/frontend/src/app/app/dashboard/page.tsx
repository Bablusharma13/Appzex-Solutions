'use client';

import { AlertTriangle, Building2, CalendarClock, CheckCircle2, Flag, FolderKanban, MessageSquare, Plus, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { PriorityBadge } from '@/components/shared/badges';
import { CHART_COLORS, ProjectProgressChart, SegmentedBar } from '@/components/shared/charts';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState, ListSkeleton, StatCardsSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { usePermissions } from '@/hooks/use-auth';
import { useAgencyDashboard } from '@/hooks/use-agency';
import { cn, dueLabel, isOverdue } from '@/lib/utils';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function AgencyDashboardPage() {
  const router = useRouter();
  const { profile, canEdit, readOnly } = usePermissions();
  const { data, isLoading, isError, error, refetch } = useAgencyDashboard();
  const [createOpen, setCreateOpen] = useState(false);

  const firstName = profile?.user.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={readOnly ? `${profile?.agency?.name} workspace` : `${greeting()}, ${firstName}`}
        description={`Here is what is happening across ${profile?.agency?.name ?? 'your agency'} today.`}
        actions={
          canEdit && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New project
            </Button>
          )
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={6} />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <ListSkeleton rows={5} />
            </Card>
            <Card className="p-5">
              <ListSkeleton rows={4} />
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {data.stats.activeProjects + data.stats.completedProjects + data.stats.onHoldProjects === 0 && (
            <EmptyState
              icon={Rocket}
              title="Welcome to your workspace"
              description="Add a client, create your first project and invite your team. Your dashboard fills up as work gets done."
              action={
                canEdit && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus /> Create first project
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/app/clients">Add a client</Link>
                    </Button>
                  </div>
                )
              }
            />
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total clients" value={data.stats.totalClients} icon={Building2} href="/app/clients" />
            <StatCard label="Active projects" value={data.stats.activeProjects} icon={FolderKanban} href="/app/projects" />
            <StatCard
              label="Due in 14 days"
              value={data.stats.projectsDueSoon}
              icon={CalendarClock}
              tone={data.stats.projectsDueSoon ? 'warning' : 'neutral'}
              hint={data.stats.overdueProjects ? `${data.stats.overdueProjects} overdue` : 'Projects'}
            />
            <StatCard label="Completed projects" value={data.stats.completedProjects} icon={CheckCircle2} tone="success" />
            <StatCard label="Pending feedback" value={data.stats.pendingFeedback} icon={MessageSquare} tone={data.stats.pendingFeedback ? 'warning' : 'neutral'} href="/app/feedback" />
            <StatCard
              label="Overdue tasks"
              value={data.stats.overdueTasks}
              icon={AlertTriangle}
              tone={data.stats.overdueTasks ? 'danger' : 'neutral'}
              hint={`of ${data.stats.totalTasks} tasks`}
              href="/app/tasks"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle>Project progress</CardTitle>
                  <CardDescription>Share of tasks completed in each open project</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/projects">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.charts.projectProgress.length === 0 ? (
                  <EmptyState icon={FolderKanban} title="No open projects" compact />
                ) : (
                  <ProjectProgressChart
                    data={data.charts.projectProgress}
                    onSelect={(projectId) => router.push(`/app/projects/${projectId}`)}
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project status</CardTitle>
                </CardHeader>
                <CardContent>
                  <SegmentedBar
                    label="Projects by status"
                    emptyText="No projects yet"
                    segments={[
                      { key: 'ACTIVE', label: 'Active', value: data.charts.projectStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0, color: CHART_COLORS.inFlight },
                      { key: 'ON_HOLD', label: 'On hold', value: data.charts.projectStatus.find((s) => s.status === 'ON_HOLD')?.count ?? 0, color: CHART_COLORS.waiting },
                      { key: 'COMPLETED', label: 'Completed', value: data.charts.projectStatus.find((s) => s.status === 'COMPLETED')?.count ?? 0, color: CHART_COLORS.done },
                    ]}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Task status</CardTitle>
                </CardHeader>
                <CardContent>
                  <SegmentedBar
                    label="Tasks by status"
                    emptyText="No tasks yet"
                    segments={[
                      { key: 'TODO', label: 'To do', value: data.charts.taskStatus.find((s) => s.status === 'TODO')?.count ?? 0, color: CHART_COLORS.waiting },
                      { key: 'IN_PROGRESS', label: 'In progress', value: data.charts.taskStatus.find((s) => s.status === 'IN_PROGRESS')?.count ?? 0, color: CHART_COLORS.inFlight },
                      { key: 'COMPLETED', label: 'Completed', value: data.charts.taskStatus.find((s) => s.status === 'COMPLETED')?.count ?? 0, color: CHART_COLORS.done },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="space-y-1">
                  <CardTitle>Upcoming & overdue work</CardTitle>
                  <CardDescription>Open tasks due within 7 days</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/tasks">All tasks</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.upcomingTasks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nothing due this week.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.upcomingTasks.map((task) => {
                      const overdue = isOverdue(task.dueDate, false);
                      return (
                        <li key={task.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <Link href={`/app/projects/${task.project.id}`} className="block truncate text-sm font-medium hover:underline">
                              {task.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {task.project.name} · {task.assignee?.name ?? 'Unassigned'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={cn('text-xs', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>{dueLabel(task.dueDate)}</span>
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming milestones</CardTitle>
                <CardDescription>Next 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                {data.upcomingMilestones.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No milestones due soon.</p>
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
                            <Link href={`/app/projects/${milestone.project.id}`} className="hover:underline">
                              {milestone.project.name}
                            </Link>{' '}
                            · {dueLabel(milestone.dueDate)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <CardTitle>Recent activity</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/app/activity">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ActivityTimeline items={data.recentActivity.slice(0, 6)} projectHref={(projectId) => `/app/projects/${projectId}`} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
