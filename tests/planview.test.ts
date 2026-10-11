import { describe, expect, it } from 'vitest';
import { orderedItems, segmentProgress } from '../shared/planview';
import type { Item, SessionPlan } from '../shared/types';

const items: Item[] = [
  { id: 'a1', name: 'A1', domain: 'artist' },
  { id: 'a2', name: 'A2', domain: 'artist' },
  { id: 'm1', name: 'M1', domain: 'movie' },
];
const plan: SessionPlan = {
  title: 'T',
  warmup: { text: 'w', minutes: 4 },
  winddown: { text: 'd', minutes: 4 },
  segments: [
    { domain: 'artist', title: 'Music', intro: '', minutes: 11, items: [{ id: 'a2', prompt: 'p2', sensoryCue: 'c' }, { id: 'a1', prompt: 'p1', sensoryCue: 'c' }] },
    { domain: 'movie', title: 'Film', intro: '', minutes: 11, items: [{ id: 'm1', prompt: 'pm', sensoryCue: 'c' }, { id: 'gone', prompt: 'x', sensoryCue: 'c' }] },
  ],
};

describe('orderedItems', () => {
  it('follows plan order, attaches prompts and skips ids with no item', () => {
    const o = orderedItems(plan, items);
    expect(o.map((x) => x.item.id)).toEqual(['a2', 'a1', 'm1']);
    expect(o.map((x) => x.plan.prompt)).toEqual(['p2', 'p1', 'pm']);
    expect(o.map((x) => x.segmentKey)).toEqual(['artist', 'artist', 'movie']);
  });
});

describe('segmentProgress', () => {
  it('counts rated items and flags completion', () => {
    expect(segmentProgress(['a1', 'a2'], { a1: 'loved' })).toEqual({ rated: 1, total: 2, done: false });
    expect(segmentProgress(['a1', 'a2'], { a1: 'loved', a2: 'upset' }).done).toBe(true);
  });
  it('never reports an empty segment as done', () => {
    expect(segmentProgress([], {}).done).toBe(false);
  });
});
