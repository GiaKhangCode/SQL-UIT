import { createContext, type Context } from "react";

// Preserve context identity when Vite refreshes a provider module. Otherwise
// already-mounted consumers can stay attached to its previous context object.
const contexts: Map<string, Context<unknown>> = import.meta.hot
  ? (import.meta.hot.data.sqluitContexts ??= new Map())
  : new Map();

export function createStableContext<T>(name: string, initial: T): Context<T> {
  const existing = contexts.get(name);
  if (existing) return existing as Context<T>;
  const context = createContext(initial);
  context.displayName = name;
  contexts.set(name, context as Context<unknown>);
  return context;
}
