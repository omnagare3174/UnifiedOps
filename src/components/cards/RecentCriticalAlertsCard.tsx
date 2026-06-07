import type { RecentAlert, Severity } from '../../types';
import { ExternalIcon } from '../icons/Icons';
import { Card, CardTitle } from './Card';
import { AlertRowHoverCard } from '../hover/AlertRowHoverCard';
import { useAlertRowHover } from '../../hooks/useAlertRowHover';

interface Props {
  alerts: RecentAlert[];
  rangeLabel: string;
  onView?: () => void;
  className?: string;
}

const ROW_CLASS: Record<Severity, string> = {
  critical:      'alerts-row--critical',
  error:         'alerts-row--error',
  warning:       'alerts-row--warning',
  notice:        'alerts-row--notice',
  informational: 'alerts-row--informational',
};

const SEV_COLOR: Record<Severity, string> = {
  critical:      '#f87171',
  error:         '#f9a8a3',
  warning:       '#fb923c',
  notice:        '#facc15',
  informational: '#60a5fa',
};

export function RecentCriticalAlertsCard({
  alerts,
  rangeLabel,
  onView,
  className,
}: Props) {
  const { hover, onMove, onLeave } = useAlertRowHover();

  return (
    <Card
      className={`card--recent card--clickable ${className ?? ''}`}
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView?.();
        }
      }}
      title="Click to view all alerts"
    >
      <CardTitle
        action={
          <button type="button" className="card-title__action">
            View all <ExternalIcon size={11} />
          </button>
        }
      >
        Recent Critical Alerts
      </CardTitle>

      <div className="table-wrap">
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
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No alerts in {rangeLabel.toLowerCase()}
                </td>
              </tr>
            ) : (
              alerts.map((a, i) => (
                <tr
                  key={i}
                  className={`alerts-row ${ROW_CLASS[a.severity]}`}
                  onMouseEnter={onRowMove(a)}
                  onMouseMove={onRowMove(a)}
                  onMouseLeave={onRowLeave}
                >
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
                  <td className="cell-truncate" title={a.event}>{a.event}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hover && (
        <AlertRowHoverCard alert={hover.alert} x={hover.x} y={hover.y} />
      )}
    </Card>
  );
}
