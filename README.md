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
assets/js/destruct.js  Easter egg: the terminal's red dot self-destructs
                       the site (projectile-physics debris, WAAPI)
assets/fonts/          Self-hosted variable WOFF2 (Inter, JetBrains Mono)
tests/validate_site.py Static content and integration acceptance checks
scripts/qa.sh          One-command static, JS, server, and screenshot QA
```

## Run locally

```sh
npx live-server        # auto-reloads on save
# or, zero-install:
python3 -m http.server 8000
```

That's it - static files, any server works.

## Verify changes

```sh
./scripts/qa.sh
```

The command uses only Python, Node's syntax checker, curl, and the installed
Firefox. It prints a temporary directory containing desktop/mobile screenshots;
no QA artifacts or browser dependencies are committed.

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
  HTTPS, Minimum TLS 1.2, Bot Fight Mode, and Browser Cache TTL set to
  "Respect Existing Headers" (any fixed TTL there silently overrides
  every `_headers` max-age lower than it - it's what turned the 10-min
  JS cache into 4 hours).

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
