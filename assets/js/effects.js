import { prefersReducedMotion } from "./motion.js";

// Unified pointer effects: one rAF loop and one smoothed pointer drive the
// card dot-grid spotlight, the About word magnetism, and the chip hue field
// + magnetism. Words and chips cache page-coord positions (stable across
// scroll); card rects are viewport-coord and recached on scroll/resize.
//
// Returns { recacheCards } so the project grid can request a card recache
// after FLIP/page reorders, or null when nothing is active.
export function initEffects() {
  if (prefersReducedMotion) return null;

  const spotlightCards = document.querySelectorAll(".project-card, .bento-card, .stack-card");
  const aboutProse = document.querySelector("#about .prose");
  const chipList = document.getElementById("chip-list");
  const chips = chipList ? Array.from(chipList.querySelectorAll("li")) : [];

  // Wrap About words in spans so each can be magnetized individually
  let magWords = [];
  if (aboutProse) {
    aboutProse.querySelectorAll("p").forEach((p) => {
      Array.from(p.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(" "));
          } else {
            const span = document.createElement("span");
            span.className = "mag-word";
            span.textContent = part;
            frag.appendChild(span);
          }
        });
        p.replaceChild(frag, node);
      });
    });
    magWords = Array.from(aboutProse.querySelectorAll(".mag-word"));
  }

  if (spotlightCards.length === 0 && magWords.length === 0 && chips.length === 0) return null;

  const CARD_REACH = 220; // 180px mask radius + margin
  const WORD_RADIUS = 110;
  const WORD_PUSH = 0.12; // negative translate = repel from pointer
  const CHIP_RADIUS = 130;
  const CHIP_PULL = 0.3;
  const CHIP_MAX_SCALE = 1.1;
  const FIELD_REACH = 200; // px beyond the chip list where the hue field tracks

  let hasTarget = false;
  let targetX = 0, targetY = 0; // latest pointer position (client coords)
  let renderX = 0, renderY = 0; // smoothed position (lerped toward target)
  let loopId = null;

  let cardRects = [];
  const cardActive = [];
  let wordPos = []; // word centers in page coords
  let chipRects = []; // chip boxes in page coords
  let chipListBox = null; // chip list bounds in page coords
  let fieldActive = false;

  function cacheCardRects() {
    cardRects = [];
    for (let i = 0; i < spotlightCards.length; i++) {
      cardRects.push(spotlightCards[i].getBoundingClientRect());
    }
  }

  function cacheWordPos() {
    // Clear transforms first - getBoundingClientRect includes them
    magWords.forEach((w) => { w.style.transform = ""; });
    wordPos = magWords.map((w) => {
      const r = w.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 + window.scrollX,
        y: r.top + r.height / 2 + window.scrollY,
      };
    });
  }

  function cacheChipRects() {
    if (!chipList) return;
    // Clear transforms first - getBoundingClientRect includes them
    chips.forEach((c) => { c.style.transform = ""; });
    const sx = window.scrollX, sy = window.scrollY;
    chipRects = chips.map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
    });
    const lr = chipList.getBoundingClientRect();
    chipListBox = {
      left: lr.left + sx,
      top: lr.top + sy,
      right: lr.right + sx,
      bottom: lr.bottom + sy,
    };
  }

  function clearChipStyles() {
    chips.forEach((c) => {
      c.style.transform = "";
      c.style.zIndex = "";
      c.style.removeProperty("--gx");
      c.style.removeProperty("--gy");
    });
  }

  // Touch has no "pointer left" event, so on release we reset everything the
  // pointer was driving. Without this the last touch position stays baked in
  // (glow lit, words shoved, chips pulled) until the next touch, which reads
  // as a freeze-then-snap. Dropping hasTarget makes the next contact snap to
  // its own position instead of lerping across from the stale one.
  function clearAllEffects() {
    if (loopId !== null) {
      cancelAnimationFrame(loopId);
      loopId = null;
    }
    for (let i = 0; i < spotlightCards.length; i++) {
      if (!cardActive[i]) continue;
      spotlightCards[i].style.setProperty("--mouse-x", "-999px");
      spotlightCards[i].style.setProperty("--mouse-y", "-999px");
      cardActive[i] = false;
    }
    magWords.forEach((w) => { w.style.transform = ""; });
    fieldActive = false;
    clearChipStyles();
    hasTarget = false;
  }

  function renderFrame() {
    loopId = null;
    const dx = targetX - renderX;
    const dy = targetY - renderY;
    // Snap during continuous tracking (zero lag); lerp only across big
    // jumps (restart after scroll/blur) so the catch-up stays smooth
    if (dx * dx + dy * dy < 150 * 150) {
      renderX = targetX;
      renderY = targetY;
    } else {
      renderX += dx * 0.35;
      renderY += dy * 0.35;
    }

    // Only touch styles on cards in range - style writes on two dozen
    // cards per frame are the real cost
    for (let i = 0; i < spotlightCards.length; i++) {
      const r = cardRects[i];
      if (!r) continue;
      const inRange =
        renderX > r.left - CARD_REACH && renderX < r.right + CARD_REACH &&
        renderY > r.top - CARD_REACH && renderY < r.bottom + CARD_REACH;
      if (inRange) {
        spotlightCards[i].style.setProperty("--mouse-x", (renderX - r.left) + "px");
        spotlightCards[i].style.setProperty("--mouse-y", (renderY - r.top) + "px");
        cardActive[i] = true;
      } else if (cardActive[i]) {
        spotlightCards[i].style.setProperty("--mouse-x", "-999px");
        spotlightCards[i].style.setProperty("--mouse-y", "-999px");
        cardActive[i] = false;
      }
    }

    const sx = window.scrollX, sy = window.scrollY;

    for (let j = 0; j < magWords.length; j++) {
      const p = wordPos[j];
      if (!p) continue;
      const wdx = renderX - (p.x - sx);
      const wdy = renderY - (p.y - sy);
      const dist = Math.sqrt(wdx * wdx + wdy * wdy);
      if (dist < WORD_RADIUS) {
        const force = 1 - dist / WORD_RADIUS;
        magWords[j].style.transform =
          "translate(" + (-wdx * WORD_PUSH * force).toFixed(1) + "px," +
          (-wdy * WORD_PUSH * force).toFixed(1) + "px)";
      } else if (magWords[j].style.transform) {
        magWords[j].style.transform = "";
      }
    }

    // Chip hue field + magnetism against cached page-coord boxes. Skip the
    // per-chip work while the pointer is far away; clear once on exit.
    if (chips.length > 0 && chipListBox) {
      if (renderX < chipListBox.left - sx - FIELD_REACH ||
          renderX > chipListBox.right - sx + FIELD_REACH ||
          renderY < chipListBox.top - sy - FIELD_REACH ||
          renderY > chipListBox.bottom - sy + FIELD_REACH) {
        if (fieldActive) { fieldActive = false; clearChipStyles(); }
      } else {
        fieldActive = true;
        for (let k = 0; k < chips.length; k++) {
          const c = chipRects[k];
          if (!c) continue;
          const lx = c.x - sx, ly = c.y - sy;
          // Pointer in this chip's local coords - all chips place the same
          // gradient at the same screen point, forming one continuous hue
          // field. Tracking starts FIELD_REACH out, so the glow eases in on
          // approach (the 120px radial falloff does the fading)
          chips[k].style.setProperty("--gx", (renderX - lx).toFixed(1) + "px");
          chips[k].style.setProperty("--gy", (renderY - ly).toFixed(1) + "px");
          const cdx = renderX - (lx + c.w / 2);
          const cdy = renderY - (ly + c.h / 2);
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CHIP_RADIUS) {
            const force = 1 - cdist / CHIP_RADIUS;
            const scale = 1 + (CHIP_MAX_SCALE - 1) * force;
            chips[k].style.transform =
              "translate(" + (cdx * CHIP_PULL * force).toFixed(1) + "px," +
              (cdy * CHIP_PULL * force).toFixed(1) + "px) scale(" + scale.toFixed(3) + ")";
            chips[k].style.zIndex = "2";
          } else if (chips[k].style.transform) {
            chips[k].style.transform = "";
            chips[k].style.zIndex = "";
          }
        }
      }
    }

    // Keep animating until smoothed position catches up
    if (renderX !== targetX || renderY !== targetY) scheduleFrame();
  }

  function scheduleFrame() {
    if (loopId === null) loopId = requestAnimationFrame(renderFrame);
  }

  function setTarget(x, y) {
    targetX = x;
    targetY = y;
    // First contact: snap instead of lerping across the whole viewport
    if (!hasTarget) {
      renderX = x;
      renderY = y;
      hasTarget = true;
    }
    scheduleFrame();
  }

  // pointermove covers mouse + Apple Pencil hover; touchmove covers finger
  // drags (iOS fires pointercancel once scrolling starts, touchmove keeps going)
  document.addEventListener("pointermove", (e) => {
    setTarget(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 0) setTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  // During scroll the pointer's client position is unchanged but the page
  // moves under it - card rects go stale (viewport coords) and need a
  // recache; words and chips are page-coord cached so a re-render suffices
  window.addEventListener("scroll", () => {
    cacheCardRects();
    if (hasTarget) scheduleFrame();
  }, { passive: true });

  window.addEventListener("resize", () => {
    cacheCardRects();
    cacheWordPos();
    cacheChipRects();
    if (hasTarget) scheduleFrame();
  });

  // Fonts settle late - page-coord caches need a final pass
  window.addEventListener("load", () => {
    cacheWordPos();
    cacheChipRects();
  });

  if (chipList) {
    // Touch: chips follow the finger from first contact (document touchmove
    // handles the drag, the touchend handler below clears on release)
    chipList.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) setTarget(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  // Release everything once the last finger lifts (touchend fires per finger,
  // so wait for touches to empty). Not pointercancel: iOS fires that when a
  // drag turns into a scroll, mid-gesture, while touchmove keeps tracking.
  const onTouchRelease = (e) => {
    if (e.touches.length === 0) clearAllEffects();
  };
  document.addEventListener("touchend", onTouchRelease, { passive: true });
  document.addEventListener("touchcancel", onTouchRelease, { passive: true });

  cacheCardRects();
  cacheWordPos();
  cacheChipRects();

  return {
    recacheCards() {
      cacheCardRects();
      if (hasTarget) scheduleFrame();
    },
  };
}
