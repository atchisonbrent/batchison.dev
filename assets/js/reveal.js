import { prefersReducedMotion } from "./motion.js";

// Scroll reveal (opacity only - transforms belong to other layers).
//
// Modern browsers do this in pure CSS: `.reveal` carries a scroll-driven
// animation on its own view() timeline (see style.css), so this module has
// nothing to do and stands down. The IntersectionObserver path below is the
// fallback for engines without animation-timeline; it toggles .active and
// feeds --reveal-i so each card grid staggers its own cascade.
export function initReveal() {
  const revealElements = document.querySelectorAll(".reveal");
  if (revealElements.length === 0) return;

  const nativeScrollDriven =
    typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: view()");
  if (nativeScrollDriven) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((el) => el.classList.add("active"));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -50px 0px", threshold: 0.1 });

  revealElements.forEach((el) => {
    let i = 0;
    for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.classList.contains("reveal")) i++;
    }
    el.style.setProperty("--reveal-i", i);
    observer.observe(el);
  });
}
