import { useState, type ReactNode } from 'react';
import { DOMAIN_LABEL, type Item, type PlanItem, type Rating } from '../../shared/types';
import { HeartIcon, MinusIcon, SadIcon } from './Icons';
import { Meter } from './ui';

const HUES = [18, 28, 38, 168, 184];
export const itemMeta = (item: Item): string => `${DOMAIN_LABEL[item.domain]}${item.year ? ` \u00b7 ${item.year}` : ''}`;

/** Artwork from Qloo when it exists, otherwise a calm gradient with initials. Optional text overlay. */
export function ItemArt({ item, className = '', overlayClassName = '', children }: { item: Item; className?: string; overlayClassName?: string; children?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  const hue = HUES[[...item.name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length]!;
  const initials = item.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  const showImage = Boolean(item.imageUrl) && !broken;
  return (
    <div className={`relative overflow-hidden text-white ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 30%), hsl(${(hue + 25) % 360} 40% 22%))` }}>
      {showImage ? (
        <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute right-3 top-1 select-none font-display text-5xl opacity-30">{initials}</span>
      )}
      {children && (
        <div className={overlayClassName}>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">{children}</div>
        </div>
      )}
    </div>
  );
}

export function ReasonChips({ reasons }: { reasons?: string[] }) {
  if (!reasons?.length) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Because of</span>
      {reasons.map((r) => <span key={r} className="rounded-full bg-teal-soft px-3 py-0.5 font-semibold text-teal">{r}</span>)}
    </p>
  );
}

const RATINGS: { value: Rating; label: string; Icon: typeof HeartIcon; on: string }[] = [
  { value: 'loved', label: 'Loved it', Icon: HeartIcon, on: 'border-teal bg-teal text-accent-ink' },
  { value: 'neutral', label: 'Neutral', Icon: MinusIcon, on: 'border-ink bg-ink text-bg' },
  { value: 'upset', label: 'Upset', Icon: SadIcon, on: 'border-accent bg-accent text-accent-ink' },
];

export function RatingButtons({ name, rating, onRate, big }: { name: string; rating?: Rating; onRate: (r: Rating) => void; big?: boolean }) {
  return (
    <div role="group" aria-label={`How did ${name} go?`} className="no-print grid grid-cols-3 gap-2">
      {RATINGS.map(({ value, label, Icon, on }) => (
        <button key={value} type="button" aria-pressed={rating === value} onClick={() => onRate(value)}
          className={`flex items-center justify-center rounded-2xl border px-1 font-semibold transition ${big ? 'min-h-[64px] flex-col gap-1' : 'min-h-[48px] gap-2'} ${rating === value ? on : 'border-line bg-paper hover:border-accent'}`}>
          <Icon size={big ? 26 : 20} />
          {label}
        </button>
      ))}
    </div>
  );
}

export function ItemCard({ item, plan, rating, onRate }: { item: Item; plan?: PlanItem; rating?: Rating; onRate?: (r: Rating) => void }) {
  return (
    <article aria-label={item.name} className="overflow-hidden rounded-card border border-line bg-paper shadow-soft lg:flex lg:gap-4 lg:p-4">
      <ItemArt item={item} className="h-32 w-full lg:h-[88px] lg:w-[88px] lg:shrink-0 lg:rounded-2xl" overlayClassName="lg:hidden">
        <p className="text-sm opacity-90">{itemMeta(item)}</p>
        <h4 className="font-display text-xl leading-tight">{item.name}</h4>
      </ItemArt>
      <div className="min-w-0 flex-1 space-y-3 p-4 lg:p-0">
        <div className="hidden lg:block">
          <h4 className="font-display text-xl leading-snug">{item.name}</h4>
          <p className="text-sm text-muted">{itemMeta(item)}{item.tags?.slice(0, 2).map((t) => ` \u00b7 ${t.replace(/-/g, ' ')}`).join('')}</p>
        </div>
        {item.affinity !== undefined && <Meter value={item.affinity} label="Fit with their favourites" />}
        <ReasonChips reasons={item.reasons} />
        {plan && (
          <div className="space-y-1 border-l-4 border-accent pl-3">
            <p className="italic">{plan.prompt}</p>
            <p className="text-sm text-muted"><span className="font-semibold text-ink">Try:</span> {plan.sensoryCue}</p>
          </div>
        )}
        {onRate && <RatingButtons name={item.name} rating={rating} onRate={onRate} />}
      </div>
    </article>
  );
}
