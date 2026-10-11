import { FLATTER_NOTE } from '../../shared/trend';
import { lovedRatio } from '../../shared/trend';
import type { SessionRecord } from '../lib/types';
import { Button, Card, ModeBadge } from './ui';

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="text-sm text-muted">The trend line appears after two rated sessions.</p>;
  const w = 220;
  const h = 48;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 8) + 4},${h - 4 - v * (h - 8)}`).join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label={`Share of loved items across sessions: ${values.map((v) => Math.round(v * 100) + '%').join(', ')}`}>
      <polyline points={pts} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={(i / (values.length - 1)) * (w - 8) + 4} cy={h - 4 - v * (h - 8)} r="3.5" fill="var(--accent)" />)}
    </svg>
  );
}

export function History({ sessions, series, flatter, onOpen, onReset }: { sessions: SessionRecord[]; series: number[]; flatter: boolean; onOpen: (i: number) => void; onReset: () => void }) {
  return (
    <div className="step-in space-y-6">
      <h1 className="text-3xl">Past sessions</h1>
      {flatter && <p role="note" className="rounded-card border border-teal bg-teal-soft p-4">{FLATTER_NOTE}</p>}
      {sessions.length === 0 ? (
        <Card><p>No sessions yet. Open a ready-made session or start your own, and it will appear here.</p></Card>
      ) : (
        <>
          <Card><h2 className="text-lg">Share of "loved it" ratings</h2><div className="mt-2"><Sparkline values={series} /></div></Card>
          <ol className="space-y-3">
            {[...sessions].map((s, i) => ({ s, i })).reverse().map(({ s, i }) => {
              const ratio = lovedRatio(s.ratings);
              return (
                <li key={s.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-xl">Session {s.number}</p>
                      {s.response.agent && <p className="text-sm text-teal">Ask Echoes: &ldquo;{s.response.agent.instruction}&rdquo;</p>}
                      <p className="text-muted">{new Date(s.createdAt).toLocaleString()}, {s.response.items.length} items, {ratio === null ? 'not enough ratings yet' : `${Math.round(ratio * 100)}% loved`}</p>
                      <div className="mt-1"><ModeBadge source={s.response.source} /></div>
                    </div>
                    <Button variant="secondary" onClick={() => onOpen(i)}>Open</Button>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <div>
        <Button variant="ghost" onClick={() => { if (window.confirm('Delete all sessions and favourites stored in this browser?')) onReset(); }}>Reset all data</Button>
        <p className="mt-1 text-sm text-muted">Everything is stored only in this browser. Nothing is sent anywhere to build this list.</p>
      </div>
    </div>
  );
}
