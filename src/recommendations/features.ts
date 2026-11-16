import { getJson, type MediaKind } from '@/api/tmdb'
import { titleKey, type TitleRef } from '@/lib/library'
import { REC } from './config'

/** What the taste profile learns from a title. Small on purpose: it is cached on the device. */
export type TitleFeatures = {
  kind: MediaKind
  genres: number[]
  keywords: number[]
  /** Directors / creators first, then the top-billed cast. */
  people: number[]
  /** The top-billed actors, kept separately so recurring actors can be spotted. */
  cast: number[]
  language: string
  year: number
}

type RawDetails = {
  genres?: { id: number }[]
  original_language?: string
  release_date?: string
  first_air_date?: string
  keywords?: { keywords?: { id: number }[]; results?: { id: number }[] }
  credits?: {
    cast?: { id: number; order?: number }[]
    crew?: { id: number; job?: string }[]
  }
  created_by?: { id: number }[]
}

const STORAGE_KEY = 'cinimate:rec-features:v2'
const KEYWORD_LIMIT = 15
const DIRECTOR_LIMIT = 2
const CAST_LIMIT = 10
const PEOPLE_CAST_LIMIT = 4
const CONCURRENCY = 6

type CacheEntry = { t: number; f: TitleFeatures }

let cache: Map<string, CacheEntry> | null = null

function readCache(): Map<string, CacheEntry> {
  if (cache) return cache
  cache = new Map()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {}
    const oldest = Date.now() - REC.featureTtlDays * 86_400_000

    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.t === 'number' && entry.t > oldest && entry.f) {
        cache.set(key, entry)
      }
    }
  } catch {
    // Storage is blocked or corrupted: the cache just starts empty.
  }

  return cache
}

let saveTimer: number | null = null

function scheduleSave() {
  if (saveTimer !== null) return

  saveTimer = window.setTimeout(() => {
    saveTimer = null
    const entries = [...readCache().entries()]
      .sort(([, a], [, b]) => b.t - a.t)
      .slice(0, REC.featureCacheLimit)

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch {
      // Full or blocked storage only costs a refetch next time.
    }
  }, 500)
}

function toFeatures(kind: MediaKind, data: RawDetails): TitleFeatures {
  const keywords = (kind === 'movie' ? data.keywords?.keywords : data.keywords?.results) ?? []

  const makers =
    kind === 'movie'
      ? (data.credits?.crew ?? []).filter((person) => person.job === 'Director')
      : (data.created_by ?? [])

  const cast = [...(data.credits?.cast ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, CAST_LIMIT)

  const date = (kind === 'movie' ? data.release_date : data.first_air_date) ?? ''

  return {
    kind,
    genres: (data.genres ?? []).map((genre) => genre.id),
    keywords: keywords.slice(0, KEYWORD_LIMIT).map((keyword) => keyword.id),
    people: [
      ...makers.slice(0, DIRECTOR_LIMIT),
      ...cast.slice(0, PEOPLE_CAST_LIMIT),
    ].map((person) => person.id),
    cast: cast.map((person) => person.id),
    language: data.original_language ?? '',
    year: Number(date.slice(0, 4)) || 0,
  }
}

async function fetchFeatures(ref: TitleRef): Promise<TitleFeatures | null> {
  const path = ref.kind === 'movie' ? 'movie' : 'tv'

  try {
    const data = await getJson<RawDetails>(
      `/${path}/${ref.id}?language=en-US&append_to_response=keywords,credits`,
    )
    return toFeatures(ref.kind, data)
  } catch {
    // A deleted title or a network hiccup: the profile simply learns from the others.
    return null
  }
}

/**
 * Features of the given titles. Cached ones come from the device; the rest are requested from
 * TMDB a few at a time (one request per title, keywords and credits ride along).
 */
export async function loadFeatures(refs: TitleRef[]): Promise<Map<string, TitleFeatures>> {
  const store = readCache()
  const result = new Map<string, TitleFeatures>()
  const missing: TitleRef[] = []

  for (const ref of refs) {
    const hit = store.get(titleKey(ref))
    if (hit) result.set(titleKey(ref), hit.f)
    else missing.push(ref)
  }

  let next = 0
  const worker = async () => {
    while (next < missing.length) {
      const ref = missing[next++]
      const features = await fetchFeatures(ref)
      if (!features) continue

      store.set(titleKey(ref), { t: Date.now(), f: features })
      result.set(titleKey(ref), features)
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker))
  if (missing.length > 0) scheduleSave()

  return result
}
