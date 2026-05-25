import Link from "next/link";

export default function Home() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 720, padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>DyKnow Demo App</h1>
      <p style={{ marginBottom: "1.5rem" }}>
        Lightweight demo product used for Phase 3 stale-to-fresh documentation
        walkthroughs.
      </p>

      <ul style={{ display: "grid", gap: "0.5rem", listStyle: "none" }}>
        <li>
          <Link href="/pricing">View pricing</Link>
        </li>
        <li>
          <a href="/api/feedback">Open feedback API metadata</a>
        </li>
      </ul>
    </main>
  );
}
