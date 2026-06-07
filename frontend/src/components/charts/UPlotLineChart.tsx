import { useEffect, useRef } from 'react';
import uPlot, { type Options as UPlotOptions, type AlignedData } from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface UPlotPoint {
  ts:    number;        // epoch ms
  value: number;
  label?: string;
}

interface Props {
  data:        UPlotPoint[];
  height?:     number;
  lineColor?:  string;
  fillFrom?:   string;
  fillTo?:     string;
  className?:  string;
  /** Label for the y-value in the tooltip (e.g. "alerts"). */
  yLabel?:     string;
}

const PAD_X = 6;
const PAD_Y = 10;

const fmtTooltipTime = (ts: number, durationMs: number): string => {
  const d = new Date(ts);
  if (durationMs > 36 * 60 * 60 * 1000) {
    return d.toLocaleString([], {
      month: 'short', day: 'numeric',
      hour:  '2-digit', minute: '2-digit',
    });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * Thin React wrapper around uPlot with a cursor-driven tooltip.
 *
 * On live updates we call `u.setData()` instead of recreating the chart
 * — uPlot keeps the canvas allocated and animates smoothly.
 *
 * uPlot wants time as **seconds**; we accept epoch-ms points and divide
 * once when assembling the AlignedData tuple. The tooltip then converts
 * back to ms for human-readable formatting.
 */
export function UPlotLineChart({
  data,
  height    = 130,
  lineColor = '#FF7A6F',
  fillFrom  = 'rgba(255, 122, 111, 0.4)',
  fillTo    = 'rgba(255, 77, 79, 0.05)',
  className,
  yLabel    = 'alerts',
}: Props) {
  const hostRef    = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const uRef       = useRef<uPlot | null>(null);

  const sorted = [...data].sort((a, b) => a.ts - b.ts);
  const ad: AlignedData = [
    sorted.map(p => Math.floor(p.ts / 1000)),
    sorted.map(p => p.value),
  ];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Build a single floating tooltip element managed by the cursor hook.
    const tip = document.createElement('div');
    tip.className = 'uplot-tip';
    tip.style.cssText = `
      position: absolute;
      pointer-events: none;
      display: none;
      padding: 6px 9px;
      border-radius: 6px;
      background: rgba(15, 18, 22, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e6e9ee;
      font: 500 11px Inter, system-ui, sans-serif;
      white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      z-index: 50;
      transition: transform 60ms linear, opacity 80ms ease;
      opacity: 0;
    `;
    host.style.position = 'relative';
    host.appendChild(tip);
    tooltipRef.current = tip;

    const buildOpts = (w: number): UPlotOptions => ({
      width:  w,
      height,
      cursor: {
        x:     true,
        y:     false,
        drag:  { x: false, y: false, setScale: false },
        focus: { prox: 30 },
        points: { show: false },
      },
      legend: { show: false },
      hooks: {
        setCursor: [
          (u) => {
            const t = tooltipRef.current;
            if (!t) return;
            const idx = u.cursor.idx;
            if (idx == null) {
              t.style.opacity = '0';
              t.style.display = 'none';
              return;
            }
            const x = u.data[0][idx];
            const y = u.data[1][idx];
            if (x == null || y == null) {
              t.style.opacity = '0';
              return;
            }
            // Find the duration to format the tooltip time intelligently.
            const xs = u.data[0];
            const first = xs[0] ?? 0;
            const last  = xs[xs.length - 1] ?? 0;
            const durMs = ((last - first) || 0) * 1000;
            const tsMs  = (x as number) * 1000;
            t.textContent = '';

            const timeLine = document.createElement('div');
            timeLine.style.cssText =
              'color: var(--text-muted, #94a3b8); font-size: 10px; margin-bottom: 2px;';
            timeLine.textContent = fmtTooltipTime(tsMs, durMs);
            t.appendChild(timeLine);

            const valLine = document.createElement('div');
            valLine.style.cssText =
              'display: flex; align-items: center; gap: 6px; color: #fafafa;';
            const dot = document.createElement('span');
            dot.style.cssText =
              `display:inline-block; width:7px; height:7px; border-radius:99px;
               background:${lineColor};`;
            valLine.appendChild(dot);
            valLine.append(`${y as number} ${yLabel}`);
            t.appendChild(valLine);

            const left = (u.cursor.left ?? 0) + PAD_X;
            const top  = (u.cursor.top  ?? 0) + PAD_Y;
            t.style.transform = `translate(${left}px, ${top}px)`;
            t.style.display = 'block';
            t.style.opacity = '1';
          },
        ],
      },
      scales: {
        x: { time: true },
        y: { auto: true, range: (_u, _min, dataMax) => {
          const max = Math.max(1, dataMax ?? 1);
          const pad = Math.max(1, Math.ceil(max * 0.15));
          return [0, max + pad];
        }},
      },
      axes: [
        {
          stroke: '#7a8694',
          font:   '10px Inter, system-ui, sans-serif',
          grid:   { stroke: 'rgba(255,255,255,0.04)', width: 1 },
          ticks:  { stroke: 'rgba(255,255,255,0.08)', width: 1 },
          space:  60,
        },
        {
          stroke: '#7a8694',
          font:   '10px Inter, system-ui, sans-serif',
          grid:   { stroke: 'rgba(255,255,255,0.04)', width: 1 },
          ticks:  { stroke: 'rgba(255,255,255,0.08)', width: 1 },
          size:   28,
          values: (_u, splits) => splits.map(v => String(Math.round(v))),
        },
      ],
      series: [
        {},
        {
          stroke: lineColor,
          width:  1.8,
          fill:   (u) => {
            const ctx  = u.ctx;
            const grad = ctx.createLinearGradient(0, 0, 0, u.bbox.height);
            grad.addColorStop(0, fillFrom);
            grad.addColorStop(1, fillTo);
            return grad;
          },
          points: {
            show:   true,
            size:   6,
            stroke: lineColor,
            fill:   '#0b0d0f',
            width:  1.4,
            filter: ((_u: unknown, indices: number[]) => {
              const idx = uRef.current?.cursor.idx;
              return idx == null ? [] : indices.filter((i: number) => i === idx);
            }) as unknown as undefined,
          },
          paths:  uPlot.paths!.spline!(),
        },
      ],
    });

    const w = host.clientWidth || 600;
    const u = new uPlot(buildOpts(w), ad, host);
    uRef.current = u;

    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth;
      if (nw > 0) u.setSize({ width: nw, height });
    });
    ro.observe(host);

    // Hide tooltip when the cursor leaves the chart area.
    const onLeave = () => {
      const t = tooltipRef.current;
      if (t) { t.style.opacity = '0'; t.style.display = 'none'; }
    };
    host.addEventListener('mouseleave', onLeave);

    return () => {
      ro.disconnect();
      host.removeEventListener('mouseleave', onLeave);
      if (tooltipRef.current && tooltipRef.current.parentNode) {
        tooltipRef.current.parentNode.removeChild(tooltipRef.current);
      }
      tooltipRef.current = null;
      u.destroy();
      uRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const u = uRef.current;
    if (!u) return;
    u.setData(ad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div
      ref={hostRef}
      className={`uplot-host ${className ?? ''}`}
      style={{ width: '100%', height }}
    />
  );
}
