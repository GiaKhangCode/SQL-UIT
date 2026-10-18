import { sql, MSSQL } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, Prec } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { Decoration, EditorView, RectangleMarker, ViewPlugin, layer, type DecorationSet, type ViewUpdate } from "@codemirror/view";

const workspaceEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: 'Consolas, "JetBrains Mono", monospace',
    padding: "8px 0",
    lineHeight: "24px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--muted)",
    border: "none",
    padding: "0 8px 0 16px",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--accent)" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-matchingBracket": {
    backgroundColor: "var(--accent-subtle)",
    outline: "1px solid var(--accent)",
    color: "var(--text)",
  },
  ".cm-nonmatchingBracket": {
    backgroundColor: "var(--danger-subtle)",
    outline: "1px solid var(--danger)",
  },
  ".cm-contentSelectionBackground": { backgroundColor: "var(--selection)" },
  ".cm-scroller": { overflow: "auto" },
});

const workspaceSyntax = HighlightStyle.define([
  { tag: [tags.keyword, tags.bool, tags.null], class: "cm-ws-keyword" },
  { tag: [tags.name, tags.typeName], class: "cm-ws-name" },
  { tag: tags.standard(tags.name), class: "cm-ws-function" },
  { tag: tags.number, class: "cm-ws-number" },
  { tag: tags.string, class: "cm-ws-string" },
  { tag: tags.comment, class: "cm-ws-comment" },
  { tag: [tags.operator, tags.punctuation], class: "cm-ws-punctuation" },
]);

function selectedWhitespace(view: EditorView): DecorationSet {
  const marks = [];
  for (const selection of view.state.selection.ranges) {
    if (selection.empty) continue;
    for (const visible of view.visibleRanges) {
      const from = Math.max(selection.from, visible.from);
      const to = Math.min(selection.to, visible.to);
      if (from >= to) continue;
      const text = view.state.doc.sliceString(from, to);
      for (const match of text.matchAll(/[ \t]+/g)) {
        const start = from + match.index!;
        marks.push(Decoration.mark({ class: "cm-selected-space" }).range(start, start + match[0].length));
      }
    }
  }
  return Decoration.set(marks, true);
}

const selectionWhitespace = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = selectedWhitespace(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = selectedWhitespace(update.view);
    }
  }
}, { decorations: (plugin) => plugin.decorations });

const fittedSelection = layer({
  above: false,
  class: "cm-contentSelectionLayer",
  update: (update) => update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged,
  markers(view) {
    const markers: RectangleMarker[] = [];
    for (const selection of view.state.selection.ranges) {
      if (selection.empty) continue;
      for (const visible of view.visibleRanges) {
        const from = Math.max(selection.from, visible.from);
        const to = Math.min(selection.to, visible.to);
        if (from >= to) continue;
        let line = view.state.doc.lineAt(from);
        while (line.from < to) {
          const start = Math.max(from, line.from);
          const end = Math.min(to, line.to);
          const range = EditorSelection.range(start, end);
          for (const rectangle of RectangleMarker.forRange(view, "cm-contentSelectionBackground", range)) {
            const width = (rectangle.width ?? 0) + (to > line.to ? view.defaultCharacterWidth : 0);
            markers.push(new RectangleMarker("cm-contentSelectionBackground", rectangle.left, rectangle.top, width, rectangle.height));
          }
          if (line.number === view.state.doc.lines || line.to >= to) break;
          line = view.state.doc.line(line.number + 1);
        }
      }
    }
    return markers;
  },
});

export const sqlEditorExtensions = [
  sql({ dialect: MSSQL }),
  Prec.highest(workspaceEditorTheme),
  syntaxHighlighting(workspaceSyntax),
  selectionWhitespace,
  fittedSelection,
];

export function sqlEditorHeight(value: string, minimumLines = 2): string {
  const lines = Math.max(minimumLines, value.split("\n").length);
  return `${lines * 24 + 16}px`;
}
