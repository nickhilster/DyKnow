import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { join } from "node:path";

import {
  AuditLogEntrySchema,
  DEFAULT_UPDATE_OUTPUT_PATH,
  type RepoMapDiff,
  RepoMapDiffSchema,
  type ReviewState,
  ReviewStateSchema,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
  createLocalStubUpdateProvider,
  draftUpdateProposal,
  parseDyknowConfig,
} from "@dyknow/core";

import { DEFAULT_REVIEW_AUDIT_LOG_PATH } from "./log-service.js";
import {
  assertAffectedPageMatchesConfiguredPage,
  formatRelativePath,
  resolveWorkspacePath,
  runConfiguredCommand,
} from "./security.js";

const REVIEW_DECISION_STATES = ["Approved", "Rejected", "Escalated"] as const;
const REVIEW_MUTATION_STATES = [...REVIEW_DECISION_STATES, "Edited"] as const;
const REVIEW_ACTION_STATES = [
  ...REVIEW_MUTATION_STATES,
  "Skipped",
  "Regenerated",
] as const;

type ReviewActionState = (typeof REVIEW_ACTION_STATES)[number];

export type ReviewResult = {
  decision?: ReviewActionState;
  outputPath: string;
  summary: string;
  totalDrafts: number;
  updatedProposals: number;
};

function getAuditActor(): string {
  return process.env.DYKNOW_ACTOR ?? "copilot";
}

function formatReviewAction(decision: ReviewActionState) {
  switch (decision) {
    case "Approved":
      return "review:approve";
    case "Rejected":
      return "review:reject";
    case "Escalated":
      return "review:escalate";
    case "Edited":
      return "review:edit";
    case "Skipped":
      return "review:skip";
    case "Regenerated":
      return "review:regenerate";
  }
}

async function appendReviewAuditEntries(options: {
  auditPath: string;
  decision: ReviewActionState;
  drafts: readonly UpdateDraftBatch["drafts"][number][];
  outputPath: string;
  rootPath: string;
}) {
  const auditPath = await resolveWorkspacePath(
    options.rootPath,
    options.auditPath,
    "Review audit log path",
  );
  const timestamp = new Date().toISOString();
  const actor = getAuditActor();
  const entries = options.drafts.map((draft) => {
    const outputsAffected = [
      draft.affectedPage.outputPath,
      formatRelativePath(options.rootPath, options.outputPath),
    ];
    const hashInput = JSON.stringify({
      action: formatReviewAction(options.decision),
      actor,
      pageId: draft.proposal.pageId,
      reviewState: draft.proposal.reviewState,
      sourcesRead: draft.proposal.sources,
      outputsAffected,
      timestamp,
    });

    return AuditLogEntrySchema.parse({
      action: formatReviewAction(options.decision),
      actor,
      sourcesRead: draft.proposal.sources,
      outputsAffected,
      timestamp,
      hash: createHash("sha256").update(hashInput).digest("hex"),
    });
  });

  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(
    auditPath,
    entries.map((entry) => `${JSON.stringify(entry)}\n`).join(""),
    "utf8",
  );
}

function parseUpdateBatch(
  snapshotText: string,
  snapshotPath: string,
): UpdateDraftBatch {
  let value: unknown;

  try {
    value = JSON.parse(snapshotText);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(
      `Invalid update proposals JSON at ${snapshotPath}: ${reason}`,
    );
  }

  try {
    return UpdateDraftBatchSchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(`Invalid update proposals at ${snapshotPath}: ${reason}`);
  }
}

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

function getReviewEditorCommand(): string {
  return process.env.DYKNOW_EDITOR_COMMAND ?? process.env.EDITOR ?? "";
}

async function editProposalTextInEditor(options: {
  cwd: string;
  initialText: string;
}) {
  const editorCommand = getReviewEditorCommand();

  if (!editorCommand) {
    throw new Error(
      "Edited review actions with --editor require DYKNOW_EDITOR_COMMAND or EDITOR to be set.",
    );
  }

  const workingDirectory = await mkdtemp(
    join(tmpdir(), "dyknow-review-editor-"),
  );
  const draftPath = join(workingDirectory, "proposal.md");

  try {
    await writeFile(draftPath, options.initialText, "utf8");
    await runConfiguredCommand({
      args: [draftPath],
      commandText: editorCommand,
      cwd: options.cwd,
      label: "Review editor command",
    });
    return await readFile(draftPath, "utf8");
  } finally {
    await rm(workingDirectory, { force: true, recursive: true });
  }
}

async function regenerateDraft(options: {
  draft: UpdateDraftBatch["drafts"][number];
  rootPath: string;
  updateBatch: UpdateDraftBatch;
}) {
  const configPath = await resolveWorkspacePath(
    options.rootPath,
    options.updateBatch.configPath,
    "Review config path",
  );
  const repoDiffPath = await resolveWorkspacePath(
    options.rootPath,
    options.updateBatch.repoDiffPath,
    "Review repo diff path",
  );
  const configText = await readFile(configPath, "utf8");
  const config = parseDyknowConfig(configText);
  const repoDiffText = await readFile(repoDiffPath, "utf8");
  const repoDiff = parseRepoDiffSnapshot(
    repoDiffText,
    formatRelativePath(options.rootPath, repoDiffPath),
  );
  const page = config.pages.find(
    (candidate) => candidate.id === options.draft.proposal.pageId,
  );

  if (!page) {
    throw new Error(
      `Update proposals referenced unknown page "${options.draft.proposal.pageId}". Regenerate dyknow update with the current config.`,
    );
  }

  assertAffectedPageMatchesConfiguredPage(
    page,
    options.draft.affectedPage,
    "Update proposal draft",
  );

  const affectedPage = repoDiff.affectedPages.find(
    (candidate) => candidate.pageId === options.draft.proposal.pageId,
  );

  if (!affectedPage) {
    throw new Error(
      `Could not find repo diff evidence for page "${options.draft.proposal.pageId}" in ${formatRelativePath(options.rootPath, repoDiffPath)}. Run dyknow diff and dyknow update again.`,
    );
  }

  assertAffectedPageMatchesConfiguredPage(
    page,
    affectedPage,
    "Repo diff affected page",
  );

  const pagePath = await resolveWorkspacePath(
    options.rootPath,
    page.outputPath,
    "Page output path",
  );
  let currentContent = "";

  try {
    currentContent = await readFile(pagePath, "utf8");
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      )
    ) {
      throw error;
    }
  }

  const provider = createLocalStubUpdateProvider();
  const proposal = await draftUpdateProposal({
    config,
    provider,
    request: {
      page,
      affectedPage,
      currentContent,
    },
  });

  return {
    affectedPage,
    proposal,
  };
}

function formatSummary(batch: UpdateDraftBatch): string {
  const counts = new Map<ReviewState, number>();

  for (const draft of batch.drafts) {
    const state = ReviewStateSchema.parse(draft.proposal.reviewState);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return "no proposals";
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([state, count]) => `${count} ${state}`)
    .join(", ");
}

export async function createReviewUpdateBatch(options: {
  all: boolean;
  cwd: string;
  decision?: ReviewActionState;
  editText?: string;
  launchEditor: boolean;
  inputPath: string;
  outputPath: string;
  pageIds: readonly string[];
}): Promise<ReviewResult> {
  const rootPath = resolve(options.cwd);
  const inputPath = await resolveWorkspacePath(
    rootPath,
    options.inputPath,
    "Review input path",
  );
  const outputPath = await resolveWorkspacePath(
    rootPath,
    options.outputPath,
    "Review output path",
  );
  let snapshotText: string;

  try {
    snapshotText = await readFile(inputPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        `Could not find update proposals at ${formatRelativePath(rootPath, inputPath)}. Run dyknow update first.`,
      );
    }

    throw error;
  }

  const updateBatch = parseUpdateBatch(
    snapshotText,
    formatRelativePath(rootPath, inputPath),
  );

  if (!options.decision) {
    return {
      outputPath: formatRelativePath(rootPath, outputPath),
      summary: formatSummary(updateBatch),
      totalDrafts: updateBatch.drafts.length,
      updatedProposals: 0,
    };
  }

  const targetedPageIds = new Set(
    options.all
      ? updateBatch.drafts.map((draft) => draft.proposal.pageId)
      : options.pageIds,
  );

  for (const pageId of targetedPageIds) {
    if (!updateBatch.drafts.some((draft) => draft.proposal.pageId === pageId)) {
      throw new Error(
        `Could not find an update proposal for page "${pageId}" in ${formatRelativePath(rootPath, inputPath)}.`,
      );
    }
  }

  if (options.decision === "Skipped") {
    const targetedDrafts = updateBatch.drafts.filter((draft) =>
      targetedPageIds.has(draft.proposal.pageId),
    );

    await appendReviewAuditEntries({
      auditPath: DEFAULT_REVIEW_AUDIT_LOG_PATH,
      decision: options.decision,
      drafts: targetedDrafts,
      outputPath: inputPath,
      rootPath,
    });

    return {
      decision: options.decision,
      outputPath: formatRelativePath(rootPath, inputPath),
      summary: formatSummary(updateBatch),
      totalDrafts: updateBatch.drafts.length,
      updatedProposals: targetedDrafts.length,
    };
  }

  if (options.decision === "Regenerated") {
    const drafts = await Promise.all(
      updateBatch.drafts.map(async (draft) => {
        if (!targetedPageIds.has(draft.proposal.pageId)) {
          return draft;
        }

        return regenerateDraft({
          draft,
          rootPath,
          updateBatch,
        });
      }),
    );
    const nextBatch = UpdateDraftBatchSchema.parse({
      ...updateBatch,
      draftedAt: new Date().toISOString(),
      outputPath: formatRelativePath(rootPath, outputPath),
      drafts,
      summary: {
        affectedPages: drafts.length,
        draftedProposals: drafts.length,
      },
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      `${JSON.stringify(nextBatch, null, 2)}\n`,
      "utf8",
    );

    await appendReviewAuditEntries({
      auditPath: DEFAULT_REVIEW_AUDIT_LOG_PATH,
      decision: options.decision,
      drafts: nextBatch.drafts.filter((draft) =>
        targetedPageIds.has(draft.proposal.pageId),
      ),
      outputPath,
      rootPath,
    });

    return {
      decision: options.decision,
      outputPath: formatRelativePath(rootPath, outputPath),
      summary: formatSummary(nextBatch),
      totalDrafts: nextBatch.drafts.length,
      updatedProposals: nextBatch.drafts.filter((draft) =>
        targetedPageIds.has(draft.proposal.pageId),
      ).length,
    };
  }

  const editedTextByPageId = new Map<string, string>();

  if (options.decision === "Edited") {
    const editedPageId = options.pageIds[0];

    if (!editedPageId) {
      throw new Error(
        "Edited review actions require exactly one --page <id> target.",
      );
    }

    const targetedDraft = updateBatch.drafts.find(
      (draft) => draft.proposal.pageId === editedPageId,
    );

    if (!targetedDraft) {
      throw new Error(
        `Could not find an update proposal for page "${editedPageId}" in ${formatRelativePath(rootPath, inputPath)}.`,
      );
    }

    const editedText = options.launchEditor
      ? await editProposalTextInEditor({
          cwd: rootPath,
          initialText: targetedDraft.proposal.proposedText,
        })
      : options.editText;

    if (!editedText) {
      throw new Error("Edited review actions require non-empty proposal text.");
    }

    editedTextByPageId.set(editedPageId, editedText);
  }

  const nextBatch = UpdateDraftBatchSchema.parse({
    ...updateBatch,
    outputPath: formatRelativePath(rootPath, outputPath),
    drafts: updateBatch.drafts.map((draft) => {
      if (!targetedPageIds.has(draft.proposal.pageId)) {
        return draft;
      }

      return {
        ...draft,
        proposal: {
          ...draft.proposal,
          ...(options.decision === "Edited"
            ? {
                proposedText:
                  editedTextByPageId.get(draft.proposal.pageId) ??
                  draft.proposal.proposedText,
              }
            : {}),
          reviewState: options.decision,
        },
      };
    }),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(nextBatch, null, 2)}\n`,
    "utf8",
  );

  await appendReviewAuditEntries({
    auditPath: DEFAULT_REVIEW_AUDIT_LOG_PATH,
    decision: options.decision,
    drafts: nextBatch.drafts.filter((draft) =>
      targetedPageIds.has(draft.proposal.pageId),
    ),
    outputPath,
    rootPath,
  });

  return {
    decision: options.decision,
    outputPath: formatRelativePath(rootPath, outputPath),
    summary: formatSummary(nextBatch),
    totalDrafts: nextBatch.drafts.length,
    updatedProposals: nextBatch.drafts.filter((draft) =>
      targetedPageIds.has(draft.proposal.pageId),
    ).length,
  };
}

export { DEFAULT_UPDATE_OUTPUT_PATH };
