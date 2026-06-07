/**
 * Static UI configuration.
 *
 * This file contains ONLY the constants the React app needs to render
 * the chrome — range options, palettes, vendor list, etc. All counts,
 * series data, and alerts come from the live WebSocket pipeline at
 * runtime; nothing in here is mock or demo data.
 */
import type {
  AlertTypeRow,
  HealthVendor,
  RangeOption,
  SeverityRow,
} from '../types';

// 14-option time range picker. `6h` is the default (matches what users
// land on after a fresh page load — see App.tsx initial state).
export const RANGE_OPTIONS: RangeOption[] = [
  { key: '5m',  label: 'Last 5 Minutes'  },
  { key: '15m', label: 'Last 15 Minutes' },
  { key: '30m', label: 'Last 30 Minutes' },
  { key: '1h',  label: 'Last 1 Hour'     },
  { key: '3h',  label: 'Last 3 Hours'    },
  { key: '6h',  label: 'Last 6 Hours'    },
  { key: '12h', label: 'Last 12 Hours'   },
  { key: '24h', label: 'Last 24 Hours'   },
  { key: '1d',  label: 'Last 1 Day'      },
  { key: '2d',  label: 'Last 2 Days'     },
  { key: '3d',  label: 'Last 3 Days'     },
  { key: '7d',  label: 'Last 7 Days'     },
  { key: '15d', label: 'Last 15 Days'    },
  { key: '30d', label: 'Last 30 Days'    },
];

// Severity row palette — counts are populated dynamically in App.tsx
// from the live alert stream.
export const SEVERITY_PALETTE: SeverityRow[] = [
  { name: 'Critical',      key: 'critical',      value: 0, color: '#FF4D4F' },
  { name: 'Error',         key: 'error',         value: 0, color: '#FF7A6F' },
  { name: 'Warning',       key: 'warning',       value: 0, color: '#FFB020' },
  { name: 'Notice',        key: 'notice',        value: 0, color: '#FACC15' },
  { name: 'Informational', key: 'informational', value: 0, color: '#4DA3FF' },
];

// Alert-type colour palette — order + colours fixed, counts derived
// from the live alert stream's `category` field.
export const ALERT_TYPE_PALETTE: AlertTypeRow[] = [
  { name: 'Disk failure',           value: 0, color: '#FF4D4F' },
  { name: 'I/O pool threshold',     value: 0, color: '#FF6A00' },
  { name: 'SUM detection',          value: 0, color: '#FACC15' },
  { name: 'Communication error',    value: 0, color: '#4DA3FF' },
  { name: 'Performance disordered', value: 0, color: '#9B5CFF' },
  { name: 'Replication error',      value: 0, color: '#C084FC' },
  { name: 'Hardware error',         value: 0, color: '#22D3EE' },
  { name: 'SFP/SFP+ issue',         value: 0, color: '#EC4899' },
  { name: 'Fan/PSU issue',          value: 0, color: '#00D26A' },
  { name: 'License expired',        value: 0, color: '#64748B' },
  { name: 'NTP',                    value: 0, color: '#00C2FF' },
  { name: 'Others',                 value: 0, color: '#94A3B8' },
];

// Order + per-vendor metadata for the bottom System Health Overview rail.
// counts/criticals/warnings are filled in from the live alert stream in
// App.tsx so badges reflect real listener->Influx->WS data. `dataActive`
// is now overridden at runtime by the heartbeat pipeline; the value here
// is just the cold-start fallback shown for ~10s while the WS opens.
export const HEALTH_VENDORS: HealthVendor[] = [
  { key: 'total',    name: 'Total Systems',    count: 0, critical: 0, warning: 0, iconBg: '#475569', icon: 'total',   dataActive: true },
  { key: 'hitachi',  name: 'Hitachi Storage',  count: 0, critical: 0, warning: 0, iconBg: '#E60012', icon: 'hitachi', dataActive: true },
  { key: 'brocade',  name: 'Brocade Switches', count: 0, critical: 0, warning: 0, iconBg: '#FF1100', icon: 'brocade', dataActive: true },
  { key: 'netapp',   name: 'NetApp Storage',   count: 0, critical: 0, warning: 0, iconBg: '#0067C5', icon: 'netapp',  dataActive: true },
  { key: 'dell',     name: 'Dell Storage',     count: 0, critical: 0, warning: 0, iconBg: '#0085C3', icon: 'dell',    dataActive: true },
];

// Placeholder NTP last-sync label until the NTP-specific feed is wired up.
export const NTP_LAST_SYNC = '12:00:49 PM';
