import type { ReactNode } from 'react';

function Svg({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
type P = { size?: number };

export const HeartIcon = (p: P) => <Svg {...p}><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z" /></Svg>;
export const MinusIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></Svg>;
export const SadIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 16c1-1.2 2.2-1.8 3.5-1.8s2.5.6 3.5 1.8M9 9.5h.01M15 9.5h.01" /></Svg>;
export const MusicIcon = (p: P) => <Svg {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Svg>;
export const FilmIcon = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></Svg>;
export const TvIcon = (p: P) => <Svg {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 21h8M9 3l3 3 3-3" /></Svg>;
export const PinIcon = (p: P) => <Svg {...p}><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
export const PrintIcon = (p: P) => <Svg {...p}><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1" /></Svg>;
export const SunIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const MoonIcon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></Svg>;
export const XIcon = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const ArrowIcon = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const SparkIcon = (p: P) => <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></Svg>;

export function LogoMark({ size = 30 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--accent-ink)" strokeWidth="2.5" opacity=".85" />
      <circle cx="16" cy="16" r="3" fill="var(--accent-ink)" />
    </svg>
  );
}
export const ListIcon = (p: P) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
export const CompareIcon = (p: P) => <Svg {...p}><path d="M7 4L3 8l4 4M3 8h18M17 20l4-4-4-4M21 16H3" /></Svg>;
export const HistoryIcon = (p: P) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2" /></Svg>;
