# batchison.dev

Personal site. Plain HTML, CSS, and vanilla JS - no frameworks, no
dependencies, no build step. Hosted on Cloudflare Pages; every push to
`main` deploys.

## Layout

```
index.html             The whole site
_headers               Cloudflare Pages cache + security headers
assets/css/style.css   Theme tokens, light/dark, responsive layout
assets/js/main.js      ES module entry point; imports the rest
assets/js/motion.js    Shared prefers-reduced-motion check
assets/js/theme.js     Theme toggle + localStorage persistence
assets/js/nav.js       Hamburger menu, anchor scrolling
assets/js/effects.js   Pointer effects: card spotlight, word magnetism,
                       chip gradient field (one shared rAF loop)
assets/js/projects.js  Project pagination, FLIP shuffle, expand/collapse
assets/js/reveal.js    Scroll-reveal via IntersectionObserver
assets/fonts/          Self-hosted variable WOFF2 (Inter, JetBrains Mono)
```

## Run locally

```sh
npx live-server        # auto-reloads on save
# or, zero-install:
python3 -m http.server 8000
```

That's it - static files, any server works.

## How it's served

- Cloudflare Pages, framework preset "None", output directory `/`.
- DNS on Cloudflare, domain via Porkbun, TLS automatic at the edge.
- `_headers` sets `immutable` year-long caching on fonts, css, and js -
  all three are query-string versioned, so a `?v=` bump is what
  invalidates, not expiry. Unversioned images get 24h.
- Security headers site-wide: CSP (`default-src 'none'` baseline, inline
  boot script pinned by hash), HSTS, `nosniff`, `Permissions-Policy`,
  `Referrer-Policy`.
- Dashboard-side settings not expressible in `_headers`: Always Use
  HTTPS, Minimum TLS 1.2, Bot Fight Mode.

## Before you push

Two things bite silently if skipped:

1. **Changed `style.css` or any JS?** Bump its `?v=N` in `index.html`.
   Those files are cached `immutable` for a year - without a bump,
   returning visitors keep the old copy indefinitely.
2. **Changed the inline `<script>` in `<head>`?** Regen the CSP hash in
   `_headers` (command is in that file). A stale hash means the browser
   refuses to run it: no theme boot, no scroll restore.

Neither is enforced by tooling - there's no build step or CI. After
deploying, a load with DevTools open catches both: CSP violations log as
errors, and a hard-reload comparison catches stale assets.

## Details worth knowing

- Theme preference persists in `localStorage` (`batchison-theme`);
  first visit follows `prefers-color-scheme`.
- All motion respects `prefers-reduced-motion`.
- The favicon is an inline SVG data URI - no file to manage.
- Fonts are self-hosted variable WOFF2 preloaded from the same origin -
  no Google Fonts, no third-party request on load.
