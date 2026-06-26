"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Circle } from "@/types";
import type { MemberContributionStatus } from "@/server/services/admin.service";
import styles from "./CircleAdminTab.module.css";

interface Props {
  circle: Circle;
}

type ContribStatus = "confirmed" | "missed" | "pending" | "refund_pending" | "refunded";

function ContribPill({ status }: { status: ContribStatus | undefined }) {
  if (!status) {
    return <span className={`${styles.pill} ${styles.pillNone}`}>—</span>;
  }
  const map: Record<ContribStatus, string> = {
    confirmed: styles.pillConfirmed,
    missed: styles.pillMissed,
    pending: styles.pillPending,
    refund_pending: styles.pillPending,
    refunded: styles.pillNone,
  };
  const labels: Record<ContribStatus, string> = {
    confirmed: "Paid",
    missed: "Missed",
    pending: "Pending",
    refund_pending: "Refund pending",
    refunded: "Refunded",
  };
  return (
    <span className={`${styles.pill} ${map[status]}`}>{labels[status]}</span>
  );
}

export function CircleAdminTab({ circle }: Props) {
  const [members, setMembers] = useState<MemberContributionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Remove member confirmation state
  const [removeTarget, setRemoveTarget] = useState<MemberContributionStatus | null>(null);
  const [removing, setRemoving] = useState(false);

  // Payout trigger confirmation state
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/circles/${circle.id}/members`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMembers(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [circle.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Derive the cycle numbers present across all members
  const cycleNumbers = Array.from(
    new Set(members.flatMap((m) => m.contributions.map((c) => c.cycleNumber)))
  ).sort((a, b) => a - b);

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveConfirm = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(
        `/api/admin/circles/${circle.id}/members/${removeTarget.memberId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccessMsg(`${removeTarget.displayName} has been removed from the circle.`);
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  };

  // ── Manual payout trigger ──────────────────────────────────────────────────
  const handlePayoutConfirm = async () => {
    setPayoutLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/circles/${circle.id}/payout`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccessMsg(
        `Payout for cycle ${json.data.cycleNumber} triggered. Tx: ${json.data.txHash}`
      );
      setPayoutConfirmOpen(false);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout failed");
      setPayoutConfirmOpen(false);
    } finally {
      setPayoutLoading(false);
    }
  };

  const nextRecipient = members.find(
    (m) => m.position === circle.currentCycle && !m.hasReceivedPayout
  );

  return (
    <div className={styles.container}>
      {/* ── Feedback ── */}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {successMsg && (
        <p className={styles.success} role="status">
          {successMsg}
        </p>
      )}

      {/* ── Manual payout trigger ── */}
      {circle.status === "active" && (
        <div className={styles.payoutSection}>
          <div className={styles.payoutInfo}>
            <p className={styles.payoutInfoTitle}>Manual Payout Trigger</p>
            <p className={styles.payoutInfoSub}>
              {nextRecipient
                ? `Next recipient: ${nextRecipient.displayName} — Cycle ${circle.currentCycle}`
                : "No eligible recipient found for the current cycle."}
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={!nextRecipient}
            onClick={() => setPayoutConfirmOpen(true)}
          >
            Trigger Payout
          </Button>
        </div>
      )}

      {/* ── Member contribution table ── */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarTitle}>
          Members &amp; Contribution Status
        </span>
        <Button variant="ghost" size="sm" onClick={fetchMembers} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading…</p>
      ) : members.length === 0 ? (
        <p className={styles.empty}>No members found.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Member contribution status">
            <thead>
              <tr>
                <th scope="col">Position</th>
                <th scope="col">Member</th>
                {cycleNumbers.map((n) => (
                  <th key={n} scope="col">
                    Cycle {n}
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const contribByCycle = new Map(
                  m.contributions.map((c) => [c.cycleNumber, c.status as ContribStatus])
                );
                return (
                  <tr key={m.memberId}>
                    <td>{m.position ?? "—"}</td>
                    <td>
                      <div className={styles.memberCell}>
                        <span className={styles.memberName}>{m.displayName}</span>
                        {m.hasReceivedPayout && (
                          <span className={styles.paidBadge}>Paid out ✓</span>
                        )}
                      </div>
                    </td>
                    {cycleNumbers.map((n) => (
                      <td key={n}>
                        <ContribPill status={contribByCycle.get(n)} />
                      </td>
                    ))}
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        className={styles.removeBtn}
                        onClick={() => setRemoveTarget(m)}
                        aria-label={`Remove ${m.displayName} from circle`}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Remove member confirmation ── */}
      <ConfirmModal
        open={!!removeTarget}
        title="Remove Member"
        message={
          removeTarget
            ? `Remove ${removeTarget.displayName} from this circle? This action is logged and cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        loading={removing}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* ── Payout trigger confirmation ── */}
      <ConfirmModal
        open={payoutConfirmOpen}
        title="Trigger Manual Payout"
        message={
          nextRecipient
            ? `Manually trigger the cycle ${circle.currentCycle} payout to ${nextRecipient.displayName}? This will execute a real Stellar transaction.`
            : "Trigger payout for the current cycle?"
        }
        confirmLabel="Trigger Payout"
        cancelLabel="Cancel"
        loading={payoutLoading}
        onConfirm={handlePayoutConfirm}
        onCancel={() => setPayoutConfirmOpen(false)}
      />
    </div>
  );
}
