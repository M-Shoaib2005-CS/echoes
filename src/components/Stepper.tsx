const STEPS = ['Seeds', 'Session', 'Feedback', 'Next'];

/** Shows where the caregiver is in the loop; purely informational. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="no-print flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold ${i < current ? 'border-teal bg-teal-soft text-teal' : i === current ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}>
            {i < current ? '\u2713' : i + 1}
          </span>
          <span className={i === current ? 'font-semibold' : 'text-muted'}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-5 bg-line" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
