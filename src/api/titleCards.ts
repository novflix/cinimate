import { createResource, type Resource } from '@/api/resource'
import { getJson, type PopularMediaItem, type TmdbTrendingItem } from '@/api/tmdb'
import { titleKey, type TitleRef } from '@/lib/library'

const CARD_STALE_TIME = 60 * 60_000
const MAX_CACHED_CARDS = 300

/** What a card needs, from the plain title endpoint: no credits, no recommendations. */
async function loadCard({ kind, id }: TitleRef): Promise<PopularMediaItem> {
  const path = kind === 'movie' ? `/movie/${id}?language=en-US` : `/tv/${id}?language=en-US`
  const data = await getJson<TmdbTrendingItem>(path)

  const title = (kind === 'movie' ? data.title : data.name) ?? ''
  const date = (kind === 'movie' ? data.release_date : data.first_air_date) ?? ''

  return {
    id,
    kind,
    title,
    year: date.slice(0, 4),
    rating: data.vote_average,
    backdrop: data.backdrop_path,
    poster: data.poster_path,
    popularity: data.popularity,
    releaseDate: date,
  }
}

const cardResources = new Map<string, Resource<PopularMediaItem>>()

/** One cached resource per title, so a card is requested once however often it is shown. */
export function titleCardResource(ref: TitleRef): Resource<PopularMediaItem> {
  const key = titleKey(ref)
  const cached = cardResources.get(key)
  if (cached) return cached

  // Keep the cache bounded during a long session; the oldest titles are dropped first.
  if (cardResources.size >= MAX_CACHED_CARDS) {
    const oldest = cardResources.keys().next().value
    if (oldest) cardResources.delete(oldest)
  }

  const resource = createResource(() => loadCard(ref), { staleTime: CARD_STALE_TIME })
  cardResources.set(key, resource)
  return resource
}
