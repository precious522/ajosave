"use client";

import { useState } from "react";

interface Props {
  publicKey: string;
  onSuccess?: (usdcTxHash: string) => void;
}

/**
 * Rendered only when NEXT_PUBLIC_STELLAR_NETWORK=testnet.
 * Calls the faucet endpoint to fund the given Stellar account with XLM + USDC.
 */
export default function FundTestnetButton({ publicKey, onSuccess }: Props) {
  if (process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") return null;

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleFund() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stellar/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMessage({ type: "success", text: `Funded! USDC tx: ${json.data.usdcTxHash.slice(0, 16)}…` });
      onSuccess?.(json.data.usdcTxHash);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Faucet failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button
        onClick={handleFund}
        disabled={loading || !publicKey}
        style={{
          background: "#f59e0b",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "0.4rem 1rem",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "0.85rem",
          opacity: loading || !publicKey ? 0.6 : 1,
        }}
      >
        {loading ? "Funding…" : "🪙 Fund testnet account (XLM + USDC)"}
      </button>
      {message && (
        <p style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: message.type === "success" ? "green" : "red" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
