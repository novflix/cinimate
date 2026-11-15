/**
 * Text side of search: normalization, script folding, typo tolerance and the relevance weights.
 *
 * The scoring follows the product spec: a title match always beats a person/genre/keyword match,
 * and popularity is only used later, as a tie-break, so an obscure exact title can outrank a
 * blockbuster with a weaker match.
 */

/** Match types in the order the spec describes them. The number is the base relevance score. */
export const MATCH_WEIGHTS = {
  'title-exact': 100,
  'title-prefix': 85,
  'title-words': 70,
  'alt-title': 65,
  actor: 55,
  director: 45,
  genre: 35,
  overview: 20,
  keyword: 15,
  server: 60,
  fuzzy: 60,
  'title-partial': 72,
} as const

export type MatchKind = keyof typeof MATCH_WEIGHTS

export type TextMatch = {
  score: number
  kind: MatchKind
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  є: 'e',
  ґ: 'g',
}

// Physical key positions: typing on the wrong layout turns "interstellar" into
// "bynthtcnfkkfh", so both directions are needed.
const LATIN_TO_RUSSIAN: Record<string, string> = {
  q: 'й',
  w: 'ц',
  e: 'у',
  r: 'к',
  t: 'е',
  y: 'н',
  u: 'г',
  i: 'ш',
  o: 'щ',
  p: 'з',
  '[': 'х',
  ']': 'ъ',
  a: 'ф',
  s: 'ы',
  d: 'в',
  f: 'а',
  g: 'п',
  h: 'р',
  j: 'о',
  k: 'л',
  l: 'д',
  ';': 'ж',
  "'": 'э',
  z: 'я',
  x: 'ч',
  c: 'с',
  v: 'м',
  b: 'и',
  n: 'т',
  m: 'ь',
  ',': 'б',
  '.': 'ю',
}

const RUSSIAN_TO_LATIN = Object.fromEntries(
  Object.entries(LATIN_TO_RUSSIAN).map(([latin, russian]) => [russian, latin]),
)

/** Lowercase, strip accents and punctuation, collapse whitespace. Cyrillic is preserved. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function hasCyrillic(value: string): boolean {
  return /[\u0400-\u04ff]/.test(value)
}

/**
 * Script-folded form used for comparisons: "Интерстеллар" and "Interstellar" both become
 * "interstellar", so a Russian query can match an English title (and vice versa).
 */
export function fold(input: string): string {
  const normalized = normalizeText(input)
  let result = ''

  for (const char of normalized) {
    result += CYRILLIC_TO_LATIN[char] ?? char
  }

  return result
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

/** Queries to send to TMDB first: the normalized text plus its transliteration. */
export function primaryVariants(query: string): string[] {
  const base = normalizeText(query)
  return unique([base, hasCyrillic(base) ? fold(base) : ''])
}

/**
 * Queries tried only when the primary search is weak: input typed on the wrong keyboard layout.
 * This keeps the correction from ever changing a query that already returns good results.
 */
export function fallbackVariants(query: string): string[] {
  const base = normalizeText(query)
  if (!base) return []

  const hasLatin = /[a-z]/.test(base)
  const hasCyrillicLetters = hasCyrillic(base)

  if (hasLatin && !hasCyrillicLetters) {
    const converted = [...base].map((char) => LATIN_TO_RUSSIAN[char] ?? char).join('')
    return unique([converted, fold(converted)])
  }

  if (hasCyrillicLetters && !hasLatin) {
    const converted = [...base].map((char) => RUSSIAN_TO_LATIN[char] ?? char).join('')
    return unique([converted])
  }

  return []
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
    }

    previous = current
  }

  return previous[b.length] ?? Math.max(a.length, b.length)
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 1
  return 1 - editDistance(a, b) / longest
}

/** How well one query word matches one title word: exact, prefix ("чел" → "человек") or typo. */
function tokenScore(queryToken: string, titleTokens: string[]): number {
  let best = 0

  for (const titleToken of titleTokens) {
    if (queryToken === titleToken) return 1

    if (
      queryToken.length >= 3 &&
      titleToken.length >= 3 &&
      (titleToken.startsWith(queryToken) || queryToken.startsWith(titleToken))
    ) {
      const shorter = Math.min(queryToken.length, titleToken.length)
      const longer = Math.max(queryToken.length, titleToken.length)
      best = Math.max(best, 0.75 + 0.25 * (shorter / longer))
      continue
    }

    if (queryToken.length >= 4 && titleToken.length >= 4) {
      const score = similarity(queryToken, titleToken)
      if (score >= 0.72) best = Math.max(best, score)
    }
  }

  return best
}

/**
 * Scores a title against the query. Returns `null` when the title is not relevant at all.
 * Exact → 100, prefix → 85, all words → 70, partial → 72, typo → 60..70.
 */
export function matchTitle(query: string, title: string): TextMatch | null {
  const q = fold(query)
  const t = fold(title)

  if (!q || !t) return null
  if (q === t) return { score: MATCH_WEIGHTS['title-exact'], kind: 'title-exact' }

  // Spacing and punctuation are not meaningful: "spiderman", "spider man" and "Spider-Man"
  // are the same title. This is also what makes the no-space spelling of a translated title work.
  const compactQuery = q.replaceAll(' ', '')
  const compactTitle = t.replaceAll(' ', '')

  if (compactQuery && compactQuery === compactTitle) {
    return { score: MATCH_WEIGHTS['title-exact'], kind: 'title-exact' }
  }

  if (compactTitle.startsWith(compactQuery)) {
    return { score: MATCH_WEIGHTS['title-prefix'], kind: 'title-prefix' }
  }

  if (t.startsWith(q)) return { score: MATCH_WEIGHTS['title-prefix'], kind: 'title-prefix' }

  const queryTokens = q.split(' ')
  const titleTokens = t.split(' ')

  if (queryTokens.every((token) => titleTokens.includes(token))) {
    return { score: MATCH_WEIGHTS['title-words'], kind: 'title-words' }
  }

  if (t.includes(q)) return { score: MATCH_WEIGHTS['title-partial'], kind: 'title-partial' }

  const scores = queryTokens.map((token) => tokenScore(token, titleTokens))
  if (scores.length > 0 && scores.every((score) => score >= 0.7)) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    return { score: Math.round(55 + average * 15), kind: 'fuzzy' }
  }

  const whole = similarity(q, t)
  if (q.length >= 4 && whole >= 0.8) {
    return { score: Math.round(60 + whole * 10), kind: 'fuzzy' }
  }

  return null
}

/** A description match is the weakest signal, and only counts when every query word is present. */
export function matchOverview(query: string, overview: string): TextMatch | null {
  const queryTokens = fold(query).split(' ')
  if (queryTokens.length === 0 || queryTokens.some((token) => token.length < 3)) return null

  const overviewTokens = new Set(fold(overview).split(' '))
  if (queryTokens.every((token) => overviewTokens.has(token))) {
    return { score: MATCH_WEIGHTS.overview, kind: 'overview' }
  }

  return null
}

export type GenreEntry = {
  key: string
  /** English display name used in the "Genre: …" hint. */
  label: string
  movieId: number | null
  tvId: number | null
  names: string[]
}

export const GENRES: GenreEntry[] = [
  {
    key: 'action',
    label: 'Action',
    movieId: 28,
    tvId: 10759,
    names: ['action', 'боевик', 'экшен'],
  },
  {
    key: 'adventure',
    label: 'Adventure',
    movieId: 12,
    tvId: 10759,
    names: ['adventure', 'adventures', 'приключения', 'приключение'],
  },
  {
    key: 'animation',
    label: 'Animation',
    movieId: 16,
    tvId: 16,
    names: ['animation', 'animated', 'анимация', 'мультфильм', 'мультфильмы', 'мультики'],
  },
  {
    key: 'comedy',
    label: 'Comedy',
    movieId: 35,
    tvId: 35,
    names: ['comedy', 'комедия', 'комедии'],
  },
  {
    key: 'crime',
    label: 'Crime',
    movieId: 80,
    tvId: 80,
    names: ['crime', 'криминал'],
  },
  {
    key: 'documentary',
    label: 'Documentary',
    movieId: 99,
    tvId: 99,
    names: ['documentary', 'документальный', 'документалка'],
  },
  {
    key: 'drama',
    label: 'Drama',
    movieId: 18,
    tvId: 18,
    names: ['drama', 'драма', 'драмы'],
  },
  {
    key: 'family',
    label: 'Family',
    movieId: 10751,
    tvId: 10751,
    names: ['family', 'семейный', 'семейное'],
  },
  {
    key: 'fantasy',
    label: 'Fantasy',
    movieId: 14,
    tvId: 10714,
    names: ['fantasy', 'фэнтези', 'фентези'],
  },
  {
    key: 'history',
    label: 'History',
    movieId: 36,
    tvId: 36,
    names: ['history', 'historical', 'история', 'исторический'],
  },
  {
    key: 'horror',
    label: 'Horror',
    movieId: 27,
    tvId: 27,
    names: ['horror', 'ужасы', 'хоррор'],
  },
  {
    key: 'music',
    label: 'Music',
    movieId: 10402,
    tvId: 10402,
    names: ['music', 'musical', 'музыка', 'мюзикл'],
  },
  {
    key: 'mystery',
    label: 'Mystery',
    movieId: 9648,
    tvId: 9648,
    names: ['mystery', 'detective', 'детектив'],
  },
  {
    key: 'romance',
    label: 'Romance',
    movieId: 10749,
    tvId: 10749,
    names: ['romance', 'romantic', 'романтика', 'мелодрама'],
  },
  {
    key: 'sci-fi',
    label: 'Sci-Fi',
    movieId: 878,
    tvId: 10765,
    names: ['sci fi', 'science fiction', 'фантастика', 'научная фантастика'],
  },
  {
    key: 'thriller',
    label: 'Thriller',
    movieId: 53,
    tvId: 53,
    names: ['thriller', 'триллер'],
  },
  {
    key: 'war',
    label: 'War',
    movieId: 10752,
    tvId: 10768,
    names: ['war', 'военный', 'война'],
  },
  {
    key: 'western',
    label: 'Western',
    movieId: 37,
    tvId: 37,
    names: ['western', 'вестерн'],
  },
  {
    key: 'kids',
    label: 'Kids',
    movieId: null,
    tvId: 10762,
    names: ['kids', 'детский', 'детское'],
  },
  {
    key: 'reality',
    label: 'Reality',
    movieId: null,
    tvId: 10764,
    names: ['reality', 'реалити'],
  },
  {
    key: 'soap',
    label: 'Soap',
    movieId: null,
    tvId: 10766,
    names: ['soap', 'soap opera', 'мыльная опера'],
  },
  {
    key: 'talk',
    label: 'Talk Show',
    movieId: null,
    tvId: 10767,
    names: ['talk', 'talk show', 'ток шоу'],
  },
  {
    key: 'tv-movie',
    label: 'TV Movie',
    movieId: 10770,
    tvId: null,
    names: ['tv movie', 'телефильм'],
  },
  {
    key: 'news',
    label: 'News',
    movieId: null,
    tvId: 10763,
    names: ['news', 'новости'],
  },
]

// "action movies" / "лучшие комедии" should still be recognised as a genre request.
const GENRE_NOISE = new Set([
  'movie',
  'movies',
  'film',
  'films',
  'series',
  'show',
  'shows',
  'tv',
  'best',
  'new',
  'top',
  'фильм',
  'фильмы',
  'кино',
  'сериал',
  'сериалы',
  'шоу',
  'лучшие',
  'лучший',
  'новые',
  'новый',
])

/** Detects a genre request such as "action", "боевик" or "action movies". */
export function detectGenre(query: string): GenreEntry | null {
  const words = normalizeText(query).split(' ').filter(Boolean)
  if (words.length === 0) return null

  const meaningful = words.length > 1 ? words.filter((word) => !GENRE_NOISE.has(word)) : words
  if (meaningful.length === 0) return null

  const cleaned = meaningful.join(' ')

  return (
    GENRES.find((entry) =>
      entry.names.some((name) => {
        const normalized = normalizeText(name)
        return cleaned === normalized || fold(cleaned) === fold(normalized)
      }),
    ) ?? null
  )
}
