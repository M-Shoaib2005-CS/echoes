import { DOMAIN_LABEL } from '../../shared/types';
import type { SessionRecord } from '../lib/types';

/** Large-type sheet shown only when printing. */
export function PrintSheet({ record, nickname }: { record: SessionRecord; nickname: string }) {
  const { plan, items, outings } = record.response;
  const byId = new Map([...items, ...outings].map((i) => [i.id, i]));
  const outing = plan.outing && byId.get(plan.outing.id);
  return (
    <section className="print-only" aria-hidden="true">
      <h1 style={{ fontSize: '26pt' }}>{plan.title}</h1>
      <p>For {nickname}. Session {record.number}, {new Date(record.createdAt).toLocaleDateString()}. About 30 minutes.</p>
      <h2>Warm-up ({plan.warmup.minutes} min)</h2>
      <p>{plan.warmup.text}</p>
      {plan.segments.map((s) => (
        <div key={s.domain}>
          <h2>{s.title} ({s.minutes} min)</h2>
          <p>{s.intro}</p>
          <ol>
            {s.items.map((pi) => (
              <li key={pi.id} style={{ marginBottom: '0.6em' }}>
                <strong>{byId.get(pi.id)?.name}</strong> <span>({DOMAIN_LABEL[s.domain]})</span>
                <div>{pi.prompt}</div>
                <div><em>Try: {pi.sensoryCue}</em></div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <h2>Wind-down ({plan.winddown.minutes} min)</h2>
      <p>{plan.winddown.text}</p>
      {outing && plan.outing && <p><strong>Outing idea: {outing.name}.</strong> {plan.outing.prompt}</p>}
      <p style={{ fontSize: '11pt', marginTop: '1.5em' }}>Echoes is a gentle conversation aid, not medical software. Taste data: Qloo Taste AI.</p>
    </section>
  );
}
