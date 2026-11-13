# liquid-glass

Vendored copy of [gentpan/liquidglass](https://github.com/gentpan/liquidglass) v1.0.0.

- `liquid-glass.js` — the refraction engine (`createGlass`, `createSpring`, `engine`).
  Source: <https://liquidglass.dev/lib/liquid-glass.js>
- `components.js` — the web components built on top of it (`<lg-navbar>`, …).
  Source: <https://liquidglass.dev/lib/components.js>
- `liquid-glass.d.ts` / `components.d.ts` — the typings the app imports.

## Why vendored

The project is distributed as static ES modules with no npm package, so keeping the files local
avoids a runtime dependency on a third-party CDN and makes the versions explicit.

## What the app uses

- `<lg-navbar>` for the mobile tab bar: its Surface refracts the page behind the capsule and its
  sliding lens refracts the icon copies (content mode, works in Chromium, Safari and Firefox).
- `createGlass()` directly for the search circle's backdrop lens.

Theming is done from `src/components/MobileNav/MobileNav.css` through the `--lg-*` custom
properties; the vendored files are otherwise untouched.

## License

MIT (see the upstream repository).
