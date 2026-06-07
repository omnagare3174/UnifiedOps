import { useState } from 'react';
import { useWebSocket, type WsStatus } from './useWebSocket';
import type {
  ListenerHealthSnapshot,
  ListenerRow,
  ListenerDownEvent,
  SiteHealth,
  InfraEvent,
} from './useListenerHealth';

export type { ListenerHealthSnapshot, ListenerRow, ListenerDownEvent, SiteHealth, InfraEvent };

const EMPTY: ListenerHealthSnapshot = {
  ok:               false,
  as_of:            0,
  poll_interval:    10,
  down_threshold_s: 30,
  sites:            [],
  listeners:        [],
  down_events:      [],
  infra_events:     [],
};

interface ServerFrame extends Partial<ListenerHealthSnapshot> {
  type?: string;
}

interface Options {
  url?:     string;
  enabled?: boolean;
}

/**
 * WS-driven version of `useListenerHealth`. Subscribes to
 * `/ws/listener-health` on the FastAPI server; the server pushes a full
 * snapshot on every tick (~10 s) plus an immediate hydrate frame on
 * connect. Same return shape as the REST hook so consumers don't need
 * to change.
 *
 * Connection state (connecting / open / reconnecting / closed) is
 * exposed so `App.tsx` can raise a "connection lost" modal after a
 * sustained outage.
 */
export function useListenerHealthWs({
  url = '/ws/listener-health',
  enabled = true,
}: Options = {}) {
  const [snapshot, setSnapshot] = useState<ListenerHealthSnapshot>(EMPTY);

  const ws = useWebSocket<ServerFrame>({
    url,
    enabled,
    onMessage: (frame) => {
      if (!frame) return;
      // The server sends either a hydrate frame or a listener-health frame
      // — both carry the full snapshot. The `type` field disambiguates.
      if (frame.type === 'hydrate' || frame.type === 'listener-health') {
        setSnapshot(prev => ({
          ok:               frame.ok               ?? prev.ok,
          as_of:            frame.as_of            ?? prev.as_of,
          poll_interval:    frame.poll_interval    ?? prev.poll_interval,
          down_threshold_s: frame.down_threshold_s ?? prev.down_threshold_s,
          sites:            frame.sites            ?? prev.sites,
          listeners:        frame.listeners        ?? prev.listeners,
          down_events:      frame.down_events      ?? prev.down_events,
          infra_events:     frame.infra_events     ?? prev.infra_events,
        }));
      }
    },
  });

  return {
    snapshot,
    wsStatus:      ws.status as WsStatus,
    statusSince:   ws.statusSince,
    lastMessageAt: ws.lastMessageAt,
  };
}
