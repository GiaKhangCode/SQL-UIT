import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createStableContext } from "./stableContext";
import { flushSync } from "react-dom";
import { storage } from "../services/storage";
import { createThemeReveal, type RevealPoint, type ThemeTransition } from "../utils/themeReveal";

type ThemeState = {
  dark: boolean;
  toggle: (origin?: RevealPoint) => void;
  setTheme: (theme: "light" | "dark", origin?: RevealPoint) => void;
};
const ThemeContext = createStableContext<ThemeState>("sqluit.theme", { dark: false, toggle: () => {}, setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => storage.get("sql-practice:theme") === "dark");
  const current = useRef(dark);
  const reveal = useMemo(() => createThemeReveal({
    current: () => current.current,
    apply: next => {
      current.current = next;
      flushSync(() => setDark(next));
      document.documentElement.dataset.theme = next ? "dark" : "light";
      storage.set("sql-practice:theme", next ? "dark" : "light");
    },
    supported: () => typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === "function",
    reduced: () => document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    reveal: (point, radius) => {
      const root = document.documentElement;
      root.style.setProperty("--u219-x", `${point.x}px`);
      root.style.setProperty("--u219-y", `${point.y}px`);
      root.style.setProperty("--u219-radius", `${radius}px`);
      root.classList.add("u219-theme-reveal");
    },
    clear: () => {
      const root = document.documentElement;
      root.classList.remove("u219-theme-reveal");
      ["--u219-x", "--u219-y", "--u219-radius"].forEach(key => root.style.removeProperty(key));
    },
    start: update => (document as unknown as { startViewTransition: (update: () => void) => ThemeTransition }).startViewTransition(update),
  }), []);
  useLayoutEffect(() => {
    current.current = dark;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    storage.set("sql-practice:theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () => { if (media.matches) reveal.finish(); };
    const hidden = () => { if (document.hidden) reveal.finish(); };
    media.addEventListener("change", reduced);
    document.addEventListener("visibilitychange", hidden);
    return () => { media.removeEventListener("change", reduced); document.removeEventListener("visibilitychange", hidden); reveal.dispose(); };
  }, [reveal]);
  const value = useMemo(() => ({ dark, toggle: reveal.toggle, setTheme: (theme: "light" | "dark", origin?: RevealPoint) => reveal.set(theme === "dark", origin) }), [dark, reveal]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
