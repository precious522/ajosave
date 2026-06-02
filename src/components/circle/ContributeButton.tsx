"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import * as vercelAnalytics from "@vercel/analytics";
import { useToast } from "@/components/ui/Toast";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import styles from "./ContributeButton.module.css";

interface Props {
  circleId: string;
  circleName: string;
  amountNgn: number;
  cycleFrequency: string;
  currentCycle: number;
}

export function ContributeButton({ circleId, circleName, amountNgn, cycleFrequency, currentCycle }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feeInfo, setFeeInfo] = useState<{ authorizationUrl: string; platformFee: number } | null>(null);
  const [networkFee, setNetworkFee] = useState<{ baseFee: number; priorityFee: number; maxFeeCap: number } | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const { toast } = useToast();
  const { rate, loading: rateLoading } = useExchangeRate("NGN");

  const feeEstimate = networkFee
    ? `${networkFee.priorityFee} stroops (${(networkFee.priorityFee / 1e7).toFixed(7)} XLM)`
    : "Fetching current Stellar fee…";

  const usdcEquivalent = rate ? (amountNgn / rate).toFixed(4) : null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/contribute`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      // Track contribution initiation (no PII)
      try { vercelAnalytics.track("contribution_made", { circleId, amountNgn }); } catch {}
      // Show fee info before redirecting
      if (json.data.platformFee > 0) {
        setFeeInfo(json.data);
        setLoading(false);
        return;
      }
      toast("Redirecting to payment…", "info");
      window.location.href = json.data.authorizationUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initiate payment";
      const display = msg.includes("contribution amount must equal required amount")
        ? `Contribution must be exactly ₦${amountNgn.toLocaleString("en-NG")} — please do not modify the amount.`
        : msg;
      toast(display, "error");
      setLoading(false);
      setShowModal(false);
    }
  };

  if (feeInfo) {
    const feeNgn = (feeInfo.platformFee / 100).toFixed(2);
    return (
      <div role="region" aria-label="Payment fee disclosure" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          A platform fee of <strong>₦{feeNgn}</strong> (0.5%) will be added to your contribution.
        </p>
        <Button
          variant="accent"
          onClick={() => {
            toast("Redirecting to payment…", "info");
            window.location.href = feeInfo.authorizationUrl;
          }}
        >
          Proceed to Payment
        </Button>
        <Button variant="ghost" onClick={() => setFeeInfo(null)}>Cancel</Button>
      </div>
    );
  }

  useEffect(() => {
    if (!showModal || networkFee || feeError) return;

    let isMounted = true;
    fetch("/api/stellar/fee")
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted) return;
        if (json.success) {
          setNetworkFee(json.data);
          setFeeError(null);
        } else {
          throw new Error(json.error || "Unable to load network fee");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setFeeError("Unable to fetch current Stellar fee. Using a conservative estimate.");
        console.warn("[ContributeButton] fee fetch failed:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [showModal, networkFee, feeError]);

  return (
    <>
      <Button variant="accent" onClick={() => setShowModal(true)}>
        Contribute Now
      </Button>

      {showModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={styles.modal}>
            <h2 id="confirm-title" className={styles.title}>Confirm Contribution</h2>

            <dl className={styles.details}>
              <div className={styles.row}>
                <dt>Circle</dt>
                <dd>{circleName}</dd>
              </div>
              <div className={styles.row}>
                <dt>Amount</dt>
                <dd>₦{amountNgn.toLocaleString("en-NG")}</dd>
              </div>
              <div className={styles.row}>
                <dt>≈ USDC</dt>
                <dd>
                  {rateLoading ? "Loading…" : usdcEquivalent ? `${usdcEquivalent} USDC` : "—"}
                </dd>
              </div>
              <div className={styles.row}>
                <dt>Cycle</dt>
                <dd>Cycle {currentCycle} ({cycleFrequency})</dd>
              </div>
              <div className={styles.row}>
                <dt>Network Fee</dt>
                <dd>
                  {networkFee ? (
                    <>
                      {networkFee.priorityFee} stroops ({(networkFee.priorityFee / 1e7).toFixed(7)} XLM)
                      <span style={{ display: "block", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                        Current base fee {networkFee.baseFee} stroops; capped at {networkFee.maxFeeCap} stroops.
                      </span>
                    </>
                  ) : feeError ? (
                    feeError
                  ) : (
                    feeEstimate
                  )}
                </dd>
              </div>
            </dl>

            <p className={styles.disclaimer}>
              ⚠ Exchange rate is indicative and refreshes every 60 seconds. Final USDC amount may vary slightly at settlement.
            </p>

            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="accent" onClick={handleConfirm} loading={loading}>
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
