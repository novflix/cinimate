# Cinimate — Technical Documentation

> Complete technical reference for the Cinimate web application.
> Version: 0.9.5 Beta | Stack: React 19 + Vite + Supabase + TMDB API + Trakt API

---

## Table of Contents

- [1. Architecture Overview](#1-architecture-overview)
- [2. Tech Stack](#2-tech-stack)
- [3. Project Structure](#3-project-structure)
- [4. Data Flow](#4-data-flow)
- [5. Authentication System](#5-authentication-system)
- [6. State Management](#6-state-management)
- [7. TMDB API Integration](#7-tmdb-api-integration)
- [8. Trakt API Integration](#8-trakt-api-integration)
- [9. Recommendation Algorithm](#9-recommendation-algorithm)
- [10. Search System](#10-search-system)
- [11. Cloud Sync (Supabase)](#11-cloud-sync-supabase)
- [12. Localization System](#12-localization-system)
- [13. TV Series Tracker](#13-tv-series-tracker)
- [14. Custom Lists](#14-custom-lists)
- [15. Public Lists & Sharing](#15-public-lists--sharing)
- [16. Admin Panel](#16-admin-panel)
- [17. PWA & iOS Support](#17-pwa--ios-support)
- [18. Performance Optimizations](#18-performance-optimizations)
- [19. CSS Architecture & Theming](#19-css-architecture--theming)
- [20. Icon System](#20-icon-system)
- [21. Seasonal & Effects System](#21-seasonal--effects-system)
- [22. About Page / Landing](#22-about-page--landing)
- [23. Build & Deployment](#23-build--deployment)
- [24. Environment Variables](#24-environment-variables)
- [25. Database Schema](#25-database-schema)

---

## 1. Architecture Overview

Cinimate is a **client-side React SPA** with no custom backend. All data lives in external services:

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                      │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ AuthCtx  │  │StoreCtx  │  │ThemeCtx  │  │ AdminCtx  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └───────────┘  │
│       │              │                                       │
│       ▼              ▼                                       │
│  ┌─────────┐   ┌──────────┐                                 │
│  │Supabase │   │localStorage│                               │
│  │  Auth   │   │  (cache)  │                                │
│  └─────────┘   └──────────┘                                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                ┌──────────┼──────────┐
                │          │          │
          ┌─────▼────┐ ┌──▼───┐ ┌───▼──────┐
          │  TMDB    │ │Trakt │ │ Supabase │
          │  API     │ │ API  │ │ (user    │
          │ (films)  │ │(comm)│ │  data)   │
          └──────────┘ └──────┘ └──────────┘
```

**Key design decisions:**
- Zero backend — reduces infrastructure cost and complexity
- All movie data comes from TMDB API at runtime (no ETL, always fresh)
- Community signal from Trakt API (related titles, no OAuth needed)
- User data (watchlists, ratings) stored in Supabase PostgreSQL
- Guest mode fully supported — localStorage only, no account required
- All React Context, no Redux or Zustand — sufficient for this scale
- Vite for fast dev server and optimized builds

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| UI Framework | React | 19.x | Component tree, hooks, rendering |
| Build Tool | Vite | 6.x | Dev server, bundling, HMR |
| Routing | react-router-dom | 7.x | Client-side routing with URL sync |
| Auth + DB | Supabase | JS v2 | Authentication, PostgreSQL, realtime |
| Movie Data | TMDB API | v3 | Films, TV shows, cast, images |
| Community Data | Trakt API | v2 | Related titles for recommendations |
| Image Hosting | Cloudinary | — | Avatar and list cover uploads |
| Hosting | Vercel | — | Static file CDN, auto-deploy |
| Icons | Solar Icon Set | 2.0.1 | UI icons (1200+ Linear style) |
| I18n | i18next | 23.x | 9-language internationalization |
| Flags | flag-icons | 7.x | Country flag icons for language picker |
| Fonts | Google Fonts | — | Bebas Neue (headings), DM Sans (body) |
| CSS | Vanilla CSS + CSS Variables | — | No CSS-in-JS, no Tailwind |
| Testing | Vitest | 3.x | Configured but no tests written yet |

---

## 3. Project Structure

```
cinimate/
├── public/
│   ├── index.html              # PWA meta tags, Apple touch icons
│   └── manifest.json           # Web app manifest
│
├── src/
│   ├── index.jsx               # Entry point, ErrorBoundary
│   ├── App.jsx                 # Root: auth gate, routing, providers
│   ├── index.css               # CSS variables, global styles, animations
│   ├── liquid-glass.css        # iOS 26 Liquid Glass effects
│   │
│   ├── auth.jsx                # AuthContext: Supabase auth + deleteAccount
│   ├── store.jsx               # StoreContext: state + cloud sync + custom lists
│   ├── theme.jsx               # ThemeContext: dark/light, language (i18n)
│   ├── admin.jsx               # AdminContext: snow/season overrides
│   ├── supabase.jsx            # Supabase client singleton
│   ├── api.jsx                 # TMDB + Trakt API wrappers, streaming links
│   ├── useLocalizedMovies.jsx  # Hook: hydrates saved lists in current language
│   │
│   ├── i18n/
│   │   ├── index.jsx           # i18next config, 9 supported languages
│   │   └── locales/            # en, ru, de, es, fr, it, pt, tr, zh
│   │
│   ├── components/
│   │   ├── MovieCard.jsx/css   # Poster card: actions, rating, TV progress, countdown
│   │   ├── MovieModal.jsx/css  # Film detail: cast, crew, streaming, ratings, studios
│   │   ├── BottomNav.jsx/css   # Mobile tab bar (4 tabs)
│   │   ├── SideNav.jsx/css     # Desktop sidebar (sticky)
│   │   ├── ScrollRow.jsx/css   # Horizontal scroll + desktop arrows
│   │   ├── RatingPrompt.jsx/css# Animated post-watch rating picker
│   │   ├── Roulette.jsx/css    # Watchlist spin wheel
│   │   ├── Countdown.jsx       # Live "in X days" badge
│   │   ├── Confetti.jsx        # Canvas confetti on mark-watched
│   │   ├── Particles.jsx/css   # Background particle field
│   │   ├── Effects.jsx/css     # SnowEffect, SparkBurst
│   │   ├── SettingsModal.jsx/css# Theme, language, account, admin tools
│   │   ├── DonateModal.jsx/css # Donation support modal
│   │   ├── ShareCard.jsx/css   # Share card component
│   │   └── Wordmark.jsx/css    # Brand wordmark logo
│   │
│   ├── hooks/
│   │   ├── useRecommendations.jsx # 6-strategy recommendation algorithm (~712 lines)
│   │   ├── useMovieModal.jsx      # Modal state synced with URL ?movie= param
│   │   ├── useDominantColor.jsx   # Canvas-based dominant color extraction
│   │   └── useSeason.jsx          # Season detection + themed genre config
│   │
│   └── pages/
│       ├── Home.jsx/css        # Hero, 7 tabs, seasonal, public lists (~644 lines)
│       ├── Search.jsx/css      # Search + filters + actor search (~813 lines)
│       ├── Recs.jsx/css        # Infinite recommendation feed
│       ├── Profile.jsx/css     # Profile, lists, roulette, list editor (~1090 lines)
│       ├── About.jsx/css       # Landing page + desktop auth gate (~669 lines)
│       ├── AuthScreen.jsx/css  # Sign in / sign up / guest flow
│       ├── ActorPage.jsx/css   # Actor filmography
│       ├── PersonPage.jsx/css  # Crew person page
│       ├── SimilarPage.jsx/css # Similar titles (via Trakt + TMDB)
│       ├── CollectionPage.jsx  # Film collections
│       ├── PublicListPage.jsx/css # Public/shared list view
│       ├── TermsOfService.jsx  # Legal: ToS
│       ├── PrivacyPolicy.jsx   # Legal: Privacy
│       ├── CommunityGuidelines.jsx # Legal: Community
│       └── Notfound.jsx/css    # 404 page
│
├── .env                        # Local env variables (not committed)
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite config (port 3000, build → /build)
├── vercel.json                 # SPA rewrites + security headers + CSP
├── README.md
└── TECHNICAL.md                # This file
```

---

## 4. Data Flow

### App Startup

```
1. index.jsx mounts ErrorBoundary → App
2. App wraps: ThemeProvider → AuthProvider → BrowserRouter → Root
3. Root: checks auth state
   a. user === undefined → loading spinner (waiting for getSession)
   b. user === null, not skipped, not public route → AuthScreen
   c. user === null, not skipped, desktop → About as landing + auth overlay
   d. user === null, skipped → AppInner (guest mode)
   e. user exists → AppInner
4. StoreProvider receives userId → loadFromCloud(userId) → merges into localStorage
5. AppInner: SideNav + Routes + BottomNav + Particles + SnowEffect
6. Home page loads → fetches TMDB data in parallel → sessionStorage cache (5min TTL)
```

### Save a Movie

```
User taps "Eye" button on MovieCard
  → handleWatched() fires
  → addToWatched(movie) in StoreContext
  → watched[] state updated (normalized: {id, media_type, addedAt})
  → localStorage.setItem('watched', ...) (sync, ~40 bytes per item)
  → pendingRating set → RatingPrompt appears after 350ms
  → showConfetti = true for 1400ms
  → After 1500ms debounce: syncToCloud() fires
  → supabase.from('user_data').upsert({...})
```

### Language Switch

```
User selects language in Settings
  → ThemeContext.setLang('de')
  → localStorage.setItem('lang', 'de')
  → i18n.changeLanguage('de') → all t() calls update
  → useLocalizedMovies() detects langCode change
  → Re-fetches TMDB data with language=de-DE
  → Replaces titles/posters in saved lists
```

---

## 5. Authentication System

**File:** `src/auth.jsx`

Uses Supabase Auth v2 with email/password. No OAuth configured currently.

```javascript
// AuthContext exports:
{
  user,           // Supabase User object | null | undefined (loading)
  loading,        // boolean — auth operation in progress
  signUp,         // (email, password) → { data, error }
  signIn,         // (email, password) → { data, error }
  signOut,        // () → void — clears all local data
  deleteAccount,  // () → { error } — deletes user data from all tables + auth
}
```

**Session persistence:** Supabase JS v2 automatically persists the session in `localStorage` under `sb-[project-ref]-auth-token`. On app load, `getSession()` restores the session without a network call.

**Auth state machine:**
```
undefined → loading (waiting for getSession)
null      → not logged in (guest mode)
User{}    → authenticated
```

**Guest → Account migration:**
When a guest user registers in Settings, `signUp()` is called. `onAuthStateChange` fires → `StoreProvider` receives the new `userId` → on first cloud load it finds empty cloud data → writes current localStorage data to cloud. All lists, ratings, and progress migrate automatically.

**Account deletion:**
Deletes user data from known tables (`watchlist`, `ratings`, `lists`, `list_items`, `profiles`, `user_settings`), calls `supabase.rpc('delete_user')`, clears all local storage, and signs out.

---

## 6. State Management

**File:** `src/store.jsx`

Single React Context (`StoreContext`) holds all app state. The context value is memoized with `useMemo` to prevent unnecessary re-renders.

### State Slices

| Slice | Type | Description |
|-------|------|-------------|
| `watched` | `Movie[]` | Films/shows marked as watched (slim: id + media_type + addedAt) |
| `watchlist` | `Movie[]` | Films/shows queued to watch |
| `sortedWatchlist` | `Movie[]` | Watchlist with pinned items first |
| `ratings` | `{ [id]: { score, ratedAt } }` | User ratings by movie ID |
| `profile` | `{ name, avatar, bio }` | User profile data |
| `likedActors` | `{ [id]: { id, name, profile_path } }` | Actors the user liked |
| `dislikedIds` | `number[]` | Movie IDs hidden from recommendations |
| `tvProgress` | `{ [id]: { season, episode, totalSeasons, episodesInSeason } }` | Series watch progress |
| `customLists` | `{ [listId]: CustomList }` | User-created custom lists |
| `pinnedIds` | `number[]` | Pinned watchlist item IDs |
| `pendingRating` | `Movie \| null` | Triggers RatingPrompt overlay |
| `showConfetti` | `boolean` | Triggers confetti animation |
| `syncing` | `boolean` | Cloud sync in progress indicator |

### Normalized Movie Shape (Slim Storage)

```typescript
interface NormalizedMovie {
  id: number;
  media_type: 'movie' | 'tv';
  addedAt: number;  // unix ms — powers temporal decay in recommendations
}
```

All movies are normalized via `normalize()` before storage. This reduces ~350 bytes per item to ~40 bytes (~89% savings). Display data (title, poster, etc.) is fetched from TMDB via `useLocalizedMovies`.

### Cloud Sync

```javascript
// Debounced 1500ms after any state change
// cloudLoaded guard prevents empty state from overwriting cloud data
syncToCloud(userId, {
  watched, watchlist, ratings, profile,
  liked_actors, disliked_ids, tv_progress, custom_lists, pinned_ids
})
// → supabase.from('user_data').upsert(...)
```

localStorage is always written synchronously; Supabase is written with debounce to avoid excessive API calls.

### Data Loss Protection

Before syncing, the store checks whether local state is meaningful:
```javascript
const hasAnyData = watched.length > 0 || watchlist.length > 0 || ...
if (!hasAnyData) {
  // Check if cloud has data — if yes, DON'T overwrite with empty state
  const { data: cloudRow } = await supabase.from('user_data').select('user_id')...
  if (cloudRow) return; // cloud has data, don't overwrite
}
```

---

## 7. TMDB API Integration

**File:** `src/api.jsx`

**Base URL:** `https://api.themoviedb.org/3`
**Auth:** Bearer token in `Authorization` header
**Image CDN:** `https://image.tmdb.org/t/p/`

### Wrapper Functions

```javascript
tmdb.trending(type, window)        // GET /trending/{type}/{window}
tmdb.popular(type, pages)          // GET /{type}/popular (multi-page)
tmdb.topRated(type, pages)         // GET /{type}/top_rated
tmdb.nowPlaying(pages)             // GET /movie/now_playing
tmdb.upcoming(pages)               // GET /movie/upcoming
tmdb.discover(type, params, pages) // GET /discover/{type}
tmdb.movieDetails(id)              // GET /movie/{id} + credits, videos, release_dates
tmdb.tvDetails(id)                 // GET /tv/{id} + credits, videos, content_ratings
tmdb.genres(type)                  // GET /genre/{type}/list
tmdb.watchProviders(type, id)      // GET /{type}/{id}/watch/providers
tmdb.similar(type, id)             // GET /{type}/{id}/recommendations
tmdb.search(query)                 // GET /search/multi
tmdb.posterUrl(path, size)         // → full image URL
tmdb.posterUrlLarge(path)          // → w780 for modal
tmdb.backdropUrl(path, size)       // → full backdrop URL
tmdb.actorUrl(path, size)          // → w185 for actor thumbnails
```

### Multi-Page Fetching (Parallel)

```javascript
const getPages = async (path, params, pages = 3) => {
  const first = await get(path, { ...params, page: 1 });
  const total = Math.min(pages, first.total_pages || 1);
  const rest = await Promise.all(
    Array.from({ length: total - 1 }, (_, i) =>
      get(path, { ...params, page: i + 2 }).catch(() => ({ results: [] }))
    )
  );
  return raw.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
};
```

Pages are fetched in parallel — cuts load time from `N × latency` to `1 × latency + overhead`.

### Image Sizes Used

| Context | Size | Dimensions |
|---------|------|-----------|
| Card poster | `w342` | ~342×513px |
| Modal main poster | `w780` | ~780×1170px |
| Backdrop | `w1280` | ~1280×720px |
| Cast/crew photos | `w185` | ~185×278px |
| Actor thumbnails | `w185` | ~185×278px |
| Streaming logos | `w92` | ~92×92px |

### Session Cache

Home page results are cached in `sessionStorage` for 5 minutes:
```javascript
const key = 'cinimate_home_cache_v5_' + lang;
// TTL: Date.now() - ts > 5 * 60 * 1000
```

Movie/TV details are cached in-memory for the session:
```javascript
const _detailsCache = new Map();
// Key: `movie_${id}_${lang}` or `tv_${id}_${lang}`
```

### Enrichment Cache

Lightweight metadata extracted from detail calls for the recommendation algorithm:
```javascript
const _enrichCache = new Map();
// Key: `${mediaType}_${id}`
// Value: { directorId, directorName, writerIds, keywordIds, runtime, collectionId, budget }
```

Populated lazily when MovieModal loads details — zero extra API calls.

### Streaming Links

```javascript
const STREAMING_LINKS = {
  8:    { name: 'Netflix',      url: 'https://www.netflix.com/search?q=' },
  9:    { name: 'Amazon Prime', url: 'https://www.amazon.com/s?k=' },
  337:  { name: 'Disney+',      url: 'https://www.disneyplus.com/search/' },
  350:  { name: 'Apple TV+',    url: 'https://tv.apple.com/search/' },
  384:  { name: 'HBO Max',      url: 'https://play.max.com/search/' },
  1899: { name: 'Max',          url: 'https://play.max.com/search/' },
  15:   { name: 'Hulu',         url: 'https://www.hulu.com/search?q=' },
  531:  { name: 'Paramount+',   url: 'https://www.paramountplus.com/search/' },
  283:  { name: 'Crunchyroll',  url: 'https://www.crunchyroll.com/search?q=' },
  555:  { name: 'Okko',         url: 'https://okko.tv/search?query=' },
  505:  { name: 'IVI',          url: 'https://www.ivi.ru/search/?q=' },
  635:  { name: 'Kinopoisk',    url: 'https://www.kinopoisk.ru/index.php?kp_query=' },
};
```

### Content Filtering

The API layer aggressively filters non-movie content:
- **Genre exclusion:** News (10763), Reality (10764), Talk Show (10767)
- **Title pattern matching:** Awards shows, late-night shows, talk shows, short films, behind-the-scenes
- **Junk TV types:** miniseries_special, talk_show, news, reality
- **Runtime filter:** Movies < 40 minutes excluded (shorts, one-shots)
- **Vote count floor:** Movies with < 20 votes excluded

---

## 8. Trakt API Integration

**File:** `src/api.jsx`

Free API (Client ID only, no OAuth needed for public endpoints).

```javascript
const TRAKT_CLIENT_ID = import.meta.env.VITE_TRAKT_CLIENT_ID;
const TRAKT_BASE = 'https://api.trakt.tv';
const TRAKT_HEADERS = {
  'Content-Type': 'application/json',
  'trakt-api-version': '2',
  'trakt-api-key': TRAKT_CLIENT_ID || '',
};
```

### Functions

```javascript
// Convert TMDB id → Trakt slug via /search endpoint
traktFindByTmdbId(tmdbId, type, signal) → { movie: {ids}, show: {ids} } | null

// Get related titles from Trakt for a given TMDB id + type
traktRelated(tmdbId, type, signal) → [{ tmdb_id, title, year, type }]

// Batch: get Trakt related for multiple seeds at once
traktRelatedBatch(seeds, signal) → flat array of unique TMDB ids
```

### Session Cache

```javascript
const _traktCache = new Map();
const TRAKT_CACHE_MAX = 100;
// Evicts oldest entry when full
```

---

## 9. Recommendation Algorithm

**File:** `src/hooks/useRecommendations.jsx` (~712 lines)

The algorithm runs entirely client-side and consists of three phases: **Profile Building**, **Candidate Fetching**, and **Scoring**.

### Phase 1: Build Taste Profile

```
buildProfile(watched, watchlist, ratings, likedActors, dislikedIds, tvProgress)
  → {
      seedMovies, likedActorIds,
      genreBoost, directorBoost, writerBoost, keywordBoost,
      topDirectors, topKeywords,
      runtimePref, budgetPref, franchiseIds,
      avoidIds, minYear, preferRecent, medianYear,
      animeInterest, eastAsianInterest,
      explorationGenres
    }
```

#### Signal Weights

| Signal | Seed Weight | Genre Boost | Notes |
|--------|-------------|-------------|-------|
| Rating 9-10 | **4.0** | +2.5 × decay | Strongest positive signal |
| Rating 7-8 | **2.5** | +1.2 × decay | Good positive signal |
| Rating 5-6 | **0.4** | none | Neutral — low seed weight |
| Rating 1-4 | skip | -1.2 to -2.5 | Genre penalty only |
| Unrated watched | **0.8** | +0.3 | Mild positive |
| Watchlist | **1.2** | +0.6 | Medium positive |
| Disliked | skip | -1.5 per genre | Strong genre suppression |

**Temporal decay:** `e^(-λ·days)` where λ = 0.00075 (half-life ≈ 924 days). Recent ratings have more influence.

**TV progress multiplier:** Finished shows get 1.4× weight.

**Enrichment signals** (from detail cache):
- Director boost: +weight per director
- Writer boost: +weight × 0.4 per writer
- Keyword boost: +weight × 0.8 per keyword
- Runtime preference: short (<90min), medium, long (>130min)
- Budget tier: indie (<$5M), mid, blockbuster (>$40M)
- Franchise boost: +2.5 weight for high-rated franchise entries

#### Seed Selection

Top 15 positive seeds by weight, deduplicated. On each page load, seeds rotate using `(page - 1) % seeds.length` so different pages show different recommendations.

### Phase 2: Fetch Candidates

Six parallel strategies per page:

```
Strategy 1: TMDB /recommendations
  → Top 4 seeds rotated per page
  → page cycles through 1-3 for variety
  → source_weight = seed.weight

Strategy 1b: Trakt community picks (pages 1-3 only)
  → traktRelatedBatch() for top 2 seeds
  → Fetches TMDB details for each Trakt result
  → source_weight = 1.8

Strategy 2: Actor + Director credits
  → GET /person/{id}/combined_credits
  → Rotates through liked actors + top directors
  → Filters: poster exists, vote_average ≥ 5.5, vote_count ≥ 30
  → source_weight = 3.5 (actor) / 3.0 (director)

Strategy 3: Genre-based discover
  → Top 2-3 boosted genres via /discover/movie + /discover/tv
  → Alternates sort: popularity vs vote_average
  → vote_count.gte=400 (movies) / 100 (TV)
  → source_weight = 1.2

Strategy 4: Exploration via secondary genres
  → Cycles through 2nd-4th ranked genres
  → vote_count.gte=500
  → source_weight = 0.7

Strategy 5: Keyword-based discover
  → Top keywords from enrichment cache
  → Alternates sort
  → vote_count.gte=100
  → source_weight = 1.4

Strategy 6: Franchise / collection (pages 1-5 only)
  → /collection/{id} for high-rated franchises
  → All parts included
  → source_weight = 2.5
```

### Phase 3: Scoring

```javascript
const totalScore = (
  tmdbScore * srcWeight +        // TMDB rating normalized to 0-1
  normGenre +                     // Normalized genre alignment (0-0.4)
  voteSignal +                    // log10(vote_count) / 15
  recencyBoost +                  // (releaseYear - 2000) / 400
  directorScore +                 // Director match (0-0.5)
  writerScore +                   // Writer match (0-0.15)
  keywordScore +                  // Keyword match (0-0.4)
  runtimeFit +                    // Runtime preference match
  budgetFit +                     // Budget tier match
  franchiseBonus                  // 0.6 for franchise entries
) * strategyMult;                 // 0.85-1.6 depending on source
```

### Diversity Buffer

Prevents same-genre and same-type runs in the feed:
- Max 3 consecutive same-genre items
- Max 4 consecutive same-type (movie/TV) items
- 12% of slots reserved for exploration (secondary genres)

### Origin Filter

- Anime (Japan) shown only if user has ≥ 2 Japanese titles in history
- East Asian content (KR, CN, TW, HK, TH) shown only if user has interest, OR if the title is highly acclaimed (rating ≥ 8.2, votes ≥ 2000)

### Refresh Behaviour

Each press of the refresh button increments `pageOffset` by a random 1-4:
```javascript
const newOffset = (current + Math.floor(Math.random() * 4) + 1) % 10;
```

### Infinite Scroll

Uses IntersectionObserver on a sentinel element:
```javascript
const obs = new IntersectionObserver(
  entries => { if (entries[0].isIntersecting && !loadingRef.current) doLoad(false); },
  { root: scrollRoot, rootMargin: '600px' }
);
```

---

## 10. Search System

**File:** `src/pages/Search.jsx` (~813 lines)

### Search Pipeline

```
User types query
  → 300ms debounce
  → enhancedSearch(query, langCode, filters, page, signal)
    1. /search/multi (primary — covers movies + TV + persons)
    2. /search/movie + /search/tv (supplementary, page 1 only)
    3. English fallback: /search/multi?language=en-US (if non-English UI)
    4. Year detection: "Dune 2023" → year=2023, query="Dune"
    5. Deduplicate by (id, media_type)
    6. Apply client-side filters (genre, year range, type)
    7. Sort by selected sort option or relevance score
  → setResults(arr)
```

### Title Match Scoring

```
Tier 6: Exact match on any title variant     → 50,000 base
Tier 5: Prefix match (query + space)         → 20,000 base
Tier 4: Starts with query                    →  8,000 base
Tier 3: Word-boundary match                  →  3,000 base
Tier 2: Substring match (≥4 chars)           →  1,000 base
Tier 1: Short substring match                →    200 base

Boosted by: popularity (log scale), vote count, rating, recency
```

### Filter System

| Filter | Options | API param |
|--------|---------|-----------|
| Type | All / Movies / Series | determines endpoint |
| Sort | Popularity / Rating / Newest / Oldest | `sort_by` |
| Year | 5 preset ranges (2020-now, 2010s, 2000s, 1990s, pre-1990) | `primary_release_date.gte/lte` |
| Genre | 14 genres (multi-select) | `with_genres` |

### Actor Search

Separate tab searches `/search/person`, filters to acting department, sorts by watched-film overlap count.

---

## 11. Cloud Sync (Supabase)

**Files:** `src/store.jsx`, `src/supabase.jsx`

### Supabase Client

```javascript
// src/supabase.jsx
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);
```

### Data Tables

**user_data** — per-user state (see Database Schema section)
**public_lists** — shared lists (see Public Lists section)

### Row Level Security

```sql
-- Users can only read/write their own row
create policy "Users manage own data"
  on public.user_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Sync Strategy

- **Load:** On login, `loadFromCloud()` fetches once and merges into localStorage
- **Save:** `syncToCloud()` debounced 1500ms — batches rapid changes
- **Conflict resolution:** Cloud always wins on login; last-write-wins for concurrent edits
- **Guard:** Empty local state never overwrites existing cloud data

---

## 12. Localization System

**Files:** `src/theme.jsx`, `src/useLocalizedMovies.jsx`, `src/i18n/`

### Supported Languages

| Code | Language | Country Code | TMDB Code |
|------|----------|-------------|-----------|
| en | English | gb | en-US |
| ru | Русский | ru | ru-RU |
| de | Deutsch | de | de-DE |
| es | Español | es | es-ES |
| fr | Français | fr | fr-FR |
| it | Italiano | it | it-IT |
| pt | Português | pt | pt-BR |
| tr | Türkçe | tr | tr-TR |
| zh | 中文 | cn | zh-CN |

### i18n Setup

```javascript
// src/i18n/index.jsx
i18n.use(initReactI18next).init({
  resources: { ru, en, es, fr, de, pt, it, tr, zh },
  lng: localStorage.getItem('lang') || 'en',
  fallbackLng: 'en',
});
```

### ThemeContext

```javascript
const { theme, setTheme, lang, setLang } = useTheme();
// theme: 'dark' | 'light'
// lang: 'en' | 'ru' | 'de' | 'es' | 'fr' | 'it' | 'pt' | 'tr' | 'zh'
```

### TMDB Localization

The `language` query param is set based on `lang`:
```javascript
const TMDB_LANG_MAP = {
  ru: 'ru-RU', en: 'en-US', es: 'es-ES', fr: 'fr-FR',
  de: 'de-DE', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', zh: 'zh-CN',
};
```

### Saved List Localization

`useLocalizedMovies(items, lang)` re-fetches titles/posters for saved items in the current language:

```javascript
// Two-level cache:
// 1. In-memory Map (instantaneous)
// 2. localStorage key 'tmdb_locale_cache' (max 300 entries, persists across sessions)

// Batch size: 10 concurrent requests
// Debounced localStorage write: 2000ms
// Stable entriesKey prevents infinite loops on re-render
```

---

## 13. TV Series Tracker

**Files:** `src/store.jsx`, `src/components/MovieModal.jsx`, `src/components/MovieCard.jsx`

### Data Shape

```typescript
interface TvProgress {
  season: number;
  episode: number;
  totalSeasons: number;
  episodesInSeason: number | null;  // fetched from TMDB season endpoint
}
// Stored as: tvProgress[movieId] = TvProgress
```

### UI Flow

1. User adds a series to Watchlist
2. **In modal:** "Track progress" button appears (only for `media_type === 'tv'` AND `inList === true`)
3. Tapping opens inline editor with season/episode steppers
4. Episode count fetched from TMDB `/tv/{id}/season/{n}` (cached per session)
5. On save: `setTvProgressEntry(id, { season, episode, totalSeasons, episodesInSeason })`
6. **On card:** `S2·E7` badge + progress bar at poster bottom
7. **In Profile queue:** show appears in "Currently Watching" section (separate from regular queue)
8. Finished detection: `season >= totalSeasons && episode >= episodesInSeason`

---

## 14. Custom Lists

**Files:** `src/pages/Profile.jsx`, `src/store.jsx`

Custom Lists allow users to create curated collections beyond the built-in Watchlist/Watched.

### Data Shape

```typescript
interface CustomList {
  id: string;                    // "list_1712345678901"
  name: string;
  description: string;
  image: string | null;          // Cloudinary URL (user upload)
  items: NormalizedMovie[];
  createdAt: number;             // Date.now()
  showProgress: boolean;         // show watched/total progress bar
  deadline: string | null;       // ISO date string "2025-12-31"
  isPublic: boolean;             // visible in public_lists table
  isSiteList: boolean;           // admin-curated list
  separateTracking: boolean;     // per-list watched/watchlist
  listWatched: NormalizedMovie[];// per-list watched (when separateTracking)
  listWatchlist: NormalizedMovie[];// per-list queue
  isOwned: boolean;              // false for copied lists
  authorName: string | null;
  sourceListId: string | null;   // original list ID if copied
  sourceAuthorName: string | null;
}
```

### Store Operations

```javascript
createCustomList(name, description, image, opts)  // → returns id
deleteCustomList(listId)                           // removes from state + public_lists
renameCustomList(listId, name)                     // rename (ownership check)
promoteCustomListOwnership(listId)                 // take ownership of copied list
addToCustomList(listId, movie)                     // adds if not duplicate
removeFromCustomList(listId, movieId)              // removes by movie id
isInCustomList(listId, movieId)                    // boolean check
updateListMeta(listId, meta)                       // patches name/desc/image/opts

// Per-list tracking (separateTracking mode)
addToListWatched(listId, movie)
removeFromListWatched(listId, movieId)
addToListWatchlist(listId, movie)
removeFromListWatchlist(listId, movieId)
isListWatched(listId, movieId)
isListInWatchlist(listId, movieId)
```

### Progress Calculation

Progress is computed at render time by cross-referencing list items against the `watched[]` slice (or `listWatched` when `separateTracking` is on):

```javascript
const watchedCount = list.separateTracking
  ? list.items.filter(m => isListWatched(listId, m.id)).length
  : list.items.filter(m => isWatched(m.id)).length;
const pct = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
```

### List Edit Page

`ListEditPage` handles both create and edit flows:
- **Create:** `listId = null` → `createCustomList()` on save
- **Edit:** `listId = existingId` → pre-fills state, calls `updateListMeta()` on save
- **Read-only:** copied lists show a "Copy list" button to take ownership

### List Detail Page

- Shows progress bar + deadline if configured
- Each poster has action buttons (Watched/Watchlist) — global or per-list depending on `separateTracking`
- Edit button navigates to `ListEditPage`
- Share button upserts to `public_lists` and copies share link
- Title picker modal for adding movies/TV shows

---

## 15. Public Lists & Sharing

**Files:** `src/pages/PublicListPage.jsx`, `src/pages/Profile.jsx`, `src/pages/Home.jsx`

### public_lists Table

```sql
create table if not exists public.public_lists (
  id            text primary key,       -- matches customLists key
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  description   text default '',
  image         text,                   -- Cloudinary URL
  items         jsonb not null default '[]'::jsonb,
  author_name   text,
  likes         integer default 0,
  is_public     boolean default true,
  is_site_list  boolean default false,
  updated_at    timestamptz default now()
);
```

### Visibility Rules

- **Site Lists** (`is_site_list = true`): always public, shown on Home page, author is "CiniMate"
- **User Public Lists** (`is_public = true`, `likes >= 100`): shown on Home page
- **Private Lists** (`is_public = false`): only accessible via direct link if the user knows the ID

### Sharing Flow

1. User clicks "Share" on a list detail page
2. Upserts list snapshot to `public_lists` table
3. Copies share URL to clipboard: `{origin}/list/{listId}`
4. Recipient opens `/list/:listId` — accessible without auth
5. If logged in, can add the list to their own custom lists (creates a copy)

---

## 16. Admin Panel

**File:** `src/admin.jsx`

Controlled by `VITE_ADMIN_ID` environment variable. If the logged-in user's Supabase UUID matches, `isAdmin = true`.

```javascript
const ADMIN_ID = import.meta.env.VITE_ADMIN_ID || null;
const isAdmin = !!(ADMIN_ID && userId === ADMIN_ID);
```

**Admin-only features:**
- Force snow effect regardless of month
- Override detected season (Auto / Halloween / New Year / Summer / Winter / Spring / Autumn)
- Publish "Site Lists" visible on Home page
- Access to Popular Lists tab on Home

Settings persist in `localStorage` under `cinimate_admin_overrides`.

---

## 17. PWA & iOS Support

**Files:** `public/index.html`, `public/manifest.json`, `src/liquid-glass.css`

### Apple Touch Icons

Six sizes generated from the original favicon:
```
apple-touch-icon.png        (180×180, default)
apple-touch-icon-180x180.png
apple-touch-icon-167x167.png (iPad Pro)
apple-touch-icon-152x152.png (iPad)
apple-touch-icon-120x120.png (iPhone)
apple-touch-icon-76x76.png   (iPad mini)
```

### Key PWA Meta Tags

```html
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="Cinimate"/>
<meta name="viewport" content="..., viewport-fit=cover"/>
```

### Liquid Glass (iOS 26)

`liquid-glass.css` applies Apple's iOS 26 Liquid Glass aesthetic using `@supports (-webkit-touch-callout: none)` — this CSS selector is **only recognised by iOS Safari**, making all styles inside invisible to Android and desktop.

```css
@supports (-webkit-touch-callout: none) {
  .bottom-nav__inner {
    background: rgba(255,255,255,0.08);
    backdrop-filter: blur(48px) saturate(2.2) brightness(1.15);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.55),   /* prismatic top edge */
      inset 0 -1px 0 rgba(255,255,255,0.12),  /* bottom edge */
      0 8px 40px rgba(0,0,0,0.28);            /* outer shadow */
  }
}
```

Applied to: bottom nav, modals, rating prompt, settings, roulette, hero labels.

---

## 18. Performance Optimizations

### React

| Optimization | Applied To | Effect |
|-------------|-----------|--------|
| `React.memo` | MovieCard, BottomNav, SideNav, MovieModal, RatingPrompt, ScrollRow, SectionRow, FeatureCard, StepCard | Skip re-render if props unchanged |
| `useCallback` | MovieCard handlers, Search filter callbacks, store mutations | Stable function references |
| `useMemo` | StoreContext value, localized lists, preview entries | Avoid object recreation |
| Memoized context | StoreContext | All consumers skip render if state unchanged |

### Network

| Optimization | Description |
|-------------|-------------|
| Parallel `getPages` | TMDB multi-page fetches run concurrently |
| Session cache | Home page data cached in sessionStorage (5min TTL) |
| Details cache | Movie/TV detail calls cached in-memory for session |
| Enrichment cache | Recommendation metadata extracted lazily from detail calls |
| Trakt cache | Trakt API responses cached (max 100 entries) |
| Debounced sync | Cloud writes batched with 1500ms debounce |
| Debounced localStorage | Localization cache writes batched with 2000ms debounce |
| Batch size 10 | useLocalizedMovies fetches 10 items concurrently |
| Search cache | Session-level search results cached (max 60 entries) |
| Poster size w342 | ~40% less bandwidth than w500 for card posters |

### Canvas

| Optimization | Description |
|-------------|-------------|
| Particles: 28 | Fewer particles, less GPU work |
| 30fps cap | Both particle and snow effects capped via `ts - last < 33` |
| Snow: 30 flakes | Half the draw calls |
| `visibilitychange` pause | Canvas loops stop when tab is hidden |

### CSS

```css
.movie-card { contain: layout style; }       /* Isolate card repaints */
.will-change { will-change: transform; }      /* Pre-promote to GPU layer */
content-visibility: auto;                     /* Skip off-screen renders */
```

### Infinite Scroll

IntersectionObserver on a sentinel element with `rootMargin: '600px'` — preloads before the user reaches the bottom. Uses `loadingRef` to prevent concurrent loads.

---

## 19. CSS Architecture & Theming

### CSS Variables

```css
:root {
  /* Spacing */
  --nav-h: 72px;      /* Bottom nav height */
  --sidebar-w: 220px; /* Desktop sidebar width */

  /* Dark theme (default) */
  --bg:       #080810;
  --bg2:      #0f0f1a;
  --surface:  #141424;
  --surface2: #1a1a2e;
  --border:   rgba(255,255,255,0.08);
  --text:     #f0eff8;
  --text2:    #a0a0b8;
  --text3:    #606078;
  --accent:   #e8c547;   /* Gold */
  --accent2:  #ff6b35;   /* Orange */
}

[data-theme="light"] {
  --bg:       #f0eff8;
  --bg2:      #ffffff;
  /* ... */
}
```

### Layout

Desktop (≥1024px): sidebar fixed, content scrolls independently:
```css
.app-shell  { display: flex; height: 100dvh; overflow: hidden; }
.app-content { flex: 1; height: 100dvh; overflow-y: auto; }
.side-nav   { position: sticky; top: 0; height: 100dvh; }
```

Mobile: full-width single column, bottom nav overlay.

---

## 20. Icon System

**Package:** `solar-icon-set` v2.0.1
**Style:** Linear (outline) throughout

Solar exports 1200+ React components as ESM, enabling tree shaking — only imported icons are bundled.

### Key Icon Mappings

| UI Element | Solar Icon |
|-----------|-----------|
| Search | `MagniferLinear` |
| Save to watchlist | `BookmarkLinear` / `BookmarkOpenedLinear` |
| Mark watched | `EyeLinear` / `EyeClosedLinear` |
| Rating | `StarLinear` |
| Home tab | `Home2Linear` |
| For You tab | `MagicStickLinear` |
| Profile tab | `UserLinear` |
| Settings | `SettingsMinimalisticLinear` |
| TV shows | `TVLinear` |
| Films | `VideoLibraryLinear` |
| Pin to top | `PinLinear` |
| Share | `ShareLinear` |
| Lists | `ListLinear` |
| Delete | `TrashBinMinimalistic2Linear` |

---

## 21. Seasonal & Effects System

**File:** `src/hooks/useSeason.jsx`, `src/components/Effects.jsx`

### Season Detection

```javascript
getCurrentSeason(override = null) {
  if (override) return override; // admin override
  const month = new Date().getMonth() + 1;
  const day   = new Date().getDate();

  if (month === 10 && day >= 20) return 'halloween';
  if (month === 11 && day >= 25) return 'newyear';
  if (month === 12)               return 'newyear';
  if (month === 1  && day <= 14)  return 'newyear';
  if (month >= 6 && month <= 8)   return 'summer';
  if (month >= 12 || month <= 2)  return 'winter';
  if (month >= 3  && month <= 5)  return 'spring';
  return 'autumn';
}
```

### Season Config

```javascript
SEASON_CONFIG = {
  halloween: { genres: [27, 53, 9648], sort: 'popularity.desc' },  // Horror, Thriller, Mystery
  newyear:   { genres: [35, 10751, 18], sort: 'vote_average.desc' },// Comedy, Family, Drama
  summer:    { genres: [28, 12, 35], sort: 'popularity.desc' },     // Action, Adventure, Comedy
  winter:    { genres: [18, 10749, 14], sort: 'vote_average.desc' },// Drama, Romance, Fantasy
  spring:    { genres: [35, 10749, 12], sort: 'popularity.desc' },  // Comedy, Romance, Adventure
  autumn:    { genres: [18, 9648, 53], sort: 'vote_average.desc' }, // Drama, Mystery, Thriller
}
```

### Effects

| Effect | Trigger | Implementation |
|--------|---------|---------------|
| Snow | December-January OR admin override | Canvas, 30 flakes, 25fps |
| Confetti | Mark movie as watched | Canvas, star/checkmark shapes |
| Particles | Always (background) | Canvas, 28 gold particles, 30fps with connecting lines |

---

## 22. About Page / Landing

**Files:** `src/pages/About.jsx`, `src/pages/About.css`

The About page serves dual purpose:
- **Desktop unauthenticated:** Landing page with auth buttons overlay (replaces AuthScreen)
- **Authenticated/ mobile:** Standard About page with app info

### Interactive Elements

- **ParticleField:** Canvas-based particle network with connecting lines
- **FloatingPosters:** 27 real TMDB poster images with mouse parallax
- **Marquee:** Two-row auto-scrolling text bands
- **Counter:** Animated number counters with easing
- **FeatureCards:** 9 feature cards with reveal-on-scroll
- **MoodSection:** 6 mood categories with live TMDB poster fetches
- **WatchlistSection:** Mock watchlist UI demonstration
- **AlgoSection:** Algorithm signal strength visualization
- **CtaSection:** Call-to-action with orb effects

### Landing Auth Flow

Desktop users see the About page with Login/Register buttons in the top-right. Clicking either shows the AuthScreen in the chosen mode. The `AboutAuthOverlay` component renders fixed-position auth buttons.

---

## 23. Build & Deployment

### Build

```bash
npm run build
# → Creates /build with optimized assets via Vite
```

### Development

```bash
npm run dev    # Vite dev server on port 3000
npm run test   # Vitest (configured, no tests written)
```

### Deployment (Vercel)

1. Push to GitHub `master` branch
2. Vercel webhook triggers
3. Vercel runs `npm run build`
4. Outputs deployed to CDN

**Environment variables** must be set in Vercel dashboard (Settings → Environment Variables).

---

## 24. Environment Variables

```bash
# .env (local development only — NOT committed)

VITE_TMDB_TOKEN=eyJ...              # TMDB API v4 Bearer token
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_KEY=sb_publishable_...
VITE_TRAKT_CLIENT_ID=...            # Optional: Trakt API Client ID
VITE_ADMIN_ID=47f2c48c-...          # Optional: Supabase user UUID for admin
VITE_CLOUDINARY_CLOUD_NAME=...      # Optional: Cloudinary cloud for avatars
VITE_CLOUDINARY_UPLOAD_PRESET=...   # Optional: Cloudinary upload preset
```

All variables are prefixed with `VITE_` for Vite's `import.meta.env` access.

---

## 25. Database Schema

### user_data

```sql
create table if not exists public.user_data (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  watched      jsonb not null default '[]'::jsonb,
  watchlist    jsonb not null default '[]'::jsonb,
  ratings      jsonb not null default '{}'::jsonb,
  profile      jsonb not null default '{}'::jsonb,
  liked_actors jsonb not null default '{}'::jsonb,
  disliked_ids jsonb not null default '[]'::jsonb,
  tv_progress  jsonb not null default '{}'::jsonb,
  custom_lists jsonb not null default '{}'::jsonb,
  pinned_ids   jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users manage own data"
  on public.user_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index on public.user_data(user_id);
```

### public_lists

```sql
create table if not exists public.public_lists (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  description   text default '',
  image         text,
  items         jsonb not null default '[]'::jsonb,
  author_name   text,
  likes         integer default 0,
  is_public     boolean default true,
  is_site_list  boolean default false,
  updated_at    timestamptz default now()
);

alter table public.public_lists enable row level security;

create policy "Anyone can read public lists"
  on public.public_lists for select
  using (is_public = true);

create policy "Authors can manage their lists"
  on public.public_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Data Sizes (Estimated)

| Table | Column | Typical Size | Max Expected |
|-------|--------|-------------|-------------|
| user_data | `watched` | 2-20kb | ~100kb (1000+ films) |
| user_data | `watchlist` | 1-5kb | ~20kb |
| user_data | `ratings` | 0.5-5kb | ~20kb |
| user_data | `liked_actors` | 0.2-2kb | ~5kb |
| user_data | `tv_progress` | 0.1-2kb | ~10kb |
| user_data | `custom_lists` | 1-20kb | ~200kb |
| public_lists | `items` | 0.5-10kb | ~50kb |

Supabase free tier allows 500MB total — with typical usage this supports **~20,000 users** before needing an upgrade.

---

*Last updated: June 2026*
*Cinimate v0.9.5 Beta*
