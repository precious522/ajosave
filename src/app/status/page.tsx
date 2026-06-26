import { headers } from "next/headers";

async function getHealth() {
  try {
    const host = headers().get("host") ?? "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const res = await fetch(`${protocol}://${host}/api/health`, {
      cache: "no-store",
    });
    return res.json();
  } catch {
    return { status: "degraded", db: "error", redis: "error", timestamp: new Date().toISOString() };
  }
}

export default async function StatusPage() {
  const health = await getHealth();
  const ok = health.status === "ok";

  const dot = (s: string) => (
    <span style={{ color: s === "ok" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      {s === "ok" ? "● Operational" : "● Degraded"}
    </span>
  );

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Ajosave Status</h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>
        Last checked: {new Date(health.timestamp).toUTCString()}
      </p>

      <div
        style={{
          padding: "20px 24px",
          borderRadius: 8,
          background: ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
          marginBottom: 24,
          fontSize: 18,
          fontWeight: 700,
          color: ok ? "#15803d" : "#b91c1c",
        }}
      >
        {ok ? "✓ All systems operational" : "✗ Service disruption detected"}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {[
            { label: "API", value: health.status },
            { label: "Database", value: health.db },
            { label: "Cache (Redis)", value: health.redis },
          ].map(({ label, value }) => (
            <tr key={label} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "14px 0", color: "#374151" }}>{label}</td>
              <td style={{ padding: "14px 0", textAlign: "right" }}>{dot(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
