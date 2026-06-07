import { create } from 'zustand';
import type {
  ListenerRow,
  ListenerDownEvent,
  SiteHealth,
  InfraEvent,
} from '../hooks/useListenerHealth';
import type { WsStatus } from '../hooks/useWebSocket';

/**
 * Zustand store for listener heartbeat / site reachability.
 *
 * Mirrors the server's /ws/listener-health payload one-for-one; the
 * connector pushes hydrate + listener-health frames into the same
 * `ingest()` action so there's no duplication of merge logic.
 */
export interface ListenerHealthState {
  sites:           SiteHealth[];
  listeners:       ListenerRow[];
  downEvents:      ListenerDownEvent[];
  infraEvents:     InfraEvent[];
  pollInterval:    number;
  downThresholdS:  number;
  asOf:            number;
  wsStatus:        WsStatus;
  statusSince:     number;
  lastMessageAt:   number;

  ingest:      (frame: HealthFrame) => void;
  setWsStatus: (s: WsStatus) => void;
  notePing:    () => void;
  reset:       () => void;
}

export interface HealthFrame {
  type:             'hydrate' | 'listener-health';
  ok?:              boolean;
  as_of?:           number;
  poll_interval?:   number;
  down_threshold_s?: number;
  sites?:           SiteHealth[];
  listeners?:       ListenerRow[];
  down_events?:     ListenerDownEvent[];
  infra_events?:    InfraEvent[];
}

export const useListenerHealthStore = create<ListenerHealthState>((set, get) => ({
  sites:           [],
  listeners:       [],
  downEvents:      [],
  infraEvents:     [],
  pollInterval:    10,
  downThresholdS:  30,
  asOf:            0,
  wsStatus:        'connecting',
  statusSince:     Date.now(),
  lastMessageAt:   0,

  ingest: (frame) => {
    set({
      sites:           frame.sites           ?? get().sites,
      listeners:       frame.listeners       ?? get().listeners,
      downEvents:      frame.down_events     ?? get().downEvents,
      infraEvents:     frame.infra_events    ?? get().infraEvents,
      pollInterval:    frame.poll_interval   ?? get().pollInterval,
      downThresholdS:  frame.down_threshold_s ?? get().downThresholdS,
      asOf:            frame.as_of           ?? get().asOf,
      lastMessageAt:   Date.now(),
    });
    // Dynamic import to avoid a circular dep at module-load time; safe
    // because `useModalStore` is independently registered with zustand
    // before any frame can arrive (App.tsx mounts both before opening WS).
    import('./useModalStore').then(({ useModalStore }) => {
      useModalStore.getState().syncAcks(
        (frame.down_events  ?? get().downEvents ).map(e => e.key),
        (frame.infra_events ?? get().infraEvents).map(e => e.key),
      );
    }).catch(() => { /* ignore */ });
  },

  setWsStatus: (s) => {
    if (get().wsStatus === s) return;
    set({ wsStatus: s, statusSince: Date.now() });
  },

  notePing: () => set({ lastMessageAt: Date.now() }),

  reset: () => set({
    sites: [], listeners: [], downEvents: [], infraEvents: [], asOf: 0,
  }),
}));
