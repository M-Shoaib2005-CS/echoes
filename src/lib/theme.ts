import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const set = document.documentElement.dataset.theme;
    return set === 'light' || set === 'dark' ? set : prefersDark() ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('echoes:theme', next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  return { theme, toggle };
}

const SIZES = [18, 20, 22] as const;

/** Caregiver-controlled text size, remembered in the browser. Everything is rem-based so it all scales. */
export function useTextSize(): { level: number; cycle: () => void } {
  const [level, setLevel] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('echoes:size'));
      return v === 1 || v === 2 ? v : 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    document.documentElement.style.fontSize = `${SIZES[level]}px`;
  }, [level]);
  const cycle = useCallback(() => {
    setLevel((l) => {
      const next = (l + 1) % SIZES.length;
      try {
        localStorage.setItem('echoes:size', String(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  return { level, cycle };
}
