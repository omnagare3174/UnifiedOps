import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ClockIcon } from '../icons/Icons';
import { RANGE_OPTIONS } from '../../data/mockData';
import type { RangeKey } from '../../types';

interface Props {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}

export function RangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = RANGE_OPTIONS.find(o => o.key === value);

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
        <span>{current?.label ?? value}</span>
        <ChevronDownIcon size={14} className={open ? 'chev chev--open' : 'chev'} />
      </button>

      {open && (
        <div className="dropdown-menu dropdown-menu--right" role="menu">
          {RANGE_OPTIONS.map(o => (
            <button
              type="button"
              key={o.key}
              className={`dropdown-item ${o.key === value ? 'is-checked' : ''}`}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
            >
              <span className="check-box">{o.key === value ? '✓' : ''}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
