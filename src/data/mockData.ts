import type {
  AlertTypeRow,
  HealthVendor,
  Location,
  RangeKey,
  RangeOption,
  RecentAlert,
  SeverityRow,
  SparkPoint,
  SystemRow,
  TimeRange,
  TrendPoint,
  Vendor,
} from '../types';

export const RANGE_OPTIONS: RangeOption[] = [
  { key: '1h', label: 'Last 1 Hour' },
  { key: '6h', label: 'Last 6 Hours' },
  { key: '24h', label: 'Last 24 Hours' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
];

export const TOTAL_ALERTS = 26;
export const TOTAL_ALERTS_DELTA = 26;

export const SEVERITY_DATA: SeverityRow[] = [
  { name: 'Critical',      key: 'critical',      value: 1,  color: '#FF4D4F' },
  { name: 'Error',         key: 'error',         value: 5,  color: '#FF7A6F' },
  { name: 'Warning',       key: 'warning',       value: 13, color: '#FFB020' },
  { name: 'Notice',        key: 'notice',        value: 7,  color: '#FACC15' },
  { name: 'Informational', key: 'informational', value: 0,  color: '#4DA3FF' },
];

export const ALERT_TYPE_DATA: AlertTypeRow[] = [
  { name: 'Disk failure',           value: 1, color: '#FF4D4F' },
  { name: 'I/O pool threshold',     value: 4, color: '#FF6A00' },
  { name: 'SUM detection',          value: 3, color: '#FACC15' },
  { name: 'Communication error',    value: 2, color: '#4DA3FF' },
  { name: 'Performance disordered', value: 3, color: '#9B5CFF' },
  { name: 'Replication error',      value: 2, color: '#C084FC' },
  { name: 'Hardware error',         value: 2, color: '#22D3EE' },
  { name: 'SFP/SFP+ issue',         value: 2, color: '#EC4899' },
  { name: 'Fan/PSU issue',          value: 2, color: '#00D26A' },
  { name: 'License expired',        value: 1, color: '#64748B' },
  { name: 'NTP',                    value: 2, color: '#00C2FF' },
  { name: 'Others',                 value: 2, color: '#475569' },
];

export const TOP_SYSTEMS: SystemRow[] = [
  // Hitachi - live listener
  { name: 'VSP_5500_30260-BCP',     alerts: 6, location: 'BCP',  vendor: 'hitachi' },
  { name: 'VSP_5200_30240-BCP',     alerts: 6, location: 'BCP',  vendor: 'hitachi' },
  { name: 'VSP_G1000_44571-B-BCP',  alerts: 5, location: 'BCP',  vendor: 'hitachi' },
  { name: 'VSP_G350_45388-CDVL',    alerts: 3, location: 'CDVL', vendor: 'hitachi' },
  { name: 'VSP_E1090_71390-CDVL',   alerts: 2, location: 'CDVL', vendor: 'hitachi' },
  // Brocade - live listener (SANnav)
  { name: 'DCX-8510_SW01-BCP',      alerts: 2, location: 'BCP',  vendor: 'brocade' },
  { name: 'X6-8_SW02-CDVL',         alerts: 2, location: 'CDVL', vendor: 'brocade' },
];

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
  // NetApp
  'AFF_A800_4112-BCP':     '10.225.40.12',
  'FAS_8200_4187-CDVL':    '10.227.62.18',
  'AFF_C400_2210-SIFY':    '10.226.64.10',
  // Dell EMC
  'PowerStore_5000-BCP':   '10.225.41.50',
  'PowerMax_8500-CDVL':    '10.227.64.85',
  'PowerStore_3000-SIFY':  '10.226.65.30',
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
  'AFF_A800_4112-BCP':     'netapp',
  'FAS_8200_4187-CDVL':    'netapp',
  'AFF_C400_2210-SIFY':    'netapp',
  'PowerStore_5000-BCP':   'dell',
  'PowerMax_8500-CDVL':    'dell',
  'PowerStore_3000-SIFY':  'dell',
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

// Offsets intentionally mix severities across the timeline so the
// "Recent Critical Alerts" table doesn't appear sorted by severity.
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

export const RECENT_ALERTS: RecentAlert[] = ALERT_SEEDS
  .map((seed) => {
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
  })
  .sort((a, b) => b.ts - a.ts);

export const HEALTH_VENDORS: HealthVendor[] = [
  { key: 'total',    name: 'Total Systems',    count: 11, critical: 1, warning: 13, iconBg: '#475569', icon: 'total',   dataActive: true  },
  { key: 'hitachi',  name: 'Hitachi Storage',  count: 9,  critical: 1, warning: 11, iconBg: '#E60012', icon: 'hitachi', dataActive: true  },
  { key: 'netapp',   name: 'NetApp Storage',   count: 0,  critical: 0, warning: 0,  iconBg: '#0067C5', icon: 'netapp',  dataActive: false },
  { key: 'dell',     name: 'Dell Storage',     count: 0,  critical: 0, warning: 0,  iconBg: '#0085C3', icon: 'dell',    dataActive: false },
  { key: 'brocade',  name: 'Brocade Switches', count: 2,  critical: 0, warning: 2,  iconBg: '#FF1100', icon: 'brocade', dataActive: true  },
];

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY  = 24 * MS_PER_HOUR;

interface RangeShape {
  durationMs: number;
  pattern: number[];
}

const RANGE_SHAPES: Record<RangeKey, RangeShape> = {
  '1h':  {
    durationMs: 1 * MS_PER_HOUR,
    pattern:    [0, 0, 1, 0, 1, 2, 1, 3, 4, 2, 1, 2],
  },
  '6h':  {
    durationMs: 6 * MS_PER_HOUR,
    pattern:    [1, 0, 1, 2, 1, 0, 0, 1, 3, 2, 1, 1, 2, 4, 12, 18, 9, 4, 2, 1, 1, 0, 1, 1],
  },
  '24h': {
    durationMs: 24 * MS_PER_HOUR,
    pattern:    [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 2, 3, 5, 4, 12, 19, 14, 8, 4, 2, 1, 1],
  },
  '7d':  {
    durationMs: 7 * MS_PER_DAY,
    pattern:    [4, 2, 5, 6, 8, 12, 18, 24, 15, 8, 7, 6, 9, 11],
  },
  '30d': {
    durationMs: 30 * MS_PER_DAY,
    pattern:    [3, 2, 4, 2, 5, 4, 8, 6, 5, 4, 7, 5, 8, 6, 9, 10, 12, 18, 22, 15, 12, 10, 8, 7, 6, 5, 8, 9, 7, 6],
  },
};

const formatHourLabel = (d: Date): string => {
  const hh = d.getHours();
  const mm = d.getMinutes();
  const hour12 = ((hh + 11) % 12) + 1;
  const ampm = hh < 12 ? 'am' : 'pm';
  return `${String(hour12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

const formatDayLabel = (d: Date): string =>
  `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

const labelFor = (d: Date, durationMs: number): string =>
  durationMs > 36 * MS_PER_HOUR ? formatDayLabel(d) : formatHourLabel(d);

const customDurationMs = (start: string, stop: string): number =>
  Math.max(MS_PER_HOUR, new Date(stop).getTime() - new Date(start).getTime());

const buildPattern = (durationMs: number): { pattern: number[]; key: RangeKey } => {
  if (durationMs <= 1.5 * MS_PER_HOUR) return { ...RANGE_SHAPES['1h'],  key: '1h'  };
  if (durationMs <= 12 * MS_PER_HOUR)  return { ...RANGE_SHAPES['6h'],  key: '6h'  };
  if (durationMs <= 2  * MS_PER_DAY)   return { ...RANGE_SHAPES['24h'], key: '24h' };
  if (durationMs <= 14 * MS_PER_DAY)   return { ...RANGE_SHAPES['7d'],  key: '7d'  };
  return { ...RANGE_SHAPES['30d'], key: '30d' };
};

const rangeBounds = (range: TimeRange): { endMs: number; durationMs: number } => {
  if (range.kind === 'relative') {
    return { endMs: Date.now(), durationMs: RANGE_SHAPES[range.key].durationMs };
  }
  return {
    endMs:      new Date(range.stop).getTime(),
    durationMs: customDurationMs(range.start, range.stop),
  };
};

export const getSparkForRange = (range: TimeRange): SparkPoint[] => {
  const { endMs, durationMs } = rangeBounds(range);
  const pattern =
    range.kind === 'relative'
      ? RANGE_SHAPES[range.key].pattern
      : buildPattern(durationMs).pattern;
  const startMs = endMs - durationMs;
  const last = pattern.length - 1;
  return pattern.map((v, i) => ({
    value: v,
    ts: startMs + (i / last) * durationMs,
  }));
};

export const getTrendForRange = (range: TimeRange): TrendPoint[] => {
  const { endMs, durationMs } = rangeBounds(range);
  const pattern =
    range.kind === 'relative'
      ? RANGE_SHAPES[range.key].pattern
      : buildPattern(durationMs).pattern;
  const startMs = endMs - durationMs;
  const last = pattern.length - 1;
  return pattern.map((v, i) => {
    const ts = startMs + (i / last) * durationMs;
    return {
      ts,
      label: labelFor(new Date(ts), durationMs),
      value: v,
    };
  });
};

export const getTotalForRange = (range: TimeRange): { total: number; delta: number } => {
  const data = getSparkForRange(range);
  const total = data.reduce((acc, p) => acc + p.value, 0);
  return { total, delta: total };
};

// Default snapshot kept for any caller that still imports the static export.
export const SPARK_DATA: SparkPoint[] = getSparkForRange({ kind: 'relative', key: '6h' });
export const TREND_DATA: TrendPoint[] = getTrendForRange({ kind: 'relative', key: '6h' });

export const NTP_LAST_SYNC = '12:00:49 PM';
