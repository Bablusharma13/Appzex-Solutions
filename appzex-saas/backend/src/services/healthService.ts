import { prisma } from '../config/prisma';
import { findAgencyProjectOrThrow } from '../repositories/tenantRepository';
import { daysBetween, startOfTodayUtc, toDateOnlyString } from '../utils/dates';
import { OPEN_FEEDBACK_STATUSES } from './feedbackService';

export type HealthLevel = 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';

const LEVELS: HealthLevel[] = ['ON_TRACK', 'AT_RISK', 'CRITICAL'];

/**
 * Deterministic project facts. These are computed from the database and are
 * the ONLY information given to the AI model, so the model analyses facts
 * rather than inventing them. The rule-based assessment also works without AI.
 */
export async function getProjectHealthFacts(agencyId: string, projectId: string) {
  // Authorization first: the project must belong to the caller's agency.
  const project = await findAgencyProjectOrThrow(agencyId, projectId);

  const [details, tasks, milestones, feedback, activity] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      select: { client: { select: { companyName: true } }, manager: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { agencyId, projectId: project.id },
      take: 500,
      select: {
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { name: true } },
        milestone: { select: { name: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { agencyId, projectId: project.id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { name: true, status: true, dueDate: true },
    }),
    prisma.feedback.findMany({
      where: { agencyId, projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { title: true, status: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      where: { agencyId, projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { eventType: true, createdAt: true, metadata: true },
    }),
  ]);

  const today = startOfTodayUtc();
  const isOpen = (status: string) => status !== 'COMPLETED';
  const openTasks = tasks.filter((task) => isOpen(task.status));
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
  const completedTasks = tasks.length - openTasks.length;
  const overdueMilestones = milestones.filter((m) => isOpen(m.status) && m.dueDate && m.dueDate < today);
  const pendingFeedback = feedback.filter((item) => OPEN_FEEDBACK_STATUSES.includes(item.status));

  const metrics = {
    totalTasks: tasks.length,
    completedTasks,
    openTasks: openTasks.length,
    inProgressTasks: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    overdueTasks: overdueTasks.length,
    unassignedOpenTasks: openTasks.filter((task) => !task.assignee).length,
    completionPercentage: tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100),
    daysUntilDeadline: project.dueDate ? daysBetween(today, project.dueDate) : null,
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter((m) => m.status === 'COMPLETED').length,
    overdueMilestones: overdueMilestones.length,
    pendingFeedback: pendingFeedback.length,
  };

  const assessment = assessHealth(project.status, metrics);

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      priority: project.priority,
      clientName: details.client.companyName,
      managerName: details.manager?.name ?? null,
      startDate: toDateOnlyString(project.startDate),
      dueDate: toDateOnlyString(project.dueDate),
    },
    today: toDateOnlyString(today),
    metrics,
    ruleBasedHealth: assessment.level,
    ruleBasedReasons: assessment.reasons,
    overdueTaskList: overdueTasks
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 10)
      .map((task) => ({
        title: task.title,
        dueDate: toDateOnlyString(task.dueDate),
        daysOverdue: daysBetween(task.dueDate!, today),
        priority: task.priority,
        assignee: task.assignee?.name ?? 'Unassigned',
        milestone: task.milestone?.name ?? null,
      })),
    milestones: milestones.map((m) => ({
      name: m.name,
      status: m.status,
      dueDate: toDateOnlyString(m.dueDate),
      overdue: Boolean(isOpen(m.status) && m.dueDate && m.dueDate < today),
    })),
    recentFeedback: feedback.slice(0, 5).map((item) => ({
      title: item.title,
      status: item.status,
      submitted: toDateOnlyString(item.createdAt),
    })),
    recentActivity: activity.map((item) => ({
      event: item.eventType,
      date: toDateOnlyString(item.createdAt),
      title: (item.metadata as { title?: string; projectName?: string } | null)?.title ?? null,
    })),
  };
}

export type ProjectHealthFacts = Awaited<ReturnType<typeof getProjectHealthFacts>>;

export function assessHealth(
  status: string,
  m: {
    totalTasks: number;
    openTasks: number;
    overdueTasks: number;
    completionPercentage: number;
    daysUntilDeadline: number | null;
    overdueMilestones: number;
    pendingFeedback: number;
  },
): { level: HealthLevel; reasons: string[] } {
  if (status === 'COMPLETED') return { level: 'ON_TRACK', reasons: ['Project is marked as completed.'] };

  let level = 0;
  const reasons: string[] = [];
  const raise = (to: number, reason: string) => {
    level = Math.max(level, to);
    reasons.push(reason);
  };

  if (m.daysUntilDeadline !== null && m.daysUntilDeadline < 0) {
    raise(2, `Project is ${Math.abs(m.daysUntilDeadline)} day(s) past its expected completion date.`);
  }
  // Critical when a large share of the remaining work is already late.
  if (m.overdueTasks >= 3 || (m.overdueTasks >= 2 && m.overdueTasks / m.openTasks >= 0.5)) {
    raise(2, `${m.overdueTasks} of ${m.openTasks} open task(s) are overdue.`);
  } else if (m.overdueTasks > 0) {
    raise(1, `${m.overdueTasks} task(s) are overdue.`);
  }
  if (m.overdueMilestones > 0) raise(1, `${m.overdueMilestones} milestone(s) have passed their due date.`);
  if (m.pendingFeedback >= 3) raise(1, `${m.pendingFeedback} client feedback items are awaiting resolution.`);
  if (
    m.daysUntilDeadline !== null &&
    m.daysUntilDeadline >= 0 &&
    m.daysUntilDeadline <= 14 &&
    m.completionPercentage < 60
  ) {
    raise(1, `Only ${m.completionPercentage}% complete with ${m.daysUntilDeadline} day(s) until the deadline.`);
  }
  if (status === 'ON_HOLD') raise(1, 'Project is on hold.');
  if (m.totalTasks === 0) reasons.push('No tasks have been created yet, so progress cannot be measured.');

  if (reasons.length === 0) reasons.push('No overdue work or deadline pressure detected.');
  return { level: LEVELS[level], reasons };
}
