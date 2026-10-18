// Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219
import { useEffect, useRef } from "react";
import { Globe2, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useLanguage, type Language } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import "./AppearanceSettings.css";

export function AppearanceSettings() {
  const { dark, toggle } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const icon = useRef<HTMLSpanElement>(null);
  const requestedLanguage = useRef(language);
  useEffect(() => { requestedLanguage.current = language; }, [language]);
  const languageName = language === "vi" ? "Tiếng Việt" : "English";
  return <div className="u219-settings">
    <small className="u219-heading"><TranslatedText>{t("Appearance")}</TranslatedText></small>
    <button type="button" className="u219-theme-toggle" aria-pressed={dark}
      aria-label={t(dark ? "Switch to light mode" : "Switch to dark mode")} onClick={() => {
        const bounds = icon.current?.getBoundingClientRect();
        toggle(bounds ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : undefined);
      }}>
      <span className="u219-theme-icon" ref={icon} data-dark={dark} aria-hidden="true"><Sun size={18} /><Moon size={18} /></span>
      <TranslatedText>{t(dark ? "Dark mode" : "Light mode")}</TranslatedText>
      <span className="u219-track" data-dark={dark} aria-hidden="true"><span /></span>
    </button>
    <button type="button" className="u219-language-toggle" aria-pressed={language === "en"}
      aria-label={t(language === "vi" ? "Switch to English" : "Switch to Vietnamese")} title={t("Language")}
      onClick={() => {
        const next: Language = requestedLanguage.current === "vi" ? "en" : "vi";
        requestedLanguage.current = next;
        setLanguage(next);
      }}>
      <Globe2 size={18} aria-hidden="true" />
      <span lang={language}><TranslatedText>{languageName}</TranslatedText></span>
      <span className="u219-track" data-dark={language === "en"} aria-hidden="true"><span /></span>
    </button>
  </div>;
}
