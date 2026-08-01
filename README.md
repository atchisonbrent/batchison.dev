# batchison.dev

Personal site. Plain HTML, CSS, and vanilla JS - no frameworks, no
dependencies, no build step. Hosted on Cloudflare Pages; every push to
`main` deploys.

## Layout

```
index.html             The whole site
_headers               Cloudflare Pages cache + security headers
assets/css/style.css   Theme tokens, light/dark, responsive layout
assets/js/boot.js      Pre-paint boot: theme + scroll restore (blocking)
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
- `_headers` sets `immutable` year-long caching on fonts and css (both
  versioned; a `?v=` bump invalidates, enforced by a pre-push hook), a
  short revalidating cache on js, and 24h on images.
- Security headers site-wide: CSP (`default-src 'none'` baseline, no
  inline scripts), HSTS, `nosniff`, `Permissions-Policy`,
  `Referrer-Policy`.
- Dashboard-side settings not expressible in `_headers`: Always Use
  HTTPS, Minimum TLS 1.2, Bot Fight Mode.

## Contributing / editing

One-time setup per clone: `git config core.hooksPath .githooks` (enables
the pre-push hook that enforces CSS cache-key bumps). See
[AGENTS.md](AGENTS.md) for the caching model and coupled-edit traps.

## Details worth knowing

- Theme preference persists in `localStorage` (`batchison-theme`);
  first visit follows `prefers-color-scheme`.
- All motion respects `prefers-reduced-motion`.
- The favicon is an inline SVG data URI - no file to manage.
- Fonts are self-hosted variable WOFF2 preloaded from the same origin -
  no Google Fonts, no third-party request on load.
