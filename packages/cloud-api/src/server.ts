import {
  type IncomingMessage,
  type ServerResponse,
  createServer,
} from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  type Organization,
  PAGE_HEALTH_STATUSES,
  PAGE_RISK_LEVELS,
  SOURCE_CONNECTION_STATUSES,
  type User,
  WORKSPACE_EVENT_KINDS,
  WORKSPACE_RUN_STATUSES,
  WORKSPACE_RUN_TYPES,
  WORKSPACE_SOURCE_TYPES,
  WORKSPACE_STATUSES,
  type Workspace,
  type WorkspaceEventInput,
  type WorkspacePage,
  type WorkspaceRunInput,
  type WorkspaceSource,
  type WorkspaceUpdateBatchInput,
} from "@dyknow/cloud-shared";

import { CloudStorage } from "./storage.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDbPath = resolve(moduleDirectory, "../.local/cloud-db.json");

const SESSION_COOKIE_NAME = "dyknow_cloud_session";
const DEMO_PASSWORD = "dyknow-demo";

type Session = {
  token: string;
  userId: string;
};

type CloudApiServerOptions = {
  dbPath?: string;
};

type JsonRecord = Record<string, unknown>;

function json(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function notFound(response: ServerResponse) {
  json(response, 404, { error: "Not found." });
}

function unauthorized(response: ServerResponse) {
  json(response, 401, { error: "Authentication required." });
}

function badRequest(response: ServerResponse, message: string) {
  json(response, 400, { error: message });
}

function readCookies(request: IncomingMessage): Record<string, string> {
  const raw = request.headers.cookie;
  if (!raw) {
    return {};
  }

  return Object.fromEntries(
    raw.split(";").map((entry) => {
      const [name, ...value] = entry.trim().split("=");
      return [name, decodeURIComponent(value.join("="))];
    }),
  );
}

async function readJsonBody(request: IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as JsonRecord;
}

function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
}

async function getAuthenticatedUser(options: {
  request: IncomingMessage;
  response: ServerResponse;
  sessions: Map<string, Session>;
  storage: CloudStorage;
}): Promise<User | undefined> {
  const cookies = readCookies(options.request);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    unauthorized(options.response);
    return undefined;
  }

  const session = options.sessions.get(token);
  if (!session) {
    unauthorized(options.response);
    return undefined;
  }

  const data = await options.storage.read();
  const user = data.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    unauthorized(options.response);
    return undefined;
  }

  return user;
}

function workspaceRecordPayload(record: {
  organization: Organization;
  summary: Awaited<ReturnType<CloudStorage["getWorkspaceSummary"]>>;
  workspace: Workspace;
}) {
  return {
    organizationSlug: record.organization.slug,
    summary: record.summary,
    workspace: record.workspace,
  };
}

export function createCloudApiServer(options: CloudApiServerOptions = {}) {
  const storage = new CloudStorage(options.dbPath ?? defaultDbPath);
  const sessions = new Map<string, Session>();

  return createServer(async (request, response) => {
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      });
      response.end();
      return;
    }

    const url = request.url
      ? new URL(request.url, "http://localhost")
      : undefined;
    if (!url) {
      notFound(response);
      return;
    }

    await storage.bootstrap();

    try {
      if (request.method === "POST" && url.pathname === "/api/session") {
        const body = await readJsonBody(request);
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");

        if (!email || !password) {
          badRequest(response, "Email and password are required.");
          return;
        }

        const user = await storage.findUserByEmail(email);
        if (!user || password !== DEMO_PASSWORD) {
          json(response, 401, { error: "Invalid credentials." });
          return;
        }

        const token = crypto.randomUUID();
        sessions.set(token, { token, userId: user.id });
        response.setHeader(
          "Set-Cookie",
          `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`,
        );
        json(response, 200, { user });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/session") {
        const user = await getAuthenticatedUser({
          request,
          response,
          sessions,
          storage,
        });
        if (!user) {
          return;
        }

        json(response, 200, { user });
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/session") {
        const token = readCookies(request)[SESSION_COOKIE_NAME];
        if (token) {
          sessions.delete(token);
        }
        response.setHeader(
          "Set-Cookie",
          `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
        );
        json(response, 200, { ok: true });
        return;
      }

      const user = await getAuthenticatedUser({
        request,
        response,
        sessions,
        storage,
      });
      if (!user) {
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/orgs") {
        const organizations = await storage.listOrganizationsForUser(user.id);
        const orgs = await Promise.all(
          organizations.map(async (organization) => {
            const workspaceRecords =
              await storage.listWorkspaceRecordsForOrganization(
                organization.id,
              );
            return {
              organization,
              workspaceCount: workspaceRecords.length,
            };
          }),
        );
        json(response, 200, { organizations: orgs });
        return;
      }

      const orgMatch = url.pathname.match(/^\/api\/orgs\/([^/]+)$/u);
      if (request.method === "GET" && orgMatch?.[1]) {
        const orgSlug = decodeURIComponent(orgMatch[1]);
        const organization = await storage.getOrganizationForUser(
          user.id,
          orgSlug,
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspaceRecords =
          await storage.listWorkspaceRecordsForOrganization(organization.id);
        json(response, 200, {
          organization,
          workspaces: workspaceRecords.map((record) =>
            workspaceRecordPayload({
              organization,
              summary: record.summary,
              workspace: record.workspace,
            }),
          ),
        });
        return;
      }

      const workspaceCreateMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces$/u,
      );
      if (workspaceCreateMatch?.[1]) {
        const orgSlug = decodeURIComponent(workspaceCreateMatch[1]);
        const organization = await storage.getOrganizationForUser(
          user.id,
          orgSlug,
        );
        if (!organization) {
          notFound(response);
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const name = String(body.name ?? "").trim();
          const environment = String(body.environment ?? "internal");
          const status = String(body.status ?? "draft");

          if (!name) {
            badRequest(response, "Workspace name is required.");
            return;
          }
          if (
            !["production", "staging", "internal"].includes(environment) ||
            !WORKSPACE_STATUSES.includes(status as Workspace["status"])
          ) {
            badRequest(response, "Invalid workspace environment or status.");
            return;
          }

          const workspace = await storage.createWorkspace({
            environment: environment as Workspace["environment"],
            name,
            organizationId: organization.id,
            status: status as Workspace["status"],
          });
          const summary = await storage.getWorkspaceSummary(
            organization.id,
            workspace.slug,
          );
          json(response, 201, {
            record: workspaceRecordPayload({
              organization,
              summary,
              workspace,
            }),
          });
          return;
        }
      }

      const dashboardMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/dashboard$/u,
      );
      if (
        request.method === "GET" &&
        dashboardMatch?.[1] &&
        dashboardMatch[2]
      ) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(dashboardMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const summary = await storage.getWorkspaceSummary(
          organization.id,
          decodeURIComponent(dashboardMatch[2]),
        );
        if (!summary) {
          notFound(response);
          return;
        }

        json(response, 200, { summary });
        return;
      }

      const sourcesMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/sources$/u,
      );
      if (sourcesMatch?.[1] && sourcesMatch[2]) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(sourcesMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspace = await storage.getWorkspaceForOrganization(
          organization.id,
          decodeURIComponent(sourcesMatch[2]),
        );
        if (!workspace) {
          notFound(response);
          return;
        }

        if (request.method === "GET") {
          const sources = await storage.listSources(workspace.id);
          json(response, 200, { sources });
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const label = String(body.label ?? "").trim();
          const scope = String(body.scope ?? "").trim();
          const type = String(body.type ?? "");
          const connectionStatus = String(body.connectionStatus ?? "");

          if (!label || !scope) {
            badRequest(response, "Source label and scope are required.");
            return;
          }
          if (
            !WORKSPACE_SOURCE_TYPES.includes(type as WorkspaceSource["type"]) ||
            !SOURCE_CONNECTION_STATUSES.includes(
              connectionStatus as WorkspaceSource["connectionStatus"],
            )
          ) {
            badRequest(response, "Invalid source type or connection status.");
            return;
          }

          const source = await storage.createSource({
            connectionStatus:
              connectionStatus as WorkspaceSource["connectionStatus"],
            label,
            scope,
            type: type as WorkspaceSource["type"],
            workspaceId: workspace.id,
          });
          json(response, 201, { source });
          return;
        }
      }

      const pagesMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/pages$/u,
      );
      if (pagesMatch?.[1] && pagesMatch[2]) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(pagesMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspace = await storage.getWorkspaceForOrganization(
          organization.id,
          decodeURIComponent(pagesMatch[2]),
        );
        if (!workspace) {
          notFound(response);
          return;
        }

        if (request.method === "GET") {
          const pages = await storage.listPages(workspace.id);
          json(response, 200, { pages });
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const title = String(body.title ?? "").trim();
          const pageKey = String(body.pageKey ?? "").trim();
          const audience = String(body.audience ?? "");
          const riskLevel = String(body.riskLevel ?? "");
          const healthStatus = String(body.healthStatus ?? "");

          if (!title || !pageKey) {
            badRequest(response, "Page title and key are required.");
            return;
          }
          if (
            !["internal", "external", "mixed", "agent"].includes(audience) ||
            !PAGE_RISK_LEVELS.includes(
              riskLevel as (typeof PAGE_RISK_LEVELS)[number],
            ) ||
            !PAGE_HEALTH_STATUSES.includes(
              healthStatus as (typeof PAGE_HEALTH_STATUSES)[number],
            )
          ) {
            badRequest(response, "Invalid page audience, risk, or health.");
            return;
          }

          const page = await storage.createPage({
            audience: audience as WorkspacePage["audience"],
            healthStatus: healthStatus as WorkspacePage["healthStatus"],
            pageKey,
            riskLevel: riskLevel as WorkspacePage["riskLevel"],
            title,
            workspaceId: workspace.id,
          });
          json(response, 201, { page });
          return;
        }
      }

      const runsMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/runs$/u,
      );
      if (runsMatch?.[1] && runsMatch[2]) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(runsMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspace = await storage.getWorkspaceForOrganization(
          organization.id,
          decodeURIComponent(runsMatch[2]),
        );
        if (!workspace) {
          notFound(response);
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const type = String(body.type ?? "");
          const status = String(body.status ?? "");
          const startedAt = String(body.startedAt ?? "");
          const finishedAt =
            typeof body.finishedAt === "string" ? body.finishedAt : undefined;
          const summary =
            typeof body.summary === "string" ? body.summary.trim() : undefined;

          if (
            !WORKSPACE_RUN_TYPES.includes(type as WorkspaceRunInput["type"]) ||
            !WORKSPACE_RUN_STATUSES.includes(
              status as WorkspaceRunInput["status"],
            ) ||
            !startedAt
          ) {
            badRequest(response, "Invalid workspace run payload.");
            return;
          }

          const run = await storage.recordWorkspaceRun({
            workspaceId: workspace.id,
            run: {
              type: type as WorkspaceRunInput["type"],
              status: status as WorkspaceRunInput["status"],
              startedAt,
              ...(finishedAt ? { finishedAt } : {}),
              ...(summary ? { summary } : {}),
            },
          });
          json(response, 201, { run });
          return;
        }
      }

      const updateBatchesMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/update-batches$/u,
      );
      if (updateBatchesMatch?.[1] && updateBatchesMatch[2]) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(updateBatchesMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspace = await storage.getWorkspaceForOrganization(
          organization.id,
          decodeURIComponent(updateBatchesMatch[2]),
        );
        if (!workspace) {
          notFound(response);
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const createdAt = String(body.createdAt ?? "");
          const reviewStateCounts = body.reviewStateCounts as
            | Record<string, unknown>
            | undefined;
          const riskCounts = body.riskCounts as
            | Record<string, unknown>
            | undefined;

          if (!createdAt || !reviewStateCounts || !riskCounts) {
            badRequest(response, "Invalid update batch payload.");
            return;
          }

          const batch = await storage.recordWorkspaceUpdateBatch({
            workspaceId: workspace.id,
            batch: {
              createdAt,
              reviewStateCounts:
                reviewStateCounts as WorkspaceUpdateBatchInput["reviewStateCounts"],
              riskCounts: riskCounts as WorkspaceUpdateBatchInput["riskCounts"],
            },
          });
          json(response, 201, { batch });
          return;
        }
      }

      const eventsMatch = url.pathname.match(
        /^\/api\/orgs\/([^/]+)\/workspaces\/([^/]+)\/events$/u,
      );
      if (eventsMatch?.[1] && eventsMatch[2]) {
        const organization = await storage.getOrganizationForUser(
          user.id,
          decodeURIComponent(eventsMatch[1]),
        );
        if (!organization) {
          notFound(response);
          return;
        }

        const workspace = await storage.getWorkspaceForOrganization(
          organization.id,
          decodeURIComponent(eventsMatch[2]),
        );
        if (!workspace) {
          notFound(response);
          return;
        }

        if (request.method === "POST") {
          const body = await readJsonBody(request);
          const kind = String(body.kind ?? "");
          const message = String(body.message ?? "").trim();
          const createdAt = String(body.createdAt ?? "");

          if (
            !message ||
            !createdAt ||
            !WORKSPACE_EVENT_KINDS.includes(kind as WorkspaceEventInput["kind"])
          ) {
            badRequest(response, "Invalid workspace event payload.");
            return;
          }

          const event = await storage.recordWorkspaceEvent({
            workspaceId: workspace.id,
            event: {
              kind: kind as WorkspaceEventInput["kind"],
              message,
              createdAt,
            },
          });
          json(response, 201, { event });
          return;
        }
      }

      notFound(response);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected Cloud API error.";
      json(response, 500, { error: message });
    }
  });
}
