import type { Item, PlanItem, Rating, SessionPlan } from './types';

export interface OrderedItem {
  item: Item;
  plan: PlanItem;
  segmentKey: string;
}

/** Items in the exact order the plan presents them, joined with their prompts. Drives focus mode. */
export function orderedItems(plan: SessionPlan, items: Item[]): OrderedItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return plan.segments.flatMap((seg) =>
    seg.items.flatMap((pi) => {
      const item = byId.get(pi.id);
      return item ? [{ item, plan: pi, segmentKey: seg.domain }] : [];
    }),
  );
}

export interface SegmentProgress {
  rated: number;
  total: number;
  done: boolean;
}

export function segmentProgress(ids: string[], ratings: Record<string, Rating>): SegmentProgress {
  const rated = ids.filter((id) => ratings[id]).length;
  return { rated, total: ids.length, done: ids.length > 0 && rated === ids.length };
}
