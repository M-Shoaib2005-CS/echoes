import { segmentProgress } from '../../shared/planview';
import type { Domain, Rating, SessionPlan } from '../../shared/types';

export type SegKey = 'warm' | Domain | 'wind';
export const SEG_LABEL: Record<Domain, string> = { artist: 'Music', movie: 'Film', tv_show: 'TV' };

interface Props {
  plan: SessionPlan;
  ratings: Record<string, Rating>;
  active: SegKey;
  onSelect: (k: SegKey) => void;
}

/** The 30 minutes at a glance. Phone: switches the visible part. Desktop: jumps to it. */
export function Ribbon({ plan, ratings, active, onSelect }: Props) {
  const parts: { key: SegKey; label: string; minutes: number; done: boolean }[] = [
    { key: 'warm', label: 'Warm-up', minutes: plan.warmup.minutes, done: false },
    ...plan.segments.map((s) => ({
      key: s.domain as SegKey,
      label: SEG_LABEL[s.domain],
      minutes: s.minutes,
      done: segmentProgress(s.items.map((i) => i.id), ratings).done,
    })),
    { key: 'wind', label: 'Wind-down', minutes: plan.winddown.minutes, done: false },
  ];
  return (
    <nav aria-label="Session parts" className="no-print sticky top-0 z-30 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur">
      <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${parts.length}, minmax(0, 1fr))` }}>
        {parts.map((p) => (
          <li key={p.key}>
            <button type="button" onClick={() => onSelect(p.key)} aria-current={active === p.key ? 'step' : undefined} className="flex min-h-[52px] w-full flex-col items-stretch gap-1 rounded-xl px-0.5 pt-1 text-center hover:bg-amber-soft">
              <span className={`block rounded-full ${p.done ? 'h-2 bg-teal' : active === p.key ? 'h-2 bg-accent' : 'h-1.5 bg-line'}`} />
              <span className={`text-[13px] leading-tight ${active === p.key ? 'font-bold text-accent' : 'font-semibold'}`}>{p.label}</span>
              <span className="text-xs text-muted">
                {p.minutes} min
                {p.done && <span className="sr-only">, all rated</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
