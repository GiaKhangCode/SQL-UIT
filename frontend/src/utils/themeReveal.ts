export type RevealPoint = { x: number; y: number };
export type ThemeTransition = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type Platform = {
  current: () => boolean;
  apply: (dark: boolean) => void;
  supported: () => boolean;
  reduced: () => boolean;
  viewport: () => { width: number; height: number };
  reveal: (point: RevealPoint, radius: number) => void;
  clear: () => void;
  start: (update: () => void) => ThemeTransition;
};

export function revealGeometry(width: number, height: number, point?: RevealPoint) {
  const x = Math.max(0, Math.min(width, point?.x ?? width / 2));
  const y = Math.max(0, Math.min(height, point?.y ?? height / 2));
  return { x, y, radius: Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y))) + 1 };
}

/** Guard delayed snapshot callbacks so the latest click always wins. */
export function createThemeReveal(platform: Platform) {
  let generation = 0;
  let requested = platform.current();
  let active: ThemeTransition | undefined;
  function stop() { active?.skipTransition(); active = undefined; platform.clear(); }
  function set(dark: boolean, point?: RevealPoint) {
    if (dark === requested && (active || dark === platform.current())) return;
    requested = dark;
    const turn = ++generation;
    stop();
    if (dark === platform.current()) return;
    const update = () => { if (turn === generation) platform.apply(dark); };
    if (!platform.supported() || platform.reduced()) { update(); return; }
    const { width, height } = platform.viewport();
    const geometry = revealGeometry(width, height, point);
    platform.reveal(geometry, geometry.radius);
    try {
      const transition = platform.start(update);
      active = transition;
      void transition.ready.catch(() => {
        if (turn === generation) { update(); platform.clear(); }
      });
      void transition.finished.catch(() => {}).then(() => {
        if (turn === generation) { active = undefined; platform.clear(); }
      });
    } catch { update(); platform.clear(); }
  }
  function finish() {
    generation++;
    stop();
    if (requested !== platform.current()) platform.apply(requested);
  }
  return { set, toggle: (point?: RevealPoint) => set(!requested, point), finish, dispose: () => { generation++; stop(); } };
}
