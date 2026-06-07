import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { WsStatus } from '../../hooks/useWebSocket';

interface Props {
  alertsStatus:         WsStatus;
  listenerHealthStatus: WsStatus;
  alertsStatusSince:    number;
  listenerStatusSince:  number;
  graceMs?: number;
}

const fmtAge = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

/**
 * Surfaces when BOTH the alert and listener-health WebSockets have been
 * non-`open` for longer than `graceMs` (default 30 s). Treats a brief
 * reconnect storm as transient — only sustained loss raises the modal.
 *
 * One socket flapping is not enough to trigger the modal; the design
 * assumption is that the FastAPI process hosts both endpoints, so when
 * the process is healthy at least one of them is up.
 */
export function ConnectionLostModal({
  alertsStatus,
  listenerHealthStatus,
  alertsStatusSince,
  listenerStatusSince,
  graceMs = 30000,
}: Props) {
  const [, force] = useState(0);
  // Re-render every second while either socket is non-open so the
  // displayed "down for Ns" counter advances.
  useEffect(() => {
    const id = window.setInterval(() => force(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const aDown = alertsStatus !== 'open';
  const hDown = listenerHealthStatus !== 'open';

  // If either is currently open we trust the backend; don't show.
  if (!aDown || !hDown) return null;

  const aFor = now - alertsStatusSince;
  const hFor = now - listenerStatusSince;
  const downFor = Math.min(aFor, hFor);
  if (downFor < graceMs) return null;

  return (
    <div className="modal listener-modal" role="dialog" aria-modal="true">
      <motion.div
        className="modal__card listener-modal__card ws-modal__card"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className="listener-modal__head ws-modal__head">
          <span className="listener-modal__dot ws-modal__dot" />
          <div>
            <div className="listener-modal__eyebrow ws-modal__eyebrow">
              WEBSOCKET DISCONNECTED
            </div>
            <div className="listener-modal__title">
              Live feed lost — reconnecting…
            </div>
          </div>
        </div>

        <div className="listener-modal__body">
          <p className="listener-modal__lede">
            The browser can&rsquo;t reach the UnifiedOps backend right now.
            Cached metrics are being shown; no new alerts will arrive until
            the connection recovers.
          </p>

          <div className="listener-modal__rows">
            <div className="listener-modal__row">
              <span className="listener-modal__key">/ws/alerts</span>
              <span className="listener-modal__val">
                {alertsStatus} (for {fmtAge(aFor)})
              </span>
            </div>
            <div className="listener-modal__row">
              <span className="listener-modal__key">/ws/listener-health</span>
              <span className="listener-modal__val">
                {listenerHealthStatus} (for {fmtAge(hFor)})
              </span>
            </div>
          </div>

          <div className="listener-modal__hint ws-modal__hint">
            <strong>What to check:</strong> the FastAPI <code>server.py</code>
            {' '}service on the UI VM — <code>systemctl status unifiedops-ui-server</code>.
            The page will refresh on its own as soon as either socket
            re-opens; no manual reload required.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
