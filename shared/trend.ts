import type { Rating } from './types';

export const FLATTER_NOTE =
  'Responses have been flatter lately. This may be worth mentioning to their care team.';

/** Share of "loved" among rated items; null when too few ratings to mean anything. */
export function lovedRatio(ratings: Record<string, Rating>, minRated = 3): number | null {
  const values = Object.values(ratings);
  if (values.length < minRated) return null;
  return values.filter((r) => r === 'loved').length / values.length;
}

export function lovedSeries(sessions: { ratings: Record<string, Rating> }[]): number[] {
  return sessions.map((s) => lovedRatio(s.ratings)).filter((r): r is number => r !== null);
}

/** True when the loved share fell across the last three sessions by a visible margin. Never diagnostic. */
export function detectFlatter(series: number[]): boolean {
  if (series.length < 3) return false;
  const [a, b, c] = series.slice(-3) as [number, number, number];
  return a > b && b > c && a - c >= 0.15;
}
