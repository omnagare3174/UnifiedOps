import { create } from 'zustand';
import type { Location, TimeRange, VendorFilter } from '../types';

/**
 * Header / dashboard filter state — range, locations, active vendor pill.
 *
 * Everything in this store drives the `/ws/dashboard` subscription via
 * `wsConnector`, so any setter here propagates to the backend on the
 * next render tick (the connector's effect watches the same fields).
 */
const ALL_LOCATIONS: Location[] = ['CDVL', 'BCP', 'SIFY'];

export interface FilterState {
  range:          TimeRange;
  locations:      Location[];
  selectedVendor: VendorFilter;

  setRange:          (r: TimeRange)        => void;
  setLocations:      (l: Location[])       => void;
  setSelectedVendor: (v: VendorFilter)     => void;
  toggleLocation:    (l: Location)         => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  range:          { kind: 'relative', key: '6h' },
  locations:      ALL_LOCATIONS,
  selectedVendor: 'total',

  setRange:          (r) => set({ range: r }),
  setLocations:      (l) => set({ locations: l }),
  setSelectedVendor: (v) => set({ selectedVendor: v }),
  toggleLocation:    (l) => {
    const cur = get().locations;
    set({
      locations: cur.includes(l)
        ? cur.filter(x => x !== l)
        : [...cur, l],
    });
  },
}));
