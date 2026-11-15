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

## Structure

```
src/
  api/          TMDB client, filters, formatters, resource cache and preloaders
  assets/       logo and self-hosted Switzer fonts
  components/   Navbar, MobileNav, HeroBanner, CategoryTabs
  hooks/        media query and data hooks
  layouts/      app shell with LiquidGlass root
  pages/        route-level pages
```
