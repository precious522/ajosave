"use client";

import { useState, useEffect, useRef } from "react";

interface ExchangeRate {
  rate: number | null;
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
}

const REFRESH_INTERVAL_MS = 60_000;

export function useExchangeRate(currency = "NGN"): ExchangeRate {
  const [rate, setRate] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchRate = async () => {
      try {
        const res = await fetch(`/api/fx/rate?currency=${currency}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setRate(json.data.rate);
          setFetchedAt(json.data.fetchedAt);
          setError(null);
        } else if (!cancelled) {
          setError(json.error ?? "Failed to fetch rate");
        }
      } catch {
        if (!cancelled) setError("Failed to fetch rate");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRate();
    timerRef.current = setInterval(fetchRate, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currency]);

  return { rate, fetchedAt, loading, error };
}
