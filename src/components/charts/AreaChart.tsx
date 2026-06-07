import { useId, useLayoutEffect, useRef, useState } from 'react';

export interface AreaPoint {
  value: number;
  label?: string;
  ts?: number;
}

interface Props {
  data: AreaPoint[];
  height?: number;
  lineColor?: string;
  lineWidth?: number;
  fillFrom?: string;
  fillTo?: string;
  smooth?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGrid?: boolean;
  yTickCount?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

const DEFAULT_PAD = { top: 10, right: 8, bottom: 24, left: 36 };

const buildSmoothPath = (pts: ReadonlyArray<readonly [number, number]>) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

const buildLinearPath = (pts: ReadonlyArray<readonly [number, number]>) =>
  pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');

export function AreaChart({
  data,
  height = 160,
  lineColor = '#f97066',
  lineWidth = 1.75,
  fillFrom = 'rgba(251, 146, 60, 0.40)',
  fillTo = 'rgba(220, 38, 38, 0.05)',
  smooth = true,
  showXAxis = false,
  showYAxis = false,
  showGrid = false,
  yTickCount = 4,
  padding,
}: Props) {
  const pad = { ...DEFAULT_PAD, ...padding };
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const id = useId().replace(/[:]/g, '');

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const maxV = Math.max(1, ...data.map(d => d.value));
  const yMax = Math.ceil(maxV * 1.15);
  const yMin = 0;
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = Math.max(0, height - pad.top - pad.bottom);

  const xAt = (i: number) =>
    data.length <= 1
      ? pad.left + plotW / 2
      : pad.left + (i / (data.length - 1)) * plotW;
  const yAt = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const pts = data.map((p, i) => [xAt(i), yAt(p.value)] as const);
  const linePath = smooth ? buildSmoothPath(pts) : buildLinearPath(pts);
  const baseY = pad.top + plotH;
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = pts.length
    ? `${linePath} L ${last[0]} ${baseY} L ${first[0]} ${baseY} Z`
    : '';

  const yTicks: number[] = [];
  if (showYAxis || showGrid) {
    const step = (yMax - yMin) / Math.max(1, yTickCount - 1);
    for (let i = 0; i < yTickCount; i++) yTicks.push(yMin + step * i);
  }

  const xTickIndices: number[] = [];
  if (showXAxis && data.length > 0) {
    const count = Math.min(6, data.length);
    if (data.length <= count) {
      for (let i = 0; i < data.length; i++) xTickIndices.push(i);
    } else {
      const step = (data.length - 1) / (count - 1);
      for (let i = 0; i < count; i++) xTickIndices.push(Math.round(i * step));
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', height }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient
              id={`grad-${id}`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={pad.top}
              x2={0}
              y2={pad.top + plotH}
            >
              <stop offset="0%" stopColor={fillFrom} />
              <stop offset="100%" stopColor={fillTo} />
            </linearGradient>
          </defs>

          {showGrid && yTicks.map((v, i) => (
            <line
              key={`g-${i}`}
              x1={pad.left}
              x2={width - pad.right}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="rgba(255,255,255,0.045)"
              strokeDasharray="3 3"
            />
          ))}

          {areaPath && <path d={areaPath} fill={`url(#grad-${id})`} />}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={lineColor}
              strokeWidth={lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showYAxis && yTicks.map((v, i) => (
            <text
              key={`yl-${i}`}
              x={pad.left - 6}
              y={yAt(v)}
              dy="0.32em"
              textAnchor="end"
              fontSize={10}
              fill="#64748b"
            >
              {Math.round(v)}
            </text>
          ))}

          {showXAxis && xTickIndices.map((i, k) => {
            const anchor =
              k === 0 ? 'start' : k === xTickIndices.length - 1 ? 'end' : 'middle';
            return (
              <text
                key={`xl-${k}`}
                x={xAt(i)}
                y={height - 4}
                textAnchor={anchor}
                fontSize={10}
                fill="#64748b"
              >
                {data[i]?.label ?? ''}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
