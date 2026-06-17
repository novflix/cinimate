![Cinimate Banner](https://i.imgur.com/FFhyZ66.png)

# CiniMate

> Personal movie & TV tracker with smart recommendations. Track what you've watched, rate it, and discover what to watch next.

---

## Screenshots

| Home | Movie Details | Recommendations |
|------|--------------|-----------------|
| ![Home](https://i.imgur.com/oCevBol.jpeg) | ![Modal](https://i.imgur.com/woZYbKq.jpeg) | ![Recs](https://i.imgur.com/xZYO5Om.jpeg) |

---

## Features

### Home
- **Auto-playing hero slider** — top trending titles rotate every 5.5s with smooth fade transitions
- **7 curated tabs** — Popular, Now Playing, Coming Soon, Trending, New Releases, Lists, Seasonal
- **3-category blocks** — each tab shows Movies, Series, and Animation separately
- **Countdown badges** — Coming Soon cards show live countdown: "in 12 days", "in 3 hours"
- **Seasonal picks** — feed surfaces Halloween horror, Christmas family films, summer blockbusters based on date
- **Public Lists** — curated site lists and community lists with poster grid previews

### Search
- Multi-source search: `/search/multi` + `/search/movie` + `/search/tv` merged and deduplicated
- Year-aware: "Dune 2023" parses year and queries accordingly
- English fallback for non-English UI languages
- Advanced filters: genre (14 options), year range (5 presets), type (All/Movies/Series), sort (4 options)
- Separate **Actors tab** with watched-film overlap count
- Title match scoring: exact > prefix > word-boundary > substring, boosted by popularity and rating
- Infinite scroll with IntersectionObserver

### Recommendations
- **6-strategy algorithm** running entirely client-side:
  1. TMDB `/recommendations` from rotating seed movies
  2. Trakt community picks (related titles from Trakt API)
  3. Liked actor + director filmographies via `/person/{id}/combined_credits`
  4. Genre-based `/discover` (movie + TV)
  5. Keyword-based `/discover`
  6. Franchise/collection expansion
- **Taste profile** built from ratings, watchlist, liked actors, disliked IDs, TV progress
- **Enrichment cache** — director, writer, keywords, runtime, budget extracted lazily from detail calls
- **Temporal decay** — recent ratings weighted more (exponential, half-life ~924 days)
- **Diversity buffer** — limits same-genre runs (max 3) and same-type runs (max 4), 12% exploration rate
- **Origin filter** — anime/east-Asian content shown only if user has demonstrated interest
- Infinite scroll with IntersectionObserver

### Profile
- Custom avatar (upload via Cloudinary, auto-resized to 256x256 webp) and bio
- Stats: watched count, queued, movies vs series breakdown
- Poster grid for Watchlist and Watched lists with rating badges
- **Watchlist pinning** — pin items to top of queue
- **Watchlist Roulette** — spin a wheel to pick what to watch tonight
- **TV Progress** — per-show season/episode tracker with progress bar
- Edit ratings directly from the film detail modal

### Custom Lists
- Create unlimited custom lists with name, description, cover image, and settings
- **Separate tracking** — optional per-list watched/watchlist independent from global
- **Progress bars** — show watched/total percentage per list
- **Deadlines** — set a target completion date
- **Public/Private** — publish lists to share via link, or keep private
- **Site Lists** — admin can publish curated lists visible on Home
- **Title picker** — search and add movies/TV shows from within the list editor
- Copy lists from other users

### Rating System
- Rate any watched film 1-10 directly after marking it watched
- Color-coded: red (1-4) → orange (5-6) → green (7-8) → blue/purple (9-10)
- Gold sparks burst on a perfect 10
- Ratings feed directly into the recommendation algorithm

### Movie Details Modal
- Full backdrop with dominant color accent extracted from poster
- Cast & crew scrollable blocks with navigation to actor/person pages
- **Where to Watch** — streaming providers (Netflix, Disney+, Okko, Kinopoisk, etc.) with direct search links
- **More Details** — tagline, status, budget, revenue, production companies, countries, languages, trailer link
- **Studio/Network navigation** — click studios to browse their filmography
- **Similar button** — navigate to full similar-title recommendations

### Localization
- **9 languages**: English, Russian, German, Spanish, French, Italian, Portuguese, Turkish, Chinese
- All TMDB data re-fetched in the selected language
- Language-neutral storage: saved lists always display in the current UI language
- Flag icons via `flag-icons` package

### Auth & Cloud Sync
- Email/password sign-up and sign-in via Supabase Auth
- All data synced to the cloud with 1500ms debounce
- **Data loss protection** — empty local state never overwrites existing cloud data
- Guest mode with clear warning about device-local data
- **Account deletion** — full data cleanup from all tables + auth user
- **Public list sharing** — lists published to `public_lists` table for sharing

### Visual Effects
- Genre-colored accent line at bottom of every card
- Flash animation on save — green for Watched, yellow for Watchlist
- Dominant color extracted from poster tints the modal backdrop
- Canvas confetti of stars and checkmarks on mark-watched
- Snow effect in December-January (admin-toggleable year-round)
- Background particle field with connecting lines
- Dark and light themes via CSS variables

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.x |
| Build Tool | Vite | 6.x |
| Routing | react-router-dom | 7.x |
| Auth + Database | Supabase | JS v2 |
| Movie Data | TMDB API | v3 |
| Community Data | Trakt API | v2 |
| Hosting | Vercel | — |
| Icons | Solar Icon Set | 2.0.1 |
| I18n | i18next | 23.x |
| Flags | flag-icons | 7.x |
| Fonts | Google Fonts | Bebas Neue + DM Sans |
| CSS | Vanilla CSS + CSS Variables | — |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A free [TMDB API key](https://www.themoviedb.org/settings/api) (Bearer token)
- A free [Supabase](https://supabase.com) project
- (Optional) A free [Trakt API](https://trakt.tv/oauth/applications/new) Client ID for community recommendations

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/cinimate.git
cd cinimate
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_TMDB_TOKEN=your_tmdb_bearer_token
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_supabase_anon_key
VITE_TRAKT_CLIENT_ID=your_trakt_client_id          # optional
VITE_ADMIN_ID=your_supabase_user_uuid              # optional, for admin features
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name          # for avatar/list image uploads
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

### Database Setup

Run this in your Supabase SQL Editor:

```sql
-- User data table
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

-- Public lists table (for sharing)
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

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

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
│   ├── auth.jsx                # AuthContext: Supabase auth + account deletion
│   ├── store.jsx               # StoreContext: state + cloud sync + custom lists
│   ├── theme.jsx               # ThemeContext: dark/light, language
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
│   │   ├── MovieCard.jsx/css   # Poster card with actions, rating, TV progress
│   │   ├── MovieModal.jsx/css  # Film detail: cast, crew, streaming, ratings
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
│   │   ├── useRecommendations.jsx # 6-strategy recommendation algorithm
│   │   ├── useMovieModal.jsx      # Modal state synced with URL params
│   │   ├── useDominantColor.jsx   # Extracts accent color from poster
│   │   └── useSeason.jsx          # Season detection + themed config
│   │
│   └── pages/
│       ├── Home.jsx/css        # Hero, 7 tabs, seasonal, public lists
│       ├── Search.jsx/css      # Search + filters + actor search
│       ├── Recs.jsx/css        # Infinite recommendation feed
│       ├── Profile.jsx/css     # Profile, lists, roulette, list editor
│       ├── About.jsx/css       # Landing page (desktop auth gate)
│       ├── AuthScreen.jsx/css  # Sign in / sign up / guest flow
│       ├── ActorPage.jsx/css   # Actor filmography
│       ├── PersonPage.jsx/css  # Crew person page
│       ├── SimilarPage.jsx/css # Similar titles
│       ├── CollectionPage.jsx  # Film collections
│       ├── PublicListPage.jsx/css # Public list view
│       ├── TermsOfService.jsx  # Legal: ToS
│       ├── PrivacyPolicy.jsx   # Legal: Privacy
│       ├── CommunityGuidelines.jsx # Legal: Community
│       └── Notfound.jsx/css    # 404 page
│
├── .env                        # Local env variables (not committed)
├── package.json
├── vite.config.js              # Vite config
├── vercel.json                 # SPA rewrites + security headers
├── README.md
└── TECHNICAL.md
```

---

## Roadmap

- [ ] Google OAuth sign-in
- [ ] Seasonal recommendations tab (fully implemented data layer)
- [ ] Offline mode with cached posters
- [ ] Unit tests (vitest configured, no tests written yet)

---

## Credits

- Movie data provided by [The Movie Database (TMDB)](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.
- Community recommendations powered by [Trakt](https://trakt.tv)
- Authentication and database by [Supabase](https://supabase.com)
- Icons by [Solar Icon Set](https://solar-icon-set.com)
- Internationalization with [i18next](https://www.i18next.com)

---

## License

MIT — feel free to fork and build on it.
