'use client';

import { Ban, Building2, CheckCircle2, FolderKanban, Users, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { ActivityTimeline } from '@/components/shared/activity-timeline';
import { AgencyStatusBadge, PlanBadge } from '@/components/shared/badges';
import { CATEGORICAL, SegmentedBar } from '@/components/shared/charts';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState, ListSkeleton, StatCardsSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSuperAdminDashboard } from '@/hooks/use-super-admin';
import { PLAN } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export default function SuperAdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useSuperAdminDashboard();

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every agency workspace on AppZex at a glance. Figures are calculated live from the database."
        actions={
          <Button asChild>
            <Link href="/super-admin/agencies">Manage agencies</Link>
          </Button>
        }
      />

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <StatCardsSkeleton count={6} />
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <ListSkeleton rows={3} />
            </Card>
            <Card className="p-5 lg:col-span-2">
              <ListSkeleton rows={5} />
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total agencies" value={data.stats.totalAgencies} icon={Building2} href="/super-admin/agencies" />
            <StatCard label="Active agencies" value={data.stats.activeAgencies} icon={CheckCircle2} tone="success" />
            <StatCard label="Suspended agencies" value={data.stats.suspendedAgencies} icon={Ban} tone={data.stats.suspendedAgencies ? 'danger' : 'neutral'} />
            <StatCard label="Total users" value={data.stats.totalUsers} icon={Users} hint="Team members and clients" />
            <StatCard label="Total clients" value={data.stats.totalClients} icon={UsersRound} />
            <StatCard label="Total projects" value={data.stats.totalProjects} icon={FolderKanban} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agencies by plan</CardTitle>
                  <CardDescription>Subscription mix across the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <SegmentedBar
                    label="Agencies by plan"
                    segments={data.planDistribution.map((entry, index) => ({
                      key: entry.plan,
                      label: PLAN[entry.plan].label,
                      value: entry.count,
                      color: CATEGORICAL[index],
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Newest agencies</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {data.recentAgencies.map((agency) => (
                      <li key={agency.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link href={`/super-admin/agencies/${agency.id}`} className="block truncate text-sm font-medium hover:underline">
                            {agency.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">Created {formatDate(agency.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <PlanBadge plan={agency.plan} />
                          <AgencyStatusBadge status={agency.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent platform activity</CardTitle>
                <CardDescription>Agency lifecycle, new users and support sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <EmptyState icon={Building2} title="No platform activity yet" compact />
                ) : (
                  <ActivityTimeline items={data.recentActivity} showProject={false} showAgency />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
