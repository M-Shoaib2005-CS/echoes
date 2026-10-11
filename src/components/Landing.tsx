import type { PresetBundle } from '../../shared/types';
import { ArrowIcon } from './Icons';
import { Button, Card, Disclaimer, ModeBadge } from './ui';

interface Props {
  presets: PresetBundle[];
  hasHistory: boolean;
  onPreset: (p: PresetBundle) => void;
  onStart: () => void;
  onContinue: () => void;
}

export function Landing({ presets, hasHistory, onPreset, onStart, onContinue }: Props) {
  return (
    <div className="step-in space-y-12">
      <section className="max-w-3xl pt-4">
        <h1 className="text-4xl sm:text-5xl">A few favourites from long ago, turned into a calm half hour of music, film and TV.</h1>
        <p className="mt-5 text-xl text-muted">
          Tell Echoes what someone loved when they were younger. It asks Qloo's taste graph what else fits, plans a gentle 30-minute session, and learns from how each moment lands.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button onClick={onStart}>Start your own <ArrowIcon size={18} /></Button>
          {hasHistory && <Button variant="secondary" onClick={onContinue}>Continue where you left off</Button>}
        </div>
      </section>

      <section aria-labelledby="presets-h">
        <h2 id="presets-h" className="text-2xl">Or open a ready-made session</h2>
        <p className="mt-1 text-muted">These load instantly with no waiting. You can still rate items and ask for a next session.</p>
        <ul className="mt-5 grid gap-5 md:grid-cols-3">
          {presets.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col">
                <h3 className="text-xl">{p.title}</h3>
                <p className="mt-2 text-muted">{p.blurb}</p>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Favourites">
                  {p.seeds.map((s) => <li key={s.id} className="rounded-full bg-amber-soft px-3 py-0.5 text-sm">{s.name}</li>)}
                </ul>
                <div className="mt-4"><ModeBadge source={p.response.source} /></div>
                <Button className="mt-auto self-start !mt-5" onClick={() => onPreset(p)}>Open session</Button>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="grid gap-5 md:grid-cols-3">
        <h2 id="how-h" className="sr-only">How it works</h2>
        {[
          ['Qloo chooses', 'Related music, films and TV, their ranking, and the "because of" reasons all come from Qloo taste data.'],
          ['The AI only words it', 'A language model turns the short Qloo list into a warm plan. It may only mention titles Qloo returned.'],
          ['Feedback steers the next one', 'Loved items sharpen the next Qloo query. Upsetting items are excluded for good.'],
        ].map(([t, d]) => (
          <div key={t}><h3 className="text-lg">{t}</h3><p className="mt-1 text-muted">{d}</p></div>
        ))}
      </section>
      <Disclaimer className="max-w-3xl" />
    </div>
  );
}
