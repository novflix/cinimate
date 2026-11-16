# Cinimate

Movie and series discovery app built with React, Vite and TypeScript.

## Getting started

```bash
npm install
cp .env.example .env.local
# add your TMDB read access token and Firebase web config to .env.local
npm run dev
```

### Environment

The app loads popular movies and series from [TMDB](https://www.themoviedb.org/) and signs users in
with [Firebase Authentication](https://firebase.google.com/docs/auth).

Create a TMDB read access token in **Settings → API** and copy the Firebase web app config from
**Project settings → Your apps → Web app → SDK setup and configuration**. Put both into
`.env.local`:

```env
VITE_TMDB_TOKEN=your_tmdb_read_access_token
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id
```

`.env.local` is git-ignored. Both the token and the Firebase config are bundled into the client, so
use a read-only TMDB token, and protect the Firebase project with security rules and the
authorized-domains list instead of relying on the config staying private.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint

## Loading and prefetching

Pages never fetch directly. Each API payload is a small in-memory resource
(`src/api/resource.ts`) that de-duplicates requests, keeps the last result for a few
minutes, and refreshes stale data in the background while it stays on screen.

That gives the UI two useful properties:

- **No skeleton flash.** Cached or preloaded data is read through `useResource`, so the
  first render after a tab switch or back-navigation already has content.
- **Silent warming.** Hovering a tab or card, and idling on the home page, start low-priority
  requests ahead of time (`src/api/preload.ts`). Speculative failures stay invisible; only
  data the user is actually waiting for can show an error.

Skeletons mirror the final layout, images fade in over a shimmer (`SmartImage`), and every
failed feed has a retry button. Background prefetching is skipped when the browser is
offline, in data-saver mode, or on a `2g` connection.

## Recommendations (For You)

`/recommendations` is an endless, personalised feed. Everything runs in the browser on top of
TMDB and the user's saved library; there is no server.

- **Signals** (`src/recommendations/signals.ts`): a rating (1–10) maps to −1…+1, "watched" without
  a rating is +0.3, the watchlist +0.5 and "Not interested" −0.7. Old signals fade (half-life of
  about six months).
- **Taste profile** (`profile.ts`, `features.ts`): genres, keywords, directors/cast, language,
  decade and kind, with shrinkage so one title cannot define a taste and damping for features
  that are in almost everything. Actors are tracked separately from directors so recurring
  faces in the saved and high-rated titles can drive their own recommendations. Seeds for the
  "also liked" queries are chosen for spread as well as weight, so one franchise cannot fill the
  whole plan, and the liked release years are tracked so freshness follows the user's era
  instead of forcing old or new titles. Title features are cached in `localStorage` for 14 days.
- **Candidates** (`candidates.ts`): TMDB "also liked" lists of the favourites, `/discover` by the
  best genres, keywords and people, one credits query per recurring actor, plus exploration
  (trending, neighbouring genres). High-priority sources run first, and the engine rotates
  through the plan so no long query starves the others. Users with fewer than 3 positive signals
  get a general quality mix instead.
- **Ranking** (`scoring.ts`, `engine.ts`): taste fit, seed support, Bayesian rating, popularity
  and era-aware freshness; titles that resemble hidden or low-rated ones are pushed down, and
  titles already shown are lowered. Each page is picked with MMR using genres, year, kind,
  language, rating and popularity for variety, and every 7th slot is an exploration pick.
  Watched, saved, rated and hidden titles never appear.
- **Tuning**: every number is in `src/recommendations/config.ts`.

Storage: "Not interested" is saved in the same `users/{uid}` document as `x` (`{ m603: <seconds> }`,
capped at 1500 titles). Cached features and impressions stay on the device. No security-rule
change is needed as long as the owner may read and write their own `users/{uid}` document.

## Structure

```
src/
  api/          TMDB client, filters, formatters, resource cache and preloaders
  assets/       logo and self-hosted Switzer fonts
  components/   Navbar, MobileNav, HeroBanner, CategoryTabs
  hooks/        media query and data hooks
  layouts/      app shell with LiquidGlass root
  pages/        route-level pages
  recommendations/  taste profile, candidate plan, scoring and the feed engine
```
