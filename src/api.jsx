const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN;
const BASE = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p';

if (!TMDB_TOKEN) {
  console.error('[api] Missing VITE_TMDB_TOKEN. All TMDB requests will fail with 401.');
}

export const HEADERS = { Authorization: `Bearer ${TMDB_TOKEN ?? ''}`, 'Content-Type': 'application/json' };

// ─── TV genre IDs that indicate non-movie/non-scripted content ────────────────
const SHOW_GENRE_IDS = new Set([
  10763, // News
  10764, // Reality
  10767, // Talk Show
]);

// Keywords in titles that indicate awards shows, talk shows, live events, shorts
const SHOW_TITLE_PATTERNS = [
  /\bawards?\b/i,
  /\boscars?\b/i,
  /\bgolden globe/i,
  /\bgrammy/i,
  /\bemmy/i,
  /\bbafta/i,
  /\bvma\b/i,
  /\bmtv movie/i,
  /\btalk show/i,
  /\blive!\s*with\b/i,
  /\bkimmel\b/i,
  /\bfallonb?\b/i,
  /\bconan\b/i,
  /\blate (night|show|late)/i,
  /\btonight show\b/i,
  /\bdaily show\b/i,
  /\bcolbert\b/i,
  /\bjimmy\b.*\bshow\b/i,
  /\boprah\b/i,
  /\bellen\b.*\bshow\b/i,
  /\bkelly clarkson\b/i,
  /\bview\b.*\bshow\b/i,
  /\bgood morning\b/i,
  /\btoday show\b/i,
  /\bnightline\b/i,
  /\b20\/20\b/i,
  /\bdateline\b/i,
  /\binside edition\b/i,
  /\bextra\b.*\bshow\b/i,
  /\bentertainment tonight\b/i,
  /\baccess (hollywood|daily)\b/i,
  /\bpeople's choice\b/i,
  /\bteen choice\b/i,
  /\bradio disney\b/i,
  /\bkids' choice\b/i,
  /\bimpact x\b/i,
  /\bspecial edition\b/i,
  /\bchampionship\b/i,
  /\bsuper bowl\b/i,
  // ── Short/bonus/behind-the-scenes content ────────────────────────────────
  /\bshort film\b/i,
  /\bteaser\b/i,
  /\bbonus clip\b/i,
  /\bdeleted scene/i,
  /\bbehind the scenes\b/i,
  /\bmake.*of\b/i,
  /\bfeaturette\b/i,
  /\bbloopers?\b/i,
  /\bgag reel\b/i,
  /^team\s+\w+[\s:]/i,    // "Team Thor:", "Team Darryl:" etc. — Marvel one-shots
  /\bone[- ]shot\b/i,     // explicitly labelled one-shots
];

// TMDB "type" field values that are not full features or proper TV series.
// Present on TV items returned from /discover and /credits.
const JUNK_TV_TYPES = new Set([
  'miniseries_special', 'talk_show', 'news', 'reality',
]);

/**
 * Returns true if the item should be excluded from recommendations:
 * talk shows, award ceremonies, reality/news, short films, bonus clips,
 * one-shots, and anything under MIN_RUNTIME_MOVIE minutes for movies.
 */
export function isShowOrAward(item) {
  const genres = item.genre_ids || [];
  if (genres.some(id => SHOW_GENRE_IDS.has(id))) return true;

  const title = (item.name || item.title || item.original_name || item.original_title || '').trim();
  if (SHOW_TITLE_PATTERNS.some(re => re.test(title))) return true;

  // episode_count on TV cast entries — daily shows stack these fast
  if (item.media_type === 'tv' && (item.episode_count || 0) > 200) return true;

  // TMDB explicit type field (present on TV detail objects)
  if (item.type && JUNK_TV_TYPES.has(item.type.toLowerCase().replace(/\s+/g, '_'))) return true;

  // ── Runtime-based filter ──────────────────────────────────────────────────
  // runtime is populated when we have detail data (enrichment cache / modal open).
  // MIN for movies: 40 min — filters shorts, one-shots, bonus clips.
  // We do NOT filter TV by runtime since episode_run_time varies widely.
  const runtime = item.runtime ?? item.episode_run_time?.[0] ?? null;
  if (item.media_type === 'movie' && runtime !== null && runtime < 40) return true;

  // ── Vote-count floor as a junk proxy ────────────────────────────────────
  // Shorts and one-shots almost always have very few votes even when they're
  // famous. A movie-type item with <20 votes is almost certainly ephemeral.
  // (Main scoring already requires ≥15, but defence-in-depth here.)
  if (item.media_type === 'movie' && (item.vote_count || 0) > 0 && (item.vote_count || 0) < 20) return true;

  return false;
}

// Maps app language codes to TMDB language codes.
// To add a new language: add its code here and create the corresponding locale file.
const TMDB_LANG_MAP = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
  tr: 'tr-TR',
  zh: 'zh-CN',
};
const getLang = () => {
  try {
    const code = localStorage.getItem('lang') || 'en';
    return TMDB_LANG_MAP[code] || 'en-US';
  } catch { return 'en-US'; }
};

// ─── Session-level details cache (fix #9) ────────────────────────────────────
const _detailsCache = new Map();

// ─── Enrichment cache for recommendation algorithm ────────────────────────────
// Stores lightweight metadata extracted from movie/tv detail calls:
// { directorId, directorName, keywordIds, runtime, collectionId, budget }
// Populated lazily whenever MovieModal loads details — zero extra API calls.
const _enrichCache = new Map();

// Called by tmdb.movieDetails / tmdb.tvDetails after each successful detail fetch.
// Extracts and stores only the fields the recommendation algorithm needs.
function _storeEnrich(id, mediaType, data) {
  if (!data || _enrichCache.has(`${mediaType}_${id}`)) return;
  const director = (data.credits?.crew || []).find(c => c.job === 'Director');
  const writers  = (data.credits?.crew || [])
    .filter(c => ['Screenplay','Writer','Story'].includes(c.job))
    .slice(0, 2)
    .map(c => c.id);
  _enrichCache.set(`${mediaType}_${id}`, {
    directorId:   director?.id   || null,
    directorName: director?.name || null,
    writerIds:    writers,
    keywordIds:   [],          // filled by fetchKeywords below
    runtime:      data.runtime || data.episode_run_time?.[0] || null,
    collectionId: data.belongs_to_collection?.id || null,
    budget:       data.budget  || 0,
  });
}

// Fetch keywords for a movie/tv from TMDB; merges into existing enrichment entry.
// Called lazily by the recommendation algorithm when building a rich profile.
export async function fetchEnrichKeywords(id, mediaType) {
  const key = `${mediaType}_${id}`;
  const entry = _enrichCache.get(key);
  if (!entry) return [];
  if (entry.keywordIds.length > 0) return entry.keywordIds;    // already fetched
  try {
    const lang  = getLang();
    const path  = mediaType === 'tv'
      ? `${BASE}/tv/${id}/keywords`
      : `${BASE}/movie/${id}/keywords`;
    const res = await fetch(`${path}?language=${lang}`, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const ids  = (data.keywords || data.results || []).map(k => k.id).slice(0, 20);
    entry.keywordIds = ids;
    return ids;
  } catch { return []; }
}

// Read-only accessor used by recommendation algorithm.
export function getEnrichEntry(id, mediaType) {
  return _enrichCache.get(`${mediaType}_${id}`) || null;
}

// Fetch lightweight enrichment data for movies not yet in _enrichCache.
// Used during profile build to enrich seed movies that were never opened in modal.
export async function fetchEnrichBatch(items) {
  const missing = items.filter(m => !_enrichCache.has(`${m.media_type}_${m.id}`));
  if (missing.length === 0) return;
  await Promise.all(missing.slice(0, 8).map(async m => {
    try {
      const lang   = getLang();
      const isTV   = m.media_type === 'tv';
      const path   = isTV ? `/tv/${m.id}` : `/movie/${m.id}`;
      const append = isTV ? 'credits' : 'credits';
      const res    = await fetch(
        `${BASE}${path}?language=${lang}&append_to_response=${append}`,
        { headers: HEADERS }
      );
      if (!res.ok) return;
      const data = await res.json();
      _storeEnrich(m.id, m.media_type, data);
    } catch {}
  }));
}

const get = async (path, params = {}) => {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('language', getLang());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
};

// Fetch multiple pages and merge results (TMDB returns 20 per page)
const getPages = async (path, params = {}, pages = 3) => {
  try {
    const first = await get(path, { ...params, page: 1 });
    const total = Math.min(pages, first.total_pages || 1);
    const raw = [...(first.results || [])];
    if (total > 1) {
      const rest = await Promise.all(
        Array.from({ length: total - 1 }, (_, i) =>
          get(path, { ...params, page: i + 2 }).catch(() => ({ results: [] }))
        )
      );
      rest.forEach(d => raw.push(...(d.results || [])));
    }
    // Deduplicate by id to prevent the same item appearing in multiple pages
    const seen = new Set();
    return raw.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  } catch { return []; }
};

export const tmdb = {
  trending:      (type = 'all', window = 'week') => get(`/trending/${type}/${window}`),
  popular:       (type = 'movie', pages = 1) => pages > 1
    ? getPages(`/${type}/popular`, {}, pages).then(results => ({ results }))
    : get(`/${type}/popular`),
  topRated:      (type = 'movie', pages = 1) => pages > 1
    ? getPages(`/${type}/top_rated`, {}, pages).then(results => ({ results }))
    : get(`/${type}/top_rated`),
  nowPlaying:    (pages = 1) => pages > 1
    ? getPages('/movie/now_playing', {}, pages).then(results => ({ results }))
    : get('/movie/now_playing'),
  upcoming:      (pages = 1) => pages > 1
    ? getPages('/movie/upcoming', {}, pages).then(results => ({ results }))
    : get('/movie/upcoming'),
  search:        (query) => get('/search/multi', { query }),
  // Fix #9: cache movieDetails / tvDetails for session, also fetch videos
  movieDetails:  async (id) => {
    const key = `movie_${id}_${getLang()}`;
    if (_detailsCache.has(key)) return _detailsCache.get(key);
    const data = await get(`/movie/${id}`, { append_to_response: 'credits,videos,release_dates,production_companies' });
    _detailsCache.set(key, data);
    _storeEnrich(id, 'movie', data);
    return data;
  },
  tvDetails:     async (id) => {
    const key = `tv_${id}_${getLang()}`;
    if (_detailsCache.has(key)) return _detailsCache.get(key);
    const data = await get(`/tv/${id}`, { append_to_response: 'credits,videos,content_ratings,production_companies' });
    _detailsCache.set(key, data);
    _storeEnrich(id, 'tv', data);
    return data;
  },
  genres:        (type = 'movie') => get(`/genre/${type}/list`),
  discover:      (type = 'movie', params = {}, pages = 1) => pages > 1
    ? getPages(`/discover/${type}`, params, pages).then(results => ({ results }))
    : get(`/discover/${type}`, params),
  watchProviders:(type, id) => get(`/${type}/${id}/watch/providers`),
  similar:       (type, id) => get(`/${type}/${id}/recommendations`),
  // Fix #11: default poster size w342 instead of w500 — ~40% less traffic on cards
  posterUrl:     (path, size = 'w342') => path ? `${IMG}/${size}${path}` : null,
  // Large poster for modal (w780) — called explicitly
  posterUrlLarge:(path) => path ? `${IMG}/w780${path}` : null,
  backdropUrl:   (path, size = 'w1280') => path ? `${IMG}/${size}${path}` : null,
  // Small actor thumbnails (w185)
  actorUrl:      (path, size = 'w185') => path ? `${IMG}/${size}${path}` : null,
};

// ─── Trakt API ────────────────────────────────────────────────────────────────
// Free API (Client ID only, no OAuth needed for public endpoints).
// Get your key at https://trakt.tv/oauth/applications/new
// Then add VITE_TRAKT_CLIENT_ID=your_key to your .env file.
const TRAKT_CLIENT_ID = import.meta.env.VITE_TRAKT_CLIENT_ID;
const TRAKT_BASE      = 'https://api.trakt.tv';
const TRAKT_HEADERS   = {
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': TRAKT_CLIENT_ID || '',
};

// Session-level cache for Trakt responses
const _traktCache = new Map();
const TRAKT_CACHE_MAX = 100;
function traktCacheSet(key, val) {
  if (_traktCache.size >= TRAKT_CACHE_MAX) _traktCache.delete(_traktCache.keys().next().value);
  _traktCache.set(key, val);
}

async function traktGet(path, signal) {
  if (!TRAKT_CLIENT_ID) return null;
  if (_traktCache.has(path)) return _traktCache.get(path);
  try {
    const res = await fetch(`${TRAKT_BASE}${path}`, { headers: TRAKT_HEADERS, signal });
    if (!res.ok) return null;
    const data = await res.json();
    traktCacheSet(path, data);
    return data;
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('[Trakt]', e);
    return null;
  }
}

// Convert TMDB id → Trakt slug via /search endpoint
// Returns { movie: {ids}, show: {ids} } or null
async function traktFindByTmdbId(tmdbId, type, signal) {
  const traktType = type === 'tv' ? 'show' : 'movie';
  const path = `/search/tmdb/${tmdbId}?type=${traktType}`;
  const data = await traktGet(path, signal);
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  return data[0][traktType] || null;
}

// Get related titles from Trakt for a given TMDB id + type
// Returns array of { tmdb_id, title, year, type } or []
export async function traktRelated(tmdbId, type, signal) {
  const traktType = type === 'tv' ? 'shows' : 'movies';
  const item = await traktFindByTmdbId(tmdbId, type, signal);
  if (!item) return [];

  const slug = item.ids?.slug;
  if (!slug) return [];

  const path = `/${traktType}/${slug}/related?limit=20`;
  const data = await traktGet(path, signal);
  if (!Array.isArray(data)) return [];

  return data
    .map(entry => ({
      tmdb_id: entry.ids?.tmdb,
      title:   entry.title,
      year:    entry.year,
      type,
    }))
    .filter(r => r.tmdb_id);
}

// Get Trakt related for multiple seeds at once (used in Recs)
// Returns flat array of unique TMDB ids with their type
export async function traktRelatedBatch(seeds, signal) {
  if (!TRAKT_CLIENT_ID || seeds.length === 0) return [];
  const results = await Promise.all(
    seeds.map(s => traktRelated(s.id, s.media_type, signal).catch(() => []))
  );
  const seen = new Set();
  return results.flat().filter(r => {
    if (seen.has(r.tmdb_id)) return false;
    seen.add(r.tmdb_id);
    return true;
  });
}

export const STREAMING_LINKS = {
  8:   { name: 'Netflix',      url: 'https://www.netflix.com/search?q=' },
  9:   { name: 'Amazon Prime', url: 'https://www.amazon.com/s?k=' },
  337: { name: 'Disney+',      url: 'https://www.disneyplus.com/search/' },
  350: { name: 'Apple TV+',    url: 'https://tv.apple.com/search/' },
  384: { name: 'HBO Max',      url: 'https://play.max.com/search/' },
  1899:{ name: 'Max',          url: 'https://play.max.com/search/' },
  15:  { name: 'Hulu',         url: 'https://www.hulu.com/search?q=' },
  531: { name: 'Paramount+',   url: 'https://www.paramountplus.com/search/' },
  283: { name: 'Crunchyroll',  url: 'https://www.crunchyroll.com/search?q=' },
  2:   { name: 'Apple iTunes', url: 'https://tv.apple.com/search/' },
  3:   { name: 'Google Play',  url: 'https://play.google.com/store/search?q=' },
  192: { name: 'YouTube',      url: 'https://www.youtube.com/results?search_query=' },
  555: { name: 'Okko',         url: 'https://okko.tv/search?query=' },
  505: { name: 'IVI',          url: 'https://www.ivi.ru/search/?q=' },
  635: { name: 'Kinopoisk',    url: 'https://www.kinopoisk.ru/index.php?kp_query=' },
};