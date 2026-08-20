# Agent guide - batchison.dev

Plain HTML/CSS/vanilla-JS static site on Cloudflare Pages. No frameworks,
no dependencies, no build step, no CI. Every push to `main` deploys.

## One-time setup per clone

```sh
git config core.hooksPath .githooks
```

This enables the pre-push hook that blocks the one silent trap this repo
has: changing an immutable-cached CSS file without bumping its `?v=` in
`index.html` (CSS caches for a year; the bump is the only invalidation).

## Caching model

- **CSS + fonts**: `immutable`, 1 year. CSS is referenced with `?v=N`
  from `index.html`; bump on every change (hook-enforced). Fonts are
  renamed on change.
- **JS**: `max-age=600, must-revalidate`. Deliberately NOT immutable:
  the ES module imports inside `main.js` are unversioned URLs, so
  immutable would pin stale submodules with no way to bust them. A `?v=`
  bump on `boot.js`/`main.js` is nice for instant propagation but not
  required - staleness self-heals in 10 minutes.
- **Images**: 24h, unversioned.

## Coupled edits - change one, change both

- **Dark palette is duplicated in `style.css`.** The
  `[data-theme="dark"]` block and the
  `@media (prefers-color-scheme: dark) { html:not([data-theme]) }` block
  directly below it must stay identical (11 vars). The second is the
  no-JS fallback; there's no preprocessor to share them.
- **`<html>` carries no `data-theme` attribute in the markup.**
  `assets/js/boot.js` (blocking, in `<head>`) sets it pre-paint; its
  *absence* is the no-JS signal. Never add a static `data-theme` back.
- **The `<noscript><style>` block in `index.html`** hides JS-only
  controls (`.theme-toggle`, `.menu-toggle`, `.projects-controls`,
  `.projects-footer`). Adding a new JS-only control means adding it
  there too, or it renders as a dead button without JS. Alternative
  pattern: keep the element decorative in markup and bolt button
  semantics on from JS (see the terminal's red dot in
  `assets/js/destruct.js`).

## Conventions

- Conventional commits, scope = module: `feat(nav): ...`,
  `fix(parser): ...`. Lowercase imperative subject.
- No inline scripts. CSP `script-src` is `'self'` with no hashes; the
  pre-paint boot lives in `assets/js/boot.js`. A new inline script means
  reintroducing hash maintenance - put it in a file instead.
- `_headers` comments go *above* the header block, not inside it -
  in-block comment support is undocumented in the Pages parser.
- All motion respects `prefers-reduced-motion` (shared check in
  `assets/js/motion.js`). New effects must too.
- **Hero physics is content-only.** `assets/js/hero.js` may wrap and move the
  eyebrow, title, description, and status text; keep buttons and
  `.private-surfaces` outside `HERO_PHYSICS_TARGETS`. Glyphs are spring-bound
  to their reading positions, collide through a spatial grid, and must settle
  back to exact zero. Mouse and touch share the broad, forgiving field; touch
  listeners stay passive so native page scrolling remains in charge. Buttons
  and `.private-surfaces` remain outside the target list. The direct-contact
  punch experiment was less satisfying in practice. Keep damping modestly
  heavier and glyph restitution lower than the original so it remains lively
  without becoming a trampoline. Update the checks in
  `tests/validate_site.py` if the target contract intentionally changes.
- Fonts, favicon, everything is same-origin. The CSP has no third-party
  allowances and `connect-src` is `'self'` (the stale-module watchdog in
  `boot.js` re-fetches the module graph) - adding any external request
  requires a deliberate CSP change.

## Verification

Run the repo-owned zero-dependency QA command:

```sh
./scripts/qa.sh
```

It runs the stdlib site validator, checks every JS module with `node --check`,
starts an isolated local server, and uses stock Firefox to write normal
desktop/mobile plus deterministic no-JS full-content screenshots to a printed
temporary directory. The no-JS captures are intentional: Firefox screenshots
before the ES module graph and `IntersectionObserver` settle, while this site's
fallback exposes every card and hides dead controls. The script uses
`--no-remote` and unique disposable profiles so an already-running personal
Firefox instance cannot consume the request. Do not add Playwright merely for
screenshots unless interaction testing becomes a real recurring requirement.

After deploy, inspect DevTools for CSP/caching errors.
