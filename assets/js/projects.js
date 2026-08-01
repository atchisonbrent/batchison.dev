import { prefersReducedMotion } from "./motion.js";

// Project grid: shuffle (FLIP), pagination (slide), expand/collapse (height
// clip). All cards stay rendered; a max-height clip hides everything beyond
// the current page window.
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
  const FLIP_MS = 250;
  const HEIGHT_MS = 400;
  const SLIDE_MS = 130; // per phase; out + in lands near the FLIP's 250ms

  let currentOrder = allCards.slice();
  let isExpanded = false;
  let page = 0;
  let pendingTimeout = null;

  const pagerPrev = document.getElementById("pager-prev");
  const pagerNext = document.getElementById("pager-next");
  const pagerCount = document.getElementById("pager-count");

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

  function clearStyles(cards) {
    cards.forEach((card) => {
      card.style.transition = "";
      card.style.transform = "";
      card.style.opacity = "";
    });
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
  // clip can't reach them. visibility (not display) keeps their layout so
  // FLIP can still measure rects.
  function applyPageVisibility() {
    const visCount = visibleCount();
    for (let i = 0; i < projectGrid.children.length; i++) {
      projectGrid.children[i].style.visibility = i < visCount ? "" : "hidden";
    }
  }

  function unhideAll() {
    allCards.forEach((card) => { card.style.visibility = ""; });
  }

  // FLIP: all cards stay rendered. Clip hides cards beyond the page window.
  // Entering cards emerge from behind clip, leaving cards slide behind it.
  function flipReorder() {
    if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
    clearStyles(allCards);
    projectGrid.classList.remove("is-animating");
    unhideAll();

    // Snap max-height to current state (no transition)
    setClipHeight();

    if (prefersReducedMotion) {
      displayOrder().forEach((card) => { projectGrid.appendChild(card); });
      setClipHeight();
      applyPageVisibility();
      recache();
      return;
    }

    // FIRST: record all positions
    const firstPos = new Map();
    allCards.forEach((card) => {
      firstPos.set(card, card.getBoundingClientRect());
    });

    // Reorder DOM
    displayOrder().forEach((card) => { projectGrid.appendChild(card); });

    // Update height for new layout
    setClipHeight();

    // INVERT: translate each card back to its first position
    allCards.forEach((card) => {
      const first = firstPos.get(card);
      if (!first) return;
      const last = card.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx === 0 && dy === 0) return;
      card.style.transition = "none";
      card.style.transform = "translate(" + dx + "px," + dy + "px)";
    });

    projectGrid.offsetHeight;

    // PLAY
    allCards.forEach((card) => {
      if (card.style.transform) {
        card.style.transition = "transform " + FLIP_MS + "ms cubic-bezier(0.2,0,0.2,1)";
        card.style.transform = "";
      }
    });

    pendingTimeout = setTimeout(() => {
      clearStyles(allCards);
      applyPageVisibility();
      recache();
      pendingTimeout = null;
    }, FLIP_MS + 30);
  }

  function shuffle() {
    currentOrder = fisherYates(allCards);
    page = 0;
    flipReorder();
    updatePager();
  }

  // Toggle expanded/collapsed page size, keeping the first visible card
  // visible. Reorders DOM for the new window, then animates max-height.
  function setExpanded(expanded) {
    if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
    clearStyles(allCards);
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

  // Page turn: slide current window out, swap window, slide new one in.
  // Wraps around; on a single page the same cards cycle out and back in.
  function goPage(dir) {
    if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
    clearStyles(allCards);
    projectGrid.classList.remove("is-animating");

    const pc = pageCount();
    const newPage = ((page + dir) % pc + pc) % pc;

    if (prefersReducedMotion) {
      page = newPage;
      displayOrder().forEach((card) => { projectGrid.appendChild(card); });
      setClipHeight();
      applyPageVisibility();
      updatePager();
      recache();
      return;
    }

    const dist = projectGrid.offsetWidth;
    const outgoing = Array.prototype.slice.call(projectGrid.children, 0, visibleCount());

    outgoing.forEach((card) => {
      card.style.transition = "transform " + SLIDE_MS + "ms cubic-bezier(0.4,0,1,1), opacity " + SLIDE_MS + "ms ease";
      card.style.transform = "translateX(" + (-dir * dist) + "px)";
      card.style.opacity = "0";
    });

    pendingTimeout = setTimeout(() => {
      clearStyles(allCards);
      page = newPage;
      displayOrder().forEach((card) => { projectGrid.appendChild(card); });
      setClipHeight();
      applyPageVisibility();
      updatePager();

      const incoming = Array.prototype.slice.call(projectGrid.children, 0, visibleCount());
      incoming.forEach((card) => {
        card.style.transition = "none";
        card.style.transform = "translateX(" + (dir * dist) + "px)";
        card.style.opacity = "0";
      });
      projectGrid.offsetHeight;
      incoming.forEach((card) => {
        card.style.transition = "transform " + SLIDE_MS + "ms cubic-bezier(0,0,0.2,1), opacity " + SLIDE_MS + "ms ease";
        card.style.transform = "";
        card.style.opacity = "";
      });

      pendingTimeout = setTimeout(() => {
        clearStyles(allCards);
        recache();
        pendingTimeout = null;
      }, SLIDE_MS + 30);
    }, SLIDE_MS + 20);
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
      flipReorder();
      updatePager();
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
