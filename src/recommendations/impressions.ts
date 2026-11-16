import { REC } from './config'

/**
 * How many times a title has been shown to the user in the feed. Titles that were seen but
 * ignored are gradually ranked lower, so a reload does not bring the same cards back.
 * Kept on the device only: it is a ranking hint, not user data worth syncing.
 */
const KEY_PREFIX = 'cinimate:rec-impressions:v1:'

const stores = new Map<string, Map<string, number>>()
const timers = new Map<string, number>()

function load(uid: string): Map<string, number> {
  const existing = stores.get(uid)
  if (existing) return existing

  const store = new Map<string, number>()

  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + uid)
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    for (const [key, count] of Object.entries(parsed)) {
      if (Number.isFinite(count)) store.set(key, count)
    }
  } catch {
    // Unreadable storage: start from zero.
  }

  stores.set(uid, store)
  return store
}

function scheduleSave(uid: string) {
  if (timers.has(uid)) return

  timers.set(
    uid,
    window.setTimeout(() => {
      timers.delete(uid)
      const store = load(uid)

      // Oldest entries (first inserted) go first.
      while (store.size > REC.impressionCacheLimit) {
        const oldest = store.keys().next().value
        if (oldest === undefined) break
        store.delete(oldest)
      }

      try {
        window.localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(Object.fromEntries(store)))
      } catch {
        // Ignore: losing impressions only makes repeats slightly more likely.
      }
    }, 1000),
  )
}

export function impressionsOf(uid: string): ReadonlyMap<string, number> {
  return load(uid)
}

export function recordImpression(uid: string, key: string) {
  const store = load(uid)
  const count = store.get(key) ?? 0

  // Re-inserting moves the key to the end, which keeps the pruning order right.
  store.delete(key)
  store.set(key, count + 1)
  scheduleSave(uid)
}
