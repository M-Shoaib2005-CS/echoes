import { EMPTY_STORE, type Store } from './types';

const KEY = 'echoes:v1';
const MAX_SESSIONS = 30;

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return Array.isArray(parsed.sessions) ? { profile: parsed.profile ?? null, sessions: parsed.sessions } : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(store: Store): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...store, sessions: store.sessions.slice(-MAX_SESSIONS) }));
    return true;
  } catch {
    return false;
  }
}

export function clearStore(): void {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.clear();
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
