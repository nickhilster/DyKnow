import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCloudApiServer } from "../src/server.js";

async function startServer(dbPath: string) {
  const server = createCloudApiServer({ dbPath });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }
  return {
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    origin: `http://127.0.0.1:${String(address.port)}`,
  };
}

describe("@dyknow/cloud-api", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupPaths
        .splice(0)
        .map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  it("authenticates and persists a created workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dyknow-cloud-api-"));
    cleanupPaths.push(dir);
    const dbPath = join(dir, "cloud-db.json");
    const server = await startServer(dbPath);

    const loginResponse = await fetch(`${server.origin}/api/session`, {
      body: JSON.stringify({
        email: "nick@example.com",
        password: "dyknow-demo",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const cookie = loginResponse.headers.get("set-cookie");
    expect(loginResponse.status).toBe(200);
    expect(cookie).toContain("dyknow_cloud_session=");

    const createWorkspaceResponse = await fetch(
      `${server.origin}/api/orgs/dyknow/workspaces`,
      {
        body: JSON.stringify({
          environment: "internal",
          name: "Cloud Sprint 1 Test",
          status: "active",
        }),
        headers: {
          Cookie: cookie ?? "",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(createWorkspaceResponse.status).toBe(201);

    const orgResponse = await fetch(`${server.origin}/api/orgs/dyknow`, {
      headers: { Cookie: cookie ?? "" },
    });
    const orgPayload = (await orgResponse.json()) as {
      workspaces: Array<{ workspace: { name: string } }>;
    };

    expect(
      orgPayload.workspaces.some(
        (record) => record.workspace.name === "Cloud Sprint 1 Test",
      ),
    ).toBe(true);

    await server.close();
  });

  it("records workspace runs, update batches, and events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "dyknow-cloud-api-records-"));
    cleanupPaths.push(dir);
    const dbPath = join(dir, "cloud-db.json");
    const server = await startServer(dbPath);

    const loginResponse = await fetch(`${server.origin}/api/session`, {
      body: JSON.stringify({
        email: "nick@example.com",
        password: "dyknow-demo",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const cookie = loginResponse.headers.get("set-cookie");

    const runResponse = await fetch(
      `${server.origin}/api/orgs/dyknow/workspaces/dyknow-marketing/runs`,
      {
        body: JSON.stringify({
          finishedAt: "2026-07-02T12:00:00.000Z",
          startedAt: "2026-07-02T11:59:30.000Z",
          status: "succeeded",
          summary: "Synced scan results.",
          type: "scan",
        }),
        headers: {
          Cookie: cookie ?? "",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(runResponse.status).toBe(201);

    const batchResponse = await fetch(
      `${server.origin}/api/orgs/dyknow/workspaces/dyknow-marketing/update-batches`,
      {
        body: JSON.stringify({
          createdAt: "2026-07-02T12:01:00.000Z",
          riskCounts: { low: 1, medium: 0, high: 0 },
          reviewStateCounts: {
            approved: 1,
            edited: 0,
            escalated: 0,
            "needs-review": 0,
            published: 0,
            rejected: 0,
            skipped: 0,
          },
        }),
        headers: {
          Cookie: cookie ?? "",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(batchResponse.status).toBe(201);

    const eventResponse = await fetch(
      `${server.origin}/api/orgs/dyknow/workspaces/dyknow-marketing/events`,
      {
        body: JSON.stringify({
          createdAt: "2026-07-02T12:02:00.000Z",
          kind: "workspace-synced",
          message: "Synced DyKnow Local artifacts.",
        }),
        headers: {
          Cookie: cookie ?? "",
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    expect(eventResponse.status).toBe(201);

    const dashboardResponse = await fetch(
      `${server.origin}/api/orgs/dyknow/workspaces/dyknow-marketing/dashboard`,
      {
        headers: { Cookie: cookie ?? "" },
      },
    );
    const dashboardPayload = (await dashboardResponse.json()) as {
      summary: { latestRuns: Record<string, { type: string }>; pendingUpdates: { total: number } };
    };

    expect(dashboardPayload.summary.latestRuns.scan?.type).toBe("scan");
    expect(dashboardPayload.summary.pendingUpdates.total).toBe(1);

    await server.close();
  });
});
