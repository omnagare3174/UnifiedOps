import { useEffect } from 'react';
import type { RecentAlert, Severity } from '../../types';
import { AlertRowHoverCard } from '../hover/AlertRowHoverCard';
import { useAlertRowHover } from '../../hooks/useAlertRowHover';

export interface ModalFilters {
  severity?: Severity;
  category?: string;
  storage?: string;
}

interface Props {
  open: boolean;
  rangeLabel: string;
  filters: ModalFilters | null;
  alerts: RecentAlert[];
  onClose: () => void;
}

const matches = (a: RecentAlert, f: ModalFilters | null) => {
  if (!f) return true;
  if (f.severity && a.severity !== f.severity) return false;
  if (f.storage && a.storageName !== f.storage) return false;
  if (f.category && a.category !== f.category) return false;
  return true;
};

const SEV_COLOR: Record<Severity, string> = {
  critical:      '#f87171',
  error:         '#f9a8a3',
  warning:       '#fb923c',
  notice:        '#facc15',
  informational: '#60a5fa',
};

export function AlertDetailsModal({
  open, rangeLabel, filters, alerts, onClose,
}: Props) {
  const { hover, onMove, onLeave } = useAlertRowHover();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = alerts.filter(a => matches(a, filters));
  const chips: Array<{ label: string; value: string }> = [];
  if (filters?.severity) chips.push({ label: 'Severity', value: filters.severity });
  if (filters?.category) chips.push({ label: 'Category', value: filters.category });
  if (filters?.storage)  chips.push({ label: 'System',   value: filters.storage });

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <span className="modal__title">Alert Details</span>
            <span className="modal__sub">{rangeLabel} · {filtered.length} matching</span>
          </div>
          <button
            type="button"
            className="modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {chips.length > 0 && (
          <div className="modal__filters">
            {chips.map(c => (
              <span key={c.label} className="modal__filter-chip">
                {c.label}: <strong>{c.value}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="modal__body">
          <table className="alerts-table">
            <thead>
              <tr>
                <th className="col-time">Time Stamp</th>
                <th>Severity</th>
                <th className="col-name">Storage Name</th>
                <th className="col-ip">Storage IP</th>
                <th>Event Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No matching alerts in {rangeLabel.toLowerCase()}
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr key={i} className={`alerts-row alerts-row--${a.severity}`}>
                    <td>{a.time}</td>
                    <td>
                      <span
                        className="alert-list__sev"
                        style={{ color: SEV_COLOR[a.severity] }}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="cell-mono">{a.storageName}</td>
                    <td className="cell-mono">{a.ip}</td>
                    <td>{a.event}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
