import type { AgentRun, AgentStep } from './types';

const DOMAIN_WORD: Record<string, string> = { artist: 'music', movie: 'films', tv_show: 'TV shows' };

function parseArgs(step: AgentStep): Record<string, unknown> {
  const inner = /^[a-z_]+\(([\s\S]*)\)$/.exec(step.input)?.[1];
  try {
    const v: unknown = JSON.parse(inner ?? '');
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {}; // the stored input is truncated at 160 characters, so it may not parse
  }
}
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

/** Plain-language label and detail for one agent step, for caregivers and judges. */
export function describeStep(step: AgentStep): { label: string; detail: string } {
  const a = parseArgs(step);
  switch (step.tool) {
    case 'find_entity':
      return { label: 'Looked up on Qloo', detail: [text(a.name), DOMAIN_WORD[text(a.domain)]].filter(Boolean).join(' \u00b7 ') };
    case 'find_tags':
      return { label: 'Searched Qloo tags', detail: text(a.query) ? `\u201c${text(a.query)}\u201d` : '' };
    case 'recommend':
      return {
        label: 'Asked Qloo for recommendations',
        detail: [DOMAIN_WORD[text(a.domain)], count(a.filter_tag_ids) ? 'restricted to a tag' : '', count(a.signal_ids) ? 'from chosen favourites' : ''].filter(Boolean).join(' \u00b7 '),
      };
    case 'finish':
      return { label: 'Chose the final picks', detail: '' };
    default:
      return { label: 'Hit a snag', detail: '' };
  }
}

export const FINISH_TEXT: Record<AgentRun['finishedBy'], string> = {
  agent: 'finished normally',
  step_limit: 'stopped at the step limit and used the best results so far',
  time_limit: 'stopped at the time limit and used the best results so far',
  error: 'could not finish, so the standard session was used',
};
