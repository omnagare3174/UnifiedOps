import type { CSSProperties } from 'react';

interface Props {
  width?:        number | string;
  height?:       number | string;
  borderRadius?: number | string;
  className?:    string;
  style?:        CSSProperties;
}

/**
 * Lightweight CSS-animated shimmering placeholder block. Used as a row
 * stand-in inside `AlertsDataTable` and as filler inside cards while
 * the first dashboard snapshot is in flight.
 *
 * Animation + colors live in app.css under `.skeleton`.
 */
export function Skeleton({
  width  = '100%',
  height = 12,
  borderRadius = 4,
  className,
  style,
}: Props) {
  return (
    <span
      className={`skeleton ${className ?? ''}`}
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}

interface RowProps {
  /** Number of cells to render per row. */
  cells:  number;
  /** Number of rows to render. */
  rows?:  number;
}

/**
 * Drop a batch of skeleton table rows. Each cell gets a slightly
 * randomised width so the placeholder reads as "loading data" rather
 * than as a uniform block.
 */
export function SkeletonRows({ cells, rows = 6 }: RowProps) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const tds = [];
    for (let c = 0; c < cells; c++) {
      // Wider for the storage / event columns, narrower for severity / IP.
      const w =
        c === cells - 1 ? '78%' :
        c === 0          ? '60%' :
        c === 1          ? '50%' :
                           `${60 + ((r * 13 + c * 7) % 30)}%`;
      tds.push(
        <td key={c}>
          <Skeleton width={w} height={9} />
        </td>,
      );
    }
    out.push(<tr key={r} className="alerts-row alerts-row--skeleton">{tds}</tr>);
  }
  return <>{out}</>;
}
