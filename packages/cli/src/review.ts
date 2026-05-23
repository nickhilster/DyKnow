import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type ReviewState,
  ReviewStateSchema,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

const REVIEW_DECISION_STATES = ["Approved", "Rejected", "Escalated"] as const;
const REVIEW_MUTATION_STATES = [...REVIEW_DECISION_STATES, "Edited"] as const;
const REVIEW_ACTION_STATES = [...REVIEW_MUTATION_STATES, "Skipped"] as const;

type ReviewDecision = (typeof REVIEW_DECISION_STATES)[number];
type ReviewMutationState = (typeof REVIEW_MUTATION_STATES)[number];
type ReviewActionState = (typeof REVIEW_ACTION_STATES)[number];

export type ReviewOptions = {
  all: boolean;
  decision?: ReviewActionState;
  editText?: string;
  inputPath: string;
  outputPath: string;
  pageIds: string[];
};

export type ReviewResult = {
  decision?: ReviewActionState;
  outputPath: string;
  summary: string;
  totalDrafts: number;
  updatedProposals: number;
};

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function formatRelativePath(rootPath: string, targetPath: string): string {
  return toPortablePath(relative(rootPath, targetPath) || targetPath);
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

function parseReviewDecision(argument: string): ReviewDecision | undefined {
  if (argument === "--approve") {
    return "Approved";
  }

  if (argument === "--reject") {
    return "Rejected";
  }

  if (argument === "--escalate") {
    return "Escalated";
  }

  return undefined;
}

function isEditFlag(argument: string): boolean {
  return argument === "--edit";
}

function isSkipFlag(argument: string): boolean {
  return argument === "--skip";
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

export function parseReviewOptions(args: readonly string[]): ReviewOptions {
  let inputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let outputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let decision: ReviewActionState | undefined;
  let editText: string | undefined;
  let all = false;
  const pageIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      break;
    }

    const decisionFlag = parseReviewDecision(argument);

    if (argument === "--input") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --input.");
      }

      inputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      outputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--page") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --page.");
      }

      pageIds.push(value);
      index += 1;
      continue;
    }

    if (argument === "--text") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --text.");
      }

      editText = value;
      index += 1;
      continue;
    }

    if (argument === "--all") {
      all = true;
      continue;
    }

    if (isSkipFlag(argument)) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, or --skip.",
        );
      }

      decision = "Skipped";
      continue;
    }

    if (isEditFlag(argument)) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, or --skip.",
        );
      }

      decision = "Edited";
      continue;
    }

    if (decisionFlag) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, or --skip.",
        );
      }

      decision = decisionFlag;
      continue;
    }

    throw new Error(`Unknown review option: ${argument}`);
  }

  if (!decision && (all || pageIds.length > 0)) {
    throw new Error(
      "Review targets require an action flag: --approve, --reject, --escalate, --edit, or --skip.",
    );
  }

  if (decision && !all && pageIds.length === 0) {
    throw new Error(
      "Select review targets with --all or at least one --page <id>.",
    );
  }

  if (all && pageIds.length > 0) {
    throw new Error("Use either --all or --page <id>, not both.");
  }

  if (decision === "Edited") {
    if (!editText) {
      throw new Error("Edited review actions require --text <value>.");
    }

    if (all || pageIds.length !== 1) {
      throw new Error(
        "Edited review actions require exactly one --page <id> target.",
      );
    }
  }

  if (decision === "Skipped" && editText) {
    throw new Error("Skipped review actions do not accept --text.");
  }

  return {
    all,
    inputPath,
    outputPath,
    pageIds,
    ...(decision ? { decision } : {}),
    ...(editText ? { editText } : {}),
  };
}

export async function createReviewUpdateBatch(options: {
  all: boolean;
  cwd: string;
  decision?: ReviewActionState;
  editText?: string;
  inputPath: string;
  outputPath: string;
  pageIds: readonly string[];
}): Promise<ReviewResult> {
  const rootPath = resolve(options.cwd);
  const inputPath = resolve(rootPath, options.inputPath);
  const outputPath = resolve(rootPath, options.outputPath);
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
    return {
      decision: options.decision,
      outputPath: formatRelativePath(rootPath, inputPath),
      summary: formatSummary(updateBatch),
      totalDrafts: updateBatch.drafts.length,
      updatedProposals: updateBatch.drafts.filter((draft) =>
        targetedPageIds.has(draft.proposal.pageId),
      ).length,
    };
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
          ...(options.decision === "Edited" && options.editText
            ? { proposedText: options.editText }
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
