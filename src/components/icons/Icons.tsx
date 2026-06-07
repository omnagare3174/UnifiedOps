import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export function BellIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function ClockIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function LocationIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <circle cx="7" cy="7" r="0.6" fill="currentColor" />
      <circle cx="7" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function ExternalIcon({ size = 12, ...rest }: IconProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

export function BrandCubeIcon({ size = 32, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <linearGradient id="cubeTop" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#cffafe" />
          <stop offset="30%" stopColor="#67e8f9" />
          <stop offset="65%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id="cubeTopSideL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#155e75" />
        </linearGradient>
        <linearGradient id="cubeTopSideR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#155e75" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id="cubeMid" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="cubeMidSideL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c4a6e" />
          <stop offset="100%" stopColor="#0c2a4a" />
        </linearGradient>
        <linearGradient id="cubeMidSideR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#082f49" />
          <stop offset="100%" stopColor="#061a2f" />
        </linearGradient>
        <linearGradient id="cubeBot" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0c1e44" />
        </linearGradient>
        <linearGradient id="cubeBotSideL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c1e44" />
          <stop offset="100%" stopColor="#080f24" />
        </linearGradient>
        <linearGradient id="cubeBotSideR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070d22" />
          <stop offset="100%" stopColor="#020410" />
        </linearGradient>
        <radialGradient id="cubeGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="32" cy="14" rx="22" ry="9" fill="url(#cubeGlow)" />

      <polygon points="32,42 12,47 32,52 52,47" fill="url(#cubeBot)"
        stroke="#3b82f6" strokeOpacity="0.55" strokeWidth="0.6" />
      <polygon points="12,47 32,52 32,55 12,50" fill="url(#cubeBotSideL)" />
      <polygon points="52,47 32,52 32,55 52,50" fill="url(#cubeBotSideR)" />

      <polygon points="32,26 12,31 32,36 52,31" fill="url(#cubeMid)"
        stroke="#7dd3fc" strokeOpacity="0.65" strokeWidth="0.7" />
      <polygon points="12,31 32,36 32,39 12,34" fill="url(#cubeMidSideL)" />
      <polygon points="52,31 32,36 32,39 52,34" fill="url(#cubeMidSideR)" />

      <polygon points="32,10 12,15 32,20 52,15" fill="url(#cubeTop)"
        stroke="#ecfeff" strokeOpacity="0.9" strokeWidth="0.8" />
      <polygon points="12,15 32,20 32,23 12,18" fill="url(#cubeTopSideL)" />
      <polygon points="52,15 32,20 32,23 52,18" fill="url(#cubeTopSideR)" />

      <polyline points="32,10 12,15" stroke="#ffffff" strokeOpacity="0.95"
        strokeWidth="0.7" fill="none" strokeLinecap="round" />
      <polyline points="32,10 25,12.5" stroke="#ffffff" strokeOpacity="1"
        strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}
