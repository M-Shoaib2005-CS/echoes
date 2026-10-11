import { DOMAIN_LABEL, type CompareResult, type CompareStatus, type Item } from '../../shared/types';
import { Button, Card, ErrorBanner, LoadingPanel, ModeBadge } from './ui';

const STATUS: Record<CompareStatus, string> = {
  'in-shown': "Also in Qloo's picks",
  'in-qloo': "In Qloo's wider results",
  'in-catalogue': "In Qloo's catalogue, not recommended for these favourites",
  unchecked: "Not in Qloo's picks (catalogue not checked in this data)",
  'not-found': 'Not found in Qloo at all',
  seed: 'One of the favourites entered',
};
/** Results saved before the catalogue check used "not found" to mean "not among Qloo's results". */
const LEGACY_NOT_FOUND = "Not found in Qloo's results for these seeds";

interface Props {
  items: Item[];
  compare: CompareResult | null;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
}

export function CompareView({ items, compare, busy, error, onGenerate }: Props) {
  const legacy = compare !== null && compare.stats.inCatalogue === undefined;
  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-muted">
        The same language model, asked the same question, once with Qloo's results and once with only the favourites' names. The numbers below are counted by code, not judged by the AI.
      </p>
      {compare && (
        <Card>
          <p className="font-semibold">{compare.summary}</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(legacy
              ? [
                  ['Titles suggested by the AI alone', compare.stats.llmTotal],
                  ["Found in Qloo's results", compare.stats.inQlooResults],
                  ["Not found in Qloo's results", compare.stats.notFound],
                  ['With a "because of" reason (Qloo / AI)', `${compare.stats.qlooWithReasons} / 0`],
                ]
              : [
                  ['Titles suggested by the AI alone', compare.stats.llmTotal],
                  ["Among Qloo's results", compare.stats.inQlooResults],
                  ["In Qloo's catalogue, not recommended", (compare.stats.inCatalogue ?? 0) + (compare.stats.unchecked ?? 0)],
                  ['Not found in Qloo at all', compare.stats.notFound],
                ]
            ).map(([k, v]) => (
              <div key={String(k)}><dd className="font-display text-3xl">{v}</dd><dt className="text-sm text-muted">{k}</dt></div>
            ))}
          </dl>
          {!legacy && <p className="mt-3 text-sm text-muted">With a "because of" reason: Qloo {compare.stats.qlooWithReasons} of {compare.stats.qlooShown}, AI-only 0 of {compare.stats.llmTotal}.</p>}
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="cmp-q">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 id="cmp-q" className="text-xl">Echoes, with Qloo</h3>
            <ModeBadge source={compare?.source ?? { mode: 'mock' }} />
          </div>
          <ul className="space-y-2">
            {items.map((i) => {
              const inLlm = compare?.qlooOnly.every((q) => q.id !== i.id);
              return (
                <li key={i.id} className="rounded-2xl border border-line bg-paper p-3">
                  <p className="font-semibold">{i.name} <span className="text-sm font-normal text-muted">{DOMAIN_LABEL[i.domain]}</span></p>
                  {i.reasons?.length ? <p className="text-sm text-teal">Because of: {i.reasons.join(', ')}</p> : <p className="text-sm text-muted">No reason available in this data</p>}
                  {compare && <p className="text-sm text-muted">{inLlm ? 'The AI-only list had this too' : 'Only in the Qloo list'}</p>}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="cmp-l">
          <h3 id="cmp-l" className="mb-2 text-xl">The same AI, no Qloo data</h3>
          {busy && <LoadingPanel label="Asking the AI on its own\u2026" />}
          {error && <ErrorBanner message={error} />}
          {!compare && !busy && (
            <Card>
              <p>Generate the no-Qloo list on demand. It uses one AI request, so it only runs when you ask.</p>
              <Button className="mt-4" onClick={onGenerate}>Generate the AI-only list</Button>
            </Card>
          )}
          {compare && (
            <>
              {compare.llmSource === 'sample' && <p className="mb-2 rounded-2xl bg-line p-3 text-sm">Illustrative sample, written by hand for this demo. It is not a live AI response. Generate a real one in your own session.</p>}
              <ul className="space-y-2">
                {compare.rows.map((r) => (
                  <li key={`${r.domain}-${r.name}`} className="rounded-2xl border border-line bg-paper p-3">
                    <p className="font-semibold">{r.name} <span className="text-sm font-normal text-muted">{DOMAIN_LABEL[r.domain]}</span></p>
                    <p className={`text-sm ${r.status === 'not-found' ? 'text-accent' : 'text-teal'}`}>{legacy && r.status === 'not-found' ? LEGACY_NOT_FOUND : STATUS[r.status]}</p>
                    <p className="text-sm text-muted">No reason given</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
