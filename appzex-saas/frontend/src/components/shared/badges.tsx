import { AlertTriangle, CheckCircle2, Eye, Lock, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AGENCY_STATUS,
  FEEDBACK_STATUS,
  HEALTH,
  MILESTONE_STATUS,
  PLAN,
  PRIORITY,
  PROJECT_STATUS,
  ROLE_LABEL,
  TASK_STATUS,
} from '@/lib/constants';
import type {
  AgencyPlan,
  AgencyStatus,
  FeedbackStatus,
  HealthLevel,
  MilestoneStatus,
  Priority,
  ProjectStatus,
  Role,
  TaskStatus,
} from '@/lib/types';

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => (
  <Badge tone={PROJECT_STATUS[status].tone} dot>
    {PROJECT_STATUS[status].label}
  </Badge>
);

export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge tone={TASK_STATUS[status].tone} dot>
    {TASK_STATUS[status].label}
  </Badge>
);

export const MilestoneStatusBadge = ({ status }: { status: MilestoneStatus }) => (
  <Badge tone={MILESTONE_STATUS[status].tone} dot>
    {MILESTONE_STATUS[status].label}
  </Badge>
);

export const FeedbackStatusBadge = ({ status }: { status: FeedbackStatus }) => (
  <Badge tone={FEEDBACK_STATUS[status].tone} dot>
    {FEEDBACK_STATUS[status].label}
  </Badge>
);

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge tone={PRIORITY[priority].tone}>{PRIORITY[priority].label}</Badge>
);

export const AgencyStatusBadge = ({ status }: { status: AgencyStatus }) => (
  <Badge tone={AGENCY_STATUS[status].tone} dot>
    {AGENCY_STATUS[status].label}
  </Badge>
);

export const PlanBadge = ({ plan }: { plan: AgencyPlan }) => <Badge tone={PLAN[plan].tone}>{PLAN[plan].label}</Badge>;

export const RoleBadge = ({ role }: { role: Role }) => {
  const tone = role === 'SUPER_ADMIN' ? 'violet' : role === 'AGENCY_ADMIN' ? 'blue' : role === 'CLIENT' ? 'teal' : 'neutral';
  return <Badge tone={tone}>{ROLE_LABEL[role]}</Badge>;
};

/** Health is status: always icon + label, never color alone. */
export function HealthBadge({ health }: { health: HealthLevel }) {
  const Icon = health === 'ON_TRACK' ? CheckCircle2 : health === 'AT_RISK' ? AlertTriangle : ShieldAlert;
  return (
    <Badge tone={HEALTH[health].tone} className="gap-1">
      <Icon className="size-3.5" aria-hidden />
      {HEALTH[health].label}
    </Badge>
  );
}

export function VisibilityBadge({ clientVisible }: { clientVisible: boolean }) {
  return clientVisible ? (
    <Badge tone="teal" className="gap-1">
      <Eye className="size-3" aria-hidden />
      Client visible
    </Badge>
  ) : (
    <Badge tone="neutral" className="gap-1">
      <Lock className="size-3" aria-hidden />
      Internal
    </Badge>
  );
}
