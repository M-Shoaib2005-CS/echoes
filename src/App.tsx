import { useEffect, useMemo, useRef, useState } from 'react';
import { collectFeedback, diffSessions } from '../shared/feedback';
import { detectFlatter, lovedSeries } from '../shared/trend';
import type { IdSpace, PresetBundle, Rating, SessionRequest, SessionResponse } from '../shared/types';
import { BottomNav, type NavKey } from './components/BottomNav';
import { History } from './components/History';
import { MoonIcon, SunIcon, LogoMark } from './components/Icons';
import { Landing } from './components/Landing';
import { PrintSheet } from './components/PrintSheet';
import { SeedsStep, type SeedsValue } from './components/SeedsStep';
import { SessionView } from './components/SessionView';
import { Stepper } from './components/Stepper';
import { ModeBadge, ToastProvider, useToast } from './components/ui';
import { PRESETS } from './data/presets';
import { ApiFail, createAgentSession, createCompare, createSession, getHealth, seedsForServer } from './lib/api';
import { clearStore, loadStore, saveStore } from './lib/storage';
import { useTextSize, useTheme } from './lib/theme';
import { EMPTY_STORE, type Profile, type SessionRecord, type Store } from './lib/types';

type View = 'landing' | 'seeds' | 'session' | 'history';
type Busy = '' | 'session' | 'next' | 'agent' | 'compare';

const spaceOf = (r: SessionResponse): IdSpace => (r.source.mode === 'mock' ? 'mock' : 'qloo');
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));
const messageOf = (e: unknown) => (e instanceof ApiFail ? e.message : 'Something went wrong. Please try again, or open a ready-made session.');

function Shell() {
  const { theme, toggle } = useTheme();
  const textSize = useTextSize();
  const toast = useToast();
  const [store, setStore] = useState<Store>(() => loadStore());
  const [view, setView] = useState<View>('landing');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<Busy>('');
  const [tab, setTab] = useState<'plan' | 'compare'>('plan');
  const [error, setError] = useState<string | null>(null);
  const warned = useRef(false);

  useEffect(() => {
    if (!saveStore(store) && !warned.current) {
      warned.current = true;
      toast("History couldn't be saved in this browser, so it will be lost when you close the tab.");
    }
  }, [store, toast]);
  const [agentAvailable, setAgentAvailable] = useState(true);
  useEffect(() => {
    void getHealth().then((h) => {
      if (h) setAgentAvailable(h.agent);
    });
  }, []);

  const series = useMemo(() => lovedSeries(store.sessions), [store.sessions]);
  const flatter = detectFlatter(series);
  const record = store.sessions[active];
  const go = (v: View) => {
    setError(null);
    setView(v);
    window.scrollTo({ top: 0 });
  };
  const patch = (index: number, fn: (r: SessionRecord) => SessionRecord) =>
    setStore((s) => ({ ...s, sessions: s.sessions.map((r, i) => (i === index ? fn(r) : r)) }));

  const confirmReplace = () => store.sessions.length === 0 || window.confirm('This replaces the sessions currently stored in this browser. Continue?');

  const openPreset = (p: PresetBundle) => {
    if (!confirmReplace()) return;
    const request: SessionRequest = { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds: p.seeds };
    const profile: Profile = { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds: p.seeds, idSpace: p.idSpace };
    setStore({ profile, sessions: [{ id: newId(), number: 1, createdAt: new Date().toISOString(), request, response: p.response, idSpace: p.idSpace, ratings: {}, compare: p.compare, changes: null }] });
    setActive(0);
    setTab('plan');
    go('session');
  };

  const startOwn = async (v: SeedsValue) => {
    if (!confirmReplace()) return;
    setBusy('session');
    setError(null);
    try {
      const request: SessionRequest = { nickname: v.nickname, city: v.city, bornDecade: v.bornDecade, seeds: v.seeds };
      const response = await createSession(request);
      const idSpace = spaceOf(response);
      setStore({
        profile: { ...v, idSpace },
        sessions: [{ id: newId(), number: 1, createdAt: new Date().toISOString(), request, response, idSpace, ratings: {}, compare: null, changes: null }],
      });
      setActive(0);
      setTab('plan');
      go('session');
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };

  const rate = (id: string, r: Rating) => patch(active, (s) => ({ ...s, ratings: { ...s.ratings, [id]: r } }));

  /** Next session from ratings, or (with an instruction) an agent-shaped session via Ask Echoes. */
  const generate = async (instruction?: string) => {
    const profile = store.profile;
    const latest = store.sessions[store.sessions.length - 1];
    if (!profile || !latest) return;
    setBusy(instruction ? 'agent' : 'next');
    setError(null);
    try {
      const { seeds, idSpace } = await seedsForServer(profile.seeds, profile.idSpace);
      const comparable = store.sessions.filter((s) => s.idSpace === idSpace);
      if (comparable.length < store.sessions.length) toast("Ratings made on sample data can't carry over to the current data source.");
      const feedback = collectFeedback(comparable.map((s) => ({ items: s.response.items, ratings: s.ratings })));
      const request: SessionRequest = { nickname: profile.nickname, city: profile.city, bornDecade: profile.bornDecade, seeds, feedback };
      const response = instruction ? await createAgentSession(request, instruction) : await createSession(request);
      const changes = diffSessions(latest.response.items, response.items, feedback.upsetIds, feedback.loved.map((l) => l.name));
      const next: SessionRecord = { id: newId(), number: latest.number + 1, createdAt: new Date().toISOString(), request, response, idSpace: spaceOf(response), ratings: {}, compare: null, changes };
      setStore((s) => ({ profile: { ...profile, seeds, idSpace }, sessions: [...s.sessions, next] }));
      setActive(store.sessions.length);
      setTab('plan');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };
  const nextSession = () => void generate();
  const askEchoes = (instruction: string) => void generate(instruction);

  const compare = async () => {
    if (!record) return;
    setBusy('compare');
    setError(null);
    try {
      let request = record.request;
      const h = await getHealth();
      if (h && h.idSpace !== record.idSpace) {
        const resolved = await seedsForServer(request.seeds, record.idSpace);
        request = { ...request, seeds: resolved.seeds, feedback: undefined };
      }
      const result = await createCompare(request);
      patch(active, (s) => ({ ...s, compare: result }));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy('');
    }
  };

  const reset = () => {
    clearStore();
    setStore(EMPTY_STORE);
    setActive(0);
    go('landing');
    toast('All stored sessions were deleted from this browser.');
  };

  const rated = record ? record.response.items.filter((i) => record.ratings[i.id]).length : 0;
  const step = view === 'seeds' ? 0 : record && rated >= record.response.items.length ? 3 : rated > 0 ? 2 : 1;
  const badgeSource = view === 'session' && record ? record.response.source : PRESETS[0]?.response.source;
  const navBtn = 'rounded-full px-4 font-semibold hover:bg-amber-soft';

  return (
    <div className="min-h-screen">
      <a href="#main" className="no-print sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2">Skip to content</a>
      <header className="no-print border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => go('landing')} className="flex items-center gap-2 font-display text-2xl" aria-label="Echoes home">
            <LogoMark />Echoes
          </button>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
            {badgeSource && <ModeBadge source={badgeSource} />}
            <button type="button" className={`${navBtn} ${view === 'session' || view === 'history' ? 'hidden lg:inline-flex lg:items-center' : 'inline-flex items-center'}`} onClick={() => go('history')}>History</button>
            <button type="button" className="flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 font-display text-lg hover:bg-amber-soft" onClick={textSize.cycle} aria-label={`Text size: ${['standard', 'large', 'extra large'][textSize.level]}. Tap to change.`}>Aa</button>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-amber-soft" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className={`mx-auto max-w-6xl px-4 py-8 ${view === 'history' ? 'pb-28 lg:pb-8' : ''}`}>
        {(view === 'seeds' || view === 'session') && <div className="mb-6"><Stepper current={step} /></div>}
        {view === 'landing' && <Landing presets={PRESETS} hasHistory={store.sessions.length > 0} onPreset={openPreset} onStart={() => go('seeds')} onContinue={() => { setActive(store.sessions.length - 1); go('session'); }} />}
        {view === 'seeds' && <SeedsStep busy={busy === 'session'} error={error} onSubmit={startOwn} />}
        {view === 'session' && record && store.profile && (
          <SessionView key={record.id} tab={tab} onTab={setTab} record={record} profile={store.profile} isLatest={active === store.sessions.length - 1} busy={busy === 'session' ? '' : busy} agentAvailable={agentAvailable} error={error} flatter={flatter}
            onRate={rate} onNext={nextSession} onAsk={askEchoes} onCompare={compare} onLatest={() => setActive(store.sessions.length - 1)} />
        )}
        {view === 'session' && !record && <p>No session is open. <button type="button" className="font-semibold text-accent underline" onClick={() => go('landing')}>Go back to the start</button>.</p>}
        {view === 'history' && <History sessions={store.sessions} series={series} flatter={flatter} onOpen={(i) => { setActive(i); go('session'); }} onReset={reset} />}
      </main>

      {(view === 'session' || view === 'history') && store.sessions.length > 0 && (
        <BottomNav
          active={view === 'history' ? 'history' : tab}
          onSelect={(k: NavKey) => {
            if (k === 'history') return go('history');
            setTab(k);
            go('session');
          }}
        />
      )}
      {record && store.profile && <PrintSheet record={record} nickname={store.profile.nickname} />}
      <footer className="no-print mt-8 border-t border-line">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-sm text-muted">
          <p>Taste data: Qloo Taste AI. Built for the Qloo Agentic Hackathon.</p>
          <p>Echoes is a gentle conversation aid, not medical software. It makes no diagnosis or health claims.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
