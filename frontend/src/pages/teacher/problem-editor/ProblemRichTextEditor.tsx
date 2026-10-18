import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Redo2, Undo2, Link2, Minus, Maximize2 } from "lucide-react";
import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function safeHref(value: string) {
  const href = value.trim();
  return /^(https?:|mailto:|\/|#)/i.test(href) ? href : "";
}

function inlineMarkdownToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\[font-size=(1[0-9]|20)\]([\s\S]*?)\[\/font-size\]/g, "<span style=\"font-size:$1px\">$2</span>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:|\/|#)[^)\s]+)\)/gi, (_match, label: string, href: string) => {
      return `<a href=\"${href}\" target=\"_blank\" rel=\"noopener noreferrer\">${label}</a>`;
    });
}

function markdownToHtml(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  const paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let codeLines: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      closeList();
      if (codeLines) {
        output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = null;
      } else codeLines = [];
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
    } else if (/^\s*---+\s*$/.test(line)) {
      flushParagraph(); closeList(); output.push("<hr>");
    } else if (bullet || numbered) {
      flushParagraph();
      const nextType = bullet ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${inlineMarkdownToHtml((bullet || numbered)![1])}</li>`);
    } else if (!line.trim()) {
      flushParagraph(); closeList();
    } else {
      closeList(); paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  if (codeLines) output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return output.join("") || "";
}

function htmlToMarkdown(html: string) {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstElementChild;
  if (!root) return "";

  const render = (node: Node, parentTag = ""): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/\u00a0/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "pre") return `\n\n\`\`\`\n${element.textContent || ""}\n\`\`\`\n\n`;
    const children = Array.from(element.childNodes).map((child) => render(child, tag)).join("");
    if (tag === "strong" || tag === "b") return `**${children}**`;
    if (tag === "em" || tag === "i") return `*${children}*`;
    if (tag === "code" && parentTag !== "pre") return `\`${children}\``;
    if (tag === "span" && element.style.fontSize) {
      const size = Math.round(parseFloat(element.style.fontSize));
      if (size >= 10 && size <= 20) return `[font-size=${size}]${children}[/font-size]`;
    }
    if (tag === "a") {
      const href = safeHref(element.getAttribute("href") || "");
      return href ? `[${children}](${href})` : children;
    }
    if (tag === "ul") return `${Array.from(element.children).map((child) => `- ${render(child).trim()}`).join("\n")}\n\n`;
    if (tag === "ol") return `${Array.from(element.children).map((child, index) => `${index + 1}. ${render(child).trim()}`).join("\n")}\n\n`;
    if (tag === "li") return children;
    if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${children}\n\n`;
    if (tag === "p" || tag === "div") return `${children}\n\n`;
    return children;
  };

  return render(root).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getTextSize(editor: HTMLElement, selection: Selection | null): number | "mixed" | null {
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  const sizes = new Set<number>();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    if (textNode.textContent?.trim() && range.intersectsNode(textNode)) {
      const size = Math.round(parseFloat(window.getComputedStyle(textNode.parentElement || editor).fontSize));
      if (size) sizes.add(size);
    }
    textNode = walker.nextNode();
  }
  return sizes.size > 1 ? "mixed" : sizes.size === 1 ? [...sizes][0] : null;
}

type ProblemRichTextEditorProps = {
  value: string;
  label: string;
  onChange: (value: string) => void;
  onOpenExpanded: () => void;
  disabled?: boolean;
};

export function ProblemRichTextEditor({ value, label, onChange, onOpenExpanded, disabled = false }: ProblemRichTextEditorProps) {
  const { t } = useLanguage("teacher");
  const editorRef = useRef<HTMLDivElement>(null);
  const latestValueRef = useRef(value);
  const [selectedSize, setSelectedSize] = useState<number | "mixed" | null>(null);
  latestValueRef.current = value;
  const labels = {
    undo: t("Undo"), redo: t("Redo"), bold: t("Bold"), italic: t("Italic"), code: t("Inline code"),
    bullets: t("Bulleted list"), numbers: t("Numbered list"), heading2: t("Heading 2"), heading3: t("Heading 3"),
    link: t("Insert link"), rule: t("Horizontal rule"), decrease: t("Decrease selected text size"),
    increase: t("Increase selected text size"),
  };

  const syncFromValue = () => {
    const editor = editorRef.current;
    if (!editor || editor === document.activeElement) return;
    if (htmlToMarkdown(editor.innerHTML) !== latestValueRef.current) editor.innerHTML = markdownToHtml(latestValueRef.current);
  };

  useLayoutEffect(syncFromValue, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const updateSelection = () => setSelectedSize(getTextSize(editor, window.getSelection()));
    document.addEventListener("selectionchange", updateSelection);
    editor.addEventListener("keyup", updateSelection);
    editor.addEventListener("mouseup", updateSelection);
    editor.addEventListener("focus", updateSelection);
    return () => {
      document.removeEventListener("selectionchange", updateSelection);
      editor.removeEventListener("keyup", updateSelection);
      editor.removeEventListener("mouseup", updateSelection);
      editor.removeEventListener("focus", updateSelection);
    };
  }, []);

  const syncChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = htmlToMarkdown(editor.innerHTML);
    latestValueRef.current = next;
    onChange(next);
    setSelectedSize(getTextSize(editor, window.getSelection()));
  };

  const runCommand = (command: string, valueArg?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    document.execCommand(command, false, valueArg);
    syncChange();
  };

  const wrapInlineCode = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const code = document.createElement("code");
    code.appendChild(range.extractContents());
    range.insertNode(code);
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    syncChange();
  };

  const adjustTextSize = (delta: number) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as HTMLElement : range.startContainer.parentElement;
    const current = start ? parseFloat(window.getComputedStyle(start).fontSize) : 12;
    const span = document.createElement("span");
    span.style.fontSize = `${Math.max(10, Math.min(20, current + delta))}px`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    range.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(range);
    syncChange();
  };

  const insertLink = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const selected = selection?.toString() || "";
    const rawHref = window.prompt(t("Enter a link URL"), "https://");
    if (!rawHref) return;
    const href = safeHref(rawHref);
    if (!href) return;
    editor.focus({ preventScroll: true });
    if (!selected && selection?.rangeCount) {
      document.execCommand("insertText", false, href);
      const currentSelection = window.getSelection();
      if (currentSelection?.rangeCount) {
        const range = currentSelection.getRangeAt(0);
        range.setStart(range.startContainer, Math.max(0, range.startOffset - href.length));
        currentSelection.removeAllRanges();
        currentSelection.addRange(range);
      }
    }
    document.execCommand("createLink", false, href);
    syncChange();
  };

  const toolbarButton = (title: string, content: ReactNode, action: () => void, className = "") => (
    <button
      key={title}
      type="button"
      className={className}
      aria-label={title}
      title={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >{typeof content === "string" ? <TranslatedText>{content}</TranslatedText> : content}</button>
  );

  return (
    <div className="teacher-rich-text-field">
      <div className="teacher-markdown-toolbar teacher-markdown-toolbar-inline" role="toolbar" aria-label={t("Text formatting")}>
        {toolbarButton(labels.undo, <Undo2 size={15} />, () => runCommand("undo"))}
        {toolbarButton(labels.redo, <Redo2 size={15} />, () => runCommand("redo"))}
        <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
        {toolbarButton(labels.bold, <strong>B</strong>, () => runCommand("bold"))}
        {toolbarButton(labels.italic, <em>I</em>, () => runCommand("italic"))}
        {toolbarButton(labels.code, <code>&lt;/&gt;</code>, wrapInlineCode)}
        <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
        {toolbarButton(labels.bullets, "• List", () => runCommand("insertUnorderedList"))}
        {toolbarButton(labels.numbers, "1. List", () => runCommand("insertOrderedList"))}
        <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
        {toolbarButton(labels.heading2, "H2", () => runCommand("formatBlock", "<h2>"))}
        {toolbarButton(labels.heading3, "H3", () => runCommand("formatBlock", "<h3>"))}
        {toolbarButton(labels.link, <Link2 size={15} />, insertLink)}
        {toolbarButton(labels.rule, <Minus size={16} />, () => runCommand("insertHorizontalRule"))}
        <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
        <output className="teacher-markdown-toolbar-size" aria-live="polite" title={t("Selected text size")}>
          <TranslatedText>{selectedSize === "mixed" ? t("Mixed") : selectedSize ? `${selectedSize}px` : "—"}</TranslatedText>
        </output>
        {toolbarButton(labels.decrease, "A−", () => adjustTextSize(-1))}
        {toolbarButton(labels.increase, "A+", () => adjustTextSize(1))}
        <span className="teacher-markdown-toolbar-spacer" aria-hidden="true" />
        <button type="button" className="teacher-rich-text-expand" disabled={disabled} onClick={onOpenExpanded} aria-label={t("Open editor")} title={t("Open editor")}>
          <Maximize2 size={14} aria-hidden="true" /> <TranslatedText>{t("Open editor")}</TranslatedText>
        </button>
      </div>
      <div
        ref={editorRef}
        className="teacher-long-text-editor teacher-rich-text-editor teacher-problem-inline-editor"
        aria-label={label}
        aria-multiline="true"
        data-placeholder={t("Write here…")}
        contentEditable={!disabled}
        aria-disabled={disabled}
        role="textbox"
        suppressContentEditableWarning
        onInput={syncChange}
        onBlur={syncFromValue}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
          const key = event.key.toLowerCase();
          if (key === "b" || key === "i" || key === "z" || key === "y") {
            event.preventDefault();
            runCommand(key === "b" ? "bold" : key === "i" ? "italic" : key === "z" ? "undo" : "redo");
          }
        }}
      />
    </div>
  );
}
