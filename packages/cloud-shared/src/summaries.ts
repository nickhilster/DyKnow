import {
  type CloudSeedData,
  PAGE_HEALTH_STATUSES,
  PAGE_RISK_LEVELS,
  type PageHealthStatus,
  type PageRiskLevel,
  SOURCE_CONNECTION_STATUSES,
  type SourceConnectionStatus,
  UPDATE_REVIEW_STATES,
  type UpdateReviewState,
  WORKSPACE_RUN_TYPES,
  type Workspace,
  type WorkspaceDashboardSummary,
  type WorkspaceEvent,
  type WorkspacePage,
  type WorkspaceRun,
  type WorkspaceRunType,
  type WorkspaceSource,
  type WorkspaceUpdateBatch,
} from "./contracts.js";

function makeCountRecord<T extends string>(
  keys: readonly T[],
): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function incrementRecord<T extends string>(
  record: Record<T, number>,
  key: T,
): void {
  record[key] += 1;
}

function sortDescendingByDate<T extends { createdAt: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function sortRunsDescending(runs: readonly WorkspaceRun[]): WorkspaceRun[] {
  return [...runs].sort((left, right) => {
    const leftDate = left.finishedAt ?? left.startedAt;
    const rightDate = right.finishedAt ?? right.startedAt;
    return rightDate.localeCompare(leftDate);
  });
}

export function buildWorkspaceDashboardSummary(options: {
  workspace: Workspace;
  sources: readonly WorkspaceSource[];
  pages: readonly WorkspacePage[];
  runs: readonly WorkspaceRun[];
  updateBatches: readonly WorkspaceUpdateBatch[];
  events: readonly WorkspaceEvent[];
}): WorkspaceDashboardSummary {
  const sourceCounts = makeCountRecord<SourceConnectionStatus>(
    SOURCE_CONNECTION_STATUSES,
  );
  const pageHealthCounts =
    makeCountRecord<PageHealthStatus>(PAGE_HEALTH_STATUSES);
  const reviewStateCounts =
    makeCountRecord<UpdateReviewState>(UPDATE_REVIEW_STATES);
  const riskCounts = makeCountRecord<PageRiskLevel>(PAGE_RISK_LEVELS);

  for (const source of options.sources) {
    incrementRecord(sourceCounts, source.connectionStatus);
  }

  for (const page of options.pages) {
    incrementRecord(pageHealthCounts, page.healthStatus);
  }

  const latestBatch = sortDescendingByDate(options.updateBatches)[0];

  if (latestBatch) {
    for (const state of UPDATE_REVIEW_STATES) {
      reviewStateCounts[state] = latestBatch.reviewStateCounts[state];
    }
    for (const level of PAGE_RISK_LEVELS) {
      riskCounts[level] = latestBatch.riskCounts[level];
    }
  }

  const latestRuns: Partial<Record<WorkspaceRunType, WorkspaceRun>> = {};

  for (const run of sortRunsDescending(options.runs)) {
    if (!latestRuns[run.type]) {
      latestRuns[run.type] = run;
    }
    if (WORKSPACE_RUN_TYPES.every((type) => latestRuns[type])) {
      break;
    }
  }

  return {
    workspace: options.workspace,
    sourceCounts,
    pageHealthCounts,
    latestRuns,
    pendingUpdates: {
      total:
        reviewStateCounts["needs-review"] +
        reviewStateCounts.approved +
        reviewStateCounts.edited +
        reviewStateCounts.escalated,
      reviewStateCounts,
      riskCounts,
    },
    recentEvents: sortDescendingByDate([...options.events]).slice(0, 6),
  };
}

export function getWorkspaceBundle(data: CloudSeedData, workspaceId: string) {
  const workspace = data.workspaces.find(
    (candidate) => candidate.id === workspaceId,
  );
  if (!workspace) {
    return undefined;
  }

  return {
    workspace,
    sources: data.sources.filter(
      (source) => source.workspaceId === workspaceId,
    ),
    pages: data.pages.filter((page) => page.workspaceId === workspaceId),
    runs: data.runs.filter((run) => run.workspaceId === workspaceId),
    updateBatches: data.updateBatches.filter(
      (batch) => batch.workspaceId === workspaceId,
    ),
    events: data.events.filter((event) => event.workspaceId === workspaceId),
  };
}

export function buildWorkspaceSummaryFromSeed(
  data: CloudSeedData,
  workspaceId: string,
): WorkspaceDashboardSummary | undefined {
  const bundle = getWorkspaceBundle(data, workspaceId);
  if (!bundle) {
    return undefined;
  }

  return buildWorkspaceDashboardSummary(bundle);
}
