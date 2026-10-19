// Stable solution IDs keep answers attached when questions are renamed or reordered.
export function readQuestionDrafts(script: string, ids: string[]): Record<string, string> {
  const markers = [...script.matchAll(/^-- solution:([^\r\n]+)\r?\n/gm)];
  if (!markers.length) return ids[0] ? { [ids[0]]: script } : {};
  return Object.fromEntries(markers.map((match, index) => [match[1], script.slice((match.index || 0) + match[0].length, markers[index + 1]?.index ?? script.length).trimEnd()]));
}
export function writeQuestionDrafts(answers: Record<string, string>, ids: string[]) {
  return ids.map(id => `-- solution:${id}\n${answers[id] || ""}`).join("\n\n");
}
