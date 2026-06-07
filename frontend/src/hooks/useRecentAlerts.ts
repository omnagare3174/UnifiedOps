import { useEffect, useRef, useState } from 'react';
import type { RecentAlert } from '../types';

export interface BucketStatus {
  site:   string;
  vendor: string;
  bucket: string;
  ok:     boolean;
  count:  number;
  error:  string | null;
}

export interface RecentAlertsSnapshot {
  ok:             boolean;
  as_of:          number;
  count:          number;
  buckets_ok:     number;
  buckets_total:  number;
  elapsed_ms:     number;
  alerts:         RecentAlert[];
  bucket_status:  BucketStatus[];
}

const EMPTY: RecentAlertsSnapshot = {
  ok:            false,
  as_of:         0,
  count:         0,
  buckets_ok:    0,
  buckets_total: 0,
  elapsed_ms:    0,
  alerts:        [],
  bucket_status: [],
};

interface Options {
  url?:        string;
  pollMs?:     number;
  limit?:      number;
  lookbackS?:  number;
  perBucket?:  number;
  onNewAlerts?: (fresh: RecentAlert[]) => void;
}

/**
 * Polls the backend `/api/alerts/recent` endpoint which aggregates all 11
 * vendor InfluxDB buckets into one merged, time-sorted list. Replaces the
 * in-browser `buildLiveAlert()` simulator with real listener data.
 *
 * `onNewAlerts` fires only with rows whose ts is strictly newer than the
 * previous max ts, so toast / screen-blink animations only trigger for
 * actually-new traps.
 */
export function useRecentAlerts({
  url        = '/api/alerts/recent',
  pollMs     = 4000,
  limit      = 200,
  lookbackS  = 21600,
  perBucket  = 50,
  onNewAlerts,
}: Options = {}) {
  const [snapshot, setSnapshot] = useState<RecentAlertsSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const maxTsRef = useRef(0);
  // Stash the callback in a ref so the effect doesn't re-run every time the
  // parent re-renders with a fresh closure.
  const cbRef    = useRef(onNewAlerts);
  cbRef.current  = onNewAlerts;

  useEffect(() => {
    aliveRef.current = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const q = `?limit=${limit}&lookback_s=${lookbackS}&per_bucket=${perBucket}`;
        const r = await fetch(`${url}${q}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as RecentAlertsSnapshot;
        if (!aliveRef.current) return;

        setSnapshot(data);
        setError(null);

        // Surface only freshly-arrived alerts to the caller.
        if (cbRef.current && Array.isArray(data.alerts)) {
          const prevMax = maxTsRef.current;
          const fresh = data.alerts.filter(a => a.ts > prevMax);
          if (fresh.length > 0) {
            // Sort oldest -> newest so the consumer sees them in arrival order
            fresh.sort((a, b) => a.ts - b.ts);
            cbRef.current(fresh);
            maxTsRef.current = fresh[fresh.length - 1].ts;
          } else if (data.alerts.length > 0) {
            // Seed the max on the very first poll so subsequent ticks only
            // emit genuinely-new rows.
            if (prevMax === 0) {
              maxTsRef.current = data.alerts[0].ts;
            }
          }
        }
      } catch (e) {
        if (!aliveRef.current) return;
        setError((e as Error).message);
      } finally {
        if (aliveRef.current) {
          timer = window.setTimeout(tick, pollMs);
        }
      }
    };

    tick();

    return () => {
      aliveRef.current = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [url, pollMs, limit, lookbackS, perBucket]);

  return { snapshot, error };
}
