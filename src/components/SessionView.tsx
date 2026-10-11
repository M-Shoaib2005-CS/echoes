import { useMemo, useState } from 'react';
import { orderedItems } from '../../shared/planview';
import { FLATTER_NOTE } from '../../shared/trend';
import type { Item, Rating } from '../../shared/types';
import type { Profile, SessionRecord } from '../lib/types';
import { AgentTrace } from './AgentTrace';
import { AskForm } from './AskEchoes';
import { CompareView } from './CompareView';
import { FocusMode } from './FocusMode';
import { ArrowIcon, ClockIcon, InfoIcon, PinIcon, PrintIcon, SparkIcon } from './Icons';
import { ItemCard } from './ItemCard';
import { Ribbon, type SegKey } from './Ribbon';
import { Button, Card, Disclaimer, ErrorBanner, LoadingPanel, ModeBadge } from './ui';

interface Props {
  record: SessionRecord;
  profile: Profile;
  isLatest: boolean;
  busy: '' | 'next' | 'agent' | 'compare';
  /** False when the server has no AI service, so Ask Echoes cannot run. */
  agentAvailable: boolean;
  error: string | null;
  flatter: boolean;
  tab: 'plan' | 'compare';
  onTab: (t: 'plan' | 'compare') => void;
  onRate: (id: string, r: Rating) => void;
  onNext: () => void;
  onCompare: () => void;
  onLatest: () => void;
  onAsk: (instruction: string) => void;
}

export function SessionView({ record, profile, isLatest, busy, agentAvailable, error, flatter, tab, onTab, onRate, onNext, onCompare, onLatest, onAsk }: Props) {
  const working = busy === 'next' || busy === 'agent';
  const [seg, setSeg] = useState<SegKey>('warm');
  const [focus, setFocus] = useState<number | null>(null);
  const { response, ratings, changes } = record;
  const { plan } = response;
  const byId = new Map<string, Item>([...response.items, ...response.outings].map((i) => [i.id, i]));
  const ordered = useMemo(() => orderedItems(plan, response.items), [plan, response.items]);
  const rated = response.items.filter((i) => ratings[i.id]).length;
  const outing = plan.outing ? byId.get(plan.outing.id) : undefined;
  // Phone shows one part at a time; desktop (lg) shows all parts stacked.
  const show = (k: SegKey) => (seg === k ? '' : 'hidden lg:block');
  const firstOf = (domain: string) => ordered.findIndex((o) => o.segmentKey === domain);

  const select = (k: SegKey) => {
    setSeg(k);
    if (window.matchMedia('(min-width: 1024px)').matches) document.getElementById(`seg-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const actions = (
    <>
      <Button variant="secondary" onClick={() => window.print()}><PrintIcon size={18} />Print sheet</Button>
      {isLatest ? (
        <Button onClick={onNext} disabled={rated === 0 || working}>{busy === 'next' ? 'Planning\u2026' : 'Next session'}</Button>
      ) : (
        <Button onClick={onLatest}>Back to latest</Button>
      )}
    </>
  );

  return (
    <div className="step-in grid gap-6 pb-44 lg:grid-cols-[1fr_20rem] lg:pb-0">
      <div className="min-w-0 space-y-6">
        <header>
          <p className="text-muted">Session {record.number} for {profile.nickname}</p>
          <h1 className="text-3xl sm:text-4xl">{plan.title}</h1>
          {response.planSource === 'template' && <p className="mt-1 text-sm text-muted">Plan assembled from a template. The suggestions themselves still come from the data below.</p>}
        </header>

        {response.notices.length > 0 && (
          <div role="status" className="space-y-1 rounded-card bg-amber-soft p-4">
            {response.notices.map((n) => <p key={n} className="flex gap-2"><InfoIcon size={20} />{n}</p>)}
          </div>
        )}
        {flatter && isLatest && <p role="note" className="rounded-card border border-teal bg-teal-soft p-4 text-ink">{FLATTER_NOTE}</p>}
        {response.yearFilter.note && <p className="text-sm text-muted">{response.yearFilter.note}</p>}
        {response.agent && <AgentTrace run={response.agent} />}
        {isLatest && (
          <details className="no-print rounded-card border border-line bg-paper shadow-soft lg:hidden">
            <summary className="flex min-h-[52px] cursor-pointer items-center gap-2 px-4 font-semibold"><SparkIcon size={20} />Ask Echoes to change this session</summary>
            <div className="px-4 pb-4"><AskForm busy={busy === 'agent'} available={agentAvailable} onAsk={onAsk} /></div>
          </details>
        )}

        <div role="tablist" aria-label="Session views" className="no-print hidden gap-2 lg:flex">
          {([['plan', 'Session plan'], ['compare', 'With Qloo vs without']] as const).map(([k, label]) => (
            <button key={k} role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => onTab(k)}
              className={`rounded-full border px-5 py-2 font-semibold ${tab === k ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-paper'}`}>{label}</button>
          ))}
        </div>

        {tab === 'plan' ? (
          <div role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" className="space-y-6">
            <Ribbon plan={plan} ratings={ratings} active={seg} onSelect={select} />
            {changes && (
              <Card className={show('warm')}>
                <h2 className="text-xl">What changed since last session</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Added ({changes.added.length})</h3>
                    <ul className="mt-1 space-y-1 text-sm">
                      {changes.added.length === 0 && <li className="text-muted">Nothing new this time.</li>}
                      {changes.added.map((i) => <li key={i.id}>{i.name}{changes.drivers[i.id] && <span className="text-teal"> because you loved {changes.drivers[i.id]!.join(', ')}</span>}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold">Removed ({changes.removed.length})</h3>
                    <ul className="mt-1 space-y-1 text-sm">
                      {changes.removed.length === 0 && <li className="text-muted">Nothing removed.</li>}
                      {changes.removed.map((i) => <li key={i.id}>{i.name}{changes.upsetRemoved.some((u) => u.id === i.id) && <span className="text-accent"> (upset, won't return)</span>}</li>)}
                    </ul>
                  </div>
                </div>
              </Card>
            )}

            <section id="seg-warm" aria-labelledby="warm" className={`scroll-mt-24 space-y-2 ${show('warm')}`}>
              <h2 id="warm" className="flex items-center gap-2 text-2xl"><ClockIcon />Warm-up <span className="text-base text-muted">{plan.warmup.minutes} min</span></h2>
              <p className="max-w-prose">{plan.warmup.text}</p>
              {plan.segments[0] && <Button className="lg:hidden" onClick={() => select(plan.segments[0]!.domain)}>Start with {plan.segments[0].title.toLowerCase()}<ArrowIcon size={18} /></Button>}
            </section>

            {plan.segments.map((s) => (
              <section key={s.domain} id={`seg-${s.domain}`} aria-labelledby={`h-${s.domain}`} className={`scroll-mt-24 space-y-3 ${show(s.domain)}`}>
                <h2 id={`h-${s.domain}`} className="flex items-center gap-2 text-2xl">{s.title} <span className="text-base text-muted">{s.minutes} min</span></h2>
                <p className="max-w-prose text-muted">{s.intro}</p>
                <div className="space-y-3">
                  {s.items.map((pi) => { const item = byId.get(pi.id); return item ? <ItemCard key={pi.id} item={item} plan={pi} rating={ratings[pi.id]} onRate={(r) => onRate(pi.id, r)} /> : null; })}
                </div>
                <Button className="w-full lg:hidden" onClick={() => setFocus(Math.max(0, firstOf(s.domain)))}>Go one by one<ArrowIcon size={18} /></Button>
              </section>
            ))}

            <div id="seg-wind" className={`scroll-mt-24 space-y-6 ${show('wind')}`}>
              {outing && plan.outing && (
                <section aria-labelledby="out"><h2 id="out" className="flex items-center gap-2 text-2xl"><PinIcon />A gentle outing</h2><Card className="mt-2"><p className="font-semibold">{outing.name}</p><p className="text-muted">{plan.outing.prompt}</p></Card></section>
              )}
              <section aria-labelledby="wind" className="space-y-2">
                <h2 id="wind" className="flex items-center gap-2 text-2xl"><SparkIcon />Wind-down <span className="text-base text-muted">{plan.winddown.minutes} min</span></h2>
                <p className="max-w-prose">{plan.winddown.text}</p>
                <Button variant="secondary" className="lg:hidden" onClick={() => window.print()}><PrintIcon size={18} />Print sheet</Button>
              </section>
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="panel-compare" aria-labelledby="tab-compare">
            <CompareView items={response.items} compare={record.compare} busy={busy === 'compare'} error={busy === '' ? error : null} onGenerate={onCompare} />
          </div>
        )}
        {busy === 'next' && <LoadingPanel label="Learning from the feedback and planning the next session\u2026" />}
        {busy === 'agent' && <LoadingPanel label="Echoes is choosing which Qloo tools to use. This can take up to half a minute\u2026" />}
        {tab === 'plan' && error && <ErrorBanner message={error} />}
      </div>

      <aside className="no-print hidden space-y-4 lg:sticky lg:top-6 lg:block lg:self-start">
        {isLatest && <Card><AskForm busy={busy === 'agent'} available={agentAvailable} onAsk={onAsk} /></Card>}
        <Card className="space-y-3">
          <ModeBadge source={response.source} />
          <p><span className="font-display text-3xl">{rated}</span> of {response.items.length} rated</p>
          <p className="text-sm text-muted">Rate each item as you go. Loved items shape the next session; upsetting ones never return.</p>
          <div className="flex flex-col gap-2">{actions}</div>
          {rated === 0 && isLatest && <p className="text-sm text-muted">Rate at least one item to plan the next session.</p>}
        </Card>
        <Disclaimer />
      </aside>

      {tab === 'plan' && (
        <div className="above-nav no-print fixed inset-x-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-paper px-4 py-2 lg:hidden">
          <p className="text-sm text-muted">{rated === 0 ? 'Rate items, then plan the next session' : `${rated} of ${response.items.length} rated`}</p>
          {isLatest ? (rated > 0 && <Button onClick={onNext} disabled={working}>{busy === 'next' ? 'Planning\u2026' : 'Next session'}</Button>) : <Button onClick={onLatest}>Back to latest</Button>}
        </div>
      )}
      <Disclaimer className="lg:hidden" />

      {focus !== null && (
        <FocusMode ordered={ordered} start={focus} ratings={ratings} onRate={onRate} onClose={() => setFocus(null)} onNext={onNext} onPrint={() => window.print()} />
      )}
    </div>
  );
}
