export type Severity = 'critical' | 'error' | 'warning' | 'notice' | 'informational';

export type Location = 'CDVL' | 'BCP' | 'SIFY';

export type Vendor = 'hitachi' | 'netapp' | 'dell' | 'brocade';

export type VendorFilter = 'total' | Vendor;

export interface SeverityRow {
  name: string;
  key: Severity;
  value: number;
  color: string;
}

export interface AlertTypeRow {
  name: string;
  value: number;
  color: string;
}

export interface SystemRow {
  name: string;
  alerts: number;
  location: Location;
  vendor: Vendor;
}

export interface RecentAlert {
  time: string;
  ts: number;
  severity: Severity;
  storageName: string;
  ip: string;
  event: string;
  category: string;
  location: Location;
  vendor: Vendor;
}

export interface HealthVendor {
  key: VendorFilter;
  name: string;
  count: number;
  critical: number;
  warning: number;
  iconBg: string;
  icon: 'hitachi' | 'netapp' | 'dell' | 'brocade' | 'total';
  dataActive: boolean;
}

export interface SparkPoint {
  value: number;
  ts: number;
}

export interface TrendPoint {
  ts: number;
  label: string;
  value: number;
}

export type SystemStatus = 'live' | 'fetching' | 'error';

export type RangeKey =
  | '5m'  | '15m' | '30m'
  | '1h'  | '3h'  | '6h'  | '12h' | '24h'
  | '1d'  | '2d'  | '3d'  | '7d'  | '15d' | '30d';

export interface RangeOption {
  key: RangeKey;
  label: string;
}

export type TimeRange =
  | { kind: 'relative'; key: RangeKey }
  | { kind: 'custom';   start: string; stop: string };
