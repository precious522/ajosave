export default function OfflinePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "1rem", textAlign: "center", padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--color-text-primary)" }}>You&apos;re offline</h1>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: "400px" }}>
        No internet connection. Cached pages are still available — check your circles or dashboard.
      </p>
      <a href="/" style={{ color: "var(--color-brand-primary)", textDecoration: "underline" }}>Go to home</a>
    </div>
  );
}
