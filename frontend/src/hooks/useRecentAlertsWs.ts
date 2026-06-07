import { useRef, useState } from 'react';
import { useWebSocket, type WsStatus } from './useWebSocket';
import type { RecentAlert } from '../types';
import type { BucketStatus, RecentAlertsSnapshot } from './useRecentAlerts';

export type { BucketStatus, RecentAlertsSnapshot };

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

interface ServerFrame {
  type?:          string;
  ok?:            boolean;
  as_of?:         number;
  poll_interval?: number;
  buckets_total?: number;
  buckets_ok?:    number;
  count?:         number;
  alerts?:        RecentAlert[];
  bucket_status?: BucketStatus[];
}

interface Options {
  url?:        string;
  enabled?:    boolean;
  maxBuffer?:  number;
  onNewAlerts?: (fresh: RecentAlert[]) => void;
}

/**
 * WS-driven version of `useRecentAlerts`. Subscribes to `/ws/alerts`,
 * which sends:
 *
 *   - a `hydrate` frame on connect (full rolling buffer + bucket status)
 *   - an `alerts` frame on every tick that has fresh rows
 *   - a `health` frame on every tick (so the UI knows we're still alive
 *     even when no new alerts are flowing)
 *
 * `onNewAlerts` fires only with strictly-new rows so toast / blink
 * effects don't replay on every health frame.
 */
export function useRecentAlertsWs({
  url       = '/ws/alerts',
  enabled   = true,
  maxBuffer = 200,
  onNewAlerts,
}: Options = {}) {
  const [snapshot, setSnapshot] = useState<RecentAlertsSnapshot>(EMPTY);
  const cbRef    = useRef(onNewAlerts);
  cbRef.current  = onNewAlerts;
  const maxTsRef = useRef(0);

  const ws = useWebSocket<ServerFrame>({
    url,
    enabled,
    onMessage: (frame) => {
      if (!frame) return;
      switch (frame.type) {
        case 'hydrate': {
          const alerts = (frame.alerts ?? []).slice(0, maxBuffer);
          if (alerts.length > 0) {
            maxTsRef.current = Math.max(...alerts.map(a => a.ts));
          }
          setSnapshot({
            ok:            !!frame.ok,
            as_of:         frame.as_of ?? Date.now() / 1000,
            count:         alerts.length,
            buckets_ok:    frame.buckets_ok    ?? 0,
            buckets_total: frame.buckets_total ?? 0,
            elapsed_ms:    0,
            alerts,
            bucket_status: frame.bucket_status ?? [],
          });
          break;
        }
        case 'alerts': {
          const fresh = frame.alerts ?? [];
          if (fresh.length === 0) return;
          // Sort oldest -> newest for the consumer; the server delivers
          // newest-first to make `alerts.slice(0, N)` cheap on the React
          // side, but the toast callback expects arrival order.
          const forCb = [...fresh].sort((a, b) => a.ts - b.ts);
          const trulyNew = forCb.filter(a => a.ts > maxTsRef.current);
          if (cbRef.current && trulyNew.length > 0) {
            cbRef.current(trulyNew);
          }
          if (trulyNew.length > 0) {
            maxTsRef.current = trulyNew[trulyNew.length - 1].ts;
          }
          setSnapshot(prev => {
            const merged = [...fresh, ...prev.alerts]
              .filter((a, i, arr) =>
                arr.findIndex(b =>
                  b.ts === a.ts && b.storageName === a.storageName && b.event === a.event,
                ) === i,
              )
              .sort((x, y) => y.ts - x.ts)
              .slice(0, maxBuffer);
            return { ...prev, alerts: merged, count: merged.length };
          });
          break;
        }
        case 'health': {
          // Keep the bucket-status surface fresh so the WS-disconnect
          // modal can distinguish "backend healthy / pipeline degraded"
          // from "WS dead".
          setSnapshot(prev => ({
            ...prev,
            ok:            !!frame.ok,
            as_of:         frame.as_of ?? prev.as_of,
            buckets_ok:    frame.buckets_ok    ?? prev.buckets_ok,
            buckets_total: frame.buckets_total ?? prev.buckets_total,
            bucket_status: frame.bucket_status ?? prev.bucket_status,
          }));
          break;
        }
        default:
          break;
      }
    },
  });

  return {
    snapshot,
    wsStatus:      ws.status as WsStatus,
    statusSince:   ws.statusSince,
    lastMessageAt: ws.lastMessageAt,
  };
}
