import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  type CloudSeedData,
  DYKNOW_CLOUD_DEMO_DATA,
  type Organization,
  type PageHealthStatus,
  type PageRiskLevel,
  type WorkspaceEventInput,
  type WorkspaceRunInput,
  type SourceConnectionStatus,
  type User,
  type Workspace,
  type WorkspaceDashboardSummary,
  type WorkspacePage,
  type WorkspaceRun,
  type WorkspaceSource,
  type WorkspaceUpdateBatch,
  type WorkspaceUpdateBatchInput,
  buildWorkspaceDashboardSummary,
} from "@dyknow/cloud-shared";

export type CloudDatabase = CloudSeedData;

export type WorkspaceRecord = {
  summary: WorkspaceDashboardSummary;
  workspace: Workspace;
};

function cloneSeedData(): CloudDatabase {
  return JSON.parse(JSON.stringify(DYKNOW_CLOUD_DEMO_DATA)) as CloudDatabase;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function assertUniqueSlug(
  existing: readonly { slug: string }[],
  slug: string,
  label: string,
) {
  if (existing.some((entry) => entry.slug === slug)) {
    throw new Error(`${label} slug "${slug}" already exists.`);
  }
}

export class CloudStorage {
  constructor(private readonly dbPath: string) {}

  async bootstrap(): Promise<void> {
    try {
      await readFile(this.dbPath, "utf8");
    } catch {
      await this.write(cloneSeedData());
    }
  }

  async read(): Promise<CloudDatabase> {
    await this.bootstrap();
    const raw = await readFile(this.dbPath, "utf8");
    return JSON.parse(raw) as CloudDatabase;
  }

  async write(data: CloudDatabase): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    await writeFile(this.dbPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    const data = await this.read();
    return data.users.find(
      (user) => user.email.toLowerCase() === email.trim().toLowerCase(),
    );
  }

  async listOrganizationsForUser(userId: string): Promise<Organization[]> {
    const data = await this.read();
    const organizationIds = new Set(
      data.memberships
        .filter((membership) => membership.userId === userId)
        .map((membership) => membership.organizationId),
    );

    return data.organizations.filter((organization) =>
      organizationIds.has(organization.id),
    );
  }

  async getOrganizationForUser(
    userId: string,
    orgSlug: string,
  ): Promise<Organization | undefined> {
    const organizations = await this.listOrganizationsForUser(userId);
    return organizations.find((organization) => organization.slug === orgSlug);
  }

  async listWorkspaceRecordsForOrganization(
    organizationId: string,
  ): Promise<WorkspaceRecord[]> {
    const data = await this.read();
    const workspaces = data.workspaces.filter(
      (workspace) => workspace.organizationId === organizationId,
    );

    return workspaces.map((workspace) => ({
      workspace,
      summary: buildWorkspaceDashboardSummary({
        workspace,
        sources: data.sources.filter(
          (source) => source.workspaceId === workspace.id,
        ),
        pages: data.pages.filter((page) => page.workspaceId === workspace.id),
        runs: data.runs.filter((run) => run.workspaceId === workspace.id),
        updateBatches: data.updateBatches.filter(
          (batch) => batch.workspaceId === workspace.id,
        ),
        events: data.events.filter(
          (event) => event.workspaceId === workspace.id,
        ),
      }),
    }));
  }

  async getWorkspaceForOrganization(
    organizationId: string,
    workspaceSlug: string,
  ): Promise<Workspace | undefined> {
    const data = await this.read();
    return data.workspaces.find(
      (workspace) =>
        workspace.organizationId === organizationId &&
        workspace.slug === workspaceSlug,
    );
  }

  async getWorkspaceSummary(
    organizationId: string,
    workspaceSlug: string,
  ): Promise<WorkspaceDashboardSummary | undefined> {
    const data = await this.read();
    const workspace = data.workspaces.find(
      (entry) =>
        entry.organizationId === organizationId && entry.slug === workspaceSlug,
    );

    if (!workspace) {
      return undefined;
    }

    return buildWorkspaceDashboardSummary({
      workspace,
      sources: data.sources.filter(
        (source) => source.workspaceId === workspace.id,
      ),
      pages: data.pages.filter((page) => page.workspaceId === workspace.id),
      runs: data.runs.filter((run) => run.workspaceId === workspace.id),
      updateBatches: data.updateBatches.filter(
        (batch) => batch.workspaceId === workspace.id,
      ),
      events: data.events.filter((event) => event.workspaceId === workspace.id),
    });
  }

  async listSources(workspaceId: string): Promise<WorkspaceSource[]> {
    const data = await this.read();
    return data.sources.filter((source) => source.workspaceId === workspaceId);
  }

  async listPages(workspaceId: string): Promise<WorkspacePage[]> {
    const data = await this.read();
    return data.pages.filter((page) => page.workspaceId === workspaceId);
  }

  async createWorkspace(input: {
    environment: Workspace["environment"];
    name: string;
    organizationId: string;
    status: Workspace["status"];
  }): Promise<Workspace> {
    const data = await this.read();
    const slug = slugify(input.name);
    assertUniqueSlug(
      data.workspaces.filter(
        (workspace) => workspace.organizationId === input.organizationId,
      ),
      slug,
      "Workspace",
    );

    const timestamp = nowIso();
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      slug,
      name: input.name.trim(),
      environment: input.environment,
      status: input.status,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.workspaces.push(workspace);
    data.events.push({
      id: crypto.randomUUID(),
      workspaceId: workspace.id,
      kind: "workspace-created",
      message: `Workspace ${workspace.name} created in ${workspace.environment} mode.`,
      createdAt: timestamp,
    });
    await this.write(data);
    return workspace;
  }

  async createSource(input: {
    connectionStatus: SourceConnectionStatus;
    label: string;
    scope: string;
    type: WorkspaceSource["type"];
    workspaceId: string;
  }): Promise<WorkspaceSource> {
    const data = await this.read();
    const timestamp = nowIso();
    const source = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      type: input.type,
      label: input.label.trim(),
      scope: input.scope.trim(),
      connectionStatus: input.connectionStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const persistedSource: WorkspaceSource =
      input.connectionStatus === "connected"
        ? { ...source, lastSyncedAt: timestamp }
        : source;

    data.sources.push(persistedSource);
    data.events.push({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      kind: "source-added",
      message: `Added ${persistedSource.type} source "${persistedSource.label}" with ${persistedSource.connectionStatus} status.`,
      createdAt: timestamp,
    });
    await this.write(data);
    return persistedSource;
  }

  async createPage(input: {
    audience: WorkspacePage["audience"];
    healthStatus: PageHealthStatus;
    pageKey: string;
    riskLevel: PageRiskLevel;
    title: string;
    workspaceId: string;
  }): Promise<WorkspacePage> {
    const data = await this.read();
    const timestamp = nowIso();
    const page: WorkspacePage = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      pageKey: slugify(input.pageKey),
      title: input.title.trim(),
      audience: input.audience,
      riskLevel: input.riskLevel,
      healthStatus: input.healthStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.pages.push(page);
    data.events.push({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      kind: "page-added",
      message: `Registered page "${page.title}" with ${page.healthStatus} health.`,
      createdAt: timestamp,
    });
    await this.write(data);
    return page;
  }

  async recordWorkspaceRun(input: {
    run: WorkspaceRunInput;
    workspaceId: string;
  }): Promise<WorkspaceRun> {
    const data = await this.read();
    const run: WorkspaceRun = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      type: input.run.type,
      status: input.run.status,
      startedAt: input.run.startedAt,
      ...(input.run.finishedAt ? { finishedAt: input.run.finishedAt } : {}),
      ...(input.run.summary ? { summary: input.run.summary } : {}),
    };

    data.runs.push(run);
    data.events.push({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      kind: "run-recorded",
      message: input.run.summary ?? `Recorded ${input.run.type} run.`,
      createdAt: input.run.finishedAt ?? input.run.startedAt,
    });
    await this.write(data);
    return run;
  }

  async recordWorkspaceUpdateBatch(input: {
    batch: WorkspaceUpdateBatchInput;
    workspaceId: string;
  }): Promise<WorkspaceUpdateBatch> {
    const data = await this.read();
    const batch: WorkspaceUpdateBatch = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      createdAt: input.batch.createdAt,
      reviewStateCounts: input.batch.reviewStateCounts,
      riskCounts: input.batch.riskCounts,
    };

    data.updateBatches.push(batch);
    data.events.push({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      kind: "update-batch-recorded",
      message: `Recorded an update batch with ${batch.reviewStateCounts["needs-review"]} items needing review.`,
      createdAt: input.batch.createdAt,
    });
    await this.write(data);
    return batch;
  }

  async recordWorkspaceEvent(input: {
    event: WorkspaceEventInput;
    workspaceId: string;
  }) {
    const data = await this.read();
    const event = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      kind: input.event.kind,
      message: input.event.message,
      createdAt: input.event.createdAt,
    };

    data.events.push(event);
    await this.write(data);
    return event;
  }
}
