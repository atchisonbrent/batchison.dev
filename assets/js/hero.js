import { prefersReducedMotion } from "./motion.js";

// A pointer-following spectral highlight inside the hero name. This is
// deliberately local to the title: no global pointer listener, no layout
// movement, and no effect at all when reduced motion is requested.
export function initHeroSignal() {
  if (prefersReducedMotion) return;

  const title = document.querySelector(".hero-title");
  if (!title) return;

  title.classList.add("hero-signal");

  const moveSignal = (event) => {
    const rect = title.getBoundingClientRect();
    title.style.setProperty("--hero-x", `${event.clientX - rect.left}px`);
    title.style.setProperty("--hero-y", `${event.clientY - rect.top}px`);
  };

  const clearSignal = () => {
    title.style.setProperty("--hero-x", "-240px");
    title.style.setProperty("--hero-y", "50%");
  };

  title.addEventListener("pointerenter", moveSignal, { passive: true });
  title.addEventListener("pointermove", moveSignal, { passive: true });
  title.addEventListener("pointerleave", clearSignal, { passive: true });
  title.addEventListener("pointercancel", clearSignal, { passive: true });
  clearSignal();
}
