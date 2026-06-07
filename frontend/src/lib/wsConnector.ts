import { useEffect, useRef } from 'react';
import { useAlertsStore }         from '../stores/useAlertsStore';
import { useListenerHealthStore } from '../stores/useListenerHealthStore';
import { useDashboardStore }      from '../stores/useDashboardStore';
import type { RecentAlert } from '../types';

/**
 * Reconnecting WebSocket connector for the THREE server channels.
 *
 * Subscribes once at app mount; pushes frames into the zustand stores
 * and notifies a single `onNewAlerts` callback for genuinely-new rows
 * so App.tsx can drive toast + screen blink without owning state.
 *
 *     useWsConnector({
 *       subscription: { range: '6h', sites: ['CDVL'], vendors: [] },
 *       onNewAlerts: (fresh) => { pushToast(...); triggerBlink(...); },
 *     });
 *
 * The dashboard channel is subscription-driven: whenever the caller
 * passes a new `subscription` value, we send `{type:"subscribe", ...}`
 * over the open /ws/dashboard socket so the backend recomputes its
 * per-client key.
 *
 * Resolves relative URLs against `window.location`, so the same code
 * works against the vite dev proxy and against same-origin production.
 */
export interface DashboardSubscription {
  range:   string;
  sites:   string[];
  vendors: string[];
}

interface Options {
  alertsUrl?:         string;
  listenerHealthUrl?: string;
  dashboardUrl?:      string;
  baseDelayMs?:       number;
  maxDelayMs?:        number;
  pingIntervalMs?:    number;
  subscription?:      DashboardSubscription;
  onNewAlerts?:       (fresh: RecentAlert[]) => void;
}

const PING_TYPE = '"type":"ping"';

function resolveUrl(path: string): string {
  if (path.startsWith('ws://') || path.startsWith('wss://')) return path;
  if (typeof window === 'undefined') return path;
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${path}`;
}

interface ChannelOpts {
  url:     string;
  onFrame: (frame: unknown) => void;
  onOpen?: (ws: WebSocket) => void;
  setStatus: (s: 'connecting' | 'open' | 'closed' | 'reconnecting') => void;
  notePing: () => void;
  baseDelayMs: number;
  maxDelayMs:  number;
  pingIntervalMs: number;
}

interface ChannelHandle {
  send: (text: string) => boolean;
  close: () => void;
}

function openChannel(opts: ChannelOpts): ChannelHandle {
  let alive    = true;
  let ws: WebSocket | null = null;
  let attempts = 0;
  let reconnectId: number | undefined;
  let pingId:      number | undefined;

  const stopPing = () => {
    if (pingId !== undefined) { window.clearInterval(pingId); pingId = undefined; }
  };

  const scheduleReconnect = () => {
    if (!alive) return;
    const delay = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** Math.max(0, attempts - 1));
    reconnectId = window.setTimeout(connect, delay);
  };

  const connect = () => {
    if (!alive) return;
    attempts += 1;
    opts.setStatus(attempts === 1 ? 'connecting' : 'reconnecting');
    try {
      ws = new WebSocket(opts.url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      if (!alive || !ws) return;
      attempts = 0;
      opts.setStatus('open');
      stopPing();
      pingId = window.setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send('ping'); } catch { /* ignore */ }
        }
      }, opts.pingIntervalMs);
      try { opts.onOpen?.(ws); } catch { /* ignore */ }
    };
    ws.onmessage = (ev: MessageEvent) => {
      if (!alive || typeof ev.data !== 'string') return;
      if (ev.data === 'pong' || ev.data === 'ping') {
        opts.notePing();
        return;
      }
      if (ev.data.includes(PING_TYPE)) {
        opts.notePing();
        return;
      }
      try {
        const frame = JSON.parse(ev.data);
        opts.onFrame(frame);
      } catch {
        /* swallow malformed frames */
      }
    };
    ws.onerror = () => { /* close handler does the work */ };
    ws.onclose = () => {
      stopPing();
      ws = null;
      if (!alive) {
        opts.setStatus('closed');
        return;
      }
      opts.setStatus('reconnecting');
      scheduleReconnect();
    };
  };

  connect();

  return {
    send: (text: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(text); return true; } catch { return false; }
      }
      return false;
    },
    close: () => {
      alive = false;
      stopPing();
      if (reconnectId !== undefined) window.clearTimeout(reconnectId);
      if (ws) { try { ws.close(); } catch { /* ignore */ } }
    },
  };
}

export function useWsConnector({
  alertsUrl         = '/ws/alerts',
  listenerHealthUrl = '/ws/listener-health',
  dashboardUrl      = '/ws/dashboard',
  baseDelayMs       = 800,
  maxDelayMs        = 15000,
  pingIntervalMs    = 25000,
  subscription,
  onNewAlerts,
}: Options = {}) {
  const cbRef = useRef(onNewAlerts);
  cbRef.current = onNewAlerts;

  const dashRef = useRef<ChannelHandle | null>(null);
  const subRef  = useRef<DashboardSubscription | undefined>(subscription);
  subRef.current = subscription;

  useEffect(() => {
    const handles: ChannelHandle[] = [];

    handles.push(openChannel({
      url:        resolveUrl(alertsUrl),
      setStatus:  s => useAlertsStore.getState().setWsStatus(s),
      notePing:   () => useAlertsStore.getState().notePing(),
      baseDelayMs, maxDelayMs, pingIntervalMs,
      onFrame: (raw: unknown) => {
        const frame = raw as { type?: string };
        const store = useAlertsStore.getState();
        if (frame.type === 'hydrate') {
          store.ingestHydrate(frame as never);
        } else if (frame.type === 'alerts') {
          const fresh = store.ingestAlerts(frame as never);
          if (fresh.length > 0 && cbRef.current) cbRef.current(fresh);
        } else if (frame.type === 'health') {
          store.ingestHealth(frame as never);
        }
      },
    }));

    handles.push(openChannel({
      url:        resolveUrl(listenerHealthUrl),
      setStatus:  s => useListenerHealthStore.getState().setWsStatus(s),
      notePing:   () => useListenerHealthStore.getState().notePing(),
      baseDelayMs, maxDelayMs, pingIntervalMs,
      onFrame: (raw: unknown) => {
        const frame = raw as { type?: string };
        if (frame.type === 'hydrate' || frame.type === 'listener-health') {
          useListenerHealthStore.getState().ingest(frame as never);
        }
      },
    }));

    const dashHandle = openChannel({
      url:        resolveUrl(dashboardUrl),
      setStatus:  (_s) => { /* dashboard status not surfaced separately */ },
      notePing:   () => { /* dashboard ping handled inline */ },
      baseDelayMs, maxDelayMs, pingIntervalMs,
      onOpen: (ws) => {
        const sub = subRef.current;
        if (sub) {
          try { ws.send(JSON.stringify({ type: 'subscribe', ...sub })); } catch { /* ignore */ }
        }
      },
      onFrame: (raw: unknown) => {
        const frame = raw as { type?: string; snapshot?: unknown };
        if (frame.type === 'dashboard' && frame.snapshot) {
          useDashboardStore.getState().ingest(frame.snapshot as never);
        }
      },
    });
    dashRef.current = dashHandle;
    handles.push(dashHandle);

    return () => {
      handles.forEach(h => h.close());
      dashRef.current = null;
    };
  }, [alertsUrl, listenerHealthUrl, dashboardUrl, baseDelayMs, maxDelayMs, pingIntervalMs]);

  // Re-send subscription whenever it changes, without tearing down the socket.
  useEffect(() => {
    if (!subscription) return;
    const handle = dashRef.current;
    if (!handle) return;
    useDashboardStore.getState().setSubscription(subscription);
    handle.send(JSON.stringify({ type: 'subscribe', ...subscription }));
  }, [
    subscription?.range,
    JSON.stringify(subscription?.sites ?? []),
    JSON.stringify(subscription?.vendors ?? []),
  ]);
}
