import { prefersReducedMotion } from "./motion.js";

// Mobile menu + anchor handling. Anchor hrefs use the "/#id" form so they
// keep working from future non-root pages; on the home page we intercept and
// smooth-scroll instead of navigating.

function scrubTopHash() {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function initMenu() {
  const menuToggle = document.getElementById("menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  if (!menuToggle || !mobileNav) return;

  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    menuToggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    if (open) {
      mobileNav.setAttribute("hidden", "");
    } else {
      mobileNav.removeAttribute("hidden");
    }
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open menu");
      mobileNav.setAttribute("hidden", "");
    });
  });
}

// Floating back-to-top: the footer link only pays off once you've already
// scrolled to the bottom, so mirror it as a fixed button past one screen.
export function initBackToTop() {
  const btn = document.getElementById("to-top");
  if (!btn) return;

  const footerLink = document.querySelector(".footer-links a");

  function update() {
    const pastFold = window.scrollY > window.innerHeight * 0.8;
    // Stand down once the footer's own link is on screen - two controls for
    // the same action in one viewport is noise
    const footerLinkInView =
      footerLink && footerLink.getBoundingClientRect().top < window.innerHeight;
    if (pastFold && !footerLinkInView) {
      btn.removeAttribute("hidden");
      btn.classList.add("is-visible");
    } else {
      btn.classList.remove("is-visible");
    }
  }

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

export function initAnchors() {
  // A stale #top can linger from a click that beat the JS bindings (native
  // anchor jump) - scrub it so the bare URL shows
  if (window.location.hash === "#top") scrubTopHash();

  const onHomePage =
    window.location.pathname === "/" ||
    window.location.pathname.endsWith("/index.html");

  document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;
      // "/#id" from another page is a real navigation - let the browser go
      if (href.startsWith("/") && !onHomePage) return;
      const id = href.startsWith("/") ? href.slice(1) : href;
      // #top is the sticky header: once stuck its rect top is already 0, so the
      // native anchor jump is a no-op. Scroll the document explicitly instead.
      if (id === "#top") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Keep the URL bare - #top in the address bar is noise
        scrubTopHash();
        return;
      }
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}
