import { FEEDBACK_STATUS, MILESTONE_STATUS, PROJECT_STATUS, TASK_STATUS } from './constants';
import type { Activity } from './types';

type Meta = Record<string, unknown>;

const str = (meta: Meta | null, key: string) => {
  const value = meta?.[key];
  return typeof value === 'string' ? value : '';
};

function statusLabel(value: string) {
  const all: Record<string, { label: string }> = { ...PROJECT_STATUS, ...TASK_STATUS, ...MILESTONE_STATUS, ...FEEDBACK_STATUS };
  return all[value]?.label ?? value.replace(/_/g, ' ').toLowerCase();
}

/** Human-readable sentence for an activity event (actor name is rendered separately). */
export function describeActivity(activity: Activity): string {
  const m = activity.metadata;
  const title = str(m, 'title');
  const project = str(m, 'projectName');
  const quoted = title ? `“${title}”` : '';
  const transition = str(m, 'to') ? ` to ${statusLabel(str(m, 'to'))}` : '';

  switch (activity.eventType) {
    case 'agency.created':
      return `created agency ${str(m, 'agencyName')}`;
    case 'agency.updated':
      return 'updated agency settings';
    case 'agency.suspended':
      return `suspended ${str(m, 'agencyName') || 'the agency'}${str(m, 'reason') ? ` — ${str(m, 'reason')}` : ''}`;
    case 'agency.activated':
      return `re-activated ${str(m, 'agencyName') || 'the agency'}`;
    case 'support.session_started':
      return `started a read-only support session${str(m, 'agencyName') ? ` in ${str(m, 'agencyName')}` : ''}`;
    case 'support.session_ended':
      return `ended the support session${m?.durationMinutes ? ` (${m.durationMinutes} min)` : ''}`;
    case 'user.created':
      return `added ${str(m, 'name')} as ${str(m, 'role') === 'CLIENT' ? `client user${str(m, 'companyName') ? ` for ${str(m, 'companyName')}` : ''}` : str(m, 'role') === 'AGENCY_ADMIN' ? 'an admin' : 'a team member'}`;
    case 'client.created':
      return `added client ${str(m, 'companyName')}`;
    case 'client.updated':
      return `updated client ${str(m, 'companyName')}`;
    case 'client.deleted':
      return `removed client ${str(m, 'companyName')}`;
    case 'project.created':
      return `created project ${project}`;
    case 'project.updated':
      return `updated project ${project}`;
    case 'project.status_changed':
      return `moved ${project}${transition}`;
    case 'project.deleted':
      return `deleted project ${project}`;
    case 'milestone.created':
      return `added milestone ${quoted}`;
    case 'milestone.completed':
      return `completed milestone ${quoted}`;
    case 'milestone.updated':
      return `updated milestone ${quoted}${transition}`;
    case 'milestone.deleted':
      return `deleted milestone ${quoted}`;
    case 'task.created':
      return `created task ${quoted}`;
    case 'task.completed':
      return `completed ${quoted}`;
    case 'task.reopened':
      return `reopened ${quoted}`;
    case 'task.status_changed':
      return `moved ${quoted}${transition}`;
    case 'task.updated':
      return `updated task ${quoted}`;
    case 'task.deleted':
      return `deleted task ${quoted}`;
    case 'task.comment_added':
      return `commented on ${quoted}`;
    case 'meeting.created':
      return `recorded meeting ${quoted}`;
    case 'meeting.shared':
      return `shared meeting notes ${quoted}`;
    case 'meeting.updated':
      return `updated meeting ${quoted}`;
    case 'meeting.deleted':
      return `deleted meeting ${quoted}`;
    case 'feedback.submitted':
      return `submitted feedback ${quoted}`;
    case 'feedback.status_changed':
      return `marked feedback ${quoted}${transition}`;
    case 'feedback.comment_added':
      return `replied to feedback ${quoted}`;
    case 'file.uploaded':
      return `uploaded ${quoted}`;
    case 'file.shared':
      return `shared ${quoted} with the client`;
    case 'file.unshared':
      return `made ${quoted} internal`;
    case 'file.deleted':
      return `deleted file ${quoted}`;
    case 'ai.project_health_generated':
      return `generated an AI health report${str(m, 'health') ? ` (${statusLabel(str(m, 'health'))})` : ''}`;
    default:
      return activity.eventType.replace(/[._]/g, ' ');
  }
}

export function activityCategory(eventType: string) {
  return eventType.split('.')[0];
}
