import { prefersReducedMotion } from "./motion.js";

// Project grid: shuffle / reset / page turn reorder the DOM inside a View
// Transition; expand/collapse animates the grid's max-height clip. All cards
// stay rendered; the clip hides everything beyond the current page window.
//
// View-transition contract (see the matching CSS):
// - Every card carries a stable view-transition-name while it is inside the
//   page window and `none` while it is hidden. So a card that stays visible
//   across a reorder gets a real position tween; one leaving the window fades
//   out where it was; one entering fades in where it lands. Hidden cards are
//   never captured, which is what keeps them from flying across the footer -
//   the pseudo-element layer is not clipped by the grid's overflow.
// - The root opts out of capture, so the rest of the page (hero physics,
//   scrolling) stays live during the ~260ms tween.
// - <html data-vt="next|prev"> is set for the duration of a page turn so the
//   CSS can swap the default cross-fade for a directional slide.
export function initProjects(recacheCards) {
  const shuffleBtn = document.getElementById("shuffle-btn");
  const resetBtn = document.getElementById("reset-btn");
  const expandBtn = document.getElementById("expand-btn");
  const projectGrid = document.getElementById("project-grid");
  if (!shuffleBtn || !projectGrid) return;

  const recache = recacheCards || function () {};

  const allCards = Array.from(projectGrid.children);
  const TOTAL = allCards.length;
  const DISPLAY_COUNT = Math.min(6, TOTAL);
  const EXPANDED_COUNT = 12;
  const HEIGHT_MS = 400;

  const cardNames = new Map(allCards.map((card, i) => [card, "pc-" + i]));

  let currentOrder = allCards.slice();
  let isExpanded = false;
  let page = 0;
  let pendingTimeout = null;

  const pagerPrev = document.getElementById("pager-prev");
  const pagerNext = document.getElementById("pager-next");
  const pagerCount = document.getElementById("pager-count");

  const canTransition = () =>
    !prefersReducedMotion && typeof document.startViewTransition === "function";

  function pageSize() { return isExpanded ? EXPANDED_COUNT : DISPLAY_COUNT; }
  function pageCount() { return Math.max(1, Math.ceil(TOTAL / pageSize())); }
  function visibleCount() { return Math.min(pageSize(), TOTAL - page * pageSize()); }

  // DOM order = current page's window first, remaining cards after (hidden by clip)
  function displayOrder() {
    const start = page * pageSize();
    const win = currentOrder.slice(start, start + pageSize());
    return win.concat(currentOrder.filter((c) => win.indexOf(c) === -1));
  }

  function updatePager() {
    if (pagerCount) pagerCount.textContent = (page + 1) + " / " + pageCount();
  }

  function fisherYates(arr) {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = result[i]; result[i] = result[j]; result[j] = temp;
    }
    return result;
  }

  function updateFooter() {
    if (expandBtn) {
      const label = expandBtn.querySelector(".expand-label");
      label.textContent = isExpanded ? "Collapse" : "Expand";
      expandBtn.setAttribute("aria-expanded", String(isExpanded));
    }
  }

  // Clip height = bottom of the last window card, NOT top of the next card:
  // on a partial last page the next card shares the window's row, which
  // would measure 0 and disable the clip entirely.
  // Assumes maxHeight is currently "none". Returns px, or -1 for no clip.
  function measureClipTarget() {
    const visCount = visibleCount();
    if (visCount >= TOTAL) return -1;
    const gridTop = projectGrid.getBoundingClientRect().top;
    const lastCard = projectGrid.children[visCount - 1];
    return lastCard ? Math.round(lastCard.getBoundingClientRect().bottom - gridTop) : 0;
  }

  // Set max-height to show exactly the current page's cards (rest clipped).
  // Applies expanded too: with >12 cards, expanded pages clip at card 13.
  function setClipHeight() {
    projectGrid.style.maxHeight = "none";
    const h = measureClipTarget();
    projectGrid.style.maxHeight = h > 0 ? h + "px" : "";
  }

  // Non-window cards can occupy empty slots in a partial last row where the
  // clip can't reach them. visibility (not display) keeps their layout so the
  // grid geometry is stable. The view-transition-name rides along: only
  // window cards are capturable.
  function applyPageVisibility() {
    const visCount = visibleCount();
    for (let i = 0; i < projectGrid.children.length; i++) {
      const card = projectGrid.children[i];
      const shown = i < visCount;
      card.style.visibility = shown ? "" : "hidden";
      card.style.viewTransitionName = shown ? cardNames.get(card) : "none";
    }
  }

  // Apply the current order/page to the DOM. Called inside the view
  // transition's update callback, or directly when transitions are off.
  function commitLayout() {
    displayOrder().forEach((card) => { projectGrid.appendChild(card); });
    setClipHeight();
    applyPageVisibility();
    updatePager();
  }

  function reorder(direction) {
    if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
    projectGrid.classList.remove("is-animating");

    if (!canTransition()) {
      commitLayout();
      recache();
      return;
    }

    const root = document.documentElement;
    if (direction) root.dataset.vt = direction > 0 ? "next" : "prev";
    // A second call while one is running skips the first - the browser owns
    // the interrupt bookkeeping the old FLIP timers used to.
    const transition = document.startViewTransition(commitLayout);
    transition.finished.then(
      () => { delete root.dataset.vt; recache(); },
      () => { delete root.dataset.vt; recache(); },
    );
  }

  function shuffle() {
    currentOrder = fisherYates(allCards);
    page = 0;
    reorder(0);
  }

  // Toggle expanded/collapsed page size, keeping the first visible card
  // visible. Reorders DOM for the new window, then animates max-height.
  function setExpanded(expanded) {
    if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
    projectGrid.classList.remove("is-animating");

    const currentH = projectGrid.offsetHeight;
    const firstIdx = page * pageSize();
    isExpanded = expanded;
    page = Math.floor(firstIdx / pageSize());
    displayOrder().forEach((card) => { projectGrid.appendChild(card); });
    applyPageVisibility();

    projectGrid.style.maxHeight = "none";
    const clipH = measureClipTarget();
    const targetH = clipH >= 0 ? clipH : projectGrid.offsetHeight;
    projectGrid.style.maxHeight = currentH + "px";
    projectGrid.offsetHeight;
    projectGrid.classList.add("is-animating");
    projectGrid.offsetHeight;
    projectGrid.style.maxHeight = targetH + "px";

    updateFooter();
    updatePager();

    pendingTimeout = setTimeout(() => {
      projectGrid.classList.remove("is-animating");
      if (visibleCount() >= TOTAL) projectGrid.style.maxHeight = "none";
      recache();
      pendingTimeout = null;
    }, HEIGHT_MS + 30);
  }

  function expand() { setExpanded(true); }
  function collapse() { setExpanded(false); }

  // Page turn, wrapping around. Outgoing cards leave the window (fade/slide
  // out in place), incoming ones enter (fade/slide in where they land).
  function goPage(dir) {
    const pc = pageCount();
    page = ((page + dir) % pc + pc) % pc;
    reorder(dir);
  }

  // Init: all cards rendered, clip to first page
  allCards.forEach((card) => { card.classList.add("active"); });
  setClipHeight();
  applyPageVisibility();
  updateFooter();
  updatePager();

  if (TOTAL <= DISPLAY_COUNT && expandBtn) {
    expandBtn.style.display = "none";
  }

  shuffleBtn.addEventListener("click", () => {
    shuffle();
    if (resetBtn) resetBtn.removeAttribute("hidden");
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      currentOrder = allCards.slice();
      page = 0;
      reorder(0);
      resetBtn.setAttribute("hidden", "");
    });
  }

  if (pagerPrev) pagerPrev.addEventListener("click", () => { goPage(-1); });
  if (pagerNext) pagerNext.addEventListener("click", () => { goPage(1); });

  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      if (isExpanded) collapse(); else expand();
    });
  }

  // Re-measure on resize/load (card heights change with viewport/fonts)
  window.addEventListener("resize", () => {
    if (!pendingTimeout) setClipHeight();
  });
  window.addEventListener("load", () => {
    if (!pendingTimeout) setClipHeight();
  });

  // --- Floating collapse button ---
  // Shows when expanded AND real button is below fold AND projects section is in view
  const floatCollapse = document.getElementById("float-collapse");
  if (floatCollapse) {
    const projectsSection = document.getElementById("projects");

    function updateFloat() {
      if (!isExpanded) {
        floatCollapse.classList.remove("is-visible");
        expandBtn.style.visibility = "";
        return;
      }
      const btnRect = expandBtn.getBoundingClientRect();
      const secRect = projectsSection.getBoundingClientRect();
      const vh = window.innerHeight;
      const btnBelowFold = btnRect.bottom > vh + 40;
      const secInView = secRect.top < vh - 40 && secRect.bottom > 40;
      if (btnBelowFold && secInView) {
        floatCollapse.classList.add("is-visible");
        floatCollapse.removeAttribute("hidden");
        expandBtn.style.visibility = "hidden";
      } else {
        floatCollapse.classList.remove("is-visible");
        expandBtn.style.visibility = "";
      }
    }

    window.addEventListener("scroll", updateFloat, { passive: true });
    window.addEventListener("resize", updateFloat);

    // Track button position during expand/collapse animation via rAF
    function trackDuringAnimation() {
      const startTime = Date.now();
      function tick() {
        updateFloat();
        if (Date.now() - startTime < HEIGHT_MS + 100) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    expandBtn.addEventListener("click", () => {
      trackDuringAnimation();
    });
    floatCollapse.addEventListener("click", () => {
      if (isExpanded) {
        collapse();
        trackDuringAnimation();
      }
    });
    updateFloat();
  }
}
