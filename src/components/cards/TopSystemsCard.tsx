import { useState } from 'react';
import type { Location, SystemRow } from '../../types';
import { ExternalIcon } from '../icons/Icons';
import { Card, CardTitle } from './Card';

interface Props {
  systems: SystemRow[];
  onView?: () => void;
  onSystemClick?: (row: SystemRow) => void;
  className?: string;
}

const LOC_COLOR: Record<Location | 'ALL', { from: string; to: string; dot: string }> = {
  ALL:  { from: '#475569', to: '#94a3b8', dot: '#94a3b8' },
  CDVL: { from: '#1E90FF', to: '#00C2FF', dot: '#1E90FF' },
  BCP:  { from: '#7C3AED', to: '#9B5CFF', dot: '#9B5CFF' },
  SIFY: { from: '#00B894', to: '#00D26A', dot: '#00D26A' },
};

const TABS: Array<{ key: Location | 'ALL'; label: string }> = [
  { key: 'ALL',  label: 'All'  },
  { key: 'CDVL', label: 'CDVL' },
  { key: 'BCP',  label: 'BCP'  },
  { key: 'SIFY', label: 'SIFY' },
];

export function TopSystemsCard({ systems, onView, onSystemClick, className }: Props) {
  const [tab, setTab] = useState<Location | 'ALL'>('ALL');

  const filtered = tab === 'ALL'
    ? systems
    : systems.filter(s => s.location === tab);

  const max = Math.max(1, ...filtered.map(s => s.alerts));

  const useTwoCols = filtered.length > 5;
  const half = Math.ceil(filtered.length / 2);
  const col1 = useTwoCols ? filtered.slice(0, half) : filtered;
  const col2 = useTwoCols ? filtered.slice(half) : [];

  return (
    <Card className="card--top-systems">
      <CardTitle
        hint={`(${filtered.length} systems)`}
        action={
          <div className="row gap-2">
            <div className="top-tabs">
              {TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className={`top-tab ${tab === t.key ? 'top-tab--active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  <span
                    className="top-tab__dot"
                    style={{ background: LOC_COLOR[t.key].dot }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" className="card-title__action" onClick={onView}>
              View all systems <ExternalIcon size={11} />
            </button>
          </div>
        }
      >
        Top Systems by Alerts
      </CardTitle>

      <div className={`systems-grid ${useTwoCols ? '' : 'systems-grid--1col'}`}>
        <SystemColumn rows={col1} max={max} onClick={onSystemClick} />
        {useTwoCols && <SystemColumn rows={col2} max={max} onClick={onSystemClick} />}
      </div>
    </Card>
  );
}

interface ColProps {
  rows: SystemRow[];
  max: number;
  onClick?: (row: SystemRow) => void;
}

function SystemColumn({ rows, max, onClick }: ColProps) {
  return (
    <div className="systems-col">
      {rows.map(s => {
        const palette = LOC_COLOR[s.location];
        const width = `${Math.max(6, (s.alerts / max) * 100)}%`;
        return (
          <div
            key={s.name}
            className="system-row"
            title={s.name}
            onClick={() => onClick?.(s)}
          >
            <span className="system-row__name">{s.name}</span>
            <div
              className="bar"
              style={{
                width,
                ['--bar-from' as string]: palette.from,
                ['--bar-to' as string]: palette.to,
              }}
            />
            <span className="system-row__value">{s.alerts}</span>
          </div>
        );
      })}
    </div>
  );
}
