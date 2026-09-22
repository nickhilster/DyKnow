import { describe, expect, it } from "vitest";

import { parseUpdateOptions } from "../../cli/src/update.js";
import {
  buildAllPendingReviewArgs,
  buildCommitArgs,
  buildEditProposalArgs,
  buildOpenPrArgs,
  buildReviewActionArgs,
  buildSelectedReviewArgs,
  buildUpdateArgs,
  createDefaultPrBranchName,
} from "../src/commands.js";

describe("vscode extension command helpers", () => {
  it("builds update args the CLI accepts", () => {
    const [command, ...options] = buildUpdateArgs();

    expect(command).toBe("update");
    expect(() => parseUpdateOptions(options)).not.toThrow();
  });

  it("builds single-page review action args", () => {
    expect(buildReviewActionArgs("approve", "product-overview")).toEqual([
      "review",
      "--approve",
      "--page",
      "product-overview",
    ]);
    expect(buildReviewActionArgs("reject", "product-overview")).toEqual([
      "review",
      "--reject",
      "--page",
      "product-overview",
    ]);
    expect(buildReviewActionArgs("skip", "product-overview")).toEqual([
      "review",
      "--skip",
      "--page",
      "product-overview",
    ]);
    expect(buildReviewActionArgs("regenerate", "product-overview")).toEqual([
      "review",
      "--regenerate",
      "--page",
      "product-overview",
    ]);
  });

  it("builds edit args with the edited text payload", () => {
    expect(
      buildEditProposalArgs("product-overview", "Edited draft text"),
    ).toEqual([
      "review",
      "--edit",
      "--page",
      "product-overview",
      "--text",
      "Edited draft text",
    ]);
  });

  it("builds all-pending review args", () => {
    expect(buildAllPendingReviewArgs("reject")).toEqual([
      "review",
      "--reject",
      "--all",
    ]);
    expect(buildAllPendingReviewArgs("regenerate")).toEqual([
      "review",
      "--regenerate",
      "--all",
    ]);
  });

  it("deduplicates selected page ids while preserving first-seen order", () => {
    expect(
      buildSelectedReviewArgs("regenerate", [
        "product-overview",
        "feature-map",
        "product-overview",
      ]),
    ).toEqual([
      "review",
      "--regenerate",
      "--page",
      "product-overview",
      "--page",
      "feature-map",
    ]);
  });

  it("builds commit args with and without the high-risk override", () => {
    expect(buildCommitArgs(false)).toEqual(["commit"]);
    expect(buildCommitArgs(true)).toEqual(["commit", "--allow-high-risk"]);
  });

  it("builds deterministic default PR branch names", () => {
    expect(
      createDefaultPrBranchName(new Date("2026-06-26T15:30:00.000Z")),
    ).toBe("dyknow/updates-2026-06-26");
  });

  it("builds open-pr args in CLI order", () => {
    expect(buildOpenPrArgs("dyknow/updates-2026-06-26")).toEqual([
      "pr",
      "--branch",
      "dyknow/updates-2026-06-26",
    ]);
  });
});
