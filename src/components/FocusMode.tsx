import { useEffect, useRef, useState } from 'react';
import type { OrderedItem } from '../../shared/planview';
import type { Rating } from '../../shared/types';
import { ArrowIcon, PrintIcon, XIcon } from './Icons';
import { itemMeta, ItemArt, RatingButtons, ReasonChips } from './ItemCard';
import { SEG_LABEL } from './Ribbon';
import { Button } from './ui';

interface Props {
  ordered: OrderedItem[];
  start: number;
  ratings: Record<string, Rating>;
  onRate: (id: string, r: Rating) => void;
  onClose: () => void;
  onNext: () => void;
  onPrint: () => void;
}

/** One item per screen for use mid-session on a phone. Manual navigation only: nothing moves by itself. */
export function FocusMode({ ordered, start, ratings, onRate, onClose, onNext, onPrint }: Props) {
  const [i, setI] = useState(Math.max(0, Math.min(start, ordered.length - 1)));
  const [finished, setFinished] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    closeBtn.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [i, finished]);

  const cur = ordered[i];
  if (!cur) return null;
  const last = i === ordered.length - 1;
  const counts = { loved: 0, neutral: 0, upset: 0 };
  for (const o of ordered) {
    const r = ratings[o.item.id];
    if (r) counts[r]++;
  }
  const rated = counts.loved + counts.neutral + counts.upset;

  return (
    <div ref={scroller} role="dialog" aria-modal="true" aria-label="Session, one item at a time" className="no-print step-in fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <button ref={closeBtn} type="button" onClick={onClose} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-paper px-4 font-semibold">
            <XIcon size={18} />Close
          </button>
          {!finished && <p className="text-muted">{SEG_LABEL[cur.item.domain === 'place' ? 'artist' : cur.item.domain]} · {i + 1} of {ordered.length}</p>}
        </div>

        {finished ? (
          <div className="space-y-5">
            <h2 className="text-3xl">Session finished</h2>
            <dl className="grid grid-cols-2 gap-3">
              {([['Loved it', counts.loved], ['Neutral', counts.neutral], ['Upset', counts.upset], ['Not rated', ordered.length - rated]] as const).map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-line bg-paper p-3"><dd className="font-display text-3xl">{v}</dd><dt className="text-sm text-muted">{k}</dt></div>
              ))}
            </dl>
            <p>Loved items shape the next session. Upsetting ones will not come back.</p>
            <div className="flex flex-col gap-3">
              {rated > 0 ? <Button onClick={() => { onClose(); onNext(); }}>Plan the next session</Button> : <p className="text-muted">Rate at least one item to plan the next session.</p>}
              <Button variant="secondary" onClick={onPrint}><PrintIcon size={18} />Print sheet</Button>
              <Button variant="secondary" onClick={onClose}>Back to the plan</Button>
            </div>
          </div>
        ) : (
          <>
            <div aria-hidden="true" className="flex gap-1">
              {ordered.map((o, idx) => <i key={o.item.id} className={`h-1.5 flex-1 rounded-full ${idx <= i ? 'bg-accent' : 'bg-line'}`} />)}
            </div>
            <ItemArt item={cur.item} className="h-44 w-full rounded-card">
              <p className="text-sm opacity-90">{itemMeta(cur.item)}</p>
              <h2 className="font-display text-3xl leading-tight">{cur.item.name}</h2>
            </ItemArt>
            <ReasonChips reasons={cur.item.reasons} />
            <p className="border-l-4 border-accent pl-3 font-display text-2xl italic leading-snug">{cur.plan.prompt}</p>
            <p className="text-muted"><span className="font-semibold text-ink">Try:</span> {cur.plan.sensoryCue}</p>
            <RatingButtons name={cur.item.name} rating={ratings[cur.item.id]} onRate={(r) => onRate(cur.item.id, r)} big />
            <div className="mt-auto flex items-center justify-between gap-3 pt-2">
              {i > 0 ? <Button variant="secondary" onClick={() => setI(i - 1)}>Back</Button> : <span />}
              <Button onClick={() => (last ? setFinished(true) : setI(i + 1))}>{last ? 'Finish' : 'Next item'}<ArrowIcon size={18} /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
