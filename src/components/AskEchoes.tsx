import { useId, useState } from 'react';
import { SparkIcon } from './Icons';
import { Button } from './ui';

const EXAMPLES = ['Add more ghazal and classic Urdu music', 'Make it gentler and more soothing', 'More classic comedy for a laugh', 'Only older titles, nothing modern'];

interface Props {
  busy: boolean;
  available: boolean;
  onAsk: (instruction: string) => void;
}

/** Plain-language request to the agent. Examples fill the box so they can be edited, never auto-send. */
export function AskForm({ busy, available, onAsk }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const ready = text.trim().length >= 3 && !busy && available;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (ready) onAsk(text.trim()); }}>
      <label htmlFor={`${id}-t`} className="block font-semibold">Ask Echoes to change this session</label>
      <textarea id={`${id}-t`} rows={3} maxLength={300} value={text} disabled={!available || busy} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-h`}
        placeholder="For example: she loved Sunday-evening ghazal radio, make it gentler" className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-ink" />
      <p id={`${id}-h`} className="text-sm text-muted">
        {available ? "Echoes chooses which Qloo tools to use and shows every step. Please don't include health details or full names." : 'Ask Echoes needs the AI service, which is not set up on this server. The standard session still works.'}
      </p>
      {available && (
        <div role="group" aria-label="Examples" className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)} className="min-h-[44px] rounded-full border border-line bg-paper px-4 text-left text-sm font-semibold hover:border-accent">{ex}</button>
          ))}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={!ready}><SparkIcon size={18} />{busy ? 'Working\u2026' : 'Ask Echoes'}</Button>
    </form>
  );
}
