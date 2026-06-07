import { useEffect, useRef, useState } from 'react';

export type ListenerState = 'up' | 'down' | 'infra_down' | 'unknown';

export interface ListenerRow {
  id:         string;       // "SIFY:Hitachi"
  site:       string;       // "SIFY"
  oem:        string;       // "Hitachi"
  listener:   string;       // "hitachi-sify"
  state:      ListenerState;
  last_seen:  number | null;
  age_s:      number | null;
  down_since: number | null;
  msg_count:  number;
  hb_seq:     number;
  event_key:  string | null;
}

export interface ListenerDownEvent {
  key:        string;       // unique per outage; flips when listener re-fails
  id:         string;
  site:       string;
  oem:        string;
  listener:   string;
  down_since: number;
  raised_at:  number;
  age_s:      number | null;
}

export interface SiteHealth {
  site:        string;
  reachable:   boolean;
  last_check:  number | null;
  last_ok:     number | null;
  error:       string | null;
}

export interface InfraEvent {
  key:        string;       // unique per outage; flips when site re-fails
  site:       string;
  since:      number;       // epoch when we first observed the outage
  error:      string;
  /** "heartbeat" (default) or "alert" — which InfluxDB tier is down. */
  component?: 'heartbeat' | 'alert';
  /** Vendor whose alert store is unreachable (only when component === "alert"). */
  vendor?:    string;
}

export interface ListenerHealthSnapshot {
  ok:                boolean;
  as_of:             number;
  poll_interval:     number;
  down_threshold_s:  number;
  sites:             SiteHealth[];
  listeners:         ListenerRow[];
  down_events:       ListenerDownEvent[];
  infra_events:      InfraEvent[];
}

const EMPTY: ListenerHealthSnapshot = {
  ok:               false,
  as_of:            0,
  poll_interval:    10,
  down_threshold_s: 90,
  sites:            [],
  listeners:        [],
  down_events:      [],
  infra_events:     [],
};

interface Options {
  url?:        string;
  pollMs?:     number;
  enabled?:    boolean;
}

export function useListenerHealth({
  url     = '/api/health/listeners',
  pollMs  = 8000,
  enabled = true,
}: Options = {}) {
  const [snapshot, setSnapshot] = useState<ListenerHealthSnapshot>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    aliveRef.current = true;

    let timer: number | undefined;

    const tick = async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as ListenerHealthSnapshot;
        if (!aliveRef.current) return;
        setSnapshot(data);
        setError(null);
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
  }, [url, pollMs, enabled]);

  return { snapshot, error };
}
