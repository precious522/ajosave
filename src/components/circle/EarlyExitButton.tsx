"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface EarlyExitButtonProps {
  circleId: string;
}

export function EarlyExitButton({ circleId }: EarlyExitButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/circles/${circleId}/early-exit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to submit exit request");
      setSuccess(true);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <p style={{ color: "var(--color-success)", fontSize: "var(--text-sm)" }}>
        ✓ Early exit request submitted. An admin will review it shortly.
      </p>
    );
  }

  return (
    <div>
      {!showConfirm ? (
        <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
          Request Early Exit
        </Button>
      ) : (
        <div style={{ border: "1px solid var(--color-warning, #f59e0b)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", background: "rgba(245,158,11,0.08)" }}>
          <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
            <strong>Warning:</strong> A 10% penalty will be deducted from your total contributions. The remaining balance will be refunded to your Stellar wallet. The circle will continue with remaining members.
          </p>
          {error && <p style={{ color: "var(--color-error)", fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>{error}</p>}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button size="sm" variant="accent" onClick={handleRequest} loading={loading}>
              Confirm Exit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
