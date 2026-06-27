import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  type RepoMapDiff,
  RepoMapDiffSchema,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
  type UpdateProvider,
  createLocalStubUpdateProvider,
  createOpenAiByoKeyUpdateProvider,
  draftUpdateResult,
  parseDyknowConfig,
} from "@dyknow/core";
import { DYKNOW_CONFIG_FILE_NAME } from "@dyknow/core";

import { formatRelativePath, resolveWorkspacePath } from "./security.js";

function parseRepoDiffSnapshot(
  snapshotText: string,
  snapshotPath: string,
): RepoMapDiff {
  let value: unknown;

  try {
    value = JSON.parse(snapshotText);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(`Invalid repo diff JSON at ${snapshotPath}: ${reason}`);
  }

  try {
    return RepoMapDiffSchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(`Invalid repo diff at ${snapshotPath}: ${reason}`);
  }
}

async function readCurrentContent(
  rootPath: string,
  outputPath: string,
): Promise<string> {
  const pagePath = await resolveWorkspacePath(
    rootPath,
    outputPath,
    "Page output path",
  );

  try {
    return await readFile(pagePath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

function createUpdateProvider(providerId: string): UpdateProvider {
  if (providerId === "local") {
    return createLocalStubUpdateProvider();
  }

  if (providerId === "byo-key") {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.DYKNOW_OPENAI_MODEL;

    if (!apiKey) {
      throw new Error(
        'The "byo-key" update provider requires OPENAI_API_KEY to be set.',
      );
    }

    if (!model) {
      throw new Error(
        'The "byo-key" update provider requires DYKNOW_OPENAI_MODEL to be set.',
      );
    }

    return createOpenAiByoKeyUpdateProvider({
      apiKey,
      model,
      ...(process.env.DYKNOW_OPENAI_RESPONSES_URL
        ? { endpoint: process.env.DYKNOW_OPENAI_RESPONSES_URL }
        : {}),
    });
  }

  throw new Error(
    `No dyknow update provider implementation exists yet for "${providerId}".`,
  );
}

export async function createUpdateDraftBatch(options: {
  cwd: string;
  configPath: string;
  diffPath: string;
  outputPath: string;
}): Promise<UpdateDraftBatch> {
  const rootPath = resolve(options.cwd);
  const configPath = await resolveWorkspacePath(
    rootPath,
    options.configPath,
    "Update config path",
  );
  const diffPath = await resolveWorkspacePath(
    rootPath,
    options.diffPath,
    "Update diff path",
  );
  const outputPath = await resolveWorkspacePath(
    rootPath,
    options.outputPath,
    "Update output path",
  );
  const configText = await readFile(configPath, "utf8");
  const config = parseDyknowConfig(configText);
  const provider = createUpdateProvider(config.llmProvider);
  let diffText: string;

  try {
    diffText = await readFile(diffPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        `Could not find a repo diff at ${formatRelativePath(rootPath, diffPath)}. Run dyknow diff first.`,
      );
    }

    throw error;
  }

  const repoDiff = parseRepoDiffSnapshot(
    diffText,
    formatRelativePath(rootPath, diffPath),
  );
  const drafts = [];
  let totalAttempts = 0;
  let totalDurationMs = 0;
  let timedOutDrafts = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalEstimatedCostUsd = 0;
  let hasEstimatedCost = false;

  for (const affectedPage of repoDiff.affectedPages) {
    const page = config.pages.find(
      (candidate) => candidate.id === affectedPage.pageId,
    );

    if (!page) {
      throw new Error(
        `Repo diff referenced unknown page "${affectedPage.pageId}". Regenerate dyknow diff with the current config.`,
      );
    }

    if (affectedPage.pageId !== page.id) {
      throw new Error(
        `Repo diff affected page references page "${affectedPage.pageId}" but the current config expects "${page.id}".`,
      );
    }

    if (affectedPage.outputPath !== page.outputPath) {
      throw new Error(
        `Repo diff affected page for page "${page.id}" does not match the configured output path "${page.outputPath}".`,
      );
    }

    const currentContent = await readCurrentContent(rootPath, page.outputPath);
    const draftResult = await draftUpdateResult({
      config,
      provider,
      request: {
        page,
        affectedPage,
        currentContent,
      },
    });
    totalAttempts += draftResult.providerTelemetry.attempts;
    totalDurationMs += draftResult.providerTelemetry.durationMs;
    timedOutDrafts += draftResult.providerTelemetry.timedOut ? 1 : 0;
    totalInputTokens += draftResult.providerTelemetry.usage.inputTokens;
    totalOutputTokens += draftResult.providerTelemetry.usage.outputTokens;
    totalTokens += draftResult.providerTelemetry.usage.totalTokens;

    if (draftResult.providerTelemetry.usage.estimatedCostUsd !== null) {
      totalEstimatedCostUsd +=
        draftResult.providerTelemetry.usage.estimatedCostUsd;
      hasEstimatedCost = true;
    }

    drafts.push({
      affectedPage,
      proposal: draftResult.proposal,
      providerTelemetry: draftResult.providerTelemetry,
    });
  }

  const updateBatch = UpdateDraftBatchSchema.parse({
    draftedAt: new Date().toISOString(),
    rootPath,
    configPath: formatRelativePath(rootPath, configPath),
    repoDiffPath: formatRelativePath(rootPath, diffPath),
    outputPath: formatRelativePath(rootPath, outputPath),
    providerId: provider.id,
    drafts,
    summary: {
      affectedPages: repoDiff.affectedPages.length,
      draftedProposals: drafts.length,
    },
    providerTelemetry: {
      totalAttempts,
      totalDurationMs,
      timedOutDrafts,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        estimatedCostUsd: hasEstimatedCost
          ? Number(totalEstimatedCostUsd.toFixed(6))
          : null,
      },
    },
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(updateBatch, null, 2)}\n`,
    "utf8",
  );

  return updateBatch;
}

export {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
};
