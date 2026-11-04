import { Trash2 } from 'lucide-react'

import type { HistoryEntry } from '../../types/calculator'
import { cn } from '../../utils/cn'

interface HistoryPanelProps {
  entries: HistoryEntry[]
  /** Reuse a previous result as the current value. */
  onSelect: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
}

/**
 * The calculation history.
 *
 * Entries are stored on the device only. Tapping an entry reuses its result;
 * the trash button removes a single entry without touching the rest.
 */
export function HistoryPanel({ entries, onSelect, onRemove }: HistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-[13px] font-medium text-ink-muted">No calculations yet</p>
        <p className="max-w-[26ch] text-[12px] leading-relaxed text-ink-dim">
          Results you calculate will appear here so you can reuse them later.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div
            className={cn(
              'group flex items-center gap-2 rounded-[14px] px-3 py-2.5',
              'transition-colors duration-[140ms] ease-soft',
              'hover:bg-surface-3',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="min-w-0 flex-1 text-right"
              aria-label={`Reuse result ${entry.result}`}
            >
              <span className="block truncate font-mono text-[11.5px] leading-4 text-ink-dim">
                {entry.expression}
              </span>
              <span className="tnum block truncate text-[16px] font-semibold leading-6 tracking-[-0.02em] text-ink">
                {entry.result}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              aria-label={`Delete calculation ${entry.expression}`}
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-ink-dim',
                'transition-[color,background-color,opacity] duration-[140ms] ease-soft',
                'hover:bg-danger-soft hover:text-danger',
              )}
            >
              <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
