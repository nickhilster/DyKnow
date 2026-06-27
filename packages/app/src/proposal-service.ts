import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type DraftedPageUpdate,
  type ReviewState,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { formatRelativePath, resolveWorkspacePath } from "./security.js";

function parseUpdateDraftBatch(input: string, inputPath: string) {
  let value: unknown;

  try {
    value = JSON.parse(input);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(`Invalid update proposal JSON at ${inputPath}: ${reason}`);
  }

  try {
    return UpdateDraftBatchSchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(`Invalid update proposal batch at ${inputPath}: ${reason}`);
  }
}

export async function readProposalBatch(options: {
  cwd: string;
  inputPath: string;
}) {
  const rootPath = resolve(options.cwd);
  const inputPath = await resolveWorkspacePath(
    rootPath,
    options.inputPath,
    "Proposal input path",
  );
  const input = await readFile(inputPath, "utf8");

  return {
    batch: parseUpdateDraftBatch(
      input,
      formatRelativePath(rootPath, inputPath),
    ),
    inputPath: formatRelativePath(rootPath, inputPath),
  };
}

export async function listProposals(options: {
  cwd: string;
  inputPath?: string;
  states?: ReviewState[];
}) {
  const { batch, inputPath } = await readProposalBatch({
    cwd: options.cwd,
    inputPath: options.inputPath ?? DEFAULT_UPDATE_OUTPUT_PATH,
  });
  const states = options.states ?? [];
  const drafts =
    states.length > 0
      ? batch.drafts.filter((draft) =>
          states.includes(draft.proposal.reviewState),
        )
      : batch.drafts;

  return {
    inputPath,
    batch,
    drafts,
  };
}

export async function getProposal(options: {
  cwd: string;
  inputPath?: string;
  pageId: string;
}): Promise<{
  draft: DraftedPageUpdate;
  inputPath: string;
}> {
  const { batch, inputPath } = await readProposalBatch({
    cwd: options.cwd,
    inputPath: options.inputPath ?? DEFAULT_UPDATE_OUTPUT_PATH,
  });
  const draft = batch.drafts.find(
    (candidate) => candidate.proposal.pageId === options.pageId,
  );

  if (!draft) {
    throw new Error(
      `Could not find an update proposal for page "${options.pageId}" in ${inputPath}.`,
    );
  }

  return {
    draft,
    inputPath,
  };
}
