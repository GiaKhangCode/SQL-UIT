import { storage } from "./storage";
export type ProblemList = { id: string; name: string; problemIds: string[] };
export function getProblemLists(): ProblemList[] {
  try {
    const value: unknown = JSON.parse(
      storage.get("sql-practice:lists") || "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (item): item is ProblemList =>
            item &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            Array.isArray(item.problemIds) &&
            item.problemIds.every((id: unknown) => typeof id === "string"),
        )
      : [];
  } catch {
    return [];
  }
}
export function createProblemList(name: string, problemIds: string[]) {
  const next = [
    ...getProblemLists(),
    {
      id: "list-" + Date.now(),
      name: name.trim(),
      problemIds: [...new Set(problemIds)],
    },
  ];
  storage.set("sql-practice:lists", JSON.stringify(next));
  return next;
}
export function getFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(
      storage.get("sql-practice:favorites") || "[]",
    );
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
export function toggleFavorite(id: string) {
  const ids = getFavorites();
  const next = ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [...ids, id];
  storage.set("sql-practice:favorites", JSON.stringify(next));
  return next.includes(id);
}
export function calculateStreak(days: string[], today: string) {
  const ordered = [...new Set(days)].filter((day) => day <= today).sort();
  const dayNumber = (day: string) => Date.parse(day + "T00:00:00Z") / 86400000;
  let best = 0,
    run = 0,
    previous = -Infinity;
  for (const day of ordered) {
    const current = dayNumber(day);
    run = current - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = current;
  }
  const complete = ordered.includes(today);
  const latest = ordered[ordered.length - 1];
  return {
    current: latest && dayNumber(today) - dayNumber(latest) <= 1 ? run : 0,
    best,
    complete,
  };
}
