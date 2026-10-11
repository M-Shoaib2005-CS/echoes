import { describe, expect, it } from 'vitest';
import { describeStep, FINISH_TEXT } from '../shared/agentview';
import type { AgentStep } from '../shared/types';

const step = (tool: AgentStep['tool'], input: string): AgentStep => ({ n: 1, tool, thought: '', input, output: '', ms: 5 });

describe('describeStep', () => {
  it('describes each tool in plain language', () => {
    expect(describeStep(step('find_entity', 'find_entity({"name":"Begum Akhtar","domain":"artist"})'))).toEqual({ label: 'Looked up on Qloo', detail: 'Begum Akhtar \u00b7 music' });
    expect(describeStep(step('find_tags', 'find_tags({"query":"ghazal"})'))).toEqual({ label: 'Searched Qloo tags', detail: '\u201cghazal\u201d' });
    expect(describeStep(step('recommend', 'recommend({"domain":"movie","filter_tag_ids":["t1"],"signal_ids":["a"]})'))).toEqual({
      label: 'Asked Qloo for recommendations',
      detail: 'films \u00b7 restricted to a tag \u00b7 from chosen favourites',
    });
    expect(describeStep(step('finish', 'finish({})')).label).toBe('Chose the final picks');
    expect(describeStep(step('error', '')).label).toBe('Hit a snag');
  });
  it('copes with truncated or malformed stored input', () => {
    expect(describeStep(step('recommend', 'recommend({"domain":"artist","filter_tag_ids":["urn:tag:genre:qloo:gha')).detail).toBe('');
    expect(describeStep(step('find_tags', 'nonsense')).detail).toBe('');
  });
  it('has wording for every way a run can end', () => {
    expect(Object.keys(FINISH_TEXT).sort()).toEqual(['agent', 'error', 'step_limit', 'time_limit']);
  });
});
