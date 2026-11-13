# Cinimate

Movie and series discovery app built with React, Vite and TypeScript.

## Getting started

```bash
npm install
cp .env.example .env.local
# add your TMDB read access token to .env.local
npm run dev
```

### Environment

The app loads popular movies and series from [TMDB](https://www.themoviedb.org/).
Create a read access token in **Settings → API** and put it into `.env.local`:

```env
VITE_TMDB_TOKEN=your_tmdb_read_access_token
```

`.env.local` is git-ignored. The token is bundled into the client, so use a
read-only token and rotate it if it leaks.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint

## Structure

```
src/
  api/          TMDB client and formatters
  assets/       logo and self-hosted Switzer fonts
  components/   Navbar, MobileNav, HeroBanner, CategoryTabs
  hooks/        media query and data hooks
  layouts/      app shell with LiquidGlass root
  pages/        route-level pages
```
