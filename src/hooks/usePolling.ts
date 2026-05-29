"use client";

import { useEffect, useRef, useState } from "react";

interface UsePollingOptions<T> {
  fetchFn: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function usePolling<T>({
  fetchFn,
  interval = 5000,
  enabled = true,
  onSuccess,
  onError,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const result = await fetchFn();
        if (mountedRef.current) {
          setData(result);
          setError(null);
          setIsConnected(true);
          onSuccess?.(result);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Polling failed");
        if (mountedRef.current) {
          setError(error);
          setIsConnected(false);
          onError?.(error);
        }
      }
    };

    // Initial fetch
    poll();

    // Set up polling interval
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchFn, interval, enabled, onSuccess, onError]);

  return { data, isConnected, error };
}
