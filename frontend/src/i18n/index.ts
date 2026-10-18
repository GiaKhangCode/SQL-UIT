import { vi } from "./locales/vi";
import { en } from "./locales/en";
import { messagePatterns } from "./messages";
import type { Language, TranslationScope, Translator } from "./types";
export type { Language, TranslationScope, Translator } from "./types";

export const catalogs = { vi, en };
export const languageConfig = {
  defaultLanguage: "vi" as Language,
  storageKey: "sql-practice:language",
  locales: { vi: "vi-VN", en: "en-US" },
};

const fallbacks = {
  vi: Object.assign({}, ...Object.values(vi)) as Record<string, string>,
  en: Object.assign({}, ...Object.values(en)) as Record<string, string>,
};

/** UI-only translation. Preserve numbers and React nodes passed by shared components. */
export function createTranslator(language: Language, scope: TranslationScope = "common"): Translator {
  return <T>(text: T, values?: Record<string, unknown>): T => {
    if (typeof text !== "string") return text;
    const entries = catalogs[language];
    let translated = entries[scope][text] ?? entries.common[text] ?? fallbacks[language][text];
    let parameters = values;
    if (translated === undefined && language !== "en") {
      for (const { key, names, pattern } of messagePatterns) {
        const match = pattern.exec(text);
        if (!match) continue;
        translated = entries[scope][key] ?? entries.common[key] ?? fallbacks[language][key];
        parameters = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
        break;
      }
    }
    return (translated ?? text).replace(/\{(\w+)\}/g, (token, key: string) => String(parameters?.[key] ?? token)) as T;
  };
}
