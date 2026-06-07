import type { TrendPoint } from '../../types';
import { AreaChart } from '../charts/AreaChart';
import { Card, CardTitle } from './Card';

interface Props {
  data: TrendPoint[];
  rangeLabel: string;
  className?: string;
}

export function AlertTrendCard({ data, rangeLabel, className }: Props) {
  return (
    <Card className={`card--trend ${className ?? ''}`}>
      <CardTitle hint={rangeLabel}>Alert Trend</CardTitle>
      <div className="trend-host">
        <AreaChart
          data={data.map(d => ({ value: d.value, label: d.label, ts: d.ts }))}
          height={170}
          padding={{ top: 12, right: 10, bottom: 22, left: 30 }}
          lineColor="#f97066"
          lineWidth={1.8}
          fillFrom="rgba(251, 146, 60, 0.45)"
          fillTo="rgba(220, 38, 38, 0.06)"
          showXAxis
          showYAxis
          showGrid
          yTickCount={4}
          xTickCount={6}
          renderTooltip={(p) => (
            <div className="trend-tip">
              {p.label && <span className="trend-tip__time">{p.label}</span>}
              {p.label && <span className="trend-tip__sep">·</span>}
              <span className="trend-tip__val">alerts {p.value}</span>
            </div>
          )}
        />
      </div>
    </Card>
  );
}
