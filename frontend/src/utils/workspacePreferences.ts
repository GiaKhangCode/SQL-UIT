import { storage } from "../services/storage";
export const layouts = ["Default", "Leet", "Note-taking", "Debug"] as const;
export type Layout = typeof layouts[number];
export type PaneSizes = { problemWidth: number; secondBoundary: number; editorHeight: number };
export const defaults: Record<Layout, PaneSizes> = {
  Default: { problemWidth: 28, secondBoundary: 72, editorHeight: 58 },
  Leet: { problemWidth: 28, secondBoundary: 72, editorHeight: 58 },
  "Note-taking": { problemWidth: 28, secondBoundary: 76, editorHeight: 58 },
  Debug: { problemWidth: 28, secondBoundary: 72, editorHeight: 58 },
};
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}
function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
export function readLayouts(key: string) {
  let saved: any;
  try { saved = JSON.parse(storage.get(key) || "null"); } catch { saved = null; }
  const sizes = { ...defaults };
  for (const layout of layouts) {
    const value = saved?.sizes?.[layout];
    const secondBoundary = clamp(finite(value?.secondBoundary, defaults[layout].secondBoundary), 44, 82);
    sizes[layout] = {
      secondBoundary,
      problemWidth: clamp(finite(value?.problemWidth, defaults[layout].problemWidth), 18, layout === "Default" ? 50 : secondBoundary - 26),
      editorHeight: clamp(finite(value?.editorHeight, 58), 30, 75),
    };
  }
  return { layout: layouts.includes(saved?.layout) ? saved.layout as Layout : "Default" as Layout, sizes };
}
export type TimerState = { elapsed: number; startedAt: number | null };
export function readTimer(key: string): TimerState {
  try {
    const value = JSON.parse(storage.get(key) || "null");
    return { elapsed: Math.max(0, finite(value?.elapsed, 0)), startedAt: typeof value?.startedAt === "number" && Number.isFinite(value.startedAt) && value.startedAt > 0 ? value.startedAt : null };
  } catch { return { elapsed: 0, startedAt: null }; }
}
export function elapsedTime(timer: TimerState, now = Date.now()) {
  return timer.elapsed + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt));
}
export function toggleTimer(timer: TimerState, now = Date.now()): TimerState {
  return timer.startedAt === null ? { ...timer, startedAt: now } : { elapsed: elapsedTime(timer, now), startedAt: null };
}
export function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
}
export function workspaceKey(userId: string, problemId: string, kind: string) {
  return `sql-practice:workspace:${encodeURIComponent(userId)}:${encodeURIComponent(problemId)}:${kind}`;
}
