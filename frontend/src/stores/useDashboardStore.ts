import { create } from 'zustand';
import type { Severity, Vendor, Location, RecentAlert } from '../types';

/**
 * Dashboard data store.
 *
 * Fed exclusively by the WS connector — every payload comes from the
 * `/ws/dashboard` channel. The store keeps:
 *
 *   - `snapshot` : the most recent dashboard aggregation pushed by the
 *                  backend's DashboardBroadcaster
 *   - the current subscription parameters (range / sites / vendors)
 *
 * Cards select `snapshot.*` directly; the WS connector calls
 * `setSubscription` whenever the user changes range or location so the
 * backend can update its per-client subscription key.
 */

export interface TrendBucket {
  ts:    number;
  value: number;
  label: string;
}

export interface TopSystemRow {
  name:     string;
  alerts:   number;
  location: Location;
  vendor:   Vendor;
}

export interface DeviceVendorCounts {
  total:    number;
  alerting: number;
  by_site?: Record<string, { total: number; alerting: number }>;
}

export interface DevicesSnapshot {
  range?:          string;
  vendors:         Record<string, DeviceVendorCounts>;
  grand_total:     number;
  grand_alerting:  number;
}

export interface DashboardSnapshot {
  total:      number;
  severity:   Record<Severity, number>;
  categories: Record<string, number>;
  topSystems: TopSystemRow[];
  trend:      TrendBucket[];
  recent:     RecentAlert[];
  devices?:   DevicesSnapshot;
  range?:     string;
  sites?:     string[];
  vendors?:   string[];
  as_of?:     number;
  elapsed_ms?: number;
}

export interface SubscriptionParams {
  range:   string;
  sites:   string[];
  vendors: string[];
}

export interface DashboardState {
  snapshot:     DashboardSnapshot | null;
  subscription: SubscriptionParams;
  lastPush:     number;
  hydrated:     boolean;

  ingest: (snap: DashboardSnapshot) => void;
  setSubscription: (params: SubscriptionParams) => void;
  reset:  () => void;
}

const EMPTY_SEV: Record<Severity, number> = {
  critical: 0, error: 0, warning: 0, notice: 0, informational: 0,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  snapshot:     null,
  subscription: { range: '6h', sites: [], vendors: [] },
  lastPush:     0,
  hydrated:     false,

  ingest: (snap) => set({
    snapshot: {
      total:      snap.total      ?? 0,
      severity:   { ...EMPTY_SEV, ...(snap.severity ?? {}) },
      categories: snap.categories ?? {},
      topSystems: snap.topSystems ?? [],
      trend:      snap.trend      ?? [],
      recent:     snap.recent     ?? [],
      range:      snap.range,
      sites:      snap.sites,
      vendors:    snap.vendors,
      as_of:      snap.as_of,
      elapsed_ms: snap.elapsed_ms,
    },
    lastPush: Date.now(),
    hydrated: true,
  }),

  setSubscription: (params) => set({ subscription: params }),

  reset: () => set({ snapshot: null, hydrated: false }),
}));
