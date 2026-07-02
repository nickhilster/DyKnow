import {
  type CloudSession,
  type Organization,
  PAGE_HEALTH_STATUSES,
  PAGE_RISK_LEVELS,
  SOURCE_CONNECTION_STATUSES,
  WORKSPACE_SOURCE_TYPES,
  WORKSPACE_STATUSES,
  type Workspace,
  type WorkspaceDashboardSummary,
  type WorkspacePage,
  type WorkspaceSource,
} from "@dyknow/cloud-shared";
import { startTransition, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";

type OrgListEntry = {
  organization: Organization;
  workspaceCount: number;
};

type OrgWorkspaceRecord = {
  organizationSlug: string;
  summary: WorkspaceDashboardSummary;
  workspace: Workspace;
};

type SessionState = {
  status: "loading" | "signed-in" | "signed-out";
  user?: CloudSession["user"];
};

const initialSessionState: SessionState = { status: "loading" };

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errorPayload?.error ?? `Request failed for ${path}.`);
  }

  return (await response.json()) as T;
}

function useSession() {
  const [state, setState] = useState<SessionState>(initialSessionState);

  useEffect(() => {
    let cancelled = false;

    apiRequest<CloudSession>("/api/session")
      .then((payload) => {
        if (!cancelled) {
          setState({ status: "signed-in", user: payload.user });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "signed-out" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    async signIn(email: string, password: string) {
      const payload = await apiRequest<CloudSession>("/api/session", {
        body: JSON.stringify({ email, password }),
        method: "POST",
      });
      startTransition(() => {
        setState({ status: "signed-in", user: payload.user });
      });
    },
    async signOut() {
      await apiRequest<{ ok: boolean }>("/api/session", { method: "DELETE" });
      startTransition(() => {
        setState({ status: "signed-out" });
      });
    },
    state,
  };
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SummaryCard(props: {
  title: string;
  value: string | number;
  detail: string;
  tone: "teal" | "amber" | "ink" | "rose";
}) {
  return (
    <article className={`summary-card tone-${props.tone}`}>
      <p className="card-label">{props.title}</p>
      <strong>{props.value}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function LoginPage(props: {
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("nick@example.com");
  const [password, setPassword] = useState("dyknow-demo");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="login-shell">
      <section className="login-panel">
        <p className="eyeline">DyKnow Cloud Sprint 1</p>
        <h1>Hosted control plane for knowledge operations.</h1>
        <p className="intro-copy">
          This slice now uses a local backend with cookie auth and file-backed
          workspace state. It is still narrow on purpose.
        </p>
        <form
          className="login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(undefined);
            setIsSubmitting(true);
            try {
              await props.onSignIn(email, password);
              navigate("/orgs");
            } catch (signInError) {
              setError(
                signInError instanceof Error
                  ? signInError.message
                  : "Could not sign in.",
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <label>
            <span>Email</span>
            <input
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Enter control plane"}
          </button>
          <p className="supporting-note">
            Demo credentials are prefilled for Sprint 1 local development.
          </p>
          {error ? <p className="error-copy">{error}</p> : null}
        </form>
      </section>
      <section className="login-aside">
        <div className="aside-card">
          <span>Scope</span>
          <strong>Control plane only</strong>
          <p>No connectors, no publishing UI, no billing in Sprint 1.</p>
        </div>
        <div className="aside-card">
          <span>Boundary</span>
          <strong>Local remains the executor</strong>
          <p>
            Cloud stores state, auth, and status summaries. Local and future
            connectors still provide the underlying run data.
          </p>
        </div>
      </section>
    </div>
  );
}

function OrgsPage() {
  const [entries, setEntries] = useState<OrgListEntry[]>([]);

  useEffect(() => {
    apiRequest<{ organizations: OrgListEntry[] }>("/api/orgs").then((payload) =>
      setEntries(payload.organizations),
    );
  }, []);

  return (
    <div className="content-shell">
      <header className="section-header">
        <p className="eyeline">Organizations</p>
        <h1>Choose an organization workspace cluster.</h1>
      </header>
      <div className="org-grid">
        {entries.map((entry) => (
          <NavLink
            key={entry.organization.id}
            className="org-card"
            to={`/orgs/${entry.organization.slug}`}
          >
            <div>
              <p className="card-label">Organization</p>
              <h2>{entry.organization.name}</h2>
            </div>
            <div className="org-meta">
              <span>{entry.workspaceCount} workspace</span>
              <span>
                Created {formatDateTime(entry.organization.createdAt)}
              </span>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function OrgDetailPage() {
  const { orgSlug } = useParams();
  const [organization, setOrganization] = useState<Organization | undefined>();
  const [workspaces, setWorkspaces] = useState<OrgWorkspaceRecord[]>([]);
  const [name, setName] = useState("");
  const [environment, setEnvironment] =
    useState<Workspace["environment"]>("internal");
  const [status, setStatus] = useState<Workspace["status"]>("draft");

  useEffect(() => {
    if (!orgSlug) {
      return;
    }
    apiRequest<{
      organization: Organization;
      workspaces: OrgWorkspaceRecord[];
    }>(`/api/orgs/${orgSlug}`).then((payload) => {
      setOrganization(payload.organization);
      setWorkspaces(payload.workspaces);
    });
  }, [orgSlug]);

  if (!orgSlug) {
    return <Navigate replace to="/orgs" />;
  }

  return (
    <div className="content-shell">
      <header className="section-header">
        <p className="eyeline">{organization?.name ?? orgSlug}</p>
        <h1>Workspace control plane.</h1>
      </header>

      <section className="panel creation-panel">
        <header className="panel-header">
          <h2>Create workspace</h2>
          <span>Persisted through the Cloud API.</span>
        </header>
        <form
          className="inline-form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) {
              return;
            }
            const payload = await apiRequest<{ record: OrgWorkspaceRecord }>(
              `/api/orgs/${orgSlug}/workspaces`,
              {
                body: JSON.stringify({ environment, name, status }),
                method: "POST",
              },
            );
            setWorkspaces((current) => [...current, payload.record]);
            setName("");
            setEnvironment("internal");
            setStatus("draft");
          }}
        >
          <label>
            <span>Name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Cloud sprint workspace"
              value={name}
            />
          </label>
          <label>
            <span>Environment</span>
            <select
              onChange={(event) =>
                setEnvironment(event.target.value as Workspace["environment"])
              }
              value={environment}
            >
              <option value="internal">internal</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) =>
                setStatus(event.target.value as Workspace["status"])
              }
              value={status}
            >
              {WORKSPACE_STATUSES.map((workspaceStatus) => (
                <option key={workspaceStatus} value={workspaceStatus}>
                  {workspaceStatus}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            Create
          </button>
        </form>
      </section>

      <div className="workspace-grid">
        {workspaces.map((record) => (
          <NavLink
            key={record.workspace.id}
            className="workspace-card"
            to={`/orgs/${record.organizationSlug}/workspaces/${record.workspace.slug}`}
          >
            <div className="status-row">
              <span className={`status-pill status-${record.workspace.status}`}>
                {record.workspace.status}
              </span>
              <span className="workspace-environment">
                {record.workspace.environment}
              </span>
            </div>
            <h2>{record.workspace.name}</h2>
            <p>
              {record.summary.pendingUpdates.total} pending update
              {record.summary.pendingUpdates.total === 1 ? "" : "s"}
            </p>
            <dl className="metric-pair-grid">
              <div>
                <dt>Healthy</dt>
                <dd>{record.summary.pageHealthCounts.healthy}</dd>
              </div>
              <div>
                <dt>Needs review</dt>
                <dd>{record.summary.pageHealthCounts["needs-review"]}</dd>
              </div>
            </dl>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function WorkspaceDashboardPage() {
  const { orgSlug, workspaceSlug } = useParams();
  const [summary, setSummary] = useState<
    WorkspaceDashboardSummary | undefined
  >();

  useEffect(() => {
    if (!orgSlug || !workspaceSlug) {
      return;
    }
    apiRequest<{ summary: WorkspaceDashboardSummary }>(
      `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/dashboard`,
    ).then((payload) => setSummary(payload.summary));
  }, [orgSlug, workspaceSlug]);

  if (!summary) {
    return <section className="panel">Loading workspace dashboard...</section>;
  }

  const connectedSources =
    summary.sourceCounts.connected + summary.sourceCounts.manual;
  const pageAttention =
    summary.pageHealthCounts.stale +
    summary.pageHealthCounts["needs-review"] +
    summary.pageHealthCounts.blocked;

  return (
    <section className="dashboard-stack">
      <div className="summary-grid">
        <SummaryCard
          title="Source coverage"
          value={`${connectedSources}/${Object.values(summary.sourceCounts).reduce((total, count) => total + count, 0)}`}
          detail={`${summary.sourceCounts.pending} pending, ${summary.sourceCounts.error} errored`}
          tone="teal"
        />
        <SummaryCard
          title="Page health"
          value={pageAttention}
          detail={`${summary.pageHealthCounts.healthy} healthy pages`}
          tone="amber"
        />
        <SummaryCard
          title="Pending updates"
          value={summary.pendingUpdates.total}
          detail={`${summary.pendingUpdates.riskCounts.high} high-risk draft(s)`}
          tone="rose"
        />
        <SummaryCard
          title="Latest update run"
          value={summary.latestRuns.update?.status ?? "missing"}
          detail={
            summary.latestRuns.update?.summary ?? "No update run recorded yet."
          }
          tone="ink"
        />
      </div>

      <div className="dashboard-columns">
        <section className="panel">
          <header className="panel-header">
            <h2>Latest runs</h2>
            <span>Most recent run per workflow step</span>
          </header>
          <div className="run-list">
            {(["scan", "diff", "update", "review-sync"] as const).map(
              (type) => {
                const run = summary.latestRuns[type];
                return (
                  <article className="run-row" key={type}>
                    <div>
                      <p className="run-type">{type}</p>
                      <p className="run-summary">
                        {run?.summary ?? "No run recorded."}
                      </p>
                    </div>
                    <div className="run-meta">
                      <span
                        className={`status-pill status-${run?.status ?? "queued"}`}
                      >
                        {run?.status ?? "queued"}
                      </span>
                      <span>
                        {formatDateTime(run?.finishedAt ?? run?.startedAt)}
                      </span>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <h2>Recent activity</h2>
            <span>Append-only workspace events</span>
          </header>
          <ol className="activity-list">
            {summary.recentEvents.map((event) => (
              <li key={event.id}>
                <p>{event.message}</p>
                <span>{formatDateTime(event.createdAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}

function WorkspaceSourcesPage() {
  const { orgSlug, workspaceSlug } = useParams();
  const [sources, setSources] = useState<WorkspaceSource[]>([]);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("");
  const [type, setType] = useState<WorkspaceSource["type"]>("manual");
  const [connectionStatus, setConnectionStatus] =
    useState<WorkspaceSource["connectionStatus"]>("manual");

  useEffect(() => {
    if (!orgSlug || !workspaceSlug) {
      return;
    }
    apiRequest<{ sources: WorkspaceSource[] }>(
      `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/sources`,
    ).then((payload) => setSources(payload.sources));
  }, [orgSlug, workspaceSlug]);

  if (!orgSlug || !workspaceSlug) {
    return <Navigate replace to="/orgs" />;
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Registered sources</h2>
        <span>Manual records now, live connectors later.</span>
      </header>
      <form
        className="inline-form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          const payload = await apiRequest<{ source: WorkspaceSource }>(
            `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/sources`,
            {
              body: JSON.stringify({ connectionStatus, label, scope, type }),
              method: "POST",
            },
          );
          setSources((current) => [...current, payload.source]);
          setLabel("");
          setScope("");
          setType("manual");
          setConnectionStatus("manual");
        }}
      >
        <label>
          <span>Label</span>
          <input
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            onChange={(event) =>
              setType(event.target.value as WorkspaceSource["type"])
            }
            value={type}
          >
            {WORKSPACE_SOURCE_TYPES.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceType}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            onChange={(event) =>
              setConnectionStatus(
                event.target.value as WorkspaceSource["connectionStatus"],
              )
            }
            value={connectionStatus}
          >
            {SOURCE_CONNECTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="wide-field">
          <span>Scope</span>
          <input
            onChange={(event) => setScope(event.target.value)}
            value={scope}
          />
        </label>
        <button className="primary-button" type="submit">
          Add source
        </button>
      </form>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Last sync</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>{source.label}</td>
                <td>{source.type}</td>
                <td>{source.scope}</td>
                <td>
                  <span
                    className={`status-pill status-${source.connectionStatus}`}
                  >
                    {source.connectionStatus}
                  </span>
                </td>
                <td>{formatDateTime(source.lastSyncedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkspacePagesPage() {
  const { orgSlug, workspaceSlug } = useParams();
  const [pages, setPages] = useState<WorkspacePage[]>([]);
  const [title, setTitle] = useState("");
  const [pageKey, setPageKey] = useState("");
  const [audience, setAudience] = useState<WorkspacePage["audience"]>("mixed");
  const [riskLevel, setRiskLevel] = useState<WorkspacePage["riskLevel"]>("low");
  const [healthStatus, setHealthStatus] =
    useState<WorkspacePage["healthStatus"]>("healthy");

  useEffect(() => {
    if (!orgSlug || !workspaceSlug) {
      return;
    }
    apiRequest<{ pages: WorkspacePage[] }>(
      `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/pages`,
    ).then((payload) => setPages(payload.pages));
  }, [orgSlug, workspaceSlug]);

  if (!orgSlug || !workspaceSlug) {
    return <Navigate replace to="/orgs" />;
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Registered pages</h2>
        <span>
          Page health and risk shape what later review flows must surface.
        </span>
      </header>
      <form
        className="inline-form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          const payload = await apiRequest<{ page: WorkspacePage }>(
            `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/pages`,
            {
              body: JSON.stringify({
                audience,
                healthStatus,
                pageKey,
                riskLevel,
                title,
              }),
              method: "POST",
            },
          );
          setPages((current) => [...current, payload.page]);
          setTitle("");
          setPageKey("");
          setAudience("mixed");
          setRiskLevel("low");
          setHealthStatus("healthy");
        }}
      >
        <label>
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label>
          <span>Page key</span>
          <input
            onChange={(event) => setPageKey(event.target.value)}
            value={pageKey}
          />
        </label>
        <label>
          <span>Audience</span>
          <select
            onChange={(event) =>
              setAudience(event.target.value as WorkspacePage["audience"])
            }
            value={audience}
          >
            <option value="mixed">mixed</option>
            <option value="external">external</option>
            <option value="internal">internal</option>
            <option value="agent">agent</option>
          </select>
        </label>
        <label>
          <span>Risk</span>
          <select
            onChange={(event) =>
              setRiskLevel(event.target.value as WorkspacePage["riskLevel"])
            }
            value={riskLevel}
          >
            {PAGE_RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Health</span>
          <select
            onChange={(event) =>
              setHealthStatus(
                event.target.value as WorkspacePage["healthStatus"],
              )
            }
            value={healthStatus}
          >
            {PAGE_HEALTH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit">
          Add page
        </button>
      </form>
      <div className="page-grid">
        {pages.map((page) => (
          <article className="page-card" key={page.id}>
            <div className="page-card-header">
              <div>
                <p className="card-label">{page.pageKey}</p>
                <h3>{page.title}</h3>
              </div>
              <span className={`status-pill status-${page.healthStatus}`}>
                {page.healthStatus}
              </span>
            </div>
            <dl className="page-card-meta">
              <div>
                <dt>Audience</dt>
                <dd>{page.audience}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{page.riskLevel}</dd>
              </div>
              <div>
                <dt>Last reviewed</dt>
                <dd>{formatDateTime(page.lastReviewedAt)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkspaceLayout() {
  const { orgSlug, workspaceSlug } = useParams();
  const [summary, setSummary] = useState<
    WorkspaceDashboardSummary | undefined
  >();

  useEffect(() => {
    if (!orgSlug || !workspaceSlug) {
      return;
    }
    apiRequest<{ summary: WorkspaceDashboardSummary }>(
      `/api/orgs/${orgSlug}/workspaces/${workspaceSlug}/dashboard`,
    ).then((payload) => setSummary(payload.summary));
  }, [orgSlug, workspaceSlug]);

  if (!orgSlug || !workspaceSlug) {
    return <Navigate replace to="/orgs" />;
  }

  if (!summary) {
    return <div className="content-shell">Loading workspace...</div>;
  }

  return (
    <div className="content-shell">
      <header className="workspace-header">
        <div>
          <p className="eyeline">Workspace</p>
          <h1>{summary.workspace.name}</h1>
          <p className="workspace-subtitle">
            Hosted view of source coverage, page health, latest runs, and
            pending updates.
          </p>
        </div>
        <div className="workspace-header-meta">
          <span className={`status-pill status-${summary.workspace.status}`}>
            {summary.workspace.status}
          </span>
          <span className="workspace-environment">
            {summary.workspace.environment}
          </span>
        </div>
      </header>

      <nav className="workspace-nav">
        <NavLink end to={`/orgs/${orgSlug}/workspaces/${workspaceSlug}`}>
          Dashboard
        </NavLink>
        <NavLink to={`/orgs/${orgSlug}/workspaces/${workspaceSlug}/sources`}>
          Sources
        </NavLink>
        <NavLink to={`/orgs/${orgSlug}/workspaces/${workspaceSlug}/pages`}>
          Pages
        </NavLink>
      </nav>

      <Routes>
        <Route index element={<WorkspaceDashboardPage />} />
        <Route path="sources" element={<WorkspaceSourcesPage />} />
        <Route path="pages" element={<WorkspacePagesPage />} />
      </Routes>
    </div>
  );
}

export function App() {
  const session = useSession();

  return (
    <div className="app-frame">
      <header className="topbar">
        <NavLink
          className="brand-lockup"
          to={session.state.status === "signed-in" ? "/orgs" : "/"}
        >
          <span className="brand-mark">DK</span>
          <span className="brand-copy">
            <strong>DyKnow Cloud</strong>
            <small>Sprint 1 control plane</small>
          </span>
        </NavLink>
        {session.state.status === "signed-in" && session.state.user ? (
          <div className="topbar-actions">
            <span className="session-name">
              {session.state.user.displayName}
            </span>
            <button
              className="secondary-button"
              onClick={() => void session.signOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      <main className="main-shell">
        {session.state.status === "loading" ? (
          <div className="content-shell">Loading Cloud session...</div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                session.state.status === "signed-in" ? (
                  <Navigate replace to="/orgs" />
                ) : (
                  <LoginPage
                    onSignIn={(email, password) =>
                      session.signIn(email, password)
                    }
                  />
                )
              }
            />
            <Route
              path="/orgs"
              element={
                session.state.status === "signed-in" ? (
                  <OrgsPage />
                ) : (
                  <Navigate replace to="/" />
                )
              }
            />
            <Route
              path="/orgs/:orgSlug"
              element={
                session.state.status === "signed-in" ? (
                  <OrgDetailPage />
                ) : (
                  <Navigate replace to="/" />
                )
              }
            />
            <Route
              path="/orgs/:orgSlug/workspaces/:workspaceSlug/*"
              element={
                session.state.status === "signed-in" ? (
                  <WorkspaceLayout />
                ) : (
                  <Navigate replace to="/" />
                )
              }
            />
          </Routes>
        )}
      </main>
    </div>
  );
}
