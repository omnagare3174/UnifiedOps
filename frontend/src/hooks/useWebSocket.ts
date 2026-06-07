import { useEffect, useRef, useState } from 'react';

export type WsStatus = 'connecting' | 'open' | 'closed' | 'reconnecting';

interface Options<T> {
  /** Resolved URL string (e.g. '/ws/alerts'). */
  url:        string;
  /** When the server sends a frame, this callback updates derived state. */
  onMessage:  (data: T) => void;
  /** Initial backoff in ms (exponential thereafter, capped). */
  baseDelayMs?: number;
  /** Maximum backoff in ms. */
  maxDelayMs?:  number;
  /** Whether to actually open the socket (lets parent toggle off). */
  enabled?: boolean;
  /** Optional outbound keepalive ping every N ms. */
  pingIntervalMs?: number;
}

interface State {
  status:        WsStatus;
  /** Epoch ms when the socket entered its current status. */
  statusSince:   number;
  /** Epoch ms of the most recent successful message receive. */
  lastMessageAt: number;
  /** How many reconnect attempts since the last successful 'open'. */
  attempts:      number;
  /** Last close-code received from the server (if any). */
  lastCloseCode: number | null;
}

const INITIAL: State = {
  status:        'connecting',
  statusSince:   Date.now(),
  lastMessageAt: 0,
  attempts:      0,
  lastCloseCode: null,
};

/**
 * Generic, reconnecting WebSocket hook with exponential backoff.
 *
 * Returns connection status + the most recent message timestamp so the
 * caller can decide when to surface a "connection lost" modal. The
 * underlying WebSocket is recreated on URL or enabled changes.
 *
 * Resolves relative URLs against `window.location` so '/ws/alerts'
 * works in both vite dev (proxied) and production (same-origin).
 */
export function useWebSocket<T = unknown>(opts: Options<T>) {
  const {
    url,
    onMessage,
    baseDelayMs    = 800,
    maxDelayMs     = 15000,
    enabled        = true,
    pingIntervalMs = 25000,
  } = opts;

  const [state, setState] = useState<State>(INITIAL);

  // Latest callback in a ref so we don't tear down the socket every
  // time the parent re-renders with a fresh closure.
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  const wsRef       = useRef<WebSocket | null>(null);
  const reconnectId = useRef<number | null>(null);
  const pingId      = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const aliveRef    = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const setStatus = (next: WsStatus, closeCode: number | null = null) => {
      setState(prev => ({
        ...prev,
        status:        next,
        statusSince:   Date.now(),
        attempts:      next === 'open' ? 0 : attemptsRef.current,
        lastCloseCode: closeCode ?? prev.lastCloseCode,
      }));
    };

    const resolveUrl = (path: string): string => {
      if (path.startsWith('ws://') || path.startsWith('wss://')) return path;
      if (typeof window === 'undefined') return path;
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${scheme}://${window.location.host}${path}`;
    };

    const stopPing = () => {
      if (pingId.current !== null) {
        window.clearInterval(pingId.current);
        pingId.current = null;
      }
    };

    const startPing = (ws: WebSocket) => {
      stopPing();
      pingId.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send('ping'); } catch { /* ignore */ }
        }
      }, pingIntervalMs);
    };

    const connect = () => {
      if (!aliveRef.current || !enabled) return;
      attemptsRef.current += 1;
      setStatus(attemptsRef.current === 1 ? 'connecting' : 'reconnecting');

      let ws: WebSocket;
      try {
        ws = new WebSocket(resolveUrl(url));
      } catch (e) {
        // Synchronous failure (e.g. invalid URL): schedule reconnect.
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!aliveRef.current) return;
        attemptsRef.current = 0;
        setStatus('open');
        startPing(ws);
      };

      ws.onmessage = (ev: MessageEvent) => {
        if (!aliveRef.current) return;
        // Server may send plain ping/pong text — ignore non-JSON.
        if (typeof ev.data !== 'string') return;
        if (ev.data === 'pong' || ev.data === 'ping') {
          setState(prev => ({ ...prev, lastMessageAt: Date.now() }));
          return;
        }
        try {
          const parsed = JSON.parse(ev.data) as T & { type?: string };
          // Filter out server-side keepalive frames (`{type: "ping"}`).
          if (
            parsed && typeof parsed === 'object'
            && (parsed as { type?: string }).type === 'ping'
          ) {
            setState(prev => ({ ...prev, lastMessageAt: Date.now() }));
            return;
          }
          setState(prev => ({ ...prev, lastMessageAt: Date.now() }));
          cbRef.current(parsed);
        } catch {
          /* swallow malformed frames */
        }
      };

      ws.onerror = () => {
        // onclose will fire too; let scheduleReconnect run from there.
      };

      ws.onclose = (ev: CloseEvent) => {
        stopPing();
        wsRef.current = null;
        if (!aliveRef.current) {
          setStatus('closed', ev.code);
          return;
        }
        setStatus('reconnecting', ev.code);
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (!aliveRef.current || !enabled) return;
      const attempt = attemptsRef.current;
      const delay   = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
      reconnectId.current = window.setTimeout(connect, delay);
    };

    if (enabled) {
      attemptsRef.current = 0;
      connect();
    } else {
      setStatus('closed');
    }

    return () => {
      aliveRef.current = false;
      stopPing();
      if (reconnectId.current !== null) {
        window.clearTimeout(reconnectId.current);
        reconnectId.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try { ws.close(); } catch { /* ignore */ }
      }
    };
  }, [url, enabled, baseDelayMs, maxDelayMs, pingIntervalMs]);

  return state;
}
