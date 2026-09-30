'use client';

import { Building2, CalendarDays, CheckCircle2, ChevronDown, Flag, FolderKanban, MessageSquare, Pencil, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { MilestoneStatusBadge, PriorityBadge, ProjectStatusBadge } from '@/components/shared/badges';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { ProgressBar } from '@/components/shared/progress-bar';
import { DetailSkeleton, EmptyState, ErrorState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { ProjectHealthCard } from '@/features/projects/project-health-card';
import { ActivityTab, FeedbackTab, FilesTab, MeetingsTab, MilestonesTab, TasksTab } from '@/features/projects/project-tabs';
import { usePermissions } from '@/hooks/use-auth';
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/use-projects';
import { ApiError } from '@/lib/api';
import { PROJECT_STATUS, options } from '@/lib/constants';
import type { ProjectStatus } from '@/lib/types';
import { cn, dueLabel, formatDate } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canEdit, isAgencyAdmin } = usePermissions();
  const { data: project, isLoading, isError, error, refetch } = useProject(id);
  const updateProject = useUpdateProject(id);
  const deleteProject = useDeleteProject();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="This project does not exist in your agency, or it has been deleted."
          action={
            <Button asChild variant="outline">
              <Link href="/app/projects">Back to projects</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !project) return <DetailSkeleton />;

  const done = project.status === 'COMPLETED';
  const changeStatus = (status: ProjectStatus) =>
    updateProject.mutate({ status }, { onSuccess: () => toast.success(`Project marked as ${PROJECT_STATUS[status].label.toLowerCase()}`) });

  return (
    <>
      <PageHeader
        back={{ href: '/app/projects', label: 'Projects' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {project.name}
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </span>
        }
        meta={
          <>
            <Link href={`/app/clients/${project.client.id}`} className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline">
              <Building2 className="size-4" aria-hidden /> {project.client.companyName}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" aria-hidden /> {project.manager?.name ?? 'No manager'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {formatDate(project.startDate)} → {formatDate(project.dueDate)}
            </span>
          </>
        }
        actions={
          canEdit && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" loading={updateProject.isPending}>
                    Status <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Change status</DropdownMenuLabel>
                  {options(PROJECT_STATUS).map((option) => (
                    <DropdownMenuItem key={option.value} disabled={option.value === project.status} onSelect={() => changeStatus(option.value)}>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                  {isAgencyAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                        <Trash2 /> Delete project
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="md:col-span-2">
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-3xl font-semibold tracking-tight">{project.progress.percent}%</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                {project.progress.completedTasks} of {project.progress.totalTasks} tasks completed
              </p>
            </div>
            <ProgressBar value={project.progress.percent} size="lg" label="Project progress" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{project.taskCounts.todo} to do</span>
              <span>{project.taskCounts.inProgress} in progress</span>
              <span>{project.taskCounts.completed} completed</span>
              <span className={cn(project.taskCounts.overdue > 0 && 'font-medium text-red-600')}>{project.taskCounts.overdue} overdue</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flag className="size-4" aria-hidden /> Next milestone
            </p>
            {project.nextMilestone ? (
              <>
                <p className="font-semibold">{project.nextMilestone.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MilestoneStatusBadge status={project.nextMilestone.status} />
                  {project.nextMilestone.dueDate && dueLabel(project.nextMilestone.dueDate)}
                </div>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="size-4" aria-hidden /> All milestones complete
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 pt-5">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden /> Deadline
            </p>
            <p className={cn('font-semibold', !done && project.daysUntilDue !== null && project.daysUntilDue < 0 && 'text-red-600')}>
              {project.dueDate ? dueLabel(project.dueDate, done) : 'Not set'}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" aria-hidden /> {project.openFeedbackCount} open feedback
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardContent className="space-y-2 pt-5">
              <h2 className="text-sm font-semibold">About this project</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{project.description || 'No description yet.'}</p>
              {project.client.contactName && (
                <p className="text-xs text-muted-foreground">
                  Client contact: {project.client.contactName}
                  {project.client.email && ` · ${project.client.email}`}
                </p>
              )}
            </CardContent>
          </Card>
          <ProjectHealthCard projectId={project.id} />
        </TabsContent>
        <TabsContent value="milestones">
          <MilestonesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="meetings">
          <MeetingsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="feedback">
          <FeedbackTab projectId={project.id} projectName={project.name} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab projectId={project.id} />
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete project?"
        description={`“${project.name}” will be removed from your workspace and the client portal. Its data is retained for audit purposes.`}
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={() =>
          deleteProject.mutate(project.id, {
            onSuccess: () => {
              toast.success('Project deleted');
              router.replace('/app/projects');
            },
          })
        }
      />
    </>
  );
}
