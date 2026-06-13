/**
 * Breaking news rotator — one chip at a time, auto-advance, swipe, reduced-motion fallback.
 * No marquee. Mount on #breakingNews after HTML is present (SSR or client render).
 */
(function initBreakingRotatorModule(global) {
  const MOBILE_MS = 5500;
  const DESKTOP_MS = 6500;
  const SWIPE_PX = 40;
  const STATIC_MAX = 3;
  const MAX_DOTS = 5;

  function prefersReducedMotion() {
    return global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isDesktop() {
    return global.matchMedia("(min-width: 769px)").matches;
  }

  function intervalMs() {
    return isDesktop() ? DESKTOP_MS : MOBILE_MS;
  }

  function destroyInstance(root) {
    const inst = root && root._breakingRotator;
    if (!inst) return;
    if (inst.timer) clearInterval(inst.timer);
    root._breakingRotator = null;
  }

  function setPaused(root, paused) {
    const inst = root._breakingRotator;
    if (!inst || inst.reducedMotion || inst.count <= 1) return;
    inst.paused = paused;
  }

  function goTo(root, index, animate) {
    const inst = root._breakingRotator;
    if (!inst || inst.count <= 1) return;

    const next =
      ((index % inst.count) + inst.count) % inst.count;
    inst.index = next;

    const track = root.querySelector(".breaking-rotator__track");
    if (track) {
      track.style.transition = animate === false ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = `translateX(-${next * 100}%)`;
      if (animate === false) {
        requestAnimationFrame(() => {
          track.style.transition = "";
        });
      }
    }

    root.querySelectorAll(".breaking-rotator__dot").forEach((dot, i) => {
      const active = i === next;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });

    const overflow = root.querySelector(".breaking-rotator__dots-more");
    if (overflow) {
      overflow.hidden = next < MAX_DOTS;
    }

    root.querySelectorAll(".breaking-rotator__chip").forEach((chip, i) => {
      chip.setAttribute("aria-hidden", i === next ? "false" : "true");
      chip.tabIndex = i === next ? 0 : -1;
    });
  }

  function schedule(root) {
    const inst = root._breakingRotator;
    if (!inst || inst.reducedMotion || inst.count <= 1) return;
    if (inst.timer) clearInterval(inst.timer);
    inst.timer = setInterval(() => {
      if (!inst.paused) goTo(root, inst.index + 1, true);
    }, intervalMs());
  }

  function bindControls(root) {
    const inst = root._breakingRotator;
    if (!inst || inst.bound) return;
    inst.bound = true;

    root.querySelector(".breaking-rotator__arrow--prev")?.addEventListener("click", () => {
      goTo(root, inst.index - 1, true);
      schedule(root);
    });

    root.querySelector(".breaking-rotator__arrow--next")?.addEventListener("click", () => {
      goTo(root, inst.index + 1, true);
      schedule(root);
    });

    root.querySelectorAll(".breaking-rotator__dot").forEach((dot) => {
      dot.addEventListener("click", () => {
        const idx = Number(dot.dataset.index);
        if (!Number.isNaN(idx)) {
          goTo(root, idx, true);
          schedule(root);
        }
      });
    });

    root.addEventListener("mouseenter", () => setPaused(root, true));
    root.addEventListener("mouseleave", () => setPaused(root, false));
    root.addEventListener("focusin", () => setPaused(root, true));
    root.addEventListener("focusout", (e) => {
      if (!root.contains(e.relatedTarget)) setPaused(root, false);
    });

    let touchX = 0;
    root.addEventListener(
      "touchstart",
      (e) => {
        touchX = e.changedTouches[0]?.clientX ?? 0;
        setPaused(root, true);
      },
      { passive: true }
    );
    root.addEventListener(
      "touchend",
      (e) => {
        const endX = e.changedTouches[0]?.clientX ?? 0;
        const diff = endX - touchX;
        if (Math.abs(diff) >= SWIPE_PX) {
          goTo(root, inst.index + (diff < 0 ? 1 : -1), true);
          schedule(root);
        }
        setPaused(root, false);
      },
      { passive: true }
    );
    root.addEventListener("touchcancel", () => setPaused(root, false), { passive: true });

    global.addEventListener("resize", () => {
      if (!root.isConnected) {
        destroyInstance(root);
        return;
      }
      goTo(root, inst.index, false);
      schedule(root);
    });
  }

  function mount(root) {
    if (!root) return;
    destroyInstance(root);

    const staticMode = root.classList.contains("breaking-rotator--static");
    const chips = root.querySelectorAll(".breaking-rotator__chip");
    const count = chips.length;
    if (!count) return;

    root._breakingRotator = {
      index: 0,
      count,
      paused: false,
      reducedMotion: staticMode,
      timer: null,
      bound: false
    };

    if (staticMode || count <= 1) {
      root.classList.toggle("breaking-rotator--single", count === 1);
      if (count === 1) {
        chips[0].setAttribute("aria-hidden", "false");
      }
      return;
    }

    bindControls(root);
    goTo(root, 0, false);
    schedule(root);
  }

  global.BreakingRotator = {
    mount,
    destroy: destroyInstance,
    STATIC_MAX,
    MAX_DOTS
  };
})(window);
