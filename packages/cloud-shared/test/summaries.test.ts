import { describe, expect, it } from "vitest";

import {
  DYKNOW_CLOUD_DEMO_DATA,
  buildWorkspaceSummaryFromSeed,
} from "../src/index.js";

describe("@dyknow/cloud-shared", () => {
  it("builds a dashboard summary from seeded workspace data", () => {
    const summary = buildWorkspaceSummaryFromSeed(
      DYKNOW_CLOUD_DEMO_DATA,
      "workspace_marketing",
    );

    expect(summary).toBeDefined();
    expect(summary?.sourceCounts.connected).toBe(1);
    expect(summary?.sourceCounts.pending).toBe(1);
    expect(summary?.pageHealthCounts["needs-review"]).toBe(1);
    expect(summary?.pendingUpdates.total).toBe(4);
    expect(summary?.latestRuns.update?.status).toBe("running");
    expect(summary?.recentEvents).toHaveLength(6);
  });
});
