export const ORGANIZATION_MEMBERSHIP_ROLES = [
  "admin",
  "editor",
  "reviewer",
  "viewer",
] as const;

export type OrganizationMembershipRole =
  (typeof ORGANIZATION_MEMBERSHIP_ROLES)[number];

export const WORKSPACE_STATUSES = [
  "draft",
  "active",
  "attention",
  "paused",
] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const WORKSPACE_SOURCE_TYPES = [
  "repository",
  "website",
  "docs",
  "notion",
  "manual",
] as const;

export type WorkspaceSourceType = (typeof WORKSPACE_SOURCE_TYPES)[number];

export const SOURCE_CONNECTION_STATUSES = [
  "connected",
  "pending",
  "error",
  "manual",
] as const;

export type SourceConnectionStatus =
  (typeof SOURCE_CONNECTION_STATUSES)[number];

export const PAGE_RISK_LEVELS = ["low", "medium", "high"] as const;

export type PageRiskLevel = (typeof PAGE_RISK_LEVELS)[number];

export const PAGE_HEALTH_STATUSES = [
  "healthy",
  "stale",
  "needs-review",
  "blocked",
] as const;

export type PageHealthStatus = (typeof PAGE_HEALTH_STATUSES)[number];

export const WORKSPACE_RUN_TYPES = [
  "scan",
  "diff",
  "update",
  "review-sync",
] as const;

export type WorkspaceRunType = (typeof WORKSPACE_RUN_TYPES)[number];

export const WORKSPACE_RUN_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;

export type WorkspaceRunStatus = (typeof WORKSPACE_RUN_STATUSES)[number];

export const UPDATE_REVIEW_STATES = [
  "needs-review",
  "approved",
  "rejected",
  "edited",
  "escalated",
  "skipped",
  "published",
] as const;

export type UpdateReviewState = (typeof UPDATE_REVIEW_STATES)[number];

export const WORKSPACE_EVENT_KINDS = [
  "organization-created",
  "workspace-created",
  "source-added",
  "page-added",
  "run-recorded",
  "update-batch-recorded",
  "workspace-synced",
] as const;

export type WorkspaceEventKind = (typeof WORKSPACE_EVENT_KINDS)[number];

export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationMembershipRole;
  createdAt: string;
};

export type Workspace = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  environment: "production" | "staging" | "internal";
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSource = {
  id: string;
  workspaceId: string;
  type: WorkspaceSourceType;
  label: string;
  scope: string;
  connectionStatus: SourceConnectionStatus;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePage = {
  id: string;
  workspaceId: string;
  pageKey: string;
  title: string;
  audience: "internal" | "external" | "mixed" | "agent";
  riskLevel: PageRiskLevel;
  healthStatus: PageHealthStatus;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRun = {
  id: string;
  workspaceId: string;
  type: WorkspaceRunType;
  status: WorkspaceRunStatus;
  startedAt: string;
  finishedAt?: string;
  summary?: string;
};

export type WorkspaceRunInput = {
  finishedAt?: string;
  startedAt: string;
  status: WorkspaceRunStatus;
  summary?: string;
  type: WorkspaceRunType;
};

export type WorkspaceUpdateBatch = {
  id: string;
  workspaceId: string;
  createdAt: string;
  reviewStateCounts: Record<UpdateReviewState, number>;
  riskCounts: Record<PageRiskLevel, number>;
};

export type WorkspaceUpdateBatchInput = {
  createdAt: string;
  riskCounts: Record<PageRiskLevel, number>;
  reviewStateCounts: Record<UpdateReviewState, number>;
};

export type WorkspaceEvent = {
  id: string;
  workspaceId: string;
  kind: WorkspaceEventKind;
  message: string;
  createdAt: string;
};

export type WorkspaceEventInput = {
  createdAt: string;
  kind: WorkspaceEventKind;
  message: string;
};

export type WorkspaceSourceCounts = Record<SourceConnectionStatus, number>;

export type WorkspacePageHealthCounts = Record<PageHealthStatus, number>;

export type WorkspacePendingUpdateSummary = {
  total: number;
  reviewStateCounts: Record<UpdateReviewState, number>;
  riskCounts: Record<PageRiskLevel, number>;
};

export type WorkspaceDashboardSummary = {
  workspace: Workspace;
  sourceCounts: WorkspaceSourceCounts;
  pageHealthCounts: WorkspacePageHealthCounts;
  latestRuns: Partial<Record<WorkspaceRunType, WorkspaceRun>>;
  pendingUpdates: WorkspacePendingUpdateSummary;
  recentEvents: WorkspaceEvent[];
};

export type CloudSession = {
  user: User;
};

export type CloudSeedData = {
  users: User[];
  organizations: Organization[];
  memberships: OrganizationMembership[];
  workspaces: Workspace[];
  sources: WorkspaceSource[];
  pages: WorkspacePage[];
  runs: WorkspaceRun[];
  updateBatches: WorkspaceUpdateBatch[];
  events: WorkspaceEvent[];
};
