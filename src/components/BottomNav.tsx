import { CompareIcon, HistoryIcon, ListIcon } from './Icons';

export type NavKey = 'plan' | 'compare' | 'history';
const ITEMS = [
  { key: 'plan', label: 'Plan', Icon: ListIcon },
  { key: 'compare', label: 'Compare', Icon: CompareIcon },
  { key: 'history', label: 'History', Icon: HistoryIcon },
] as const;

/** Phone-only, always visible, every icon labelled. */
export function BottomNav({ active, onSelect }: { active: NavKey; onSelect: (k: NavKey) => void }) {
  return (
    <nav aria-label="Sections" className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      {ITEMS.map(({ key, label, Icon }) => (
        <button key={key} type="button" onClick={() => onSelect(key)} aria-current={active === key ? 'page' : undefined}
          className={`flex min-h-[62px] flex-1 flex-col items-center justify-center gap-0.5 border-t-4 text-sm font-semibold ${active === key ? 'border-accent text-accent' : 'border-transparent text-muted'}`}>
          <Icon size={24} />
          {label}
        </button>
      ))}
    </nav>
  );
}
