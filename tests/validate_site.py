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
        "70 TB usable",
        "RTX 5090",
        "Cloudflare Access",
        "Beszel",
        "Bitwarden Secrets Manager",
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
    require(len(about_paragraphs) == 2, "About must stay concise at exactly two paragraphs")
    require(350 <= len(about_text) <= 650, "About copy must stay within the 350-650 character budget")
    require("Security lives in code, not the prompt" in about_text, "About must preserve the security point of view")

    project_blocks = re.findall(
        r'<article class="project-card reveal">(.*?)</article>',
        html,
        flags=re.DOTALL,
    )
    require(len(project_blocks) == 15, "Expected exactly 15 project cards")
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
    require(".hero-physics-char" in css, "Hero physics glyph styling is missing")
    require(".hero-title.hero-signal" not in css, "Rejected spectral styling must be removed")
    require(int(css_ref.group(1)) >= 16, "Hero physics styling must bump the immutable CSS cache key")

    require(html.count("Homelab control plane") == 1, "Homelab control plane must appear exactly once")
    require(html.count("Private operations portal") == 1, "Private operations portal must appear exactly once")
    require(html.count("Wake-on-demand local inference") == 1, "Wake-on-demand inference must appear exactly once")
    require(html.count('class="project-card reveal"') == 15, "Expanded project grid must end with a complete three-card row")

    print("site validation: ok")


if __name__ == "__main__":
    main()
