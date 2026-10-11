import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { DataSource } from '../../shared/types';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-soft',
  secondary: 'bg-paper text-ink border border-line hover:border-accent',
  ghost: 'text-ink hover:bg-amber-soft',
};
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={cx('inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', VARIANTS[variant], className)}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-card border border-line bg-paper p-5 shadow-soft', className)}>{children}</div>;
}

/** Always visible. Says exactly where the data came from; never claims Qloo for sample data. */
export function ModeBadge({ source }: { source: DataSource }) {
  const info = {
    live: { text: 'Live Qloo data', dot: 'bg-teal', box: 'bg-teal-soft text-teal' },
    recorded: { text: `Cached from Qloo, recorded ${source.recordedAt ?? 'earlier'}`, dot: 'bg-accent', box: 'bg-amber-soft text-ink' },
    mock: { text: 'Sample data, not live Qloo', dot: 'bg-muted', box: 'bg-line text-ink' },
  }[source.mode];
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold', info.box)}>
      <span className={cx('h-2.5 w-2.5 rounded-full', info.dot)} aria-hidden="true" />
      {info.text}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="img" aria-label={`${label}: ${pct} percent`} className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-line">
        <div className="meter-fill h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-muted">{pct}%</span>
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton', className)} aria-hidden="true" />;

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="font-semibold text-muted">{label}</p>
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

export function ErrorBanner({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-card border border-accent bg-amber-soft p-4">
      <p className="font-semibold">{message}</p>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export const Disclaimer = ({ className }: { className?: string }) => (
  <p className={cx('text-sm text-muted', className)}>
    Echoes is a gentle conversation aid, not medical software. It does not diagnose or assess anyone. Qloo results describe what groups tend to like, not what one person will like, so treat every suggestion as a conversation starter. Please use a first name or nickname only, and never enter health details.
  </p>
);

interface Toast {
  id: number;
  text: string;
}
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-40 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className="step-in pointer-events-auto rounded-full bg-ink px-5 py-3 text-bg shadow-soft">
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
