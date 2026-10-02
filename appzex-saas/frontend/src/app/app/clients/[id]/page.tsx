'use client';

import { Building2, FolderKanban, History, Lock, Mail, Pencil, Phone, Plus, Trash2, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PriorityBadge, ProjectStatusBadge } from '@/components/shared/badges';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { ProjectProgress } from '@/components/shared/progress-bar';
import { DetailSkeleton, EmptyState, ErrorState, ListSkeleton } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { ClientFormDialog } from '@/features/clients/client-form-dialog';
import { PortalUserDialog } from '@/features/clients/portal-user-dialog';
import { ProjectFormDialog } from '@/features/projects/project-form-dialog';
import { usePermissions } from '@/hooks/use-auth';
import { useClient, useClientActivity, useDeleteClient } from '@/hooks/use-clients';
import { ApiError } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/utils';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canEdit, isAgencyAdmin } = usePermissions();
  const { data: client, isLoading, isError, error, refetch } = useClient(id);
  const deleteClient = useDeleteClient();
  const [editOpen, setEditOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    error: activityErrorDetail,
    refetch: refetchActivity,
  } = useClientActivity(id, { page: activityPage, pageSize: 10 });
  // Support mode blocks writes but the read-only timeline still renders, so a
  // failing activity query must not take the rest of the page down with it.
  void activityErrorDetail;

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={Building2}
          title="Client not found"
          description="This client does not exist in your agency."
          action={
            <Button variant="outline" asChild>
              <Link href="/app/clients">Back to clients</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !client) return <DetailSkeleton />;

  return (
    <>
      <PageHeader
        back={{ href: '/app/clients', label: 'Clients' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.companyName}
            {client.portalEnabled ? <Badge tone="teal">Portal enabled</Badge> : <Badge>Portal disabled</Badge>}
          </span>
        }
        description={`Client since ${formatDate(client.createdAt)}`}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => setProjectOpen(true)}>
                <Plus /> New project
              </Button>
            )}
            {isAgencyAdmin && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil /> Edit
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-red-50" onClick={() => setConfirmDelete(true)} aria-label="Delete client">
                  <Trash2 />
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" aria-hidden /> {client.contactName ?? 'No contact name'}
              </p>
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="hover:underline">
                    {client.email}
                  </a>
                ) : (
                  'No email'
                )}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden /> {client.phone ?? 'No phone'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" aria-hidden /> Internal notes
              </CardTitle>
              <CardDescription>Never visible to the client.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{client.notes || 'No notes yet.'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div className="space-y-1">
                <CardTitle>Portal access</CardTitle>
                <CardDescription>People who can sign in to the client portal.</CardDescription>
              </div>
              {isAgencyAdmin && client.portalEnabled && (
                <Button size="sm" variant="outline" onClick={() => setPortalOpen(true)}>
                  <UserPlus /> Invite
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {client.portalUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No portal users yet.</p>
              ) : (
                <ul className="space-y-3">
                  {client.portalUsers.map((user) => (
                    <li key={user.id} className="flex items-center gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{user.isActive ? `Seen ${timeAgo(user.lastLoginAt)}` : 'Deactivated'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Everything that has happened on this client&apos;s projects.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityError ? (
              <ErrorState error={activityError} onRetry={() => refetchActivity()} />
            ) : activityLoading || !activity ? (
              <ListSkeleton rows={5} />
            ) : activity.items.length === 0 ? (
              <EmptyState icon={History} title="No activity yet" compact />
            ) : (
              <div className="space-y-5">
                <ActivityTimeline
                  items={activity.items}
                  projectHref={(projectId) => `/app/projects/${projectId}`}
                />
                <Pagination pagination={activity.pagination} onPageChange={setActivityPage} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {client.projects.length} project{client.projects.length === 1 ? '' : 's'} for {client.companyName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {client.projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No projects yet"
                description="Create a project for this client to start planning work."
                compact
                action={canEdit && <Button onClick={() => setProjectOpen(true)}><Plus /> New project</Button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {client.projects.map((project) => (
                  <li key={project.id} className="grid gap-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
                    <div className="min-w-0">
                      <Link href={`/app/projects/${project.id}`} className="font-medium hover:underline">
                        {project.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <ProjectStatusBadge status={project.status} />
                        <PriorityBadge priority={project.priority} />
                        <span>Due {formatDate(project.dueDate)}</span>
                        {project.manager && <span>· {project.manager.name}</span>}
                      </div>
                    </div>
                    <ProjectProgress progress={project.progress} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <PortalUserDialog open={portalOpen} onOpenChange={setPortalOpen} client={client} />
      <ProjectFormDialog open={projectOpen} onOpenChange={setProjectOpen} defaultClientId={client.id} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${client.companyName}?`}
        description="The client and its portal access will be removed. Clients that still have projects cannot be deleted."
        confirmLabel="Delete client"
        destructive
        loading={deleteClient.isPending}
        onConfirm={() =>
          deleteClient.mutate(client.id, {
            onSuccess: () => {
              toast.success('Client deleted');
              router.replace('/app/clients');
            },
            onSettled: () => setConfirmDelete(false),
          })
        }
      />
    </>
  );
}
