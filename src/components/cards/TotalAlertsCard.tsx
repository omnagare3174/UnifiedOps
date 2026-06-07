import { useRef, useState } from 'react';
import type { SparkPoint } from '../../types';
import { ArrowUpIcon } from '../icons/Icons';
import { AreaChart, type AreaPoint } from '../charts/AreaChart';
import { Card, CardTitle } from './Card';
import {
  SparkHoverTooltip,
  toneForValue,
  type SparkHoverPoint,
} from '../hover/SparkHoverTooltip';
import { useCursorTooltip } from '../../hooks/useCursorTooltip';

interface Props {
  total: number;
  delta: number;
  rangeLabel: string;
  spark: SparkPoint[];
  className?: string;
}

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function TotalAlertsCard({ total, delta, rangeLabel, spark, className }: Props) {
  const up = delta >= 0;
  const cardRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<SparkHoverPoint | null>(null);

  useCursorTooltip(cardRef, tipRef, point !== null);

  const chartData: AreaPoint[] = spark.map(p => ({
    value: p.value,
    ts: p.ts,
    timeLabel: fmtTime(p.ts),
  }));

  return (
    <Card className={`card--total ${className ?? ''}`} ref={cardRef}>
      <CardTitle hint={rangeLabel}>Total Alerts</CardTitle>

      <div className="total-body">
        <div className="total-bell" aria-hidden="true">
          <BellIcon size={24} />
        </div>
        <div className="total-meta">
          <div className="total-value">{total}</div>
          <div className={`total-delta total-delta--${up ? 'up' : 'down'}`}>
            <ArrowUpIcon
              size={11}
              style={{ transform: up ? 'none' : 'rotate(180deg)' }}
            />
            <span>
              {up ? '+' : ''}{delta} vs previous {rangeLabel.toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="spark-host">
        <AreaChart
          data={chartData}
          height={64}
          padding={{ top: 6, right: 4, bottom: 0, left: 4 }}
          lineColor="#FF7A6F"
          lineWidth={1.75}
          fillFrom="rgba(255, 122, 111, 0.40)"
          fillTo="rgba(255, 77, 79, 0.04)"
          showCrosshair={false}
          showHoverDot={false}
          interactionRef={cardRef}
          onHoverChange={(idx, p) => {
            if (idx === null || !p) {
              setPoint(null);
              return;
            }
            setPoint({
              value: p.value,
              timeLabel: p.timeLabel,
              tone: toneForValue(p.value),
            });
          }}
        />
      </div>

      <SparkHoverTooltip ref={tipRef} point={point} />
    </Card>
  );
}
