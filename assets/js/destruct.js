import { prefersReducedMotion } from "./motion.js";

// Easter egg: "closing" the currently-terminal takes the whole site with it.
// The red dot is a decorative span without JS, so all button semantics are
// bolted on here rather than in the markup (keeps the noscript rules honest).
//
// Structure-driven, so new content participates automatically: top-level
// pieces come from structural selectors; inside each piece, small
// self-contained elements (chips, spec terms - anything pill-sized) fly whole
// as "atoms", large text blocks split into words, and the emptied shells drop
// after. All flight happens on clones in a document-space layer, immune to
// card overflow clipping and shell transforms, and aligned under scrolling.

const LOG_LINES = [
  { text: "^C", cls: "t-key", delay: 350 },
  { text: "batchison@lab:~$ shutdown --site now", cls: "t-prompt", delay: 900 },
  { text: "warning: this will remove everything", cls: "t-key", delay: 700 },
  { text: "proceed? [y/N] y", cls: "t-key", delay: 1100 },
  { text: "unmounting /dev/portfolio ... done", cls: "t-val", delay: 600 },
  { text: "goodbye.", cls: "t-val", delay: 800 },
];

const rand = (min, max) => min + Math.random() * (max - min);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playLog(code) {
  // Lock the terminal body at its current height so new lines push old ones
  // off the top (clipped by the window chrome) instead of growing the card.
  const pre = code.parentElement; // .terminal-body
  pre.style.height = `${pre.getBoundingClientRect().height}px`;
  // The pre is a flex item (flex: 1, min-height auto), so content min-size
  // would override the locked height and keep growing the card - opt out.
  pre.style.flex = "none";
  pre.style.minHeight = "0";
  pre.style.display = "block";
  pre.style.overflow = "hidden";

  const cursor = code.querySelector(".t-cursor");
  if (cursor) cursor.remove();
  for (const line of LOG_LINES) {
    const span = document.createElement("span");
    span.className = line.cls;
    span.textContent = line.text;
    code.append(span, "\n");
    pre.scrollTop = pre.scrollHeight;
    await wait(prefersReducedMotion ? 120 : line.delay);
  }
}

// All motion is emulated projectile physics: an initial velocity, then plain
// gravity, integrated into sampled keyframes played back with linear easing.
// The browser composites the whole flight on the GPU - no per-frame JS, so it
// stays smooth on phones.
const GRAVITY = 2400; // px/s^2

function ballistic(el, rect, { vx, vy, spin, delay }) {
  // Solve 0.5*g*t^2 + vy*t = fallDist for flight time to below the viewport
  // as it was at launch. Clones fade out over the last third of the flight so
  // nothing is left hovering mid-page if the user scrolls after the dust
  // settles.
  const fallDist = Math.max(200, window.innerHeight - rect.top + 150);
  const flight = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * fallDist)) / GRAVITY;

  const SAMPLES = 24;
  const frames = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const p = i / SAMPLES;
    const t = flight * p;
    frames.push({
      transform: `translate(${vx * t}px, ${vy * t + 0.5 * GRAVITY * t * t}px) rotate(${spin * t}deg)`,
      opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      easing: "linear",
    });
  }
  el.animate(frames, { duration: flight * 1000, delay, fill: "forwards" });
  el.style.pointerEvents = "none";
  return delay + flight * 1000;
}

// Radial impulse away from the piece center plus upward lift. Heavier things
// (atoms, shells) pass scale < 1 to blast off with less violence.
function impulse(rect, center, scale) {
  let dirX = rect.left + rect.width / 2 - center.x;
  let dirY = rect.top + rect.height / 2 - center.y;
  const len = Math.hypot(dirX, dirY) || 1;
  const speed = rand(250, 950) * scale;
  return {
    vx: (dirX / len) * speed + rand(-80, 80) * scale,
    vy: (dirY / len) * speed * 0.6 - rand(250, 650) * scale, // outward + lift
    spin: rand(-540, 540) * scale, // deg/s
  };
}

// Card shell: heavy - barely any impulse, it just tips and drops in place.
function dropShell(el, delay) {
  return ballistic(el, el.getBoundingClientRect(), {
    vx: rand(-70, 70),
    vy: rand(-120, 0),
    spin: rand(-60, 60),
    delay,
  });
}

// An atom flies as one unit: pill-sized, self-contained (chips, dt/dd, stack
// names). Anything bigger gets word-split instead.
const isAtom = (rect) => rect.width <= 300 && rect.height <= 80;

// Wrap every word of the element's direct text in spans so each word can be
// measured and cloned independently. Returns the spans.
function splitWords(textNodes) {
  const words = [];
  for (const node of textNodes) {
    const frag = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(part);
        continue;
      }
      const span = document.createElement("span");
      span.className = "destruct-word";
      span.textContent = part;
      frag.append(span);
      words.push(span);
    }
    node.parentNode.replaceChild(frag, node);
  }
  return words;
}

// Style props copied onto clones: enough for words (font/color) and for
// self-styled pills (box visuals). Descendant CSS selectors stop matching
// once a clone leaves its parent, so the visuals must ride along inline.
// Longhands, not the font shorthand: Firefox computes the shorthand as "".
const CLONE_PROPS = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight",
  "color", "letterSpacing", "textTransform", "whiteSpace",
  "padding", "background", "border", "borderRadius", "boxShadow",
];

function cloneTo(layer, src, rect) {
  const clone = src.cloneNode(true);
  const cs = getComputedStyle(src);
  for (const prop of CLONE_PROPS) clone.style[prop] = cs[prop];
  clone.style.left = `${rect.left + window.scrollX}px`;
  clone.style.top = `${rect.top + window.scrollY}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  layer.append(clone);
  src.style.visibility = "hidden";
  return clone;
}

// Decompose a piece into flyable parts: atoms fly whole, larger elements
// recurse, and any bare text gets word-split. Everything is measured first,
// then cloned into the document-space layer, then launched.
function explodePiece(piece, layer, baseDelay) {
  const atoms = [];
  const textNodes = [];
  const visit = (el) => {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) textNodes.push(node);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (isAtom(rect)) atoms.push(node);
      else visit(node);
    }
  };
  visit(piece);

  const words = splitWords(textNodes);
  const parts = atoms
    .map((el) => ({ el, rect: el.getBoundingClientRect(), scale: 0.6 }))
    .concat(words.map((el) => ({ el, rect: el.getBoundingClientRect(), scale: 1 })));

  const box = piece.getBoundingClientRect();
  const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };

  let end = 0;
  for (const { el, rect, scale } of parts) {
    if (rect.width === 0) continue;
    // Skip parts clipped out of the piece's own box (e.g. log lines scrolled
    // off under the terminal chrome) - cloning them would make them pop back
    // into view mid-air.
    if (rect.bottom < box.top || rect.top > box.bottom) continue;
    const clone = cloneTo(layer, el, rect);
    end = Math.max(
      end,
      ballistic(clone, rect, { ...impulse(rect, center, scale), delay: baseDelay + rand(0, 150) })
    );
  }
  return end;
}

// Word explosions are limited to pieces within a screen of the click-time
// viewport (clone count stays bounded no matter how much content the page
// grows); everything further out still drops shell-first in document flow,
// which scrolling users see naturally.
const nearViewport = (el) => {
  const rect = el.getBoundingClientRect();
  const margin = window.innerHeight;
  return rect.bottom > -margin && rect.top < window.innerHeight + margin;
};

function collapseSite(terminalCard) {
  const pieces = [];
  document
    .querySelectorAll(".site-header, .hero .container > *, .section .container > *, .site-footer")
    .forEach((el) => {
      if (el === terminalCard) return;
      if (el.contains(terminalCard)) {
        // The terminal's own grid: handle its sibling cards individually so
        // the terminal can stay standing until the very end.
        for (const child of el.children) {
          if (child !== terminalCard) pieces.push(child);
        }
        return;
      }
      pieces.push(el);
    });

  const layer = document.createElement("div");
  layer.className = "destruct-layer";
  layer.style.height = `${document.documentElement.scrollHeight}px`;
  document.body.append(layer);

  let end = 0;
  for (const piece of pieces) {
    const visible = nearViewport(piece);
    if (visible) {
      // Atoms and words blast off first and rain down in free flight...
      end = Math.max(end, explodePiece(piece, layer, 0));
    }
    // ...then the emptied shells follow: barely any impulse, tip and drop.
    end = Math.max(end, dropShell(piece, visible ? rand(500, 1200) : rand(0, 600)));
  }

  // The terminal that started it all goes down last: its words (including the
  // shutdown log) blast off, then the empty shell drops. Cloning is deferred
  // so the log stays readable until the moment of blastoff (explodePiece
  // hides originals the instant it runs). The card hasn't moved by then, so
  // rects measured at that point are still exact.
  const terminalAt = Math.max(400, end - 1800);
  setTimeout(() => {
    explodePiece(terminalCard, layer, 0);
    dropShell(terminalCard, 350);
  }, terminalAt);
  return Math.max(end, terminalAt + 350 + 1800); // 1800ms covers any shell flight
}

function showEndScreen() {
  const layer = document.querySelector(".destruct-layer");
  if (layer) layer.remove(); // free the hundreds of flown clones

  const overlay = document.createElement("div");
  overlay.className = "destruct-overlay";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-label", "Site closed");

  const msg = document.createElement("p");
  msg.className = "destruct-msg";
  msg.textContent = "Connection to batchison.dev closed.";

  const restore = document.createElement("button");
  restore.className = "destruct-restore";
  restore.type = "button";
  restore.textContent = "[ restore session ]";
  restore.addEventListener("click", () => window.location.reload());

  overlay.append(msg, restore);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("active"));
  restore.focus();
}

async function selfDestruct(code, terminalCard) {
  await playLog(code);
  if (prefersReducedMotion || !("animate" in Element.prototype)) {
    showEndScreen();
    return;
  }
  const total = collapseSite(terminalCard);
  await wait(total + 200);
  showEndScreen();
}

export function initDestruct() {
  const terminalCard = document.querySelector(".terminal-card");
  const dot = terminalCard && terminalCard.querySelector(".dot-red");
  const code = terminalCard && terminalCard.querySelector(".terminal-body code");
  if (!dot || !code) return;

  dot.classList.add("destruct-armed");
  dot.setAttribute("role", "button");
  dot.setAttribute("tabindex", "0");
  dot.setAttribute("aria-label", "Close window");
  dot.title = "Close window";

  let fired = false;
  const trigger = () => {
    if (fired) return;
    fired = true;
    selfDestruct(code, terminalCard);
  };
  dot.addEventListener("click", trigger);
  dot.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger();
    }
  });
}
