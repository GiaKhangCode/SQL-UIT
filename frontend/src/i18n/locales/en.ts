import { vi } from "./vi";
import type { Dictionary, TranslationScope } from "../types";

// English source strings are also stable keys. Generate their identity catalog
// so adding a Vietnamese entry never leaves English without a matching key.
export const en = Object.fromEntries(Object.entries(vi).map(([scope, entries]) => [
  scope, Object.fromEntries(Object.keys(entries).map(key => [key, key])),
])) as Record<TranslationScope, Dictionary>;
