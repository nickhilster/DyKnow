export default function PricingPage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 720, padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>Pricing</h1>
      <p style={{ marginBottom: "1rem" }}>
        Baseline pricing page used for the later route-rename demo step.
      </p>

      <ul style={{ paddingLeft: "1.25rem", display: "grid", gap: "0.5rem" }}>
        <li>Starter - $0 / month</li>
        <li>Team - $49 / month</li>
        <li>Scale - Contact sales</li>
      </ul>
    </main>
  );
}
