/**
 * useStats — fetches live platform stats from GET /api/stats.
 *
 * Returns formatted strings ready for use in StatCard:
 *   tests      → "971+" (total test count)
 *   datasets   → "1180+" (files in storage/)
 *   coverage   → "86%" (line coverage from cobertura XML)
 *   responseSla → "<2s" (SLA from performance benchmarks)
 *
 * Falls back to last-known values when the API is unreachable (e.g. dev offline).
 */

import { useEffect, useState } from 'react';
import { getApiUrl } from '../config/api';

// Last-known baselines used while loading or when the API fails
const FALLBACK = {
  tests: '970+',
  datasets: '1180+',
  coverage: '86%',
  responseSla: '<2s',
};

export default function useStats() {
  const [stats, setStats] = useState(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch(getApiUrl('/api/stats'), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          // Short timeout — login page must not stall for stats
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setStats({
          tests: `${data.tests_total}+`,
          datasets: `${data.datasets_total}+`,
          coverage: `${data.coverage_pct}%`,
          responseSla: data.response_sla_ms < 1000
            ? `<${data.response_sla_ms}ms`
            : `<${data.response_sla_ms / 1000}s`,
        });
      } catch {
        // Network error or timeout — silently keep fallback values
      }
    };

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
