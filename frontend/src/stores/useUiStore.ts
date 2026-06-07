import { create } from 'zustand';
import type { Severity, SystemStatus } from '../types';

/**
 * App-level UI state — transient surface effects like toasts, screen
 * blink, header status pill, refresh spinner.
 *
 * Toasts auto-dismiss themselves on a 6 s timer set from inside the
 * `pushToast` action so callers don't have to.
 */
export interface ToastItem {
  id:       number;
  severity: Severity;
  title:    string;
  message:  string;
}

export interface UiState {
  // Toast stack (bottom-right) ----------------------------------------
  toasts:       ToastItem[];
  pushToast:    (t: Omit<ToastItem, 'id'>, ttlMs?: number) => void;
  dismissToast: (id: number) => void;

  // Screen blink (full-screen severity flash) -------------------------
  blinkColor:   string | null;
  blinkKey:     number;     // changing this key re-triggers the keyframe
  triggerBlink: (color: string) => void;

  // Header status pill / refresh button -------------------------------
  status:        SystemStatus;
  setStatus:     (s: SystemStatus) => void;
  refreshing:    boolean;
  setRefreshing: (b: boolean) => void;
}

const TOAST_TTL = 6000;
let _blinkSeq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts:       [],
  pushToast:    (t, ttlMs = TOAST_TTL) => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }));
    window.setTimeout(() => {
      const cur = get().toasts;
      if (cur.some(x => x.id === id)) {
        set({ toasts: cur.filter(x => x.id !== id) });
      }
    }, ttlMs);
  },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  blinkColor:   null,
  blinkKey:     0,
  triggerBlink: (color) => {
    _blinkSeq += 1;
    set({ blinkColor: color, blinkKey: _blinkSeq });
  },

  status:        'live',
  setStatus:     (s) => set({ status: s }),
  refreshing:    false,
  setRefreshing: (b) => set({ refreshing: b }),
}));
