import type { RecentAlert, Severity } from '../../types';

const SEV_COLOR: Record<Severity, string> = {
  critical:      '#FF4D4F',
  error:         '#FF7A6F',
  warning:       '#FFB020',
  notice:        '#FACC15',
  informational: '#4DA3FF',
};

interface Props {
  alert: RecentAlert;
  x: number;
  y: number;
}

export function AlertRowHoverCard({ alert, x, y }: Props) {
  const color = SEV_COLOR[alert.severity];
  return (
    <div
      className="alert-hover alert-hover--static"
      style={{
        left: x,
        top: y,
        transform: 'none',
        opacity: 1,
        width: 300,
      }}
      role="tooltip"
    >
      <div className="alert-hover__head">
        <span className="alert-hover__dot" style={{ background: color }} />
        <span className="alert-hover__title">{alert.category}</span>
        <span className="alert-hover__sev" style={{ color }}>
          {alert.severity}
        </span>
      </div>

      <div className="alert-hover__row">
        <span className="alert-hover__key">Storage</span>
        <span className="alert-hover__val">{alert.storageName}</span>
      </div>
      <div className="alert-hover__row">
        <span className="alert-hover__key">Source IP</span>
        <span className="alert-hover__val cell-mono">{alert.ip}</span>
      </div>
      <div className="alert-hover__row">
        <span className="alert-hover__key">Location</span>
        <span className="alert-hover__val">{alert.location}</span>
      </div>
      <div className="alert-hover__row">
        <span className="alert-hover__key">Time</span>
        <span className="alert-hover__val cell-mono">{alert.time}</span>
      </div>

      {alert.event && (
        <div className="alert-hover__msg" title={alert.event}>
          {alert.event}
        </div>
      )}
    </div>
  );
}
