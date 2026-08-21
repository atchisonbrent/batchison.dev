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

- **Dark palette is duplicated in `style.css`.** Keep the shared theme variables
  in `[data-theme="dark"]` and the adjacent no-JS
  `prefers-color-scheme: dark` fallback synchronized. Decorative variables used
  only by scripted effects do not need to be copied into the fallback.
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
- **Hero physics is content-only.** `assets/js/hero.js` may move hero text, but
  controls and `.private-surfaces` must remain stationary and clickable. Keep
  touch listeners passive: the effect follows touch movement without taking
  control of native scrolling. It must settle cleanly and honor reduced motion.
  Update `tests/validate_site.py` when intentionally changing this contract.
- **Off-Screen has explicit content ownership.** The terminal owns current
  homelab hardware/topology; other cards add personal context rather than
  repeating that inventory. Preserve the balanced single-column tablet flow.
- Fonts, favicon, everything is same-origin. The CSP has no third-party
  allowances and `connect-src` is `'self'` (the stale-module watchdog in
  `boot.js` re-fetches the module graph) - adding any external request
  requires a deliberate CSP change.

## Verification

Run the repo-owned zero-dependency QA command:

```sh
./scripts/qa.sh
```

It runs static validation, JavaScript syntax checks, whitespace checks, a local
server smoke test, and Firefox captures at desktop, tablet, and mobile widths.
Review the generated screenshots for layout changes. Keep this dependency-free
unless recurring interaction tests or visual baselines justify browser tooling.

After deploy, inspect DevTools for CSP/caching errors.
