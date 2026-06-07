/**
 * Direct InfluxDB query layer — authoritative source for every dashboard
 * card. Cards call these functions on mount + on every range / location
 * change + on WS-triggered refresh. Returns are fully-aggregated objects
 * shaped for the UI, not raw rows.
 *
 * Architecture:
 *   - 11 buckets across 3 sites (CDVL / BCP / SIFY) x 4 vendors.
 *     In dev each bucket is on its own InfluxDB instance reachable via
 *     a vite proxy path; in production the same paths are served by
 *     server.py's reverse-proxy routes.
 *   - Every function fans out one query per relevant bucket in parallel
 *     and merges, so the dashboard isn't gated on the slowest pipeline.
 *   - Browser-side queries use vite/FastAPI proxies (`/influx-{vendor}-{site}`)
 *     to avoid CORS; production puts the same paths behind nginx.
 *
 * Mirrors the v1.x pattern from the user's spec but adapted to the
 * v2 multi-bucket topology.
 */
import { InfluxDB } from '@influxdata/influxdb-client';
import type { RangeKey, TimeRange, Severity, Vendor, Location } from '../types';

// ---------------------------------------------------------------------------
// Bucket topology
// ---------------------------------------------------------------------------
export type SiteKey   = Location;            // 'CDVL' | 'BCP' | 'SIFY'
export type VendorKey = Vendor;              // 'hitachi' | 'brocade' | 'netapp' | 'dell'

interface BucketTarget {
  key:        string;                        // stable identifier (used as Map key)
  site:       SiteKey;
  vendor:     VendorKey;
  url:        string;                        // vite proxy path (e.g. '/influx-hitachi-cdvl')
  token:      string;
  org:        string;
  bucket:     string;
  placeholder: boolean;                      // skip queries if true
}

const env = import.meta.env as Record<string, string | undefined>;

const T = (
  envUrl: string | undefined,
  fallbackUrl: string,
  envToken: string | undefined,
  fallbackToken: string,
  envBucket: string | undefined,
  fallbackBucket: string,
): { url: string; token: string; bucket: string } => ({
  url:    envUrl    ?? fallbackUrl,
  token:  envToken  ?? fallbackToken,
  bucket: envBucket ?? fallbackBucket,
});

// One BucketTarget per (site, vendor). Dev defaults route through the
// FastAPI reverse-proxy at `/api/influx-proxy/{site}/{vendor}` which is
// registered as a pass-through to the per-bucket Influx instance on the
// matching localhost port. Production overrides via VITE_INFLUX_* env.
function mkTargets(): BucketTarget[] {
  const list: BucketTarget[] = [
    // ---- Hitachi (real data on all 3 sites) ---------------------------
    {
      key: 'CDVL_hitachi', site: 'CDVL', vendor: 'hitachi',
      ...T(env.VITE_INFLUX_CDVL_URL,    '/influx',
           env.VITE_INFLUX_CDVL_TOKEN,  'unifiedops-dev-token-cdvl',
           env.VITE_INFLUX_CDVL_BUCKET, 'Hitachi_CDVL_Bucket'),
      org: env.VITE_INFLUX_CDVL_ORG ?? 'HDFC',
      placeholder: false,
    },
    {
      key: 'BCP_hitachi', site: 'BCP', vendor: 'hitachi',
      ...T(env.VITE_INFLUX_BCP_URL,    '/influx-bcp',
           env.VITE_INFLUX_BCP_TOKEN,  'unifiedops-dev-token-bcp',
           env.VITE_INFLUX_BCP_BUCKET, 'Hitachi_BCP_Bucket'),
      org: env.VITE_INFLUX_BCP_ORG ?? 'HDFC',
      placeholder: false,
    },
    {
      key: 'SIFY_hitachi', site: 'SIFY', vendor: 'hitachi',
      ...T(env.VITE_INFLUX_SIFY_URL,    '/influx-sify',
           env.VITE_INFLUX_SIFY_TOKEN,  'unifiedops-dev-token-sify',
           env.VITE_INFLUX_SIFY_BUCKET, 'Hitachi_SIFY_Bucket'),
      org: env.VITE_INFLUX_SIFY_ORG ?? 'HDFC',
      placeholder: false,
    },
    // ---- Brocade (real data on 2 sites) -------------------------------
    {
      key: 'CDVL_brocade', site: 'CDVL', vendor: 'brocade',
      url:    '/api/influx-bucket/CDVL/brocade',
      token:  'unifiedops-dev-token-brocade-cdvl',
      org:    'HDFC',
      bucket: 'Brocade_CDVL_Bucket',
      placeholder: false,
    },
    {
      key: 'BCP_brocade', site: 'BCP', vendor: 'brocade',
      url:    '/api/influx-bucket/BCP/brocade',
      token:  'unifiedops-dev-token-brocade-bcp',
      org:    'HDFC',
      bucket: 'Brocade_BCP_Bucket',
      placeholder: false,
    },
    // ---- NetApp + Dell (placeholders until real listeners ship) -------
    {
      key: 'CDVL_netapp', site: 'CDVL', vendor: 'netapp',
      url: '/api/influx-bucket/CDVL/netapp',
      token: 'unifiedops-dev-token-netapp-cdvl', org: 'HDFC',
      bucket: 'NetApp_CDVL_Bucket', placeholder: false,
    },
    {
      key: 'BCP_netapp', site: 'BCP', vendor: 'netapp',
      url: '/api/influx-bucket/BCP/netapp',
      token: 'unifiedops-dev-token-netapp-bcp', org: 'HDFC',
      bucket: 'NetApp_BCP_Bucket', placeholder: false,
    },
    {
      key: 'SIFY_netapp', site: 'SIFY', vendor: 'netapp',
      url: '/api/influx-bucket/SIFY/netapp',
      token: 'unifiedops-dev-token-netapp-sify', org: 'HDFC',
      bucket: 'NetApp_SIFY_Bucket', placeholder: false,
    },
    {
      key: 'CDVL_dell', site: 'CDVL', vendor: 'dell',
      url: '/api/influx-bucket/CDVL/dell',
      token: 'unifiedops-dev-token-dell-cdvl', org: 'HDFC',
      bucket: 'Dell_CDVL_Bucket', placeholder: false,
    },
    {
      key: 'BCP_dell', site: 'BCP', vendor: 'dell',
      url: '/api/influx-bucket/BCP/dell',
      token: 'unifiedops-dev-token-dell-bcp', org: 'HDFC',
      bucket: 'Dell_BCP_Bucket', placeholder: false,
    },
    {
      key: 'SIFY_dell', site: 'SIFY', vendor: 'dell',
      url: '/api/influx-bucket/SIFY/dell',
      token: 'unifiedops-dev-token-dell-sify', org: 'HDFC',
      bucket: 'Dell_SIFY_Bucket', placeholder: false,
    },
  ];
  return list;
}

const BUCKET_TARGETS: BucketTarget[] = mkTargets();

// Per-bucket InfluxDB client cache. Keyed by `url` because we don't want
// to spawn multiple clients for the same physical endpoint.
const _clients = new Map<string, InfluxDB>();
function clientFor(t: BucketTarget): InfluxDB {
  let c = _clients.get(t.url);
  if (!c) {
    c = new InfluxDB({ url: t.url, token: t.token });
    _clients.set(t.url, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------
const REL_MS: Record<RangeKey, number> = {
  '5m':  300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h':  3_600_000,
  '3h':  10_800_000,
  '6h':  21_600_000,
  '12h': 43_200_000,
  '24h': 86_400_000,
  '1d':  86_400_000,
  '2d':  172_800_000,
  '3d':  259_200_000,
  '7d':  604_800_000,
  '15d': 1_296_000_000,
  '30d': 2_592_000_000,
};

export function rangeDurationMs(r: TimeRange): number {
  if (r.kind === 'relative') return REL_MS[r.key];
  return new Date(r.stop).getTime() - new Date(r.start).getTime();
}

function rangeClause(r: TimeRange): string {
  if (r.kind === 'relative') return `start: -${r.key}`;
  return `start: ${r.start}, stop: ${r.stop}`;
}

function bucketWindow(r: TimeRange, target: number): string {
  const ms = Math.max(1_000, Math.floor(rangeDurationMs(r) / target));
  if (ms >= 86_400_000) return `${Math.max(1, Math.round(ms / 86_400_000))}d`;
  if (ms >= 3_600_000)  return `${Math.max(1, Math.round(ms / 3_600_000))}h`;
  if (ms >= 60_000)     return `${Math.max(1, Math.round(ms / 60_000))}m`;
  return `${Math.max(1, Math.round(ms / 1_000))}s`;
}

// ---------------------------------------------------------------------------
// Filtering — which buckets a query should touch
// ---------------------------------------------------------------------------
export interface QueryScope {
  sites?:   SiteKey[];                       // default = all 3
  vendors?: VendorKey[];                     // default = all 4
}

function scopedTargets(scope?: QueryScope): BucketTarget[] {
  const sites   = scope?.sites;
  const vendors = scope?.vendors;
  return BUCKET_TARGETS.filter(t => {
    if (t.placeholder) return false;
    if (sites && !sites.includes(t.site))     return false;
    if (vendors && !vendors.includes(t.vendor)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Low-level run — one Flux query against ONE bucket
// ---------------------------------------------------------------------------
async function runQueryAt<T = Record<string, any>>(
  t: BucketTarget,
  flux: string,
): Promise<T[]> {
  if (t.placeholder) return [];
  const api = clientFor(t).getQueryApi(t.org);
  const rows: T[] = [];
  try {
    for await (const { values, tableMeta } of api.iterateRows(flux)) {
      rows.push(tableMeta.toObject(values) as T);
    }
  } catch (err) {
    // Don't blank the dashboard for one bucket — log and continue.
    // eslint-disable-next-line no-console
    console.warn(`influx query failed on ${t.key}:`, err);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Severity normalization — matches alert_monitor.py::_normalize_severity
// ---------------------------------------------------------------------------
export function bucketSeverity(raw: string | undefined | null): Severity {
  const s = (raw || '').toLowerCase();
  if (['emergency', 'alert', 'critical', 'acute'].includes(s)) return 'critical';
  if (['error', 'err', 'serious', 'failure'].includes(s))      return 'error';
  if (['warning', 'warn', 'moderate'].includes(s))             return 'warning';
  if (['notice', 'note', 'service'].includes(s))               return 'notice';
  return 'informational';
}

// ---------------------------------------------------------------------------
// Per-bucket measurement filter
// ---------------------------------------------------------------------------
// Each vendor's listener writes a different measurement; we filter generously
// to ignore heartbeat rows and accept any of the known event measurements.
const MEASUREMENT_FILTER =
  `r._measurement != "syslog_listener_heartbeat"`;

// The Hitachi listener writes both 'message' and 'raw_message' for every
// trap (it duplicates intentionally for older Hi-Track readers). Counting
// on ONLY 'raw_message' (the field the user's v1 used) prevents double-
// counting; for NetApp/Dell which write 'preview' we add it as alternative.
const COUNT_FIELD_FILTER =
  `r._field == "raw_message" or r._field == "preview"`;

// ---------------------------------------------------------------------------
// 1. Total alerts
// ---------------------------------------------------------------------------
export async function getTotalAlerts(
  r: TimeRange, scope?: QueryScope,
): Promise<number> {
  const targets = scopedTargets(scope);
  const counts  = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${COUNT_FIELD_FILTER})
        |> group()
        |> count()
    `;
    const rows = await runQueryAt<{ _value: number }>(t, flux);
    return rows[0]?._value ?? 0;
  }));
  return counts.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// 2. Alert trend — bucketed time series for the area chart.
// ---------------------------------------------------------------------------
export interface TrendBucket { ts: number; value: number; label: string }

export async function getAlertTrend(
  r: TimeRange, scope?: QueryScope, target = 25,
): Promise<TrendBucket[]> {
  const win = bucketWindow(r, target);
  const targets = scopedTargets(scope);
  const dur = rangeDurationMs(r);
  const series = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${COUNT_FIELD_FILTER})
        |> aggregateWindow(every: ${win}, fn: count, createEmpty: true)
        |> fill(value: 0)
        |> keep(columns: ["_time", "_value"])
    `;
    return runQueryAt<{ _time: string; _value: number }>(t, flux);
  }));

  // Merge bucket counts by _time across all buckets.
  const merged = new Map<string, number>();
  for (const rows of series) {
    for (const row of rows) {
      merged.set(row._time, (merged.get(row._time) ?? 0) + (row._value || 0));
    }
  }

  const out: TrendBucket[] = [];
  const sortedTimes = Array.from(merged.keys()).sort();
  for (const time of sortedTimes) {
    const d = new Date(time);
    let label = '';
    if (dur <= 21_600_000) {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (dur <= 86_400_000) {
      label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      label = `${d.toLocaleString([], { month: 'short' })} ${d.getDate()}`;
    }
    out.push({ ts: d.getTime(), value: merged.get(time) ?? 0, label });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Severity breakdown
// ---------------------------------------------------------------------------
export type SeverityBreakdown = Record<Severity, number>;

export async function getSeverityBreakdown(
  r: TimeRange, scope?: QueryScope,
): Promise<SeverityBreakdown> {
  const targets = scopedTargets(scope);
  const buckets: SeverityBreakdown = {
    critical: 0, error: 0, warning: 0, notice: 0, informational: 0,
  };
  const allRows = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${COUNT_FIELD_FILTER})
        |> group(columns: ["severity"])
        |> count()
        |> keep(columns: ["severity", "_value"])
    `;
    return runQueryAt<{ severity?: string; _value: number }>(t, flux);
  }));
  for (const rows of allRows) {
    for (const row of rows) {
      const sev = bucketSeverity(row.severity);
      buckets[sev] += row._value || 0;
    }
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// 4. Alert-type (trap_category) breakdown
// ---------------------------------------------------------------------------
export type CategoryBreakdown = Record<string, number>;

export async function getAlertTypeBreakdown(
  r: TimeRange, scope?: QueryScope,
): Promise<CategoryBreakdown> {
  const targets = scopedTargets(scope);
  const out: CategoryBreakdown = {};
  const allRows = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${COUNT_FIELD_FILTER})
        |> filter(fn: (r) => exists r.trap_category
                          and r.trap_category != "none"
                          and r.trap_category != "unknown")
        |> group(columns: ["trap_category"])
        |> count()
        |> keep(columns: ["trap_category", "_value"])
    `;
    return runQueryAt<{ trap_category?: string; _value: number }>(t, flux);
  }));
  for (const rows of allRows) {
    for (const row of rows) {
      const cat = row.trap_category ?? 'other';
      out[cat] = (out[cat] ?? 0) + (row._value || 0);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Top systems
// ---------------------------------------------------------------------------
export interface TopSystemRow {
  name:     string;
  alerts:   number;
  location: SiteKey;
  vendor:   VendorKey;
}

export async function getTopSystems(
  r: TimeRange, scope?: QueryScope, limit = 50,
): Promise<TopSystemRow[]> {
  const targets = scopedTargets(scope);
  const allRows = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${COUNT_FIELD_FILTER})
        |> filter(fn: (r) => exists r.array_name and r.array_name != "unknown")
        |> group(columns: ["array_name"])
        |> count()
        |> keep(columns: ["array_name", "_value"])
    `;
    const rows = await runQueryAt<{ array_name?: string; _value: number }>(t, flux);
    return rows.map(row => ({
      name: row.array_name ?? '-',
      alerts: row._value || 0,
      location: t.site,
      vendor:   t.vendor,
    } as TopSystemRow));
  }));
  return allRows.flat()
    .filter(r => r.alerts > 0)
    .sort((a, b) => b.alerts - a.alerts)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 6. Recent critical alerts — used by the RecentCriticalAlerts card
//    and (with limit=1000) by the full alert-details modal.
// ---------------------------------------------------------------------------
export interface DetailedAlert {
  ts:          number;          // epoch ms
  time:        string;          // formatted local
  iso:         string;
  storageName: string;
  ip:          string;
  severity:    Severity;
  category:    string;
  event:       string;
  location:    SiteKey;
  vendor:      VendorKey;
}

const SEVERITY_FILTER = `(
     r.severity == "critical" or r.severity == "Critical"
  or r.severity == "emergency" or r.severity == "Emergency"
  or r.severity == "alert"   or r.severity == "Alert"
  or r.severity == "acute"   or r.severity == "Acute"
  or r.severity == "error"   or r.severity == "Error"
  or r.severity == "serious" or r.severity == "Serious"
  or r.severity == "warning" or r.severity == "Warning"
  or r.severity == "warn"
  or r.severity == "moderate" or r.severity == "Moderate"
  or r.severity == "notice"  or r.severity == "Notice"
  or r.severity == "service" or r.severity == "Service"
  or r.severity == "info"    or r.severity == "informational" or r.severity == "Info"
)`;

export async function getRecentAlerts(
  r: TimeRange, scope?: QueryScope, limit = 50,
): Promise<DetailedAlert[]> {
  const targets = scopedTargets(scope);
  const perBucketLimit = Math.max(5, Math.min(2000, Math.ceil(limit * 2 / Math.max(1, targets.length))));
  const allRows = await Promise.all(targets.map(async t => {
    const flux = `
      from(bucket: "${t.bucket}")
        |> range(${rangeClause(r)})
        |> filter(fn: (r) => ${MEASUREMENT_FILTER})
        |> filter(fn: (r) => ${SEVERITY_FILTER})
        |> filter(fn: (r) => r._field == "message" or r._field == "preview" or r._field == "raw_message")
        |> pivot(
            rowKey:    ["_time", "source_ip", "severity", "trap_category", "array_name", "switch_name", "vendor"],
            columnKey: ["_field"],
            valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${perBucketLimit})
    `;
    type Row = {
      _time: string; source_ip?: string; severity?: string;
      trap_category?: string; array_name?: string;
      switch_name?: string; vendor?: string;
      message?: string; preview?: string; raw_message?: string;
    };
    const rows = await runQueryAt<Row>(t, flux);
    return rows.map(row => {
      const d = new Date(row._time);
      const pad = (n: number) => String(n).padStart(2, '0');
      const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const storage =
        row.array_name && row.array_name !== 'unknown' ? row.array_name :
        row.switch_name ? row.switch_name :
        row.source_ip ?? '-';
      return {
        ts:          d.getTime(),
        time,
        iso:         row._time,
        storageName: storage,
        ip:          row.source_ip ?? '-',
        severity:    bucketSeverity(row.severity),
        category:    row.trap_category && row.trap_category !== 'none' ? row.trap_category : 'other',
        event:       row.message ?? row.preview ?? row.raw_message ?? '-',
        location:    t.site,
        vendor:      t.vendor,
      } as DetailedAlert;
    });
  }));
  return allRows.flat()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// 7. Composite "everything for the dashboard" — one round-trip drives
//    every card, used by the queries store.
// ---------------------------------------------------------------------------
export interface DashboardSnapshot {
  total:      number;
  severity:   SeverityBreakdown;
  categories: CategoryBreakdown;
  topSystems: TopSystemRow[];
  trend:      TrendBucket[];
  recent:     DetailedAlert[];
}

export async function getDashboardSnapshot(
  r: TimeRange, scope?: QueryScope,
): Promise<DashboardSnapshot> {
  const [total, severity, categories, topSystems, trend, recent] = await Promise.all([
    getTotalAlerts        (r, scope),
    getSeverityBreakdown  (r, scope),
    getAlertTypeBreakdown (r, scope),
    getTopSystems         (r, scope, 50),
    getAlertTrend         (r, scope),
    getRecentAlerts       (r, scope, 200),
  ]);
  return { total, severity, categories, topSystems, trend, recent };
}
