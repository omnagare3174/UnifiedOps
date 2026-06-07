import { useEffect, type RefObject } from 'react';

export function useCursorTooltip(
  hostRef: RefObject<HTMLElement | null>,
  tipRef: RefObject<HTMLElement | null>,
  visible: boolean,
) {
  useEffect(() => {
    const host = hostRef.current;
    const tip = tipRef.current;
    if (!host || !tip) return;

    if (!visible) {
      tip.style.opacity = '0';
      tip.style.transform = 'translate3d(-9999px, -9999px, 0)';
      return;
    }

    tip.style.opacity = '1';

    let rafId: number | null = null;
    const onMove = (e: MouseEvent) => {
      const cx = e.clientX;
      const cy = e.clientY;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const tipW = tip.offsetWidth || 280;
        const tipH = tip.offsetHeight || 140;
        const x = Math.max(8, Math.min(window.innerWidth  - tipW - 8, cx - tipW / 2));
        const y = cy - tipH - 18 < 8
          ? Math.min(window.innerHeight - tipH - 8, cy + 18)
          : cy - tipH - 18;
        tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    host.addEventListener('mousemove', onMove);
    return () => {
      host.removeEventListener('mousemove', onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [hostRef, tipRef, visible]);
}
