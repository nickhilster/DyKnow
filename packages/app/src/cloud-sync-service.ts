import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PAGE_RISK_LEVELS, UPDATE_REVIEW_STATES } from "@dyknow/cloud-shared";
import type {
  PageRiskLevel,
  UpdateReviewState,
  WorkspaceRunStatus,
  WorkspaceRunType,
} from "@dyknow/cloud-shared";
import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

type FetchLike = typeof fetch;

export type CloudSyncOptions = {
  apiBaseUrl: string;
  cwd?: string;
  email: string;
  organizationSlug: string;
  password: string;
  workspaceSlug: string;
};

export type CloudSyncResolvedOptions = CloudSyncOptions & {
  source: "config" | "env" | "cli";
};

export type CloudSyncResult = {
  eventsRecorded: number;
  runsRecorded: number;
  syncedAt: string;
  updateBatchesRecorded: number;
};

export type CloudSyncConfig = {
  apiBaseUrl?: string;
  email?: string;
  organizationSlug?: string;
  workspaceSlug?: string;
};

export function resolveCloudSyncOptions(options: {
  cli?: Partial<CloudSyncOptions>;
  config?: CloudSyncConfig;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): CloudSyncResolvedOptions {
  const env = options.env ?? process.env;
  const config = options.config ?? {};
  const cli = options.cli ?? {};
  const apiBaseUrl =
    config.apiBaseUrl ??
    env.DYKNOW_CLOUD_API_BASE_URL ??
    cli.apiBaseUrl ??
    "http://127.0.0.1:4180";
  const email =
    config.email ?? env.DYKNOW_CLOUD_EMAIL ?? cli.email ?? "nick@example.com";
  const organizationSlug =
    config.organizationSlug ??
    env.DYKNOW_CLOUD_ORGANIZATION ??
    cli.organizationSlug ??
    "dyknow";
  const workspaceSlug =
    config.workspaceSlug ?? env.DYKNOW_CLOUD_WORKSPACE ?? cli.workspaceSlug;
  const password = env.DYKNOW_CLOUD_PASSWORD ?? cli.password;

  if (!workspaceSlug) {
    throw new Error(
      "Cloud workspace slug is required. Set --workspace, DYKNOW_CLOUD_WORKSPACE, or dyknow.config.json cloud.workspaceSlug.",
    );
  }

  if (!password) {
    throw new Error(
      "Cloud password is required. Set --password or DYKNOW_CLOUD_PASSWORD.",
    );
  }

  const source: CloudSyncResolvedOptions["source"] = config.workspaceSlug
    ? "config"
    : env.DYKNOW_CLOUD_WORKSPACE ||
        env.DYKNOW_CLOUD_API_BASE_URL ||
        env.DYKNOW_CLOUD_EMAIL ||
        env.DYKNOW_CLOUD_ORGANIZATION ||
        env.DYKNOW_CLOUD_PASSWORD
      ? "env"
      : "cli";

  return {
    apiBaseUrl,
    email,
    organizationSlug,
    password,
    source,
    workspaceSlug,
  };
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  if (!(await pathExists(filePath))) {
    return undefined;
  }

  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function countReviewStates(batch: UpdateDraftBatch) {
  const counts = Object.fromEntries(
    UPDATE_REVIEW_STATES.map((state) => [state, 0]),
  ) as Record<UpdateReviewState, number>;

  for (const draft of batch.drafts) {
    const state = draft.proposal.reviewState as UpdateReviewState;
    counts[state] += 1;
  }

  return counts;
}

function countRisks(batch: UpdateDraftBatch) {
  const counts = Object.fromEntries(
    PAGE_RISK_LEVELS.map((state) => [state, 0]),
  ) as Record<PageRiskLevel, number>;

  for (const draft of batch.drafts) {
    const state = draft.proposal.risk as PageRiskLevel;
    counts[state] += 1;
  }

  return counts;
}

async function postJson<T>(options: {
  body: unknown;
  fetchImpl: FetchLike;
  headers?: Record<string, string>;
  url: string;
}): Promise<T> {
  const response = await options.fetchImpl(options.url, {
    body: JSON.stringify(options.body),
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    method: "POST",
  });
  const payload = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(
      `Cloud sync request failed with status ${response.status}.`,
    );
  }

  return payload;
}

async function loginToCloud(options: {
  apiBaseUrl: string;
  email: string;
  fetchImpl: FetchLike;
  password: string;
}): Promise<string> {
  const response = await options.fetchImpl(
    `${options.apiBaseUrl.replace(/\/$/, "")}/api/session`,
    {
      body: JSON.stringify({
        email: options.email,
        password: options.password,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(`Cloud login failed with status ${response.status}.`);
  }

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("Cloud session cookie was not returned.");
  }

  return cookie;
}

export async function createCloudSyncResult(
  options: CloudSyncOptions,
): Promise<CloudSyncResult> {
  const fetchImpl = globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("Fetch is not available in this environment.");
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  const syncedAt = new Date().toISOString();
  const cookie = await loginToCloud({
    apiBaseUrl: options.apiBaseUrl,
    email: options.email,
    fetchImpl,
    password: options.password,
  });

  const authHeaders = { Cookie: cookie };
  let runsRecorded = 0;
  let updateBatchesRecorded = 0;
  let eventsRecorded = 0;

  const repoMapPath = resolve(cwd, DEFAULT_REPO_MAP_OUTPUT_PATH);
  const repoDiffPath = resolve(cwd, DEFAULT_REPO_DIFF_OUTPUT_PATH);
  const updateBatchPath = resolve(cwd, DEFAULT_UPDATE_OUTPUT_PATH);

  const repoMap = await readJson<{ files: Array<{ path: string }> }>(
    repoMapPath,
  );
  if (repoMap) {
    await postJson({
      body: {
        startedAt: syncedAt,
        status: "succeeded" satisfies WorkspaceRunStatus,
        summary: `Synced ${repoMap.files.length} scanned file(s) from Local.`,
        type: "scan" satisfies WorkspaceRunType,
        finishedAt: syncedAt,
      },
      fetchImpl,
      headers: authHeaders,
      url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/runs`,
    });
    runsRecorded += 1;
  }

  const repoDiff = await readJson<unknown>(repoDiffPath);
  if (repoDiff) {
    await postJson({
      body: {
        startedAt: syncedAt,
        status: "succeeded" satisfies WorkspaceRunStatus,
        summary: "Synced repo diff from Local.",
        type: "diff" satisfies WorkspaceRunType,
        finishedAt: syncedAt,
      },
      fetchImpl,
      headers: authHeaders,
      url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/runs`,
    });
    runsRecorded += 1;
  }

  const updateBatch = await readJson<UpdateDraftBatch>(updateBatchPath);
  if (updateBatch) {
    const parsed = UpdateDraftBatchSchema.parse(updateBatch);
    await postJson({
      body: {
        createdAt: parsed.draftedAt,
        riskCounts: countRisks(parsed),
        reviewStateCounts: countReviewStates(parsed),
      },
      fetchImpl,
      headers: authHeaders,
      url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/update-batches`,
    });
    updateBatchesRecorded += 1;

    await postJson({
      body: {
        startedAt: syncedAt,
        status: "succeeded" satisfies WorkspaceRunStatus,
        summary: `Synced ${parsed.summary.draftedProposals} drafted proposal(s) from Local review output.`,
        type: "update" satisfies WorkspaceRunType,
        finishedAt: syncedAt,
      },
      fetchImpl,
      headers: authHeaders,
      url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/runs`,
    });
    runsRecorded += 1;

    await postJson({
      body: {
        startedAt: syncedAt,
        status: "succeeded" satisfies WorkspaceRunStatus,
        summary: `Synced review state for ${parsed.drafts.length} proposal(s) from Local.`,
        type: "review-sync" satisfies WorkspaceRunType,
        finishedAt: syncedAt,
      },
      fetchImpl,
      headers: authHeaders,
      url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/runs`,
    });
    runsRecorded += 1;
  }

  await postJson({
    body: {
      createdAt: syncedAt,
      kind: "workspace-synced",
      message: `Synced DyKnow Local artifacts from ${cwd}.`,
    },
    fetchImpl,
    headers: authHeaders,
    url: `${options.apiBaseUrl.replace(/\/$/, "")}/api/orgs/${options.organizationSlug}/workspaces/${options.workspaceSlug}/events`,
  });
  eventsRecorded += 1;

  return {
    eventsRecorded,
    runsRecorded,
    syncedAt,
    updateBatchesRecorded,
  };
}
