import { create } from 'zustand';
import type { Location, Severity, Vendor } from '../types';

/**
 * Modal state for the dashboard:
 *  - Alert Details modal (open + active filter context the trigger sent)
 *  - One-shot listener-down acknowledgement bookkeeping
 *  - One-shot infrastructure-down acknowledgement bookkeeping
 */
export interface ModalFilters {
  severity?: Severity;
  category?: string;
  storage?:  string;
  vendor?:   Vendor;
  location?: Location;
}

export interface ModalState {
  // Alert Details modal ---------------------------------------------
  modalOpen:    boolean;
  modalFilters: ModalFilters | null;
  openModal:    (filters: ModalFilters | null) => void;
  closeModal:   () => void;

  // Listener-down / infra-down acknowledgements ---------------------
  ackedKeys:           Set<string>;
  ackedInfraKeys:      Set<string>;
  acknowledgeKey:      (key: string) => void;
  acknowledgeInfraKey: (key: string) => void;
  /**
   * Drop ack entries whose underlying event is no longer present in
   * the server snapshot — so a NEW outage with a fresh event_key
   * fires the modal again instead of being suppressed by the previous
   * ack. Called from the listener-health WS ingest path.
   */
  syncAcks: (activeKeys: string[], activeInfraKeys: string[]) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  modalOpen:    false,
  modalFilters: null,
  openModal:    (filters) => set({ modalOpen: true, modalFilters: filters }),
  closeModal:   () => set({ modalOpen: false }),

  ackedKeys:           new Set<string>(),
  ackedInfraKeys:      new Set<string>(),
  acknowledgeKey:      (key) => set(s => {
    const next = new Set(s.ackedKeys); next.add(key);
    return { ackedKeys: next };
  }),
  acknowledgeInfraKey: (key) => set(s => {
    const next = new Set(s.ackedInfraKeys); next.add(key);
    return { ackedInfraKeys: next };
  }),

  syncAcks: (activeKeys, activeInfraKeys) => set(s => {
    const active      = new Set(activeKeys);
    const activeInfra = new Set(activeInfraKeys);
    let next      = s.ackedKeys;
    let nextInfra = s.ackedInfraKeys;
    if (s.ackedKeys.size > 0) {
      next = new Set<string>();
      let dropped = false;
      for (const k of s.ackedKeys) {
        if (active.has(k)) next.add(k);
        else dropped = true;
      }
      if (!dropped) next = s.ackedKeys;
    }
    if (s.ackedInfraKeys.size > 0) {
      nextInfra = new Set<string>();
      let dropped = false;
      for (const k of s.ackedInfraKeys) {
        if (activeInfra.has(k)) nextInfra.add(k);
        else dropped = true;
      }
      if (!dropped) nextInfra = s.ackedInfraKeys;
    }
    if (next === s.ackedKeys && nextInfra === s.ackedInfraKeys) return s;
    return { ackedKeys: next, ackedInfraKeys: nextInfra };
  }),
}));
