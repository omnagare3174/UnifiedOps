import { Card, CardTitle } from './Card';

interface Props {
  alertCount: number;
  rangeLabel: string;
  onView?: () => void;
  className?: string;
}

type Tone = 'ok' | 'warn' | 'crit';

const toneFor = (count: number): Tone => {
  if (count === 0) return 'ok';
  if (count >= 5) return 'crit';
  return 'warn';
};

export function NTPCard({ alertCount, rangeLabel, onView, className }: Props) {
  const tone = toneFor(alertCount);

  return (
    <Card
      className={`card--ntp card--ntp--${tone} card--clickable ${className ?? ''}`}
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView?.();
        }
      }}
      title="Click to view NTP / time-sync alerts"
    >
      <NTPBackdrop />

      <CardTitle hint="(Network Time Protocol)">NTP</CardTitle>

      <div className="ntp-body">
        <div className="ntp-count">
          <span className="ntp-count__value">{alertCount}</span>
          <span className="ntp-count__sub">
            {alertCount === 1 ? 'alert' : 'alerts'} in {rangeLabel.toLowerCase()}
          </span>
        </div>
      </div>

      <div className="ntp-cta-row">
        <span className="ntp-cta-text">CLICK TO VIEW DETAILS</span>
      </div>
    </Card>
  );
}

function NTPBackdrop() {
  // Pentagonal constellation: 5 outer nodes connected to each other + to a
  // central node. The whole rig rotates slowly while each node fades in/out.
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = ((i * 72) - 90) * Math.PI / 180;
    return {
      x: 100 + Math.cos(angle) * 58,
      y: 100 + Math.sin(angle) * 58,
    };
  });

  return (
    <svg
      className="ntp-backdrop"
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ntp-halo" cx="50%" cy="50%" r="60%">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r="90" fill="url(#ntp-halo)" className="ntp-bg__halo" />

      <g className="ntp-bg__rotor">
        {/* Perimeter polygon connecting outer nodes */}
        {points.map((p, i) => {
          const next = points[(i + 1) % points.length];
          return (
            <line key={`p${i}`}
              x1={p.x} y1={p.y} x2={next.x} y2={next.y}
              stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.55" />
          );
        })}

        {/* Spokes from center to each node */}
        {points.map((p, i) => (
          <line key={`s${i}`}
            x1="100" y1="100" x2={p.x} y2={p.y}
            stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.45"
            strokeDasharray="2 3" />
        ))}

        {/* Outer nodes - halo + core */}
        {points.map((p, i) => (
          <g key={`n${i}`}>
            <circle cx={p.x} cy={p.y} r="6"
              fill="currentColor"
              className={`ntp-bg__node-halo ntp-bg__node-halo--${i}`} />
            <circle cx={p.x} cy={p.y} r="2"
              fill="currentColor" fillOpacity="0.9" />
          </g>
        ))}
      </g>

      {/* Central pulse */}
      <g className="ntp-bg__center">
        <circle cx="100" cy="100" r="10"
          fill="currentColor" className="ntp-bg__center-halo" />
        <circle cx="100" cy="100" r="3"
          fill="currentColor" fillOpacity="0.85" />
      </g>
    </svg>
  );
}
