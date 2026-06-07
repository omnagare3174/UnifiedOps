import { useEffect, useMemo, useRef, useState } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;                   // '' means "all"
  options: FilterOption[];         // does NOT include the "All" sentinel
  allLabel?: string;               // default "All"
  searchable?: boolean;            // show a search box inside the popover
  width?: number | string;
  onChange: (next: string) => void;
}

export function FilterSelect({
  label,
  value,
  options,
  allLabel = 'All',
  searchable,
  width,
  onChange,
}: Props) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const rootRef           = useRef<HTMLDivElement>(null);
  const searchRef         = useRef<HTMLInputElement>(null);

  const allOptions: FilterOption[] = useMemo(
    () => [{ value: '', label: allLabel }, ...options],
    [options, allLabel],
  );

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [allOptions, query, searchable]);

  const currentLabel =
    allOptions.find(o => o.value === value)?.label ?? allLabel;

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search input when popover opens
  useEffect(() => {
    if (open && searchable) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open, searchable]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="modal-filter">
      <label className="modal-filter__label">{label}</label>
      <div className="filter-select" ref={rootRef} style={{ width }}>
        <button
          type="button"
          className={`filter-select__trigger ${open ? 'is-open' : ''} ${value ? 'has-value' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span className="filter-select__value" title={currentLabel}>
            {currentLabel}
          </span>
          <svg
            className={`filter-select__chev ${open ? 'is-open' : ''}`}
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="filter-select__menu" role="listbox">
            {searchable && (
              <div className="filter-select__search">
                <input
                  ref={searchRef}
                  type="text"
                  className="filter-select__search-input"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
            <div className="filter-select__list">
              {visible.length === 0 ? (
                <div className="filter-select__empty">No matches</div>
              ) : (
                visible.map(o => {
                  const active = o.value === value;
                  return (
                    <button
                      type="button"
                      key={o.value || '__all__'}
                      role="option"
                      aria-selected={active}
                      className={`filter-select__option ${active ? 'is-active' : ''}`}
                      onClick={() => pick(o.value)}
                    >
                      <span className="filter-select__check" aria-hidden="true">
                        {active ? '✓' : ''}
                      </span>
                      <span className="filter-select__label" title={o.label}>
                        {o.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
