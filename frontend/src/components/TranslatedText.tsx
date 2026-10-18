import { createElement, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { LanguageMotionContext } from "../context/LanguageMotionContext";
import "./TranslatedText.css";

/** Wrap presentation text only. Never use inside native options or code editors. */
export function TranslatedText({ children, resize = false }: { children: ReactNode; resize?: boolean }) {
  const motion = useContext(LanguageMotionContext);
  const element = useRef<HTMLElement>(null);
  const hasText = typeof children === "string" && children.length > 0;
  const shortText = hasText && children.length < 80 && !children.includes("\n");
  useLayoutEffect(() => {
    if (!element.current || !motion || !hasText) return;
    const node = element.current;
    const shortControl = !!node.closest("button, a.button, .global-header nav a");
    return motion.register(node, shortText && (resize || shortControl));
  }, [motion, resize, hasText, shortText]);
  if (!hasText) return <>{children}</>;
  // Inert custom tags avoid existing rules such as `label span` and `td span`.
  // The real text stays in one accessible DOM tree throughout the transition.
  return createElement("i18n-text", { ref: element, class: "i18n-motion-text" },
    createElement("i18n-content", { class: "i18n-motion-content" }, children));
}
