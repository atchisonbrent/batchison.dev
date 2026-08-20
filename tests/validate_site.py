#!/usr/bin/env python3
"""Static acceptance checks for the public site."""

from html.parser import HTMLParser
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

    require(html.count("Homelab control plane") == 1, "Homelab control plane must appear exactly once")
    require(html.count("Private operations portal") == 1, "Private operations portal must appear exactly once")
    require(html.count("Wake-on-demand local inference") == 1, "Wake-on-demand inference must appear exactly once")
    require(html.count('class="project-card reveal"') == 15, "Expanded project grid must end with a complete three-card row")

    print("site validation: ok")


if __name__ == "__main__":
    main()
