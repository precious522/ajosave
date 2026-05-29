import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getReputation } from "@/server/services/reputation.service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const userId = (session.user as { id: string }).id;
  const rep = await getReputation(userId);

  return (
    <div className="container container--content" style={{ paddingTop: "2rem" }}>
      <h1>Profile</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        {(session.user as { phone?: string }).phone ?? session.user.name}
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Reputation Score</h2>
        {rep ? (
          <div className="card" style={{ maxWidth: 360, marginTop: "1rem" }}>
            <p style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>{rep.score}<span style={{ fontSize: "1rem", color: "var(--color-text-muted)" }}>/100</span></p>
            <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
              <li>✅ On-time contributions: {rep.onTimeContributions}</li>
              <li>🏁 Circles completed: {rep.circlesCompleted}</li>
              <li>⚠️ Defaults: {rep.defaults}</li>
            </ul>
            {rep.stellarTxProof && (
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                Stellar proof: {rep.stellarTxProof}
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: "var(--color-text-muted)", marginTop: "1rem" }}>
            No reputation data yet. Complete contributions to build your score.
          </p>
        )}
      </section>
    </div>
  );
}
