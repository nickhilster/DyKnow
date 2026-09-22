export type ReviewMutationAction = "approve" | "skip" | "reject" | "regenerate";

// The drafting provider comes from llmProvider in dyknow.config.json (plus
// env vars for byo-key); `dyknow update` has no provider or model flags.
export function buildUpdateArgs(): string[] {
  return ["update"];
}

export function buildReviewActionArgs(
  action: ReviewMutationAction,
  pageId: string,
): string[] {
  const actionFlag =
    action === "approve"
      ? "--approve"
      : action === "skip"
        ? "--skip"
        : action === "reject"
          ? "--reject"
          : "--regenerate";

  return ["review", actionFlag, "--page", pageId];
}

export function buildEditProposalArgs(
  pageId: string,
  proposedText: string,
): string[] {
  return ["review", "--edit", "--page", pageId, "--text", proposedText];
}

export function buildAllPendingReviewArgs(
  action: "reject" | "regenerate",
): string[] {
  const actionFlag = action === "reject" ? "--reject" : "--regenerate";
  return ["review", actionFlag, "--all"];
}

export function buildSelectedReviewArgs(
  action: "reject" | "regenerate",
  pageIds: readonly string[],
): string[] {
  const actionFlag = action === "reject" ? "--reject" : "--regenerate";
  const uniquePageIds = [...new Set(pageIds)];
  const args = ["review", actionFlag];

  for (const pageId of uniquePageIds) {
    args.push("--page", pageId);
  }

  return args;
}

export function buildCommitArgs(allowHighRisk: boolean): string[] {
  return allowHighRisk ? ["commit", "--allow-high-risk"] : ["commit"];
}

export function createDefaultPrBranchName(now: Date = new Date()): string {
  return `dyknow/updates-${now.toISOString().slice(0, 10)}`;
}

export function buildOpenPrArgs(branch: string): string[] {
  return ["pr", "--branch", branch];
}
