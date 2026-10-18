import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createStableContext } from "./stableContext";
import { storage } from "../services/storage";
import { createTranslator, languageConfig, type Language, type TranslationScope, type Translator } from "../i18n";
import { createDomLanguageMotion } from "../i18n/motion";
import { LanguageMotionContext } from "./LanguageMotionContext";
export type { Language } from "../i18n";

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  locale: string;
  t: Translator;
};
const LanguageContext = createStableContext<LanguageState>("sqluit.language", {
  language: languageConfig.defaultLanguage,
  setLanguage: () => {},
  locale: languageConfig.locales.vi,
  t: createTranslator(languageConfig.defaultLanguage),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, commitLanguage] = useState<Language>(() => storage.get(languageConfig.storageKey) === "en" ? "en" : languageConfig.defaultLanguage);
  const committed = useRef(language);
  const motion = useMemo(() => createDomLanguageMotion(() => committed.current, commitLanguage), []);
  const setLanguage = useCallback((next: Language) => motion.request(next), [motion]);
  useLayoutEffect(() => { committed.current = language; motion.committed(language); }, [language, motion]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finishReduced = () => { if (reduced.matches) motion.finish(); };
    const finishHidden = () => { if (document.hidden) motion.finish(); };
    reduced.addEventListener("change", finishReduced);
    document.addEventListener("visibilitychange", finishHidden);
    return () => {
      reduced.removeEventListener("change", finishReduced);
      document.removeEventListener("visibilitychange", finishHidden);
      motion.dispose();
    };
  }, [motion]);
  useEffect(() => {
    document.documentElement.lang = language;
    storage.set(languageConfig.storageKey, language);
  }, [language]);
  const value = useMemo(() => ({
    language, setLanguage, locale: languageConfig.locales[language], t: createTranslator(language),
  }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}><LanguageMotionContext.Provider value={motion}>{children}</LanguageMotionContext.Provider></LanguageContext.Provider>;
}

export function useLanguage(scope: TranslationScope = "common"): LanguageState {
  const state = useContext(LanguageContext);
  const t = useMemo(() => createTranslator(state.language, scope), [state.language, scope]);
  return { ...state, t };
}
