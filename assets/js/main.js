import { initTheme } from "./theme.js";
import { initMenu, initAnchors, initBackToTop } from "./nav.js";
import { initEffects } from "./effects.js";
import { initProjects } from "./projects.js";
import { initReveal } from "./reveal.js";

initTheme();
initMenu();
initAnchors();
initBackToTop();

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const effects = initEffects();
initProjects(effects && effects.recacheCards);
initReveal();
