import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { createReviewUpdateBatch } from "@dyknow/app";
import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type ReviewState,
  ReviewStateSchema,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { resolveWorkspacePath } from "./security.js";

const REVIEW_DECISION_STATES = ["Approved", "Rejected", "Escalated"] as const;
const REVIEW_MUTATION_STATES = [...REVIEW_DECISION_STATES, "Edited"] as const;
const REVIEW_ACTION_STATES = [
  ...REVIEW_MUTATION_STATES,
  "Skipped",
  "Regenerated",
] as const;

type ReviewActionState = (typeof REVIEW_ACTION_STATES)[number];
type ReviewDecision = (typeof REVIEW_DECISION_STATES)[number];

export type ReviewOptions = {
  all: boolean;
  decision?: ReviewActionState;
  editText?: string;
  interactive: boolean;
  launchEditor: boolean;
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

function formatRelativePath(rootPath: string, targetPath: string): string {
  return (
    targetPath
      .replace(rootPath, "")
      .replaceAll("\\", "/")
      .replace(/^\/+/, "") || targetPath
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

function isRegenerateFlag(argument: string): boolean {
  return argument === "--regenerate";
}

function isEditorFlag(argument: string): boolean {
  return argument === "--editor";
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

function isPendingInteractiveReviewState(state: ReviewState): boolean {
  return (
    state === "Drafted" ||
    state === "Needs review" ||
    state === "Edited" ||
    state === "Escalated"
  );
}

function parseInteractiveDecision(
  input: string,
):
  | "approve"
  | "reject"
  | "escalate"
  | "edit"
  | "skip"
  | "regenerate"
  | "quit"
  | undefined {
  const normalized = input.trim().toLowerCase();

  switch (normalized) {
    case "a":
    case "approve":
      return "approve";
    case "r":
    case "reject":
      return "reject";
    case "x":
    case "escalate":
      return "escalate";
    case "e":
    case "edit":
      return "edit";
    case "s":
    case "skip":
      return "skip";
    case "g":
    case "regenerate":
      return "regenerate";
    case "q":
    case "quit":
      return "quit";
    default:
      return undefined;
  }
}

async function defaultReviewPrompt(message: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await readline.question(message);
  } finally {
    readline.close();
  }
}

export function parseReviewOptions(args: readonly string[]): ReviewOptions {
  let inputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let outputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let decision: ReviewActionState | undefined;
  let editText: string | undefined;
  let interactive = false;
  let all = false;
  let launchEditor = false;
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

    if (isEditorFlag(argument)) {
      launchEditor = true;
      continue;
    }

    if (argument === "--all") {
      all = true;
      continue;
    }

    if (argument === "--interactive") {
      interactive = true;
      continue;
    }

    if (isSkipFlag(argument)) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, --skip, or --regenerate.",
        );
      }

      decision = "Skipped";
      continue;
    }

    if (isRegenerateFlag(argument)) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, --skip, or --regenerate.",
        );
      }

      decision = "Regenerated";
      continue;
    }

    if (isEditFlag(argument)) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, --skip, or --regenerate.",
        );
      }

      decision = "Edited";
      continue;
    }

    if (decisionFlag) {
      if (decision) {
        throw new Error(
          "Specify only one review action flag: --approve, --reject, --escalate, --edit, --skip, or --regenerate.",
        );
      }

      decision = decisionFlag;
      continue;
    }

    throw new Error(`Unknown review option: ${argument}`);
  }

  if (!decision && (all || pageIds.length > 0)) {
    throw new Error(
      "Review targets require an action flag: --approve, --reject, --escalate, --edit, --skip, or --regenerate.",
    );
  }

  if (interactive && (decision || all || pageIds.length > 0 || editText)) {
    throw new Error(
      "Interactive review cannot be combined with explicit review action flags or page targeting.",
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
    if (!editText && !launchEditor) {
      throw new Error(
        "Edited review actions require --text <value> or --editor.",
      );
    }

    if (all || pageIds.length !== 1) {
      throw new Error(
        "Edited review actions require exactly one --page <id> target.",
      );
    }

    if (editText && launchEditor) {
      throw new Error(
        "Use either --text <value> or --editor for edited review actions.",
      );
    }
  }

  if ((decision === "Skipped" || decision === "Regenerated") && editText) {
    throw new Error(
      "Skipped and regenerated review actions do not accept --text.",
    );
  }

  if (launchEditor && decision !== "Edited") {
    throw new Error("--editor is only supported together with --edit.");
  }

  return {
    all,
    interactive,
    launchEditor,
    inputPath,
    outputPath,
    pageIds,
    ...(decision ? { decision } : {}),
    ...(editText ? { editText } : {}),
  };
}

export async function createInteractiveReviewSession(options: {
  cwd: string;
  inputPath: string;
  outputPath: string;
  prompt?: (message: string) => Promise<string>;
  stdout?: (message: string) => void;
}) {
  const prompt = options.prompt ?? defaultReviewPrompt;
  const stdout = options.stdout ?? (() => {});
  let updatedProposals = 0;

  while (true) {
    const rootPath = resolve(options.cwd);
    const inputPath = await resolveWorkspacePath(
      rootPath,
      options.inputPath,
      "Review input path",
    );
    const snapshotText = await readFile(inputPath, "utf8");
    const updateBatch = parseUpdateBatch(
      snapshotText,
      formatRelativePath(rootPath, inputPath),
    );
    const nextDraft = updateBatch.drafts.find((draft) =>
      isPendingInteractiveReviewState(draft.proposal.reviewState),
    );

    if (!nextDraft) {
      return {
        outputPath: formatRelativePath(rootPath, inputPath),
        remainingProposals: 0,
        updatedProposals,
      };
    }

    const riskBadge =
      nextDraft.proposal.risk === "high"
        ? "[HIGH RISK] "
        : nextDraft.proposal.risk === "medium"
          ? "[medium risk] "
          : "";
    const confidenceBadge = `confidence:${nextDraft.proposal.confidence}`;
    stdout(
      `\n${riskBadge}Reviewing ${nextDraft.proposal.pageId} (${nextDraft.proposal.reviewState}) [${confidenceBadge}]: ${nextDraft.proposal.summary}`,
    );
    stdout(`  Why: ${nextDraft.proposal.why}`);
    stdout(`  Sources: ${nextDraft.proposal.sources.join(", ")}`);
    if (nextDraft.proposal.risk === "high") {
      stdout(
        "  ⚠ This proposal is HIGH RISK. Publishing requires --allow-high-risk.",
      );
    }

    const answer = parseInteractiveDecision(
      await prompt(
        "Action [approve/reject/escalate/edit/skip/regenerate/quit]: ",
      ),
    );

    if (!answer) {
      stdout(
        "Unrecognized action. Try approve, reject, escalate, edit, skip, regenerate, or quit.",
      );
      continue;
    }

    if (answer === "quit") {
      const remainingProposals = updateBatch.drafts.filter((draft) =>
        isPendingInteractiveReviewState(draft.proposal.reviewState),
      ).length;

      return {
        outputPath: formatRelativePath(rootPath, inputPath),
        remainingProposals,
        updatedProposals,
      };
    }

    if (answer === "edit") {
      const editedText = await prompt(
        `Edited text for ${nextDraft.proposal.pageId}: `,
      );

      await createReviewUpdateBatch({
        all: false,
        cwd: options.cwd,
        decision: "Edited",
        editText: editedText,
        inputPath: options.inputPath,
        launchEditor: false,
        outputPath: options.outputPath,
        pageIds: [nextDraft.proposal.pageId],
      });
      updatedProposals += 1;
      continue;
    }

    const decisionMap: Record<
      Exclude<typeof answer, "edit" | "quit">,
      ReviewActionState
    > = {
      approve: "Approved",
      reject: "Rejected",
      escalate: "Escalated",
      skip: "Skipped",
      regenerate: "Regenerated",
    };

    await createReviewUpdateBatch({
      all: false,
      cwd: options.cwd,
      decision: decisionMap[answer],
      inputPath: options.inputPath,
      launchEditor: false,
      outputPath: options.outputPath,
      pageIds: [nextDraft.proposal.pageId],
    });
    updatedProposals += 1;
  }
}

export { createReviewUpdateBatch };
