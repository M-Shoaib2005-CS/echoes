import { useEffect, useState } from 'react';
import { DOMAIN_LABEL, type Domain, type Item, type Seed } from '../../shared/types';
import { ApiFail, searchEntities } from '../lib/api';
import { PlusIcon, XIcon } from './Icons';
import { Button, Card, Disclaimer, ErrorBanner, LoadingPanel } from './ui';

export interface SeedsValue {
  nickname: string;
  city?: string;
  bornDecade?: number;
  seeds: Seed[];
}
const DOMAIN_CHIPS: { value: Domain | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'artist', label: 'Music' },
  { value: 'movie', label: 'Films' },
  { value: 'tv_show', label: 'TV shows' },
];
const DECADES = [1920, 1930, 1940, 1950, 1960];

export function SeedsStep({ busy, error, onSubmit }: { busy: boolean; error: string | null; onSubmit: (v: SeedsValue) => void }) {
  const [nickname, setNickname] = useState('');
  const [city, setCity] = useState('');
  const [decade, setDecade] = useState('');
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<Domain | undefined>();
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched('');
      setSearchError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const r = await searchEntities(q, domain);
        if (!cancelled) {
          setResults(r.items);
          setSearched(q);
        }
      } catch (e) {
        if (!cancelled) setSearchError(e instanceof ApiFail ? e.message : 'Search is unavailable right now.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, domain]);

  const add = (item: Item) => {
    if (item.domain === 'place' || seeds.length >= 6 || seeds.some((s) => s.id === item.id)) return;
    setSeeds([...seeds, { id: item.id, name: item.name, domain: item.domain }]);
    setQuery('');
    setResults([]);
  };
  const ready = nickname.trim().length > 0 && seeds.length >= 3 && !busy;
  const noMatch = !searching && !searchError && searched === query.trim() && query.trim().length >= 2 && results.length === 0;
  const field = 'w-full rounded-2xl border border-line bg-bg px-4 py-2 text-ink';

  return (
    <form className="step-in grid gap-6 lg:grid-cols-[1fr_20rem]" onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ nickname: nickname.trim(), city: city.trim() || undefined, bornDecade: decade ? Number(decade) : undefined, seeds }); }}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl">Who is this session for?</h1>
          <p className="mt-1 text-muted">Add three to six things they loved when they were younger.</p>
        </div>
        <Card className="space-y-4">
          <div>
            <label htmlFor="nick" className="font-semibold">Nickname</label>
            <input id="nick" className={field} value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} autoComplete="off" aria-describedby="nick-note" />
            <p id="nick-note" className="mt-1 text-sm text-muted">A first name or pet name only. Please don't enter real full names or health details.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="font-semibold">City <span className="font-normal text-muted">(optional)</span></label>
              <input id="city" className={field} value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} autoComplete="off" aria-describedby="city-note" />
              <p id="city-note" className="mt-1 text-sm text-muted">Only used to suggest a nearby outing.</p>
            </div>
            <div>
              <label htmlFor="decade" className="font-semibold">Born around <span className="font-normal text-muted">(optional)</span></label>
              <select id="decade" className={field} value={decade} onChange={(e) => setDecade(e.target.value)} aria-describedby="decade-note">
                <option value="">Not sure</option>
                {DECADES.map((d) => <option key={d} value={d}>The {d}s</option>)}
              </select>
              <p id="decade-note" className="mt-1 text-sm text-muted">Shapes the wording. Films and TV are only filtered by era when Qloo provides release years; the session screen tells you.</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <label htmlFor="fav" className="font-semibold">Search for a favourite</label>
            <div role="group" aria-label="Category" className="mt-2 flex flex-wrap gap-2">
              {DOMAIN_CHIPS.map((c) => (
                <button key={c.label} type="button" aria-pressed={domain === c.value} onClick={() => setDomain(c.value)}
                  className={`rounded-full border px-4 py-1 font-semibold ${domain === c.value ? 'border-teal bg-teal-soft text-teal' : 'border-line'}`}>{c.label}</button>
              ))}
            </div>
            <input id="fav" className={`${field} mt-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="An artist, film or TV show" autoComplete="off" disabled={seeds.length >= 6} aria-describedby="fav-status" />
          </div>
          <div id="fav-status" aria-live="polite" className="min-h-[1.5rem] text-muted">
            {searching && 'Searching\u2026'}
            {searchError && <span className="text-accent">{searchError}</span>}
            {noMatch && "We couldn't find that. Try another spelling, or pick a different category."}
            {seeds.length >= 6 && 'That is six favourites, the most we use at once.'}
          </div>
          {results.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => add(r)} disabled={seeds.some((s) => s.id === r.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-amber-soft disabled:opacity-50">
                    <span>{r.name}{r.year ? <span className="text-muted"> ({r.year})</span> : null}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-muted"><PlusIcon size={16} />{DOMAIN_LABEL[r.domain]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-wrap gap-2" aria-label="Chosen favourites">
            {seeds.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-1 rounded-full bg-amber-soft py-1 pl-4 pr-1">
                <span>{s.name} <span className="text-sm text-muted">{DOMAIN_LABEL[s.domain]}</span></span>
                <button type="button" aria-label={`Remove ${s.name}`} onClick={() => setSeeds(seeds.filter((x) => x.id !== s.id))} className="flex h-9 min-h-0 w-9 items-center justify-center rounded-full hover:bg-line"><XIcon size={16} /></button>
              </li>
            ))}
          </ul>
        </Card>
        {error && <ErrorBanner message={error} />}
        {busy && <LoadingPanel label="Asking Qloo and planning the session\u2026" />}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <p className="font-semibold">{seeds.length} of 3 to 6 favourites</p>
          <p className="mt-1 text-sm text-muted">{seeds.length < 3 ? `Add ${3 - seeds.length} more to continue.` : 'Ready when you are.'}</p>
          <Button type="submit" className="mt-4 w-full" disabled={!ready}>{busy ? 'Planning\u2026' : 'Plan the session'}</Button>
        </Card>
        <Disclaimer />
      </aside>
    </form>
  );
}
