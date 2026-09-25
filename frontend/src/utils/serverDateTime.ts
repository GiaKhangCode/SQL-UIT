// Assignment timestamps are stored as UTC. The API currently serializes some
// database values without a timezone suffix, so interpret those as UTC too.
export function parseServerDateTime(value: string): Date {
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

export function formatLocalDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localDate(value: string): string {
  return formatLocalDate(parseServerDateTime(value));
}

export function localTime(value: string): string {
  const date = parseServerDateTime(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toDateTimeLocal(value: string): string {
  return value ? `${localDate(value)}T${localTime(value)}` : "";
}

export function submissionTimeLabel(value: string): string {
  if (!value) return "Time unavailable";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return `${value} UTC`;
  const date = parseServerDateTime(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}
