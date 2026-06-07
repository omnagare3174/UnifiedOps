import type { TrendPoint } from '../../types';
import { AreaChart, type AreaPoint } from '../charts/AreaChart';
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
          height={130}
          padding={{ top: 8, right: 10, bottom: 18, left: 30 }}
          lineColor="#FF7A6F"
          lineWidth={1.7}
          fillFrom="rgba(255, 122, 111, 0.4)"
          fillTo="rgba(255, 77, 79, 0.05)"
          showXAxis
          showYAxis
          showGrid
          yTickCount={4}
          xTickCount={6}
          renderTooltip={(p: AreaPoint) => (
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
