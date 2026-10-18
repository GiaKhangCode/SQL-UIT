import type { Language } from "./types";

export const languageMotion = {
  exitMs: 260,
  enterMs: 380,
  widthMs: 350,
  maxDelayMs: 90,
  maxLabels: 160,
} as const;

export type MotionPhase = "idle" | "out" | "in";
export type MotionLabel = {
  activate: (delay: number) => void;
  deactivate: () => void;
  width?: number;
  resize?: (oldWidth: number) => void;
};

type MotionPlatform = {
  current: () => Language;
  commit: (language: Language) => void;
  reduced: () => boolean;
  labels: () => MotionLabel[];
  phase: (phase: MotionPhase) => void;
  timer: (callback: () => void, delay: number) => number;
  clear: (id: number) => void;
};

/** One exit/entry clock per language change, independent of the label count. */
export function createLanguageMotion(platform: MotionPlatform) {
  let timer: number | undefined;
  let pending: Language | undefined;
  let entering: Language | undefined;
  let active: MotionLabel[] = [];
  function reset() {
    if (timer !== undefined) platform.clear(timer);
    timer = undefined;
    active.forEach(label => label.deactivate());
    active = [];
    platform.phase("idle");
  }
  function request(language: Language) {
    if (language === pending || language === entering) return;
    const queuedCommit = entering;
    reset();
    pending = undefined;
    entering = undefined;
    if (language === platform.current()) {
      // React may still be processing the preceding commit. Override its queued
      // state update when the user switches back before that render completes.
      if (queuedCommit !== undefined) platform.commit(language);
      return;
    }
    if (platform.reduced()) { platform.commit(language); return; }
    active = platform.labels().slice(0, languageMotion.maxLabels);
    if (!active.length) { platform.commit(language); return; }
    active.forEach((label, index) => label.activate(Math.min(Math.floor(index / 12) * 15, languageMotion.maxDelayMs)));
    pending = language;
    platform.phase("out");
    timer = platform.timer(() => {
      timer = undefined;
      pending = undefined;
      entering = language;
      platform.commit(language);
    }, languageMotion.exitMs + languageMotion.maxDelayMs);
  }
  // Called from the provider's layout effect after React has committed new text.
  function committed(language: Language) {
    if (entering !== language) return;
    active.forEach(label => { if (label.width !== undefined) label.resize?.(label.width); });
    platform.phase("in");
    entering = undefined;
    timer = platform.timer(reset, languageMotion.enterMs + languageMotion.maxDelayMs);
  }
  function finish() {
    const destination = pending;
    pending = undefined;
    entering = undefined;
    reset();
    if (destination !== undefined && destination !== platform.current()) platform.commit(destination);
  }
  return { request, committed, finish, dispose: () => { pending = undefined; entering = undefined; reset(); } };
}

/** A single observer tracks clipping by both viewport and scrollable tables. */
export function createDomLanguageMotion(current: () => Language, commit: (language: Language) => void) {
  const nodes = new Map<HTMLElement, boolean>();
  const animations = new Set<Animation>();
  let observer: IntersectionObserver | undefined;
  const motion = createLanguageMotion({
    current, commit,
    reduced: () => document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    timer: (callback, delay) => window.setTimeout(callback, delay),
    clear: id => window.clearTimeout(id),
    phase: phase => {
      document.documentElement.dataset.languageMotion = phase;
      if (phase === "idle") { animations.forEach(animation => animation.cancel()); animations.clear(); }
    },
    labels: () => {
      // Read layout as a batch before writing animation flags or widths.
      const visible = [...nodes].filter(([node, intersects]) => node.isConnected && intersects && !node.closest("[hidden], [aria-hidden='true'], .sr-only"));
      const measured = visible.map(([node]) => ({ node, bounds: node.getBoundingClientRect() }))
        .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight && bounds.right > 0 && bounds.left < window.innerWidth)
        .sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
      let nextWidths: Map<HTMLElement, number> | undefined;
      return measured.map(({ node, bounds }) => {
        const resize = node.hasAttribute("data-resize") && (node.textContent?.length ?? 0) < 80;
        return {
          width: resize ? bounds.width : undefined,
          activate: (delay: number) => {
            node.dataset.motionActive = "true";
            node.style.setProperty("--i18n-delay", `${delay}ms`);
          },
          deactivate: () => { delete node.dataset.motionActive; node.style.removeProperty("--i18n-delay"); },
          resize: (oldWidth: number) => {
            if (!node.isConnected || !node.animate) return;
            // Measure new control widths together, before starting any layout animation.
            nextWidths ??= new Map(measured.filter(({ node }) => node.isConnected && node.hasAttribute("data-resize"))
              .map(({ node }) => [node, node.getBoundingClientRect().width]));
            const newWidth = nextWidths.get(node) ?? oldWidth;
            if (Math.abs(newWidth - oldWidth) < 1) return;
            const animation = node.animate([{ width: `${oldWidth}px` }, { width: `${newWidth}px` }], {
              duration: languageMotion.widthMs, easing: "cubic-bezier(.3,1.3,.5,1)",
            });
            animations.add(animation);
          },
        };
      });
    },
  });
  function register(node: HTMLElement, resize: boolean) {
    if (resize) node.dataset.resize = "true";
    else delete node.dataset.resize;
    // Without IntersectionObserver, use viewport checks at switch time.
    nodes.set(node, typeof IntersectionObserver === "undefined");
    if (typeof IntersectionObserver !== "undefined") {
      observer ??= new IntersectionObserver(entries => {
        entries.forEach(entry => { if (nodes.has(entry.target as HTMLElement)) nodes.set(entry.target as HTMLElement, entry.isIntersecting); });
      });
      observer.observe(node);
    }
    return () => {
      observer?.unobserve(node);
      nodes.delete(node);
      if (!nodes.size) { observer?.disconnect(); observer = undefined; }
    };
  }
  return { ...motion, register };
}

export type LanguageMotionController = ReturnType<typeof createDomLanguageMotion>;
