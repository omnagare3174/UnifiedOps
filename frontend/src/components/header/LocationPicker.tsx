import { useEffect, useRef, useState } from 'react';
import type { Location } from '../../types';
import { ChevronDownIcon, LocationIcon } from '../icons/Icons';

interface Props {
  selected: Location[];
  all: Location[];
  onChange: (next: Location[]) => void;
}

export function LocationPicker({ selected, all, onChange }: Props) {
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

  const allSelected = selected.length === all.length;
  const label = allSelected ? 'All Locations' : selected.join(' + ');

  const toggle = (loc: Location) => {
    if (selected.includes(loc)) {
      if (selected.length === 1) return;
      onChange(selected.filter(s => s !== loc));
    } else {
      onChange(all.filter(s => selected.includes(s) || s === loc));
    }
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
        <LocationIcon size={14} />
        <span>{label}</span>
        <ChevronDownIcon size={14} className={open ? 'chev chev--open' : 'chev'} />
      </button>

      {open && (
        <div className="dropdown-menu" role="menu">
          <button
            type="button"
            className={`dropdown-item ${allSelected ? 'is-checked' : ''}`}
            onClick={() => onChange([...all])}
          >
            <span className="check-box">{allSelected ? '✓' : ''}</span>
            <span>All Locations</span>
          </button>
          <div className="dropdown-divider" />
          {all.map(loc => {
            const checked = selected.includes(loc);
            return (
              <button
                type="button"
                key={loc}
                className={`dropdown-item ${checked ? 'is-checked' : ''}`}
                onClick={() => toggle(loc)}
              >
                <span className="check-box">{checked ? '✓' : ''}</span>
                <span
                  className="dot"
                  style={{
                    background:
                      loc === 'CDVL' ? '#6366f1'
                        : loc === 'BCP' ? '#a855f7' : '#2dd4bf',
                  }}
                />
                <span>{loc}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
