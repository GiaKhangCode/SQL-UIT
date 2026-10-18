// Lucian UX/UI Prompt #267 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#267
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useLanguage, type Language } from "../context/LanguageContext";
import "./LanguageSwitch.css";
import { TranslatedText } from "./TranslatedText";

/** Short-label adapter; page and header text now share one transition clock. */
export function LanguageText({ text }: { text: string; order?: number }) {
  const { t } = useLanguage();
  return <TranslatedText resize>{t(text)}</TranslatedText>;
}

const languages: { code: Language; label: string; short: string }[] = [
  { code: "vi", label: "Tiếng Việt", short: "VI" },
  { code: "en", label: "English", short: "EN" },
];

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>(`[data-language="${language}"]`)?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, language]);
  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const options = [...root.current!.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]")];
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    }
  }
  return <div className={`u267-language${open ? " is-open" : ""}`} ref={root} onKeyDown={onKey}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="u267-trigger" aria-label={t("Choose language")}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Globe2 size={16} aria-hidden="true" /><span>{language.toUpperCase()}</span><ChevronDown size={12} aria-hidden="true" />
    </button>
    <div id={id} className="u267-dropdown" role="menu" aria-label={t("Choose language")} hidden={!open}>
      {languages.map(item => <button type="button" key={item.code} data-language={item.code} role="menuitemradio"
        aria-checked={item.code === language} lang={item.code} tabIndex={open ? 0 : -1}
        onClick={() => { setLanguage(item.code); setOpen(false); trigger.current?.focus(); }}>
        <span className="u267-code">{item.short}</span><span>{item.label}</span>
        {item.code === language && <Check size={14} aria-hidden="true" />}
      </button>)}
    </div>
    <span className="sr-only" role="status">{language === "vi" ? "Ngôn ngữ: Tiếng Việt" : "Language: English"}</span>
  </div>;
}
