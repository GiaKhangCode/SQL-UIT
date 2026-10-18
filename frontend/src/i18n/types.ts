export type Language = "vi" | "en";
export type TranslationScope = "common" | "student" | "teacher" | "admin" | "auth" | "workspace";
export type Dictionary = Readonly<Record<string, string>>;
export type TranslationValues = Record<string, unknown>;
export type Translator = <T>(text: T, values?: TranslationValues) => T;
