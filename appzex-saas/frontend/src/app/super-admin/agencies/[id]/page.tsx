'use client';

import { Building2, CheckCircle2, FileText, FolderKanban, Globe, LifeBuoy, Mail, MessageSquare, Phone, Power, PowerOff, UsersRound } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { AgencyStatusBadge, PlanBadge, PriorityBadge, ProjectStatusBadge, RoleBadge } from '@/components/shared/badges';
import { PageHeader } from '@/components/shared/page-header';
import { ProjectProgress } from '@/components/shared/progress-bar';
import { StatCard } from '@/components/shared/stat-card';
import { DetailSkeleton, EmptyState, ErrorState, InlineAlert } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgencyActionDialog, type AgencyAction } from '@/features/super-admin/agency-action-dialog';
import { useSuperAdminAgency } from '@/hooks/use-super-admin';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';

export default function AgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: agency, isLoading, isError, error, refetch } = useSuperAdminAgency(id);
  const [action, setAction] = useState<AgencyAction | null>(null);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} title="Could not load this agency" />;
  if (isLoading || !agency) return <DetailSkeleton />;

  return (
    <>
      <PageHeader
        back={{ href: '/super-admin/agencies', label: 'All agencies' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {agency.name}
            <AgencyStatusBadge status={agency.status} />
            <PlanBadge plan={agency.plan} />
          </span>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4" aria-hidden /> {agency.contactEmail}
            </span>
            {agency.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden /> {agency.phone}
              </span>
            )}
            {agency.website && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="size-4" aria-hidden /> {agency.website.replace(/^https?:\/\//, '')}
              </span>
            )}
            <span>Created {formatDate(agency.createdAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setAction({ type: 'support', agency })}>
              <LifeBuoy /> Enter workspace
            </Button>
            {agency.status === 'ACTIVE' ? (
              <Button variant="destructive" onClick={() => setAction({ type: 'suspend', agency })}>
                <PowerOff /> Suspend
              </Button>
            ) : (
              <Button onClick={() => setAction({ type: 'activate', agency })}>
                <Power /> Activate
              </Button>
            )}
          </>
        }
      />

      {agency.status === 'SUSPENDED' && (
        <InlineAlert tone="danger" title="This agency is suspended" className="mb-6">
          Its team members and client portal users cannot sign in or use the API
          {agency.suspendedAt ? ` (since ${formatDateTime(agency.suspendedAt)})` : ''}. You can still inspect it in read-only support mode.
        </InlineAlert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Team members" value={agency.stats.teamMembers} icon={UsersRound} />
        <StatCard label="Clients" value={agency.stats.clients} icon={Building2} />
        <StatCard label="Projects" value={agency.stats.projects} icon={FolderKanban} hint={`${agency.stats.activeProjects} active`} />
        <StatCard label="Tasks done" value={`${agency.stats.completedTasks}/${agency.stats.totalTasks}`} icon={CheckCircle2} tone="success" />
        <StatCard label="Open feedback" value={agency.stats.openFeedback} icon={MessageSquare} tone={agency.stats.openFeedback ? 'warning' : 'neutral'} />
        <StatCard label="Files" value={agency.stats.files} icon={FileText} tone="neutral" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Team</TabsTrigger>
          <TabsTrigger value="clients">Clients ({agency.clients.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({agency.projects.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="support">Support sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Role</TH>
                  <TH>Job title</TH>
                  <TH>Last sign-in</TH>
                </tr>
              </THead>
              <tbody>
                {agency.members.map((member) => (
                  <TR key={member.id}>
                    <TD>
                      <p className="font-medium">
                        {member.name}
                        {agency.owner?.id === member.id && (
                          <Badge tone="violet" className="ml-2">
                            Owner
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </TD>
                    <TD>
                      <RoleBadge role={member.role} />
                    </TD>
                    <TD className="text-muted-foreground">{member.jobTitle ?? '—'}</TD>
                    <TD className="text-muted-foreground">{timeAgo(member.lastLoginAt)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          {agency.clients.length === 0 ? (
            <EmptyState icon={Building2} title="No clients yet" />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <THead>
                  <tr>
                    <TH>Client</TH>
                    <TH>Contact</TH>
                    <TH className="text-right">Projects</TH>
                    <TH>Portal</TH>
                    <TH>Added</TH>
                  </tr>
                </THead>
                <tbody>
                  {agency.clients.map((client) => (
                    <TR key={client.id}>
                      <TD className="font-medium">{client.companyName}</TD>
                      <TD>
                        <p>{client.contactName ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                      </TD>
                      <TD className="text-right tabular-nums">{client.projectCount}</TD>
                      <TD>
                        {client.portalEnabled ? (
                          <Badge tone="teal">{client.portalUserCount} portal user{client.portalUserCount === 1 ? '' : 's'}</Badge>
                        ) : (
                          <Badge>Disabled</Badge>
                        )}
                      </TD>
                      <TD className="text-muted-foreground">{formatDate(client.createdAt)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="projects">
          {agency.projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects yet" />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <THead>
                  <tr>
                    <TH>Project</TH>
                    <TH>Status</TH>
                    <TH>Priority</TH>
                    <TH className="w-48">Progress</TH>
                    <TH>Due</TH>
                    <TH>Manager</TH>
                  </tr>
                </THead>
                <tbody>
                  {agency.projects.map((project) => (
                    <TR key={project.id}>
                      <TD>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.client.companyName}</p>
                      </TD>
                      <TD>
                        <ProjectStatusBadge status={project.status} />
                      </TD>
                      <TD>
                        <PriorityBadge priority={project.priority} />
                      </TD>
                      <TD>
                        <ProjectProgress progress={project.progress} size="sm" />
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(project.dueDate)}</TD>
                      <TD className="text-muted-foreground">{project.manager?.name ?? '—'}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            For a deeper look (tasks, meetings, files), enter the workspace in read-only support mode.
          </p>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {agency.recentActivity.length === 0 ? (
                <EmptyState icon={FolderKanban} title="No activity yet" compact />
              ) : (
                <ActivityTimeline items={agency.recentActivity} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          {agency.supportSessions.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No support sessions" description="Support sessions you start for this agency are listed here." />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <THead>
                  <tr>
                    <TH>Started</TH>
                    <TH>By</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {agency.supportSessions.map((session) => {
                    const active = !session.endedAt && new Date(session.expiresAt) > new Date();
                    return (
                      <TR key={session.id}>
                        <TD className="whitespace-nowrap">{formatDateTime(session.startedAt)}</TD>
                        <TD>{session.superAdmin.name}</TD>
                        <TD className="max-w-xs text-muted-foreground">{session.reason ?? '—'}</TD>
                        <TD>
                          {active ? (
                            <Badge tone="amber" dot>
                              Active
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Ended {session.endedAt ? formatDateTime(session.endedAt) : '(expired)'}
                            </span>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AgencyActionDialog action={action} onClose={() => setAction(null)} />
    </>
  );
}
