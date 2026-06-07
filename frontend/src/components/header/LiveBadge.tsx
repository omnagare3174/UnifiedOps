import { useState } from 'react';
import type { SystemStatus } from '../../types';

export interface DownService {
  /** Short label rendered as the row title in the tooltip */
  label:  string;
  /** Optional one-line description appended below the label */
  detail?: string;
  /** Visual tag — drives the dot colour on each tooltip row */
  kind?:  'listener' | 'heartbeat' | 'alert-store';
}

interface Props {
  status: SystemStatus;
  /** When non-empty, the badge flips to `warn` and surfaces the list on hover. */
  downServices?: DownService[];
}

const LABELS: Record<SystemStatus, string> = {
  live: 'Live',
  fetching: 'Fetching',
  error: 'Error',
};

const KIND_COLOR: Record<NonNullable<DownService['kind']>, string> = {
  listener:    '#FBBF24',
  heartbeat:   '#F87171',
  'alert-store': '#F87171',
};

const KIND_LABEL: Record<NonNullable<DownService['kind']>, string> = {
  listener:    'LISTENER',
  heartbeat:   'HEARTBEAT INFLUX',
  'alert-store': 'ALERT STORE',
};

export function LiveBadge({ status, downServices }: Props) {
  const [open, setOpen] = useState(false);

  const hasDown      = (downServices?.length ?? 0) > 0;
  const renderStatus = hasDown && status === 'live' ? 'warn' : status;
  const renderLabel  = hasDown && status === 'live' ? 'Warn' : LABELS[status];

  return (
    <div
      className={`status-pill status-pill--${renderStatus} ${hasDown ? 'status-pill--has-down' : ''}`}
      role="status"
      onMouseEnter={() => hasDown && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => hasDown && setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={hasDown ? 0 : -1}
      title={hasDown ? `${downServices!.length} service${downServices!.length === 1 ? '' : 's'} down — hover for details` : undefined}
    >
      <span className="status-pill__dot" />
      <span>{renderLabel}</span>
      {hasDown && (
        <span className="status-pill__badge" aria-label={`${downServices!.length} down`}>
          {downServices!.length}
        </span>
      )}

      {hasDown && open && (
        <div className="status-pill__tooltip" role="tooltip">
          <div className="status-pill__tooltip-head">
            {downServices!.length} service{downServices!.length === 1 ? '' : 's'} down
          </div>
          <ul className="status-pill__tooltip-list">
            {downServices!.map((s, i) => {
              const color = KIND_COLOR[s.kind ?? 'listener'];
              return (
                <li key={`${s.label}-${i}`} className="status-pill__tooltip-row">
                  <span className="status-pill__tooltip-dot" style={{ background: color }} />
                  <div className="status-pill__tooltip-text">
                    <div className="status-pill__tooltip-label">
                      <span className="status-pill__tooltip-kind" style={{ color }}>
                        {KIND_LABEL[s.kind ?? 'listener']}
                      </span>
                      <span>{s.label}</span>
                    </div>
                    {s.detail && (
                      <div className="status-pill__tooltip-detail">{s.detail}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
