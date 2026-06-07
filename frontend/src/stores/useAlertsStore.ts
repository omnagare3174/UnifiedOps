import { create } from 'zustand';
import type { RecentAlert } from '../types';
import type { WsStatus } from '../hooks/useWebSocket';

/**
 * Single source of truth for the live alert feed.
 *
 * Replaces the previous dual-state setup (React hook snapshot + local
 * App.tsx state) which caused the hydrate-without-render bug — when a
 * trap was sent the WS frame arrived but only some pieces of derived
 * state were getting updated.
 *
 * The store is updated EXCLUSIVELY by the WS connector
 * (`src/lib/wsConnector.ts`); UI components read with selectors and
 * never mutate directly.
 */

export interface BucketStatus {
  site:   string;
  vendor: string;
  bucket: string;
  ok:     boolean;
  count:  number;
  error:  string | null;
}

export interface AlertsState {
  // -- Server payload ----------------------------------------------------
  alerts:        RecentAlert[];
  bucketStatus:  BucketStatus[];
  bucketsOk:     number;
  bucketsTotal:  number;
  asOf:          number;
  pollInterval:  number;

  // -- Local connection state -------------------------------------------
  wsStatus:      WsStatus;
  statusSince:   number;
  lastMessageAt: number;

  // -- Internal cursor — strictly-newer detection for toast/blink -------
  maxTs:         number;

  // -- Actions -----------------------------------------------------------
  ingestHydrate: (frame: HydrateFrame) => RecentAlert[];
  ingestAlerts:  (frame: AlertsFrame)  => RecentAlert[];
  ingestHealth:  (frame: HealthFrame)  => void;
  setWsStatus:   (s: WsStatus) => void;
  notePing:      () => void;
  reset:         () => void;
}

export interface HydrateFrame {
  type:          'hydrate';
  ok?:           boolean;
  as_of?:        number;
  poll_interval?: number;
  buckets_total?: number;
  buckets_ok?:    number;
  count?:        number;
  alerts?:       RecentAlert[];
  bucket_status?: BucketStatus[];
}

export interface AlertsFrame {
  type:    'alerts';
  alerts:  RecentAlert[];
}

export interface HealthFrame {
  type:          'health';
  ok?:           boolean;
  as_of?:        number;
  poll_interval?: number;
  buckets_ok?:    number;
  buckets_total?: number;
  bucket_status?: BucketStatus[];
}

const MAX_BUFFER = 500;

const alertKey = (a: RecentAlert) =>
  `${a.ts}|${a.storageName}|${a.event}|${a.severity}`;

/**
 * Merge `incoming` with `existing`, dedupe (keeping the freshest of any
 * duplicate by ts/storage/event/severity tuple) and cap at MAX_BUFFER.
 * Sorted newest-first.
 */
function mergeAlerts(existing: RecentAlert[], incoming: RecentAlert[]): RecentAlert[] {
  if (incoming.length === 0) return existing;
  const seen = new Set<string>();
  const out: RecentAlert[] = [];
  // Sort all rows newest-first, then walk so the first occurrence of a
  // key (i.e. the freshest) wins.
  const all = [...incoming, ...existing].sort((a, b) => b.ts - a.ts);
  for (const a of all) {
    const k = alertKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= MAX_BUFFER) break;
  }
  return out;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts:        [],
  bucketStatus:  [],
  bucketsOk:     0,
  bucketsTotal:  0,
  asOf:          0,
  pollInterval:  5,
  wsStatus:      'connecting',
  statusSince:   Date.now(),
  lastMessageAt: 0,
  maxTs:         0,

  ingestHydrate: (frame) => {
    const fresh = (frame.alerts ?? []);
    const newMax = fresh.reduce((m, a) => Math.max(m, a.ts), 0);
    set({
      alerts:        mergeAlerts([], fresh),
      bucketStatus:  frame.bucket_status ?? [],
      bucketsOk:     frame.buckets_ok    ?? 0,
      bucketsTotal:  frame.buckets_total ?? 0,
      asOf:          frame.as_of         ?? Date.now() / 1000,
      pollInterval:  frame.poll_interval ?? 5,
      maxTs:         newMax,
      lastMessageAt: Date.now(),
    });
    // Hydrate never raises onNewAlerts — toast/blink should not replay
    // for buffer rows that arrived before the page refresh.
    return [];
  },

  ingestAlerts: (frame) => {
    const fresh = frame.alerts ?? [];
    if (fresh.length === 0) {
      set({ lastMessageAt: Date.now() });
      return [];
    }
    const prev    = get().alerts;
    const prevMax = get().maxTs;
    const merged  = mergeAlerts(prev, fresh);
    // "Truly new" = ts strictly above the previous high-water mark; this
    // is what fires toast / screen blink.
    const trulyNew = fresh
      .filter(a => a.ts > prevMax)
      .sort((a, b) => a.ts - b.ts);
    const newMax = Math.max(prevMax, ...fresh.map(a => a.ts));
    set({
      alerts:        merged,
      maxTs:         newMax,
      lastMessageAt: Date.now(),
    });
    return trulyNew;
  },

  ingestHealth: (frame) => {
    set({
      bucketStatus:  frame.bucket_status ?? get().bucketStatus,
      bucketsOk:     frame.buckets_ok    ?? get().bucketsOk,
      bucketsTotal:  frame.buckets_total ?? get().bucketsTotal,
      asOf:          frame.as_of         ?? get().asOf,
      lastMessageAt: Date.now(),
    });
  },

  setWsStatus: (s) => {
    if (get().wsStatus === s) return;
    set({ wsStatus: s, statusSince: Date.now() });
  },

  notePing: () => set({ lastMessageAt: Date.now() }),

  reset: () => set({
    alerts: [], bucketStatus: [], bucketsOk: 0, bucketsTotal: 0,
    asOf: 0, maxTs: 0,
  }),
}));
