// API contract types. These mirror the backend response shapes.

export type Role = 'SUPER_ADMIN' | 'AGENCY_ADMIN' | 'AGENCY_MEMBER' | 'CLIENT';
export type AgencyStatus = 'ACTIVE' | 'SUSPENDED';
export type AgencyPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
export type FeedbackStatus = 'OPEN' | 'IN_REVIEW' | 'IN_PROGRESS' | 'RESOLVED' | 'DECLINED';
export type HealthLevel = 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface Progress {
  totalTasks: number;
  completedTasks: number;
  percent: number;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface PersonRef {
  id?: string;
  name: string;
  role: Role;
}

// ----- Auth --------------------------------------------------------------------

export interface AgencySummary {
  id: string;
  name: string;
  slug: string;
  status: AgencyStatus;
  plan: AgencyPlan;
}

export interface SupportSessionInfo {
  id: string;
  agencyId: string;
  agencyName: string;
  expiresAt: string;
  readOnly: boolean;
}

export interface SessionProfile {
  user: { id: string; name: string; email: string; role: Role; jobTitle: string | null };
  agency: AgencySummary | null;
  client: { id: string; companyName: string } | null;
  supportSession: SupportSessionInfo | null;
  home: string;
}

// ----- Activity ------------------------------------------------------------------

export interface Activity {
  id: string;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  visibility?: 'INTERNAL' | 'CLIENT';
  actorType: 'USER' | 'SUPER_ADMIN' | 'SYSTEM';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: PersonRef | null;
  project: { id: string; name: string } | null;
  agency?: { id: string; name: string } | null;
}

// ----- Super admin -----------------------------------------------------------------

export interface PlatformDashboard {
  stats: {
    totalAgencies: number;
    activeAgencies: number;
    suspendedAgencies: number;
    totalUsers: number;
    totalClients: number;
    totalProjects: number;
  };
  planDistribution: { plan: AgencyPlan; count: number }[];
  recentAgencies: { id: string; name: string; status: AgencyStatus; plan: AgencyPlan; createdAt: string }[];
  recentActivity: Activity[];
}

export interface AgencyListItem {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  phone: string | null;
  status: AgencyStatus;
  plan: AgencyPlan;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  counts: { teamMembers: number; clientUsers: number; users: number; clients: number; projects: number };
}

export interface AgencyDetail {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  phone: string | null;
  website: string | null;
  status: AgencyStatus;
  plan: AgencyPlan;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string } | null;
  stats: {
    teamMembers: number;
    clients: number;
    projects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
    openFeedback: number;
    files: number;
  };
  members: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    lastLoginAt: string | null;
    jobTitle: string | null;
  }[];
  clients: {
    id: string;
    companyName: string;
    contactName: string | null;
    email: string | null;
    portalEnabled: boolean;
    createdAt: string;
    projectCount: number;
    portalUserCount: number;
  }[];
  projects: {
    id: string;
    name: string;
    status: ProjectStatus;
    priority: Priority;
    dueDate: string | null;
    createdAt: string;
    client: { id: string; companyName: string };
    manager: UserRef | null;
    progress: Progress;
  }[];
  recentActivity: Activity[];
  supportSessions: {
    id: string;
    reason: string | null;
    startedAt: string;
    endedAt: string | null;
    expiresAt: string;
    superAdmin: UserRef;
  }[];
}

// ----- Agency workspace -----------------------------------------------------------

export interface AgencyDashboard {
  stats: {
    totalClients: number;
    activeProjects: number;
    onHoldProjects: number;
    completedProjects: number;
    projectsDueSoon: number;
    overdueProjects: number;
    pendingFeedback: number;
    totalTasks: number;
    overdueTasks: number;
  };
  charts: {
    projectStatus: { status: ProjectStatus; count: number }[];
    taskStatus: { status: TaskStatus; count: number }[];
    projectProgress: {
      id: string;
      name: string;
      clientName: string;
      dueDate: string | null;
      status: ProjectStatus;
      percent: number;
      completedTasks: number;
      totalTasks: number;
    }[];
  };
  upcomingTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
    project: { id: string; name: string };
    assignee: UserRef | null;
  }[];
  upcomingMilestones: {
    id: string;
    name: string;
    dueDate: string | null;
    status: MilestoneStatus;
    project: { id: string; name: string };
  }[];
  recentActivity: Activity[];
}

export interface AgencySettings {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  phone: string | null;
  website: string | null;
  status: AgencyStatus;
  plan: AgencyPlan;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
}

export interface TeamMember {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
  openTasks: number;
  activeProjects: number;
}

export interface ClientListItem {
  id: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  portalEnabled: boolean;
  createdAt: string;
  projectCount: number;
  portalUserCount: number;
}

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ClientDetail {
  id: string;
  agencyId: string;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  projects: {
    id: string;
    name: string;
    status: ProjectStatus;
    priority: Priority;
    dueDate: string | null;
    manager: UserRef | null;
    progress: Progress;
  }[];
  portalUsers: PortalUser[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; companyName: string };
  manager: UserRef | null;
  milestoneCount: number;
  openFeedbackCount: number;
  progress: Progress;
}

export interface ProjectDetail extends Omit<ProjectListItem, 'client' | 'manager'> {
  client: { id: string; companyName: string; contactName: string | null; email: string | null };
  manager: { id: string; name: string; email: string } | null;
  taskCounts: { todo: number; inProgress: number; completed: number; overdue: number };
  milestoneCounts: { pending: number; inProgress: number; completed: number };
  nextMilestone: { id: string; name: string; dueDate: string | null; status: MilestoneStatus } | null;
  daysUntilDue: number | null;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  progress: Progress;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  clientVisible: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; client: { id: string; companyName: string } };
  milestone: UserRef | null;
  assignee: UserRef | null;
  createdBy: UserRef | null;
  commentCount: number;
  fileCount: number;
}

export interface TaskMutationResult {
  task: Task;
  projectProgress: Progress;
}

export interface TaskSummary {
  all: number;
  overdue: number;
  today: number;
  week: number;
  completed: number;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; role: Role };
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string;
  notes: string | null;
  summary: string | null;
  clientVisible: boolean;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; client: { id: string; companyName: string } };
  createdBy: UserRef | null;
}

export interface Feedback {
  id: string;
  projectId?: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; client?: { id: string; companyName: string } };
  submittedBy: { id: string; name: string; role: Role };
  commentCount: number;
  fileCount?: number;
}

export interface FileItem {
  id: string;
  projectId?: string;
  taskId?: string | null;
  feedbackId?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  clientVisible?: boolean;
  createdAt: string;
  uploadedBy?: { id?: string; name: string; role: Role };
  project?: { id: string; name: string };
  task?: { id: string; title: string } | null;
  feedback?: { id: string; title: string } | null;
}

export interface FeedbackDetail extends Feedback {
  comments: Comment[];
  files: FileItem[];
}

// ----- AI & health -----------------------------------------------------------------

export interface HealthMetrics {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  unassignedOpenTasks: number;
  completionPercentage: number;
  daysUntilDeadline: number | null;
  totalMilestones: number;
  completedMilestones: number;
  overdueMilestones: number;
  pendingFeedback: number;
}

export interface HealthFacts {
  project: { id: string; name: string; status: ProjectStatus; dueDate: string | null };
  metrics: HealthMetrics;
  ruleBasedHealth: HealthLevel;
  ruleBasedReasons: string[];
  overdueTaskList: { title: string; dueDate: string | null; daysOverdue: number; priority: Priority; assignee: string }[];
}

export interface AIHealthResult {
  projectId: string;
  model: string;
  generatedAt: string;
  parsedFromModel: boolean;
  insights: {
    health: HealthLevel;
    summary: string;
    risks: string[];
    overdueWork: string[];
    recommendedActions: string[];
    clientUpdate: string;
  };
  facts: { metrics: HealthMetrics; ruleBasedHealth: HealthLevel; ruleBasedReasons: string[] };
}

export interface MeetingSummaryResult {
  model: string;
  generatedAt: string;
  parsedFromModel: boolean;
  result: {
    summary: string;
    keyDecisions: string[];
    actionItems: { title: string; owner: string | null; dueDate: string | null }[];
    deadlines: string[];
  };
}

// ----- Client portal ------------------------------------------------------------------

export interface PortalProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  manager: { name: string } | null;
  progress: Progress;
  nextMilestone?: { name: string; dueDate: string | null } | null;
}

export interface PortalMilestone {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  order: number;
  completedAt: string | null;
  project?: { id: string; name: string };
}

export interface PortalTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  project: { id: string; name: string };
  milestone: { name: string } | null;
}

export interface PortalMeeting {
  id: string;
  title: string;
  meetingDate: string;
  summary: string | null;
  project: { id: string; name: string };
}

export interface PortalDashboard {
  client: { companyName: string; contactName: string | null };
  agency: { name: string; contactEmail: string };
  stats: {
    activeProjects: number;
    totalProjects: number;
    upcomingMilestones: number;
    pendingActions: number;
    openFeedback: number;
  };
  projects: PortalProject[];
  upcomingMilestones: PortalMilestone[];
  pendingActions: PortalTask[];
  recentUpdates: Activity[];
}

export interface PortalProjectDetail extends PortalProject {
  milestones: PortalMilestone[];
  sharedTasks: PortalTask[];
  meetings: PortalMeeting[];
  files: FileItem[];
  feedback: Feedback[];
  updates: Activity[];
  upcomingDeadlines: { type: 'milestone' | 'action'; id: string; title: string; dueDate: string }[];
}
