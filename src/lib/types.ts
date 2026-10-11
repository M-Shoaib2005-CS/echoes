import type { Changes, CompareResult, IdSpace, Rating, Seed, SessionRequest, SessionResponse } from '../../shared/types';

export interface Profile {
  nickname: string;
  city?: string;
  bornDecade?: number;
  seeds: Seed[];
  idSpace: IdSpace;
}
export interface SessionRecord {
  id: string;
  number: number;
  createdAt: string;
  request: SessionRequest;
  response: SessionResponse;
  idSpace: IdSpace;
  ratings: Record<string, Rating>;
  compare: CompareResult | null;
  changes: Changes | null;
}
export interface Store {
  profile: Profile | null;
  sessions: SessionRecord[];
}
export const EMPTY_STORE: Store = { profile: null, sessions: [] };
