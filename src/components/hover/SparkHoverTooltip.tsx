import { forwardRef } from 'react';

export interface SparkHoverPoint {
  value: number;
  timeLabel?: string;
  tone: 'critical' | 'warning' | 'moderate' | 'quiet';
}

const TONE_COLOR: Record<SparkHoverPoint['tone'], string> = {
  critical: '#ef4444',
  warning:  '#f97316',
  moderate: '#eab308',
  quiet:    '#64748b',
};

interface Props {
  point: SparkHoverPoint | null;
}

export const SparkHoverTooltip = forwardRef<HTMLDivElement, Props>(
  function SparkHoverTooltip({ point }, ref) {
    return (
      <div ref={ref} className="alert-hover" role="tooltip" aria-hidden={!point}>
        {point && (
          <>
            <div className="alert-hover__head">
              <span
                className="alert-hover__dot"
                style={{ background: TONE_COLOR[point.tone] }}
              />
              <span className="alert-hover__title">Alert burst</span>
              <span
                className="alert-hover__sev"
                style={{ color: TONE_COLOR[point.tone] }}
              >
                {point.tone}
              </span>
            </div>
            {point.timeLabel && (
              <div className="alert-hover__row">
                <span className="alert-hover__key">Time</span>
                <span className="alert-hover__val cell-mono">{point.timeLabel}</span>
              </div>
            )}
            <div className="alert-hover__row">
              <span className="alert-hover__key">Alerts</span>
              <span
                className="alert-hover__val"
                style={{ color: TONE_COLOR[point.tone], fontWeight: 700 }}
              >
                {point.value}
              </span>
            </div>
          </>
        )}
      </div>
    );
  },
);

export const toneForValue = (v: number): SparkHoverPoint['tone'] =>
  v >= 5 ? 'critical' : v >= 2 ? 'warning' : v > 0 ? 'moderate' : 'quiet';
