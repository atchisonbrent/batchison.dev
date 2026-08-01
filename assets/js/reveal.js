import { prefersReducedMotion } from "./motion.js";

// Scroll reveal (opacity only - FLIP owns transforms). Stagger comes from
// --reveal-i feeding the CSS transition-delay calc; counted per parent so
// each card grid restarts its own cascade.
export function initReveal() {
  const revealElements = document.querySelectorAll(".reveal");
  if (revealElements.length === 0) return;

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
