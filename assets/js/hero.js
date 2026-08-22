import { prefersReducedMotion } from "./motion.js";

const TEXT_PHYSICS_FIELDS = [
  {
    root: ".hero",
    targets: [
      ".hero-eyebrow",
      ".hero-title",
      ".hero-subtitle",
      ".hero-cta .btn",
      ".hero-meta > span:last-child",
      ".private-surfaces-label",
    ],
  },
  {
    root: "#about",
    targets: [".prose p"],
  },
];

const POINTER_RADIUS = 30;
const SPRING = 0.05;
const DAMPING = 0.79;
const POINTER_FORCE = 0.34;
const POINTER_MOMENTUM = 0.1;
const COLLISION_RESTITUTION = 0.18;
const MAX_DISPLACEMENT = 84;
const CONTROL_MAX_DISPLACEMENT = 16;
const STATUS_MAX_DISPLACEMENT = 28;
const GRID_SIZE = 32;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapGlyphs(element) {
  const label = element.textContent.replace(/\s+/g, " ").trim();
  if (!label) return [];

  element.setAttribute("aria-label", label);
  element.textContent = "";

  const glyphs = [];
  const words = label.split(" ");
  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) element.appendChild(document.createTextNode(" "));

    const wordSpan = document.createElement("span");
    wordSpan.className = "text-physics-word";
    wordSpan.setAttribute("aria-hidden", "true");

    for (const character of word) {
      const glyph = document.createElement("span");
      glyph.className = "text-physics-char";
      glyph.textContent = character;
      wordSpan.appendChild(glyph);
      glyphs.push(glyph);
    }
    element.appendChild(wordSpan);
  });

  element.classList.add("text-physics-text");
  return glyphs;
}

function initPhysicsField(field) {
  const root = document.querySelector(field.root);
  if (!root) return;

  const glyphElements = field.targets.flatMap((selector) => {
    return Array.from(root.querySelectorAll(selector)).flatMap(wrapGlyphs);
  });
  if (glyphElements.length === 0) return;

  const particles = glyphElements.map((element) => {
    const owner = element.closest(".text-physics-text");
    const maxDisplacement = owner.matches(".btn")
      ? CONTROL_MAX_DISPLACEMENT
      : owner.matches(".private-surfaces-label")
        ? STATUS_MAX_DISPLACEMENT
        : MAX_DISPLACEMENT;
    return {
      element,
      owner,
      maxDisplacement,
      homePageX: 0,
      homePageY: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 4,
    };
  });

  const pointer = {
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  };

  let frameId = null;
  let resizeFrame = null;
  let settleDeadline = 0;
  let layoutWidth = window.innerWidth;

  function resetParticles() {
    particles.forEach((particle) => {
      particle.x = 0;
      particle.y = 0;
      particle.vx = 0;
      particle.vy = 0;
      particle.element.style.transform = "";
    });
  }

  function cacheHomes() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    particles.forEach((particle) => {
      particle.element.style.transform = "";
      particle.x = 0;
      particle.y = 0;
      particle.vx = 0;
      particle.vy = 0;
    });

    particles.forEach((particle) => {
      const rect = particle.element.getBoundingClientRect();
      particle.homePageX = rect.left + rect.width / 2 + scrollX;
      particle.homePageY = rect.top + rect.height / 2 + scrollY;
      particle.radius = clamp(Math.min(rect.width, rect.height) * 0.42, 3, 15);
    });
  }

  function currentX(particle) {
    return particle.homePageX - window.scrollX + particle.x;
  }

  function currentY(particle) {
    return particle.homePageY - window.scrollY + particle.y;
  }

  function clampParticle(particle) {
    const displacement = Math.hypot(particle.x, particle.y);
    if (displacement <= particle.maxDisplacement) return;
    const scale = particle.maxDisplacement / displacement;
    particle.x *= scale;
    particle.y *= scale;
  }

  function spatialGrid() {
    const grid = new Map();
    particles.forEach((particle, index) => {
      const column = Math.floor(currentX(particle) / GRID_SIZE);
      const row = Math.floor(currentY(particle) / GRID_SIZE);
      const key = `${column}:${row}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(index);
    });
    return grid;
  }

  function resolveGlyphCollisions() {
    const grid = spatialGrid();
    particles.forEach((particle, index) => {
      const px = currentX(particle);
      const py = currentY(particle);
      const column = Math.floor(px / GRID_SIZE);
      const row = Math.floor(py / GRID_SIZE);

      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const nearby = grid.get(`${column + offsetX}:${row + offsetY}`) || [];
          nearby.forEach((otherIndex) => {
            if (otherIndex <= index) return;
            const other = particles[otherIndex];
            if (other.owner !== particle.owner) return;
            const dx = currentX(other) - px;
            const dy = currentY(other) - py;
            const minimum = particle.radius + other.radius + 0.75;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= minimum * minimum) return;

            const distance = Math.sqrt(distanceSquared) || 0.001;
            const nx = dx / distance;
            const ny = dy / distance;
            const correction = (minimum - distance) * 0.5;
            particle.x -= nx * correction;
            particle.y -= ny * correction;
            other.x += nx * correction;
            other.y += ny * correction;

            const relativeVelocity = (other.vx - particle.vx) * nx +
              (other.vy - particle.vy) * ny;
            if (relativeVelocity < 0) {
              const impulse = relativeVelocity * COLLISION_RESTITUTION;
              particle.vx += nx * impulse;
              particle.vy += ny * impulse;
              other.vx -= nx * impulse;
              other.vy -= ny * impulse;
            }
          });
        }
      }
    });
  }

  function scheduleFrame() {
    if (frameId === null) frameId = requestAnimationFrame(renderFrame);
  }

  function renderFrame() {
    frameId = null;
    if (!pointer.active && settleDeadline > 0 && performance.now() >= settleDeadline) {
      settleDeadline = 0;
      resetParticles();
      return;
    }
    let moving = false;

    particles.forEach((particle) => {
      if (pointer.active) {
        const dx = currentX(particle) - pointer.x;
        const dy = currentY(particle) - pointer.y;
        const minimum = POINTER_RADIUS + particle.radius;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < minimum * minimum) {
          const distance = Math.sqrt(distanceSquared) || 0.001;
          const overlap = 1 - distance / minimum;
          const nx = distance > 0.01 ? dx / distance : 1;
          const ny = distance > 0.01 ? dy / distance : 0;
          particle.vx += nx * overlap * POINTER_FORCE * minimum + pointer.vx * overlap * POINTER_MOMENTUM;
          particle.vy += ny * overlap * POINTER_FORCE * minimum + pointer.vy * overlap * POINTER_MOMENTUM;
        }
      }

      particle.vx += -particle.x * SPRING;
      particle.vy += -particle.y * SPRING;
      particle.vx *= DAMPING;
      particle.vy *= DAMPING;
      particle.x += particle.vx;
      particle.y += particle.vy;

      clampParticle(particle);
    });

    // Two bounded passes keep overlapping glyphs apart without an O(n²) scan.
    resolveGlyphCollisions();
    resolveGlyphCollisions();
    particles.forEach(clampParticle);

    particles.forEach((particle) => {
      particle.element.style.transform =
        `translate3d(${particle.x.toFixed(2)}px, ${particle.y.toFixed(2)}px, 0)`;
      const displacement = Math.hypot(particle.x, particle.y);
      const speed = Math.hypot(particle.vx, particle.vy);
      const displaced = displacement > (pointer.active ? 0.08 : 1.5);
      const hasVelocity = speed > (pointer.active ? 0.03 : 0.1);
      if (hasVelocity || (!pointer.active && displaced)) {
        moving = true;
      }
    });

    if (moving) {
      scheduleFrame();
    } else if (!pointer.active) {
      settleDeadline = 0;
      resetParticles();
    }
  }

  function updatePointer(x, y) {
    const now = performance.now();
    if (pointer.lastTime === 0) {
      pointer.vx = 0;
      pointer.vy = 0;
    } else {
      const elapsed = Math.max(8, now - pointer.lastTime);
      pointer.vx = clamp((x - pointer.lastX) / elapsed * 16, -24, 24);
      pointer.vy = clamp((y - pointer.lastY) / elapsed * 16, -24, 24);
    }
    pointer.x = x;
    pointer.y = y;
    pointer.lastX = x;
    pointer.lastY = y;
    pointer.lastTime = now;
    pointer.active = true;
    settleDeadline = 0;
    scheduleFrame();
  }

  function releasePointer() {
    pointer.active = false;
    pointer.vx = 0;
    pointer.vy = 0;
    pointer.lastTime = 0;
    settleDeadline = performance.now() + 1800;
    scheduleFrame();
  }

  root.addEventListener("pointermove", (event) => {
    // Touch has its own passive path below so native scrolling remains in
    // charge even after the browser promotes the gesture into a pan.
    if (event.pointerType === "touch") return;
    updatePointer(event.clientX, event.clientY);
  }, { passive: true });

  root.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    releasePointer();
  }, { passive: true });

  function handlePointerCancel(event) {
    // Browsers emit pointercancel when a touch becomes native scrolling. The
    // touch stream continues independently, so releasing here creates the
    // visible snap/restart cycle users perceive as twitching.
    if (event.pointerType === "touch") return;
    releasePointer();
  }

  root.addEventListener("pointercancel", handlePointerCancel, { passive: true });

  root.addEventListener("touchstart", (event) => {
    if (event.touches.length > 0) {
      updatePointer(event.touches[0].clientX, event.touches[0].clientY);
    }
  }, { passive: true });

  root.addEventListener("touchmove", (event) => {
    if (event.touches.length > 0) {
      updatePointer(event.touches[0].clientX, event.touches[0].clientY);
    }
  }, { passive: true });

  root.addEventListener("touchend", (event) => {
    if (event.touches.length === 0) releasePointer();
  }, { passive: true });

  root.addEventListener("touchcancel", releasePointer, { passive: true });

  window.addEventListener("scroll", () => {
    // During a vertical swipe the finger stays in viewport coordinates while
    // the document moves underneath it. Re-render against the new scroll
    // offset even when a browser coalesces or pauses touchmove delivery.
    if (pointer.active) scheduleFrame();
  }, { passive: true });

  window.addEventListener("resize", () => {
    // Mobile browser chrome opening/closing changes only viewport height. Text
    // layout has not changed, and recaching here resets every displaced glyph
    // mid-swipe. Width changes still represent a real reflow/orientation event.
    if (window.innerWidth === layoutWidth) return;
    layoutWidth = window.innerWidth;
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      pointer.active = false;
      settleDeadline = 0;
      cacheHomes();
    });
  });

  cacheHomes();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(cacheHomes);
  }
}

export function initTextPhysics() {
  if (prefersReducedMotion) return;
  TEXT_PHYSICS_FIELDS.forEach(initPhysicsField);
}
