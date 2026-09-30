import { prisma, type TransactionClient } from '../config/prisma';

export interface Progress {
  totalTasks: number;
  completedTasks: number;
  percent: number;
}

export function computeProgress(totalTasks: number, completedTasks: number): Progress {
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  return { totalTasks, completedTasks, percent };
}

/**
 * Project progress is always derived: completed tasks / total tasks * 100.
 * It is never stored or accepted from input, so it cannot drift from reality.
 */
export async function getProgressForProjects(
  agencyId: string,
  projectIds: string[],
  db: TransactionClient = prisma,
): Promise<Map<string, Progress>> {
  const result = new Map<string, Progress>();
  if (projectIds.length === 0) return result;

  const groups = await db.task.groupBy({
    by: ['projectId', 'status'],
    where: { agencyId, projectId: { in: projectIds } },
    _count: { _all: true },
  });

  const totals = new Map<string, { total: number; completed: number }>();
  for (const group of groups) {
    const entry = totals.get(group.projectId) ?? { total: 0, completed: 0 };
    entry.total += group._count._all;
    if (group.status === 'COMPLETED') entry.completed += group._count._all;
    totals.set(group.projectId, entry);
  }

  for (const id of projectIds) {
    const entry = totals.get(id);
    result.set(id, computeProgress(entry?.total ?? 0, entry?.completed ?? 0));
  }
  return result;
}

export async function getProjectProgress(agencyId: string, projectId: string, db: TransactionClient = prisma) {
  const map = await getProgressForProjects(agencyId, [projectId], db);
  return map.get(projectId) ?? computeProgress(0, 0);
}
