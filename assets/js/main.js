import { initTheme } from "./theme.js";
import { initMenu, initAnchors, initBackToTop } from "./nav.js";
import { initEffects } from "./effects.js";
import { initProjects } from "./projects.js";
import { initReveal } from "./reveal.js";
import { initDestruct } from "./destruct.js";
import { initTextPhysics } from "./hero.js";

initTheme();
initMenu();
initAnchors();
initBackToTop();
initTextPhysics();

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const effects = initEffects();
initProjects(effects && effects.recacheCards);
initReveal();
initDestruct();

// Signals the stale-module watchdog in boot.js that the graph booted. Only
// reached if every import above resolved and executed.
window.__mainReady = true;
