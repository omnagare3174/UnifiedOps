import type { SystemStatus } from '../../types';

interface Props {
  status: SystemStatus;
}

const LABELS: Record<SystemStatus, string> = {
  live: 'Live',
  fetching: 'Fetching',
  error: 'Error',
};

export function LiveBadge({ status }: Props) {
  return (
    <div className={`status-pill status-pill--${status}`} role="status">
      <span className="status-pill__dot" />
      <span>{LABELS[status]}</span>
    </div>
  );
}
