import { useState } from 'react';
import { describeStep, FINISH_TEXT } from '../../shared/agentview';
import type { AgentRun } from '../../shared/types';

/** Every tool call the agent made, in order. Open by default on desktop, collapsed on phones to save space. */
export function AgentTrace({ run }: { run: AgentRun }) {
  const [open] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches);
  const n = run.steps.length;
  return (
    <details open={open} className="no-print rounded-card border border-teal bg-paper p-4 shadow-soft">
      <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">What Echoes did: {n} step{n === 1 ? '' : 's'} with Qloo</summary>
      <p className="mt-1 text-sm text-muted">You asked: &ldquo;{run.instruction}&rdquo;</p>
      <ol className="mt-3 space-y-3">
        {run.steps.map((s) => {
          const d = describeStep(s);
          return (
            <li key={s.n} className="flex gap-3">
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${s.tool === 'error' ? 'border-accent text-accent' : 'border-teal bg-teal-soft text-teal'}`}>{s.n}</span>
              <div className="min-w-0">
                <p className="font-semibold">{d.label}{d.detail && <span className="font-normal text-muted"> &middot; {d.detail}</span>}</p>
                {s.thought && <p className="text-sm italic text-muted">{s.thought}</p>}
                <p className="break-words text-sm">{s.output}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted">{run.qlooCalls} Qloo calls, {run.llmCalls} AI calls. The run {FINISH_TEXT[run.finishedBy]}.</p>
    </details>
  );
}
