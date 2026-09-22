import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCloudSyncResult,
  resolveCloudSyncOptions,
} from "../src/cloud-sync-service.js";

describe("@dyknow/app cloud sync", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(
      cleanupPaths
        .splice(0)
        .map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  it("sends run, update batch, and event records", async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), "dyknow-cloud-sync-"));
    cleanupPaths.push(workspaceDir);
    await mkdir(join(workspaceDir, "docs", "dyknow", ".state"), {
      recursive: true,
    });

    await writeFile(
      join(workspaceDir, "docs", "dyknow", ".state", "repo-map.json"),
      JSON.stringify({ files: [{ path: "README.md" }, { path: "docs.md" }] }),
      "utf8",
    );
    await writeFile(
      join(workspaceDir, "docs", "dyknow", ".state", "repo-diff.json"),
      JSON.stringify({ summary: { affectedPages: 1 } }),
      "utf8",
    );
    await writeFile(
      join(workspaceDir, "docs", "dyknow", ".state", "update-proposals.json"),
      JSON.stringify({
        configPath: "dyknow.config.json",
        draftedAt: "2026-07-02T12:00:00.000Z",
        drafts: [
          {
            affectedPage: {
              matchedSourcePaths: ["README.md"],
              outputPath: "docs/product-overview.md",
              reasons: ["changed-file"],
              pageId: "product-overview",
            },
            providerTelemetry: {},
            proposal: {
              confidence: "high",
              proposedText: "# Product Overview",
              requiresHumanReview: true,
              reviewState: "Approved",
              risk: "low",
              sources: ["README.md"],
              summary: "Update overview",
              pageId: "product-overview",
              why: "docs changed",
            },
          },
        ],
        outputPath: "docs/dyknow/.state/update-proposals.json",
        providerId: "local",
        providerTelemetry: {},
        repoDiffPath: "docs/dyknow/.state/repo-diff.json",
        rootPath: workspaceDir,
        summary: { affectedPages: 1, draftedProposals: 1 },
      }),
      "utf8",
    );

    const requests: Array<{ body: unknown; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const bodyText = typeof init?.body === "string" ? init.body : "{}";
        requests.push({ body: JSON.parse(bodyText), url });

        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify({ user: { id: "user_nick" } }), {
            headers: {
              "set-cookie":
                "dyknow_cloud_session=test-cookie; Path=/; HttpOnly",
            },
            status: 200,
          });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 201 });
      }),
    );

    const result = await createCloudSyncResult({
      apiBaseUrl: "http://127.0.0.1:3000",
      cwd: workspaceDir,
      email: "nick@example.com",
      organizationSlug: "dyknow",
      password: "dyknow-demo",
      workspaceSlug: "dyknow-marketing",
    });

    expect(result).toMatchObject({
      eventsRecorded: 1,
      runsRecorded: 4,
      updateBatchesRecorded: 1,
    });
    const runRequests = requests.filter((request) =>
      request.url.endsWith("/runs"),
    );
    expect(runRequests).toHaveLength(4);
    // cloud-api rejects run payloads without startedAt.
    for (const request of runRequests) {
      expect(request.body).toMatchObject({ startedAt: expect.any(String) });
    }
    expect(
      requests.some((request) => request.url.endsWith("/update-batches")),
    ).toBe(true);
    expect(requests.some((request) => request.url.endsWith("/events"))).toBe(
      true,
    );
  });

  it("prefers config, then env, then cli values for cloud connection settings", () => {
    const resolved = resolveCloudSyncOptions({
      cli: {
        apiBaseUrl: "http://cli.example",
        email: "cli@example.com",
        organizationSlug: "cli-org",
        password: "cli-password",
        workspaceSlug: "cli-workspace",
      },
      config: {
        apiBaseUrl: "http://config.example",
        email: "config@example.com",
        organizationSlug: "config-org",
        workspaceSlug: "config-workspace",
      },
      env: {
        DYKNOW_CLOUD_API_BASE_URL: "http://env.example",
        DYKNOW_CLOUD_EMAIL: "env@example.com",
        DYKNOW_CLOUD_ORGANIZATION: "env-org",
        DYKNOW_CLOUD_PASSWORD: "env-password",
        DYKNOW_CLOUD_WORKSPACE: "env-workspace",
      } as NodeJS.ProcessEnv,
    });

    expect(resolved).toMatchObject({
      apiBaseUrl: "http://config.example",
      email: "config@example.com",
      organizationSlug: "config-org",
      password: "env-password",
      workspaceSlug: "config-workspace",
    });
  });
});
