import type { QueryClient } from '@tanstack/react-query';

type Scope = 'projects' | 'tasks' | 'milestones' | 'meetings' | 'feedback' | 'files' | 'clients' | 'team' | 'activity' | 'dashboard' | 'portal';

const KEY_PREFIX: Record<Scope, string> = {
  projects: 'projects',
  tasks: 'tasks',
  milestones: 'milestones',
  meetings: 'meetings',
  feedback: 'feedback',
  files: 'files',
  clients: 'clients',
  team: 'team',
  activity: 'activity',
  dashboard: 'dashboard',
  portal: 'portal',
};

/**
 * Invalidates every cached query under the given scopes. Derived numbers
 * (progress, dashboard counts, activity) depend on many entities, so
 * mutations invalidate broadly rather than trying to patch caches by hand.
 */
export function invalidate(queryClient: QueryClient, ...scopes: Scope[]) {
  return Promise.all(scopes.map((scope) => queryClient.invalidateQueries({ queryKey: [KEY_PREFIX[scope]] })));
}
