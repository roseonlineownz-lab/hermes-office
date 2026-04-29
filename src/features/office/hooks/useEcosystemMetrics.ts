"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type EcosystemMetrics = {
  timestamp: string;
  health: { up: number; total: number; pct: number };
  services: { name: string; category: string; up: boolean; url: string }[];
  byCategory: Record<string, { up: number; total: number }>;
};

const METRICS_ENDPOINT = "/api/metrics";
const POLL_INTERVAL = 30_000;
const STALE_TIMEOUT = 120_000;

export function useEcosystemMetrics() {
  const [metrics, setMetrics] = useState<EcosystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(METRICS_ENDPOINT, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EcosystemMetrics = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMetrics]);

  const isStale = metrics
    ? Date.now() - new Date(metrics.timestamp).getTime() > STALE_TIMEOUT
    : true;

  return { metrics, loading, error, isStale, refresh: fetchMetrics };
}