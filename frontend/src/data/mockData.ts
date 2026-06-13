import type {
  AlertTypeRow,
  HealthVendor,
  Location,
  RangeOption,
  RecentAlert,
  SeverityRow,
  SystemRow,
  Vendor,
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
  { key: '2d',  label: 'Last 2 Days'     },
  { key: '3d',  label: 'Last 3 Days'     },
  { key: '7d',  label: 'Last 7 Days'     },
  { key: '15d', label: 'Last 15 Days'    },
  { key: '30d', label: 'Last 30 Days'    },
];

// Severity row palette — counts are filled in dynamically from live alerts.
export const SEVERITY_PALETTE: SeverityRow[] = [
  { name: 'Critical',      key: 'critical',      value: 0, color: '#FF4D4F' },
  { name: 'Error',         key: 'error',         value: 0, color: '#FF7A6F' },
  { name: 'Warning',       key: 'warning',       value: 0, color: '#FFB020' },
  { name: 'Notice',        key: 'notice',        value: 0, color: '#FACC15' },
  { name: 'Informational', key: 'informational', value: 0, color: '#4DA3FF' },
];

// Alert-type colour palette — order + colours fixed, counts derived from alerts.
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
  { name: 'Others',                 value: 0, color: '#475569' },
];

// Legacy exports for files that still import SEVERITY_DATA / ALERT_TYPE_DATA.
// These are now empty starting points; the real values come from the live
// alerts state in App.tsx.
export const SEVERITY_DATA   = SEVERITY_PALETTE;
export const ALERT_TYPE_DATA = ALERT_TYPE_PALETTE;

// Top systems are derived live from the alerts stream; nothing is hard-coded.
export const TOP_SYSTEMS: SystemRow[] = [];

const STORAGE_IPS: Record<string, string> = {
  // Hitachi
  'VSP_5500_30260-BCP':    '10.225.39.253',
  'VSP_5200_30240-BCP':    '10.225.19.254',
  'VSP_G1000_44571-B-BCP': '10.65.4.112',
  'VSP_G350_45388-CDVL':   '10.227.60.189',
  'VSP_E1090_71390-CDVL':  '10.227.68.117',
  'VSP_5600_40350-CDVL':   '10.227.63.5',
  'VSP_E1090_71333-CDVL':  '10.229.230.232',
  'VSP_F900_4184074-CDVL': '10.227.61.50',
  'VSP_5100_31049-SIFY':   '10.226.63.1',
  'VSP_5500_30648-SIFY':   '10.226.63.2',
  'VSP_G700_41207-SIFY':   '10.226.63.3',
  'VSP_E790_43012-SIFY':   '10.226.63.10',
  // NetApp
  'AFF_A800_4112-BCP':     '10.225.40.12',
  'FAS_8200_4187-CDVL':    '10.227.62.18',
  'AFF_C400_2210-SIFY':    '10.226.64.10',
  'AFF_A400_2211-SIFY':    '10.226.64.11',
  // Dell EMC
  'PowerStore_5000-BCP':   '10.225.41.50',
  'PowerMax_8500-CDVL':    '10.227.64.85',
  'PowerStore_3000-SIFY':  '10.226.65.30',
  'PowerMax_2500-SIFY':    '10.226.65.31',
  // Brocade SAN
  'DCX-8510_SW01-BCP':     '10.225.42.1',
  'X6-8_SW02-CDVL':        '10.227.65.2',
};

const STORAGE_VENDOR: Record<string, Vendor> = {
  'VSP_5500_30260-BCP':    'hitachi',
  'VSP_5200_30240-BCP':    'hitachi',
  'VSP_G1000_44571-B-BCP': 'hitachi',
  'VSP_G350_45388-CDVL':   'hitachi',
  'VSP_E1090_71390-CDVL':  'hitachi',
  'VSP_5600_40350-CDVL':   'hitachi',
  'VSP_E1090_71333-CDVL':  'hitachi',
  'VSP_F900_4184074-CDVL': 'hitachi',
  'VSP_5100_31049-SIFY':   'hitachi',
  'VSP_5500_30648-SIFY':   'hitachi',
  'VSP_G700_41207-SIFY':   'hitachi',
  'VSP_E790_43012-SIFY':   'hitachi',
  'AFF_A800_4112-BCP':     'netapp',
  'FAS_8200_4187-CDVL':    'netapp',
  'AFF_C400_2210-SIFY':    'netapp',
  'AFF_A400_2211-SIFY':    'netapp',
  'PowerStore_5000-BCP':   'dell',
  'PowerMax_8500-CDVL':    'dell',
  'PowerStore_3000-SIFY':  'dell',
  'PowerMax_2500-SIFY':    'dell',
  'DCX-8510_SW01-BCP':     'brocade',
  'X6-8_SW02-CDVL':        'brocade',
};

interface AlertSeed {
  storage: string;
  severity: RecentAlert['severity'];
  category: string;
  event: string;
  offsetMin: number;
}

// Templates used only by the dev "live alert simulator" in App.tsx so the
// UI demo keeps moving even without real Influx data flowing in yet.
// REAL data comes from the listeners → InfluxDB → backend pipeline.
const ALERT_SEEDS: AlertSeed[] = [
  // Hitachi - VSP family
  { storage: 'VSP_5500_30260-BCP',    severity: 'warning',  category: 'Others',                 event: 'PS OFF (impossible device)',        offsetMin: 4   },
  { storage: 'VSP_5200_30240-BCP',    severity: 'error',    category: 'Hardware error',         event: 'Hardware error (controller)',       offsetMin: 11  },
  { storage: 'VSP_5500_30260-BCP',    severity: 'notice',   category: 'SUM detection',          event: 'SUM detection (firmware drift)',    offsetMin: 18  },
  { storage: 'VSP_5200_30240-BCP',    severity: 'warning',  category: 'I/O pool threshold',     event: 'I/O pool threshold reached',        offsetMin: 26  },
  { storage: 'VSP_5500_30260-BCP',    severity: 'warning',  category: 'Others',                 event: 'ENC warning',                       offsetMin: 33  },
  { storage: 'VSP_5500_30260-BCP',    severity: 'critical', category: 'Disk failure',           event: 'Drive failure (media)',             offsetMin: 41  },
  { storage: 'VSP_G1000_44571-B-BCP', severity: 'warning',  category: 'Performance disordered', event: 'Performance disordered',            offsetMin: 49  },
  { storage: 'VSP_G1000_44571-B-BCP', severity: 'notice',   category: 'Communication error',    event: 'Communication error (recovered)',   offsetMin: 56  },
  { storage: 'VSP_5500_30260-BCP',    severity: 'error',    category: 'License expired',        event: 'License expired (HDP)',             offsetMin: 64  },
  { storage: 'VSP_G1000_44571-B-BCP', severity: 'warning',  category: 'I/O pool threshold',     event: 'I/O pool threshold reached',        offsetMin: 72  },
  { storage: 'VSP_5200_30240-BCP',    severity: 'warning',  category: 'Fan/PSU issue',          event: 'Fan speed low',                     offsetMin: 80  },
  { storage: 'VSP_G1000_44571-B-BCP', severity: 'error',    category: 'Hardware error',         event: 'Hardware error (cache module)',     offsetMin: 89  },
  { storage: 'VSP_E1090_71390-CDVL',  severity: 'notice',   category: 'Replication error',      event: 'Replication error (recovered)',     offsetMin: 98  },
  { storage: 'VSP_5500_30260-BCP',    severity: 'warning',  category: 'Performance disordered', event: 'Performance disordered',            offsetMin: 108 },
  { storage: 'VSP_5100_31049-SIFY',   severity: 'warning',  category: 'NTP',                    event: 'NTP drift detected (Stratum 5)',    offsetMin: 118 },
  { storage: 'VSP_5500_30648-SIFY',   severity: 'critical', category: 'Disk failure',           event: 'Drive failure (cache RAID)',        offsetMin: 7   },
  { storage: 'VSP_G700_41207-SIFY',   severity: 'error',    category: 'Hardware error',         event: 'Hardware error (back-end SAS)',     offsetMin: 21  },
  { storage: 'VSP_5500_30648-SIFY',   severity: 'warning',  category: 'I/O pool threshold',     event: 'I/O pool threshold reached',        offsetMin: 39  },
  { storage: 'VSP_E790_43012-SIFY',   severity: 'warning',  category: 'Performance disordered', event: 'Performance disordered',            offsetMin: 67  },
  { storage: 'VSP_G700_41207-SIFY',   severity: 'warning',  category: 'Fan/PSU issue',          event: 'PSU output voltage low',            offsetMin: 95  },
  { storage: 'VSP_5500_30648-SIFY',   severity: 'notice',   category: 'SUM detection',          event: 'SUM detection (microcode info)',    offsetMin: 145 },
  { storage: 'VSP_E790_43012-SIFY',   severity: 'notice',   category: 'Communication error',    event: 'Communication error (recovered)',   offsetMin: 205 },
  { storage: 'VSP_G1000_44571-B-BCP', severity: 'warning',  category: 'Replication error',      event: 'Replication error (TC pair)',       offsetMin: 130 },
  { storage: 'VSP_G350_45388-CDVL',   severity: 'error',    category: 'SFP/SFP+ issue',         event: 'SFP/SFP+ link down',                offsetMin: 143 },
  { storage: 'VSP_5200_30240-BCP',    severity: 'warning',  category: 'I/O pool threshold',     event: 'I/O pool threshold reached',        offsetMin: 158 },
  { storage: 'VSP_E1090_71333-CDVL',  severity: 'notice',   category: 'NTP',                    event: 'NTP time sync recovered',           offsetMin: 173 },
  { storage: 'VSP_5200_30240-BCP',    severity: 'warning',  category: 'Performance disordered', event: 'Performance disordered',            offsetMin: 192 },
  { storage: 'VSP_G350_45388-CDVL',   severity: 'warning',  category: 'Fan/PSU issue',          event: 'Fan speed low',                     offsetMin: 213 },
  { storage: 'VSP_F900_4184074-CDVL', severity: 'error',    category: 'SFP/SFP+ issue',         event: 'SFP/SFP+ link down',                offsetMin: 232 },
  { storage: 'VSP_E1090_71390-CDVL',  severity: 'warning',  category: 'I/O pool threshold',     event: 'I/O pool threshold reached',        offsetMin: 254 },
  { storage: 'VSP_5200_30240-BCP',    severity: 'notice',   category: 'SUM detection',          event: 'SUM detection (microcode info)',    offsetMin: 278 },
  { storage: 'VSP_5600_40350-CDVL',   severity: 'notice',   category: 'SUM detection',          event: 'SUM detection (microcode info)',    offsetMin: 304 },
  { storage: 'VSP_G350_45388-CDVL',   severity: 'notice',   category: 'Communication error',    event: 'Communication error (recovered)',   offsetMin: 332 },

  // NetApp + Dell listeners not configured yet — see HEALTH_VENDORS dataActive flag.

  // Brocade SAN switches (data via SANnav)
  { storage: 'DCX-8510_SW01-BCP',     severity: 'error',    category: 'SFP/SFP+ issue',         event: 'SFP+ port-8 link reset',            offsetMin: 60  },
  { storage: 'DCX-8510_SW01-BCP',     severity: 'warning',  category: 'Fan/PSU issue',          event: 'Fan-2 RPM low',                     offsetMin: 200 },
  { storage: 'X6-8_SW02-CDVL',        severity: 'warning',  category: 'Others',                 event: 'Zone configuration mismatch',       offsetMin: 288 },
  { storage: 'X6-8_SW02-CDVL',        severity: 'notice',   category: 'Communication error',    event: 'ISL bandwidth restored',            offsetMin: 384 },
];

const ALERT_NOW = Date.now();
const fmtAlertTime = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const locationFromStorage = (storage: string): Location =>
  storage.endsWith('-CDVL') ? 'CDVL' : storage.endsWith('-BCP') ? 'BCP' : 'SIFY';

// Demo templates the live-alert simulator samples from. NOT initial state.
export const ALERT_TEMPLATES: RecentAlert[] = ALERT_SEEDS.map((seed) => {
  const ts = ALERT_NOW - seed.offsetMin * 60_000;
  return {
    time:        fmtAlertTime(ts),
    ts,
    severity:    seed.severity,
    storageName: seed.storage,
    ip:          STORAGE_IPS[seed.storage] ?? '10.0.0.0',
    event:       seed.event,
    category:    seed.category,
    location:    locationFromStorage(seed.storage),
    vendor:      STORAGE_VENDOR[seed.storage] ?? 'hitachi',
  };
});

// Dashboard starts empty — real data fills in via the listener → Influx pipeline
// (live simulator can also seed alerts every 18 s in dev to keep the demo alive).
export const RECENT_ALERTS: RecentAlert[] = [];

// Order + per-vendor metadata; counts/criticals/warnings are filled in from
// the live alerts stream in App.tsx so the badges reflect real Influx data
// from the listener pipeline. All four vendor listeners are deployed.
export const HEALTH_VENDORS: HealthVendor[] = [
  { key: 'total',    name: 'Total Systems',    count: 0, critical: 0, warning: 0, iconBg: '#475569', icon: 'total',   dataActive: true },
  { key: 'hitachi',  name: 'Hitachi Storage',  count: 0, critical: 0, warning: 0, iconBg: '#E60012', icon: 'hitachi', dataActive: true },
  { key: 'brocade',  name: 'Brocade Switches', count: 0, critical: 0, warning: 0, iconBg: '#FF1100', icon: 'brocade', dataActive: true },
  { key: 'netapp',   name: 'NetApp Storage',   count: 0, critical: 0, warning: 0, iconBg: '#0067C5', icon: 'netapp',  dataActive: true },
  { key: 'dell',     name: 'Dell Storage',     count: 0, critical: 0, warning: 0, iconBg: '#0085C3', icon: 'dell',    dataActive: true },
];

// All time-series curves (Total Alerts spark + Alert Trend) are now derived
// from the real `filteredAlerts` array in `App.tsx::trendBuckets`; the
// previous synthetic `RANGE_SHAPES` patterns + `getSparkForRange` /
// `getTrendForRange` helpers were removed when the dashboard moved to a
// single source of truth.

export const NTP_LAST_SYNC = '12:00:49 PM';
