import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { RecentAlert } from '../types';

const HOVER_W = 300;
const HOVER_H = 200;

interface HoverState {
  alert: RecentAlert;
  x: number;
  y: number;
}

const positionFor = (clientX: number, clientY: number): { x: number; y: number } => {
  const pad = 14;
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + HOVER_W > window.innerWidth  - 8) x = Math.max(8, clientX - HOVER_W - pad);
  if (y + HOVER_H > window.innerHeight - 8) y = Math.max(8, clientY - HOVER_H - pad);
  return { x, y };
};

export function useAlertRowHover() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const rafRef = useRef<number | null>(null);

  const onMove = (a: RecentAlert) => (e: ReactMouseEvent) => {
    const cx = e.clientX;
    const cy = e.clientY;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const { x, y } = positionFor(cx, cy);
      setHover({ alert: a, x, y });
    });
  };

  const onLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHover(null);
  };

  return { hover, onMove, onLeave };
}
