'use client';

import { UserPlus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { RoleBadge } from '@/components/shared/badges';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, TD, TH, THead, TR, Table } from '@/components/ui/misc';
import { TeamMemberDialog } from '@/features/team/team-member-dialog';
import { usePermissions } from '@/hooks/use-auth';
import { useTeam } from '@/hooks/use-agency';
import { formatDate, timeAgo } from '@/lib/utils';

export default function TeamPage() {
  const { isAgencyAdmin, userId } = usePermissions();
  const { data: team, isLoading, isError, error, refetch } = useTeam();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Team"
        description="People with access to this agency workspace."
        actions={
          isAgencyAdmin && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Add team member
            </Button>
          )
        }
      />
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !team ? (
        <TableSkeleton columns={5} rows={4} />
      ) : team.length === 0 ? (
        <EmptyState icon={UsersRound} title="No team members" />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Role</TH>
                <TH className="text-right">Open tasks</TH>
                <TH className="text-right">Managing</TH>
                <TH>Last sign-in</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <tbody>
              {team.map((member) => (
                <TR key={member.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {member.name}
                          {member.id === userId && <span className="font-normal text-muted-foreground"> (you)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.jobTitle ? `${member.jobTitle} · ` : ''}
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <RoleBadge role={member.role} />
                  </TD>
                  <TD className="text-right tabular-nums">{member.openTasks}</TD>
                  <TD className="text-right tabular-nums">
                    {member.activeProjects} project{member.activeProjects === 1 ? '' : 's'}
                  </TD>
                  <TD className="text-muted-foreground">{timeAgo(member.lastLoginAt)}</TD>
                  <TD className="text-muted-foreground">{formatDate(member.joinedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <TeamMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
