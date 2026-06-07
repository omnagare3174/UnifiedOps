import { useEffect } from 'react';
import { motion } from 'motion/react';
import type { ListenerDownEvent } from '../../hooks/useListenerHealth';

interface Props {
  event:        ListenerDownEvent;
  remaining:    number;        // how many more queued down events behind this one
  onAcknowledge: () => void;
}

const fmtSince = (epoch: number): string => {
  const d = new Date(epoch * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fmtAge = (s: number | null): string => {
  if (s === null || s === undefined) return '—';
  if (s < 60)   return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

export function ListenerDownModal({ event, remaining, onAcknowledge }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onAcknowledge();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onAcknowledge]);

  return (
    <div className="modal listener-modal" role="dialog" aria-modal="true">
      <motion.div
        className="modal__card listener-modal__card"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className="listener-modal__head">
          <span className="listener-modal__dot" />
          <div>
            <div className="listener-modal__eyebrow">LISTENER OUTAGE</div>
            <div className="listener-modal__title">
              {event.site} {event.oem} Listener Down
            </div>
          </div>
        </div>

        <div className="listener-modal__body">
          <p className="listener-modal__lede">
            No heartbeat received from <strong>{event.listener}</strong> in
            {' '}<strong>{fmtAge(event.age_s)}</strong>. Alerts for{' '}
            <strong>{event.site} {event.oem}</strong> may be stale until the
            listener is restored.
          </p>

          <div className="listener-modal__rows">
            <div className="listener-modal__row">
              <span className="listener-modal__key">Site</span>
              <span className="listener-modal__val">{event.site}</span>
            </div>
            <div className="listener-modal__row">
              <span className="listener-modal__key">Vendor</span>
              <span className="listener-modal__val">{event.oem}</span>
            </div>
            <div className="listener-modal__row">
              <span className="listener-modal__key">Listener service</span>
              <span className="listener-modal__val cell-mono">{event.listener}</span>
            </div>
            <div className="listener-modal__row">
              <span className="listener-modal__key">Down since</span>
              <span className="listener-modal__val cell-mono">{fmtSince(event.down_since)}</span>
            </div>
          </div>

          <div className="listener-modal__hint">
            <strong>What to do:</strong> SSH to the {event.site} pipeline VM
            and check <code>systemctl status hi-track-listener-{event.oem.toLowerCase()}-{event.site.toLowerCase()}</code>.
            Heartbeat resumes automatically when the service is back; this card
            will clear on its own.
          </div>
        </div>

        <div className="listener-modal__foot">
          {remaining > 0 && (
            <span className="listener-modal__queue">
              {remaining} more {remaining === 1 ? 'outage' : 'outages'} queued
            </span>
          )}
          <button
            type="button"
            className="btn-primary listener-modal__btn"
            onClick={onAcknowledge}
            autoFocus
          >
            Acknowledge
          </button>
        </div>
      </motion.div>
    </div>
  );
}
