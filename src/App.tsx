import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/header/Header';
import { TotalAlertsCard } from './components/cards/TotalAlertsCard';
import { AlertSeverityCard } from './components/cards/AlertSeverityCard';
import { AlertTrendCard } from './components/cards/AlertTrendCard';
import { TopSystemsCard } from './components/cards/TopSystemsCard';
import { AlertTypeBreakdownCard } from './components/cards/AlertTypeBreakdownCard';
import { RecentCriticalAlertsCard } from './components/cards/RecentCriticalAlertsCard';
import { NTPCard } from './components/cards/NTPCard';
import { SystemHealthOverview } from './components/cards/SystemHealthOverview';
import { ToastStack, type ToastItem } from './components/overlays/Toast';
import { ScreenBlink } from './components/overlays/ScreenBlink';
import {
  AlertDetailsModal,
  type ModalFilters,
} from './components/overlays/AlertDetailsModal';
import {
  ALERT_TYPE_DATA,
  HEALTH_VENDORS,
  RANGE_OPTIONS,
  RECENT_ALERTS,
  SEVERITY_DATA,
  TOP_SYSTEMS,
  getSparkForRange,
  getTotalForRange,
  getTrendForRange,
} from './data/mockData';
import type {
  Location,
  RecentAlert,
  Severity,
  SystemStatus,
  TimeRange,
  VendorFilter,
} from './types';

const ALL_LOCATIONS: Location[] = ['CDVL', 'BCP', 'SIFY'];

const SEVERITY_COLOR: Record<Severity, string> = {
  critical:      '#ef4444',
  error:         '#f97066',
  warning:       '#f97316',
  notice:        '#eab308',
  informational: '#3b82f6',
};

const rangeLabel = (r: TimeRange): string => {
  if (r.kind === 'relative') {
    return RANGE_OPTIONS.find(o => o.key === r.key)?.label ?? r.key;
  }
  const s = new Date(r.start);
  const e = new Date(r.stop);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `${fmt(s)} → ${fmt(e)}`;
};

const fmtAlertTime = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const MAX_ALERTS = 200;

const buildLiveAlert = (): RecentAlert => {
  const template = RECENT_ALERTS[Math.floor(Math.random() * RECENT_ALERTS.length)];
  const now = Date.now();
  return {
    ...template,
    ts:   now,
    time: fmtAlertTime(now),
  };
};

export default function App() {
  const [range, setRange] = useState<TimeRange>({ kind: 'relative', key: '6h' });
  const [locations, setLocations] = useState<Location[]>(ALL_LOCATIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<SystemStatus>('live');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [blinkColor, setBlinkColor] = useState<string | null>(null);
  const blinkKeyRef = useRef(0);
  const [blinkKey, setBlinkKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilters, setModalFilters] = useState<ModalFilters | null>(null);

  const [alerts, setAlerts] = useState<RecentAlert[]>(RECENT_ALERTS);
  const [selectedVendor, setSelectedVendor] = useState<VendorFilter>('total');

  const vendorActive = useMemo(() => {
    if (selectedVendor === 'total') return true;
    return HEALTH_VENDORS.find(v => v.key === selectedVendor)?.dataActive ?? false;
  }, [selectedVendor]);

  const label = rangeLabel(range);

  const sparkData = useMemo(() => {
    const base = getSparkForRange(range);
    if (!vendorActive) return base.map(p => ({ ...p, value: 0 }));
    return base;
  }, [range, vendorActive]);

  const trendData = useMemo(() => {
    const base = getTrendForRange(range);
    if (!vendorActive) return base.map(p => ({ ...p, value: 0 }));
    return base;
  }, [range, vendorActive]);

  const totalsForRange = useMemo(() => {
    if (!vendorActive) return { total: 0, delta: 0 };
    return getTotalForRange(range);
  }, [range, vendorActive]);

  const severityData = useMemo(() => {
    if (!vendorActive) return SEVERITY_DATA.map(s => ({ ...s, value: 0 }));
    return SEVERITY_DATA;
  }, [vendorActive]);

  const alertTypeData = useMemo(() => {
    if (!vendorActive) return ALERT_TYPE_DATA.map(t => ({ ...t, value: 0 }));
    return ALERT_TYPE_DATA;
  }, [vendorActive]);

  const vendorName = useMemo(() => {
    if (selectedVendor === 'total') return null;
    return HEALTH_VENDORS.find(v => v.key === selectedVendor)?.name ?? selectedVendor;
  }, [selectedVendor]);

  const filteredAlerts = useMemo(() => {
    if (!vendorActive) return [];
    return alerts.filter(a =>
      locations.includes(a.location) &&
      (selectedVendor === 'total' || a.vendor === selectedVendor)
    );
  }, [alerts, locations, selectedVendor, vendorActive]);

  const ntpAlertCount = useMemo(
    () => filteredAlerts.filter(a => a.category === 'NTP').length,
    [filteredAlerts],
  );

  const filteredSystems = useMemo(() => {
    if (!vendorActive) return [];
    return TOP_SYSTEMS.filter(s =>
      locations.includes(s.location) &&
      (selectedVendor === 'total' || s.vendor === selectedVendor)
    );
  }, [locations, selectedVendor, vendorActive]);

  const pushToast = (t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    const item = { ...t, id };
    setToasts(prev => [...prev, item]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 6000);
  };

  const dismissToast = (id: number) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  const triggerBlink = (color: string) => {
    blinkKeyRef.current += 1;
    setBlinkKey(blinkKeyRef.current);
    setBlinkColor(color);
    window.setTimeout(() => setBlinkColor(null), 1700);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setStatus('fetching');
    window.setTimeout(() => {
      setRefreshing(false);
      setStatus('live');
      pushToast({
        severity: 'informational',
        title: 'Dashboard refreshed',
        message: `Latest data from ${locations.join(' + ')} loaded`,
      });
    }, 900);
  };

  const openModal = (filters: ModalFilters | null) => {
    setModalFilters(filters);
    setModalOpen(true);
  };

  // demo: simulate an incoming alert every 18s. Push it onto the live
  // alerts list (so it shows up in Recent Critical Alerts + the modal),
  // raise a toast, and flash the screen-blink overlay.
  useEffect(() => {
    const t = window.setInterval(() => {
      const fresh = buildLiveAlert();
      setAlerts(prev => [fresh, ...prev].slice(0, MAX_ALERTS));
      pushToast({
        severity: fresh.severity,
        title: '1 new alert',
        message: `${fresh.severity} · ${fresh.storageName} (${fresh.ip})`,
      });
      triggerBlink(SEVERITY_COLOR[fresh.severity]);
    }, 18000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div
      className="app"
      data-vendor={selectedVendor}
      data-vendor-offline={vendorActive ? 'false' : 'true'}
    >
      <Header
        status={status}
        selectedLocations={locations}
        allLocations={ALL_LOCATIONS}
        onLocationsChange={setLocations}
        range={range}
        onRangeChange={setRange}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <div className="dashboard">
        <TotalAlertsCard
          className="area-total"
          total={totalsForRange.total}
          delta={totalsForRange.delta}
          rangeLabel={label}
          spark={sparkData}
        />

        <AlertSeverityCard
          className="area-severity"
          data={severityData}
          onView={() => openModal(null)}
          onSliceClick={(r) => openModal({ severity: r.key })}
        />

        <AlertTrendCard
          className="area-trend"
          data={trendData}
          rangeLabel={label}
        />

        <TopSystemsCard
          className="area-systems"
          systems={filteredSystems}
          onView={() => openModal(null)}
          onSystemClick={(s) => openModal({ storage: s.name })}
        />

        <AlertTypeBreakdownCard
          className="area-type"
          data={alertTypeData}
          rangeLabel={label}
          onView={() => openModal(null)}
          onSliceClick={(r) => openModal({ category: r.name })}
        />

        <div className="area-bottom bottom-bar">
          <RecentCriticalAlertsCard
            alerts={filteredAlerts}
            rangeLabel={label}
            onView={() => openModal(null)}
          />
          <NTPCard
            alertCount={ntpAlertCount}
            onView={() => openModal({ category: 'NTP' })}
          />
        </div>
      </div>

      {!vendorActive && vendorName && (
        <div className="no-data-banner" role="status">
          <span className="no-data-banner__dot" />
          <strong>{vendorName}</strong>
          <span> listener is not configured — no data is being received. Select a different vendor to view live metrics.</span>
        </div>
      )}

      <SystemHealthOverview
        vendors={HEALTH_VENDORS}
        selected={selectedVendor}
        onSelect={setSelectedVendor}
      />

      <AlertDetailsModal
        open={modalOpen}
        rangeLabel={label}
        filters={modalFilters}
        alerts={filteredAlerts}
        onClose={() => setModalOpen(false)}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ScreenBlink triggerKey={blinkKey} color={blinkColor} />
    </div>
  );
}
