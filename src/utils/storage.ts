/**
 * Safe wrappers around `localStorage`.
 *
 * Storage can throw (private browsing, disabled cookies, quota exceeded), and
 * a calculator must never crash because a preference could not be saved.
 */

const NAMESPACE = 'calculator'

/** Build a namespaced storage key. */
export function storageKey(key: string): string {
  return `${NAMESPACE}:${key}`
}

/** Read and parse a value, falling back when missing or unreadable. */
export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Serialise and store a value. Silently ignores quota/permission errors. */
export function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    /* Storage unavailable — preferences simply do not persist. */
  }
}

/** Remove a stored value. */
export function removeStorage(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    /* no-op */
  }
}

/** Generate a collision-resistant id for history entries. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
