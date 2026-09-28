export async function readContestMarkdown(file: Pick<File, "name" | "size" | "text">): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".md")) throw new Error("Choose a Markdown (.md) file.");
  if (file.size > 256 * 1024) throw new Error("Markdown files must be smaller than 256 KB.");
  return file.text();
}
