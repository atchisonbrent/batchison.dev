#!/usr/bin/env python3
"""Static acceptance checks for the public site."""

from html.parser import HTMLParser
from html import unescape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
CSS_PATH = ROOT / "assets/css/style.css"


class SiteParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.nav_targets: list[str] = []
        self.in_primary_nav = False
        self.primary_nav_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if element_id := attributes.get("id"):
            self.ids.add(element_id)
        if tag == "nav" and attributes.get("aria-label") == "Primary":
            self.in_primary_nav = True
            self.primary_nav_depth = 1
        elif self.in_primary_nav:
            self.primary_nav_depth += 1
        if self.in_primary_nav and tag == "a" and (href := attributes.get("href")):
            self.nav_targets.append(href)

    def handle_endtag(self, tag: str) -> None:
        if not self.in_primary_nav:
            return
        self.primary_nav_depth -= 1
        if tag == "nav" or self.primary_nav_depth == 0:
            self.in_primary_nav = False
            self.primary_nav_depth = 0


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    html = HTML_PATH.read_text()
    css = CSS_PATH.read_text()
    parser = SiteParser()
    parser.feed(html)

    require("lab" not in parser.ids, "Homelab content must be worked into existing sections, not added as a parallel section")
    require("/#lab" not in parser.nav_targets, "Primary navigation must stay focused; do not add a redundant Lab destination")

    expected_copy = (
        "Wake-on-demand local inference",
        "Homelab control plane",
        "Private operations portal",
        "Deep research framework",
        "SampleMatch",
        "Homelab alert relay",
        "69 TB usable",
        "RTX 5090",
        "Cloudflare Access",
        "Beszel",
        "Bitwarden Secrets",
    )
    for text in expected_copy:
        require(text in html, f"Missing expected public-site copy: {text}")

    stale_copy = (
        "8th gen Intel i5 NUC (32GB, 1TB SSD, USB 2.0 drive)",
        "backup_wan: [U5G Max, C4P Shield]",
        "Front end</dt><dd>Organizr, Ombi, Tautulli",
    )
    for text in stale_copy:
        require(text not in html, f"Stale homelab copy remains: {text}")

    css_ref = re.search(r'href="assets/css/style\.css\?v=(\d+)"', html)
    if css_ref is None:
        raise AssertionError("Versioned stylesheet reference is required")
    require(int(css_ref.group(1)) >= 14, "Stylesheet cache key must remain versioned")
    require("@media (max-width: 760px)" in css, "Mobile breakpoint must remain present")
    require("@media (min-width: 761px) and (max-width: 900px)" in css, "Tablet-specific layout breakpoint must remain present")
    require(".bento-card { grid-column: 1 / -1; }" in css, "Tablet Off-Screen cards must use a balanced full-width flow")
    require(".terminal-card { grid-row: auto; }" in css, "Tablet terminal must not reserve a phantom second grid row")

    # Modern rendering layer: native browser features replace hand-rolled JS,
    # each behind a support/motion guard so older browsers and reduced-motion
    # users get the plain, complete page.
    require("light-dark(" in css, "Theme palette must use light-dark() so dark values are declared once")
    require("html:not([data-theme])" not in css, "The duplicated no-JS dark palette block must not return")
    require("color-scheme: light dark" in css, "No-JS theme must follow the OS via color-scheme")
    require("animation-timeline: view()" in css, "Scroll reveal must use CSS scroll-driven animations")
    require("@supports (animation-timeline: view())" in css, "Scroll-driven reveal must be feature-guarded")
    require("::view-transition-group(*.pc)" in css, "Project card view transitions must be styled by class")
    require("view-transition-name: none" in css, "The root must opt out of view transitions so the page stays live")
    require("::view-transition { pointer-events: none; }" in css, "The view-transition overlay must not swallow clicks mid-tween (shuffle felt like it had a cooldown)")
    require("@starting-style" in css, "Reset control must animate in from display:none via @starting-style")
    reduced = re.findall(r"@media \(prefers-reduced-motion: reduce\)\s*\{(.*?)\n\}", css, re.DOTALL)
    require(any("::view-transition" in block for block in reduced), "Reduced motion must disable view-transition pseudo-element animation")
    require(int(css_ref.group(1)) >= 20, "Rendering-layer changes must bump the immutable CSS cache key")

    projects_js = (ROOT / "assets/js/projects.js").read_text()
    reveal_js = (ROOT / "assets/js/reveal.js").read_text()
    require("startViewTransition" in projects_js, "Project reorders must use the View Transitions API")
    require("firstPos" not in projects_js, "Hand-rolled FLIP measurement must be retired in favor of view transitions")
    require('"animation-timeline: view()"' in reveal_js, "reveal.js must detect scroll-driven support and stand down")
    require("IntersectionObserver" in reveal_js, "reveal.js must keep the IntersectionObserver fallback for older browsers")
    require('src="assets/js/main.js?v=16"' in html, "Changed module graph should bump the entry module for instant propagation")

    private_surfaces = {
        "Hermes": "https://hermes.batchison.dev",
        "Dashboard": "https://dashboard.batchison.dev",
        "Metrics": "https://metrics.batchison.dev",
    }
    require('aria-label="Private surfaces"' in html, "Hero must expose a labeled private-surfaces link rail")
    require("Access required" in html, "Private surfaces must disclose the Access boundary")
    for label, url in private_surfaces.items():
        require(f'href="{url}"' in html, f"Missing private surface URL: {url}")
        require(f">{label}<" in html, f"Missing private surface label: {label}")

    about_match = re.search(r'<section id="about".*?<div class="prose">(.*?)</div>', html, re.DOTALL)
    if about_match is None:
        raise AssertionError("About prose cannot be parsed")
    about_paragraphs = [
        " ".join(unescape(re.sub(r"<[^>]+>", "", paragraph)).split())
        for paragraph in re.findall(r"<p>(.*?)</p>", about_match.group(1), re.DOTALL)
    ]
    about_text = " ".join(about_paragraphs)
    require(len(about_paragraphs) == 3, "About must use three balanced, substantive paragraphs")
    require(750 <= len(about_text) <= 1000, "About copy must stay within the 750-1000 character budget")
    require("Security lives in code, not the prompt" in about_text, "About must preserve the security point of view")
    require("failure modes" in about_text and "operational" in about_text, "About must explain the engineering point of view")

    chip_match = re.search(r'<ul class="chip-list".*?>(.*?)</ul>', html, re.DOTALL)
    if chip_match is None:
        raise AssertionError("Focus-area chips cannot be parsed")
    chips = [
        " ".join(unescape(re.sub(r"<[^>]+>", "", item)).split())
        for item in re.findall(r"<li>(.*?)</li>", chip_match.group(1), re.DOTALL)
    ]
    require(28 <= len(chips) <= 32, "Focus chips must be curated to 28-32 meaningful items")
    for expected_chip in (
        "Go", "Kubernetes", "TCP_INFO", "MCP", "Sandboxed eval",
        "Context engineering", "Local inference", "Cloudflare Access",
        "OpenTofu", "Bitwarden Secrets", "Beszel", "UniFi",
    ):
        require(expected_chip in chips, f"Missing current focus chip: {expected_chip}")
    for stale_chip in ("Doppler", "FastMCP", "Local LLMs", "Cloudflare Tunnel"):
        require(stale_chip not in chips, f"Stale or redundant focus chip remains: {stale_chip}")

    project_blocks = re.findall(
        r'<article class="project-card reveal">(.*?)</article>',
        html,
        flags=re.DOTALL,
    )
    require(len(project_blocks) == 18, "Expected exactly 18 project cards")
    for block in project_blocks:
        title_match = re.search(r"<h3>(.*?)</h3>", block, flags=re.DOTALL)
        title = unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip() if title_match else "untitled"
        bullets = [
            unescape(re.sub(r"<[^>]+>", "", item)).strip()
            for item in re.findall(r"<li>(.*?)</li>", block, flags=re.DOTALL)
        ]
        require(len(bullets) == 4, f"{title}: project cards must have exactly four scan points")
        require(max(map(len, bullets)) <= 80, f"{title}: a scan point exceeds 80 characters")
        require(220 <= sum(map(len, bullets)) <= 300, f"{title}: total card copy falls outside the 220-300 character budget")

    main_js = (ROOT / "assets/js/main.js").read_text()
    hero_js = (ROOT / "assets/js/hero.js").read_text()
    require("initHeroPhysics" in main_js, "Hero letter physics must be initialized")
    require("initHeroSignal" not in main_js, "The rejected spectral signal must not remain initialized")
    require("hero-physics-char" in hero_js, "Hero physics must operate on individual glyphs")
    require("HERO_PHYSICS_TARGETS" in hero_js, "Hero physics targets must be explicit and bounded")
    targets_match = re.search(r"HERO_PHYSICS_TARGETS\s*=\s*\[(.*?)\]", hero_js, re.DOTALL)
    if targets_match is None:
        raise AssertionError("Hero physics target declaration cannot be parsed")
    require("private-surfaces" not in targets_match.group(1), "Private links must not become physics targets")
    require("spatialGrid" in hero_js and "resolveGlyphCollisions" in hero_js, "Glyph-to-glyph collision handling is required")
    require("closestPointOnPointerPath" not in hero_js, "Hero interaction must use the broader forgiving field, not swept punch contact")
    require("pointer.moved" not in hero_js, "Hero interaction must not retain one-shot punch state")
    require("const POINTER_RADIUS = 30" in hero_js, "Hero interaction must restore the satisfying broad cursor radius")
    require("const DAMPING = 0.79" in hero_js, "Hero physics must keep a slightly less-bouncy damping profile")
    require("const POINTER_FORCE = 0.34" in hero_js, "Hero interaction must restore the previous proximity force")
    require("const POINTER_MOMENTUM = 0.1" in hero_js, "Hero interaction must restore the previous modest pointer momentum")
    require("const COLLISION_RESTITUTION = 0.18" in hero_js, "Glyph collisions must be slightly less elastic than the original")
    require('addEventListener("touchstart"' in hero_js, "Hero physics must respond immediately to touch")
    require('addEventListener("touchmove"' in hero_js, "Hero physics must follow touch movement")
    require('addEventListener("touchend"' in hero_js, "Hero physics must settle after touch release")
    require("touches[0]" in hero_js, "Hero physics must track the primary touch point")
    require("preventDefault" not in hero_js, "Touch physics must not hijack native page scrolling")
    require("function handlePointerCancel(event)" in hero_js, "Pointer cancellation must distinguish touch pans from mouse cancellation")
    require('event.pointerType === "touch"' in hero_js, "Touch pointer cancellation must not release an active pan")
    require('addEventListener("pointercancel", handlePointerCancel' in hero_js, "The guarded pointer-cancel handler must be installed")
    require("layoutWidth = window.innerWidth" in hero_js, "Hero physics must track layout width separately from viewport height")
    require("window.innerWidth === layoutWidth" in hero_js, "Height-only mobile browser-chrome resizes must not reset glyphs")
    require('window.addEventListener("scroll"' in hero_js, "Active touch physics must continue while the document scrolls under the finger")
    require(".hero-physics-char" in css, "Hero physics glyph styling is missing")
    require(".hero-title.hero-signal" not in css, "Rejected spectral styling must be removed")
    require(int(css_ref.group(1)) >= 17, "Tablet layout styling must bump the immutable CSS cache key")

    for title in (
        "Homelab control plane",
        "Private operations portal",
        "Wake-on-demand local inference",
        "Deep research framework",
        "SampleMatch",
        "Homelab alert relay",
    ):
        require(html.count(f"<h3>{title}</h3>") == 1, f"{title} must appear exactly once as a card title")
    require(html.count('class="project-card reveal"') == 18, "Expanded project grid must end with a complete three-card row")
    require(html.count('class="project-card reveal"') % 3 == 0, "Project card count must fill complete three-card rows")
    for url in (
        "https://github.com/atchisonbrent/deep-research",
        "https://github.com/atchisonbrent/samplematch",
    ):
        require(f'href="{url}"' in html, f"Public project must link to its source: {url}")
    require("FLIP shuffle" not in html, "Site card must describe the current interaction layer")
    require("fiction-workshop" in html, "Reading card should point at the fiction workshop")
    require("The Lab" not in html, "Duplicative Lab card must not repeat the terminal inventory")
    require("Terraria server on the lab" not in html, "Stale Terraria hosting claim must not return")
    require(html.count("Reading") == 1, "Off-Screen must include one distinct reading card")
    require("The Culture" in html and "Iain M. Banks" in html, "Reading card must reflect the current sci-fi interest")
    require("Audyssey XT32" in html and "Wharfedale karaoke zone" in html, "Acoustics card must describe the current system")

    qa_script = (ROOT / "scripts/qa.sh").read_text()
    require("capture tablet 834 1194 on" in qa_script, "QA must cover the iPad-width viewport")
    require("capture full-tablet 834 15000 off" in qa_script, "QA must expose the complete tablet card flow")

    print("site validation: ok")


if __name__ == "__main__":
    main()
