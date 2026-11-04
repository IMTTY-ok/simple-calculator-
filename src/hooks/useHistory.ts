import { useCallback, useEffect, useState } from 'react'

import { readStorage, writeStorage } from '../utils/storage'
import type { HistoryEntry } from '../types/calculator'

/** Maximum number of calculations kept locally. */
export const MAX_HISTORY_ENTRIES = 50

const STORAGE_KEY = 'history'

export interface UseHistoryResult {
  entries: HistoryEntry[]
  /** Add a calculation to the top of the list. */
  add: (entry: HistoryEntry) => void
  /** Remove a single entry. */
  remove: (id: string) => void
  /** Remove every entry. */
  clear: () => void
}

/**
 * Validate what was read back from storage.
 *
 * Local storage can be edited by hand, corrupted by another version of the
 * app, or written by a browser extension. Anything that does not look like a
 * history entry is discarded rather than allowed to crash the app.
 */
function sanitise(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is HistoryEntry => {
    if (typeof entry !== 'object' || entry === null) return false
    const candidate = entry as Partial<HistoryEntry>
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.expression === 'string' &&
      typeof candidate.result === 'string' &&
      typeof candidate.value === 'number' &&
      Number.isFinite(candidate.value) &&
      typeof candidate.timestamp === 'number'
    )
  })
}

/**
 * Calculation history, persisted locally.
 *
 * History is stored in `localStorage` only — nothing leaves the device.
 */
export function useHistory(): UseHistoryResult {
  const [entries, setEntries] = useState<HistoryEntry[]>(() =>
    sanitise(readStorage<unknown>(STORAGE_KEY, [])),
  )

  useEffect(() => {
    writeStorage(STORAGE_KEY, entries)
  }, [entries])

  const add = useCallback((entry: HistoryEntry) => {
    setEntries((previous) => [entry, ...previous].slice(0, MAX_HISTORY_ENTRIES))
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((previous) => previous.filter((entry) => entry.id !== id))
  }, [])

  const clear = useCallback(() => {
    setEntries([])
  }, [])

  return { entries, add, remove, clear }
}
