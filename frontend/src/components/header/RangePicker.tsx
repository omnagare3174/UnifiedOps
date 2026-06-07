import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ClockIcon } from '../icons/Icons';
import { RANGE_OPTIONS } from '../../data/mockData';
import type { RangeKey, TimeRange } from '../../types';

interface Props {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
}

const toLocalInput = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const labelFor = (r: TimeRange): string => {
  if (r.kind === 'relative') {
    return RANGE_OPTIONS.find(o => o.key === r.key)?.label ?? r.key;
  }
  const s = new Date(r.start);
  const e = new Date(r.stop);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `${fmt(s)} → ${fmt(e)}`;
};

export function RangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const initStart = value.kind === 'custom' ? new Date(value.start) : yesterday;
  const initStop  = value.kind === 'custom' ? new Date(value.stop)  : now;
  const [customStart, setCustomStart] = useState(toLocalInput(initStart));
  const [customStop, setCustomStop] = useState(toLocalInput(initStop));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
        setErr(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pickRelative = (key: RangeKey) => {
    onChange({ kind: 'relative', key });
    setOpen(false);
    setShowCustom(false);
  };

  const applyCustom = () => {
    const a = new Date(customStart).getTime();
    const b = new Date(customStop).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) {
      setErr('Pick both start and end times.');
      return;
    }
    if (b <= a) {
      setErr('End time must be after start time.');
      return;
    }
    setErr(null);
    onChange({
      kind: 'custom',
      start: new Date(a).toISOString(),
      stop: new Date(b).toISOString(),
    });
    setOpen(false);
    setShowCustom(false);
  };

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="btn-pill"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ClockIcon size={14} />
        <span>{labelFor(value)}</span>
        <ChevronDownIcon size={14} className={open ? 'chev chev--open' : 'chev'} />
      </button>

      {open && !showCustom && (
        <div className="dropdown-menu dropdown-menu--right" role="menu">
          {RANGE_OPTIONS.map(o => {
            const active = value.kind === 'relative' && value.key === o.key;
            return (
              <button
                type="button"
                key={o.key}
                className={`dropdown-item ${active ? 'is-checked' : ''}`}
                onClick={() => pickRelative(o.key)}
              >
                <span className="check-box">{active ? '✓' : ''}</span>
                <span>{o.label}</span>
              </button>
            );
          })}
          <div className="dropdown-divider" />
          <button
            type="button"
            className={`dropdown-item ${value.kind === 'custom' ? 'is-checked' : ''}`}
            onClick={() => setShowCustom(true)}
          >
            <span className="check-box">{value.kind === 'custom' ? '✓' : ''}</span>
            <span>Custom range…</span>
          </button>
        </div>
      )}

      {open && showCustom && (
        <div className="dropdown-menu dropdown-menu--right dropdown-menu--wide" role="menu">
          <div className="dropdown-heading">Custom Range</div>
          <label className="custom-field">
            <span className="custom-field__label">From</span>
            <input
              type="datetime-local"
              className="custom-field__input"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label className="custom-field">
            <span className="custom-field__label">To</span>
            <input
              type="datetime-local"
              className="custom-field__input"
              value={customStop}
              onChange={(e) => setCustomStop(e.target.value)}
            />
          </label>
          {err && <div className="custom-error">{err}</div>}
          <div className="custom-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setShowCustom(false); setErr(null); }}
            >
              Back
            </button>
            <button type="button" className="btn-primary" onClick={applyCustom}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
