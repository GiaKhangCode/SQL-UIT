import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { ProblemSqlEditor } from "./problem-editor/ProblemSqlEditor";
import { TeacherSqlSolutions, initialSqlSolutions } from "./problem-editor/TeacherSqlSolutions";
import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Dialog, ErrorState, Loading, Status } from "../../components/ui";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { teacherService, type TeacherDatabaseLibraryEntry } from "../../services/teacherService";
import { type TeacherProblem } from "../../data/teacherTypes";
import { TeacherField, TeacherSectionTitle } from "./TeacherPageParts";
import { parseDatabaseSchema } from "../../utils/parseDatabaseSchema";
import { parseSeedData } from "../../utils/parseSeedData";
import { Database, Download, Eye, Play, Plus, Table2, X } from "lucide-react";

import "../../styles/problem-workspace.css";
import { TeacherSchemaDiagram } from "./problem-editor/TeacherSchemaDiagram";
import { ProblemRichTextEditor } from "./problem-editor/ProblemRichTextEditor";

const MAX_HINTS = 3;

function DatasetDataPreview({ datasetNumber, seedData }: { datasetNumber: number; seedData: string }) {
  const { t: tr } = useLanguage("teacher");
  const tables = parseSeedData(seedData);
  const rowCount = tables.reduce((total, table) => total + table.rows.length, 0);

  return (
    <section className="teacher-dataset-preview" aria-label={tr("Dataset {value0} preview", { value0: datasetNumber })} aria-live="polite">
      <div className="teacher-dataset-preview-heading">
        <div className="teacher-dataset-preview-title"><Table2 size={15} aria-hidden="true" /><strong><TranslatedText>{tr("Dataset {value0} preview", { value0: datasetNumber })}</TranslatedText></strong></div>
        {tables.length > 0 && <span><TranslatedText>{tr("{value0} tables · {value1} rows", { value0: tables.length, value1: rowCount })}</TranslatedText></span>}
      </div>
      {tables.length > 0 ? (
        <div className="teacher-dataset-preview-tables">
          {tables.map((table, tableIndex) => (
            <section className="teacher-dataset-preview-table-card" key={`${table.name}-${tableIndex}`}>
              <div className="teacher-dataset-preview-table-title"><h4>{table.name}</h4><span><TranslatedText>{tr("{value0} rows", { value0: table.rows.length })}</TranslatedText></span></div>
              <div className="teacher-dataset-preview-scroll">
                <table>
                  <thead><tr>{table.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
                  <tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${table.columns[columnIndex]}-${columnIndex}`}>{value}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="teacher-dataset-preview-empty"><TranslatedText>{tr("No INSERT rows to preview in this dataset.")}</TranslatedText></p>
      )}
    </section>
  );
}

function databaseLibraryDatasets(entry: TeacherDatabaseLibraryEntry) {
  const fallbackName = entry.title.toLowerCase().replace(/đ/g, "d").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") || "database";
  return Array.isArray(entry.datasets) && entry.datasets.length
    ? entry.datasets
    : [{ fileName: entry.insertIntoFileName || `${fallbackName}_insertdata.sql`, sql: entry.insertIntoSql || "" }];
}

function parseProblemTopics(value: unknown): string[] {
  const topics = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,·]+/)
      : [];

  return [...new Set(topics.map((topic) => String(topic).trim()).filter(Boolean))];
}

function problemPayloadWasSaved(data: any, payload: any) {
  const actualTopics = parseProblemTopics(data?.topics ?? data?.topic).join("|");
  const expectedTopics = parseProblemTopics(payload?.topics).join("|");
  const actualHints = typeof data?.hint === "string" && data.hint ? data.hint.split("\n") : [];
  const expectedHints = Array.isArray(payload?.hints) ? payload.hints : [];
  const actualTestCases = Array.isArray(data?.testCases) ? data.testCases : [];
  const expectedTestCases = Array.isArray(payload?.testCases) ? payload.testCases : [];
  const testCasesMatch = actualTestCases.length === expectedTestCases.length && expectedTestCases.every((expected: any, index: number) => {
    const actual = actualTestCases[index] || {};
    return (actual.schema || "") === (expected.schema || payload.schema || "")
      && (actual.seedData || "") === (expected.seedData || "")
      && Boolean(actual.isHidden) === Boolean(expected.isHidden);
  });

  return data?.title === payload?.title
    && data?.number === payload?.number
    && data?.difficulty === payload?.difficulty
    && Boolean(data?.practiceListed) === (payload?.visibility === "Public")
    && actualTopics === expectedTopics
    && data?.description === payload?.statement
    && data?.requirements === payload?.requirements
    && actualHints.join("\n") === expectedHints.join("\n")
    && (data?.databaseType || "") === (payload?.database || "")
    && (data?.schema || "") === (payload?.schema || "")
    && (data?.schemaFileName || "database.sql") === (payload?.schemaFileName || "database.sql")
    && (data?.referenceSolution || "") === (payload?.referenceSolution || "")
    && JSON.stringify(data?.sqlSolutions || []) === JSON.stringify(payload?.sqlSolutions || [])
    && testCasesMatch;
}

function escapeEditorHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function fontSizeMarkersToEditorHtml(value: string) {
  const tokenPattern = /\[font-size=(\d{2})\]|\[\/font-size\]/g;
  const openSizes: string[] = [];
  let output = "";
  let cursor = 0;
  let match = tokenPattern.exec(value);

  while (match) {
    output += value.slice(cursor, match.index);
    if (match[1]) {
      openSizes.push(match[1]);
      output += `<span style="font-size:${match[1]}px">`;
    } else if (openSizes.length) {
      openSizes.pop();
      output += "</span>";
    } else {
      output += match[0];
    }
    cursor = match.index + match[0].length;
    match = tokenPattern.exec(value);
  }

  output += value.slice(cursor);
  if (openSizes.length) output += "</span>".repeat(openSizes.length);
  return output;
}

function markdownInlineToEditorHtml(value: string) {
  return fontSizeMarkersToEditorHtml(escapeEditorHtml(value))
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:|mailto:|\/|#)[^)\s]+)\)/gi, (_match, label: string, href: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`);
}

function markdownToEditorHtml(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  const paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${markdownInlineToEditorHtml(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${markdownInlineToEditorHtml(heading[2])}</h${level}>`);
    } else if (/^\s*---+\s*$/.test(line)) {
      flushParagraph();
      closeList();
      output.push("<hr>");
    } else if (bullet || numbered) {
      flushParagraph();
      const nextType = bullet ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${markdownInlineToEditorHtml((bullet || numbered)?.[1] || "")}</li>`);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      return;
    }

    if (listType) closeList();
    paragraph.push(line.trim());
  });

  flushParagraph();
  closeList();
  return output.join("") || "<p><br></p>";
}

function editorHtmlToMarkdown(html: string) {
  const documentRoot = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstElementChild;
  if (!documentRoot) return "";

  const render = (node: Node, parentTag = ""): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/\u00a0/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (tag === "hr") return "\n\n---\n\n";
    const children = Array.from(element.childNodes).map((child) => render(child, tag)).join("");
    if (tag === "br") return "\n";
    if (tag === "strong" || tag === "b") return `**${children}**`;
    if (tag === "em" || tag === "i") return `*${children}*`;
    if (tag === "span" && element.style.fontSize) {
      const size = Math.round(parseFloat(element.style.fontSize));
      if (size >= 10 && size <= 20) return `[font-size=${size}]${children}[/font-size]`;
    }
    if (tag === "code" && parentTag !== "pre") return `\`${children}\``;
    if (tag === "pre") return "```\n" + (element.textContent || "") + "\n```\n\n";
    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      return /^(https?:|mailto:|\/|#)/i.test(href) ? `[${children}](${href})` : children;
    }
    if (tag === "ul") {
      return `${Array.from(element.children).map((child) => `- ${render(child).trim()}`).join("\n")}\n\n`;
    }
    if (tag === "ol") {
      return `${Array.from(element.children).map((child, index) => `${index + 1}. ${render(child).trim()}`).join("\n")}\n\n`;
    }
    if (tag === "li") return children;
    if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${children}\n\n`;
    if (["p", "div"].includes(tag)) return `${children}\n\n`;
    return children;
  };

  return render(documentRoot)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getSelectedTextSize(editor: HTMLElement, selection: Selection | null): number | "mixed" | null {
  if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;

  const sizes = new Set<number>();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    if (textNode.textContent?.trim() && range.intersectsNode(textNode)) {
      const parent = textNode.parentElement;
      const size = parent ? Math.round(parseFloat(window.getComputedStyle(parent).fontSize)) : 0;
      if (size) sizes.add(size);
    }
    textNode = walker.nextNode();
  }

  if (!sizes.size) return null;
  if (sizes.size > 1) return "mixed";
  return [...sizes][0];
}

export function ProblemEditorPage() {
  const { t: tr } = useLanguage("teacher");
  const { problemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedId = problemId || "new";
  const [problem, setProblem] = useState<TeacherProblem | null>(null);
  const [loadError, setLoadError] = useState("");
  const [disabledHints, setDisabledHints] = useState<Set<number>>(new Set());
  const [databaseTab, setDatabaseTab] = useState<"schema" | "datasets" | "solution">("schema");
  const [libraryImportOpen, setLibraryImportOpen] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<TeacherDatabaseLibraryEntry[]>([]);
  const [libraryPreviewEntryId, setLibraryPreviewEntryId] = useState<string | null>(null);
  const [libraryPreviewDatasetIndex, setLibraryPreviewDatasetIndex] = useState(0);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [schemaDiagram, setSchemaDiagram] = useState<{ source: string; tables: ReturnType<typeof parseDatabaseSchema> } | null>(null);
  
  useEffect(() => {
    async function fetchProblem() {
      setDisabledHints(new Set());
      setSchemaDiagram(null);
      setSaveState("");
      markSaved();
      try {
        if (selectedId === "new") {
          const allProblems = await teacherService.getAllProblems();
          let maxNum = 0;
          allProblems.forEach((p: any) => {
            const num = parseInt(p.number, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          });
          const nextNumber = String(maxNum + 1).padStart(3, '0');
          
          setProblem({ 
            id: "new",
            workspaceParts: ["SQL"],
            number: nextNumber, 
            title: "",
            difficulty: "Easy",
            visibility: "Private", 
            topics: "", 
            database: "SQL Server",
            schemaFileName: "database.sql",
            statement: "",
            requirements: "",
            hints: [],
            schema: "",
            seedData: "",
            seedSummary: "",
            referenceSolution: "",
            sqlSolutions: initialSqlSolutions(),
            expectedOutputs: [],
            expectedOutputVisible: true,
            expectedColumns: [],
            expectedRows: [],
            testCases: [{ seedData: "", isHidden: false }]
          });
          return;
        }

        const data = await teacherService.getProblem(selectedId);
        const loadedTopics = parseProblemTopics(data.topics?.length ? data.topics : data.topic);
        setDisabledHints(new Set());
        setProblem({
          id: data.id,
          workspaceParts: Array.isArray(data.workspaceParts) ? data.workspaceParts : ["SQL"],
          number: data.number || "000",
          title: data.title || "",
          difficulty: data.difficulty || "Easy",
          topics: loadedTopics.join(", "),
          visibility: data.practiceListed ? "Public" : "Private",
          database: data.databaseType || "SQL Server",
          schemaFileName: data.schemaFileName || "database.sql",
          statement: data.description || "",
          requirements: data.requirements || "",
          hints: data.hint ? data.hint.split('\n') : [],
          schema: data.schema || "",
          seedData: data.seedData || "",
          seedSummary: "",
          referenceSolution: data.referenceSolution || "",
          sqlSolutions: initialSqlSolutions(data.sqlSolutions, data.referenceSolution || ""),
          expectedOutputs: Array.isArray(data.expectedOutputs)
            ? data.expectedOutputs
            : data.expected ? [data.expected] : [],
          expectedOutputVisible: data.expectedOutputVisible !== false,
          testCases: data.testCases && data.testCases.length > 0 ? data.testCases : [{ seedData: data.seedData || "", isHidden: false }],
          expectedColumns: [],
          expectedRows: []
        });
        setSaveState("Saved");
      } catch(e) {
        setLoadError(e instanceof Error ? e.message : "Could not load this problem.");
      }
    }
    fetchProblem();
  }, [selectedId]);

  const [saveState, setSaveState] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dialog, setDialog] = useState<"statement" | "requirements" | "hint" | null>(null);
  const [dialogHintIndex, setDialogHintIndex] = useState<number | null>(null);
  const [datasetNames, setDatasetNames] = useState<string[]>([]);
  const [previewDatasetIndex, setPreviewDatasetIndex] = useState<number | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`teacher-dataset-names:${selectedId}`) || "[]");
      setDatasetNames(Array.isArray(stored) ? stored.map((name) => typeof name === "string" ? name : "") : []);
    } catch { setDatasetNames([]); }
    setPreviewDatasetIndex(null);
  }, [selectedId]);
  function changeDatasetNames(names: string[]) {
    setDatasetNames(names);
    markUnsaved();
    try { localStorage.setItem(`teacher-dataset-names:${selectedId}`, JSON.stringify(names)); } catch { /* Editing remains available when storage is blocked. */ }
  }
  const [previewTab, setPreviewTab] = useState<"Description" | "Database">("Description");
  const [previewHintOpen, setPreviewHintOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewClosing, setPreviewClosing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [activePageSection, setActivePageSection] = useState("basic-information");
  const [navigationIndicator, setNavigationIndicator] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const problemNavigationRef = useRef<HTMLElement>(null);
  const activeNavigationLinkRef = useRef<HTMLAnchorElement>(null);
  const navigationScrollTargetRef = useRef<string | null>(null);
  const navigationScrollFallbackRef = useRef<number | null>(null);
  const splitLayoutRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function markUnsaved() {
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
  }

  function markSaved() {
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
  }

  function requestNavigation(destination: string) {
    if (hasUnsavedChangesRef.current) setPendingNavigation(destination);
    else navigate(destination);
  }

  function getMaxPreviewWidth() {
    const availableWidth = splitLayoutRef.current?.clientWidth ?? 1200;
    return window.innerWidth <= 900
      ? Math.max(320, Math.min(680, availableWidth - 332, window.innerWidth * 0.42))
      : Math.max(320, Math.min(680, availableWidth - 584));
  }

  function resizePreviewTo(width: number) {
    setPreviewWidth(Math.max(320, Math.min(getMaxPreviewWidth(), width)));
  }

  function closePreview() {
    if (!previewOpen || previewClosing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPreviewOpen(false);
      return;
    }
    setPreviewClosing(true);
  }

  useEffect(() => {
    const sectionIds = ["basic-information", "problem-statement", "problem-requirements", "database"];
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const requestedSection = navigationScrollTargetRef.current;
      if (requestedSection) {
        setActivePageSection((current) => current === requestedSection ? current : requestedSection);
        return;
      }
      const headerHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
      const activationLine = headerHeight + 100;
      let activeId = sectionIds[0];

      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= activationLine) activeId = id;
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 8 && window.scrollY >= maxScroll - 8) activeId = sectionIds[sectionIds.length - 1];
      setActivePageSection((current) => current === activeId ? current : activeId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };
    const finishNavigationScroll = () => {
      if (!navigationScrollTargetRef.current) return;
      navigationScrollTargetRef.current = null;
      if (navigationScrollFallbackRef.current !== null) {
        window.clearTimeout(navigationScrollFallbackRef.current);
        navigationScrollFallbackRef.current = null;
      }
      scheduleUpdate();
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scrollend", finishNavigationScroll);
    document.addEventListener("scrollend", finishNavigationScroll);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scrollend", finishNavigationScroll);
      document.removeEventListener("scrollend", finishNavigationScroll);
      if (navigationScrollFallbackRef.current !== null) {
        window.clearTimeout(navigationScrollFallbackRef.current);
        navigationScrollFallbackRef.current = null;
      }
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [selectedId, problem?.id]);

  useLayoutEffect(() => {
    const navigation = problemNavigationRef.current;
    const activeLink = activeNavigationLinkRef.current;
    if (!navigation || !activeLink) return;

    const updateIndicator = () => {
      const navBounds = navigation.getBoundingClientRect();
      const linkBounds = activeLink.getBoundingClientRect();
      setNavigationIndicator({
        x: linkBounds.left - navBounds.left,
        y: linkBounds.top - navBounds.top,
        width: linkBounds.width,
        height: linkBounds.height,
      });
    };

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(navigation);
    observer.observe(activeLink);
    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activePageSection, problem?.id, selectedId]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || !hasUnsavedChangesRef.current) return;
      if (destination.pathname === location.pathname && destination.search === location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    document.addEventListener("click", handleNavigationClick, true);
    return () => document.removeEventListener("click", handleNavigationClick, true);
  }, [location.pathname, location.search]);

  async function deleteProblem() {
    if (selectedId === "new" || deleteBusy || saving || validating) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await teacherService.deleteProblem(selectedId);
      navigate("/teacher/problems", { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this problem.");
    } finally {
      setDeleteBusy(false);
    }
  }
  const richTextEditorRef = useRef<HTMLDivElement>(null);
  const [selectedTextSize, setSelectedTextSize] = useState<number | "mixed" | null>(null);

  useEffect(() => {
    if (!problem || !dialog) return;
    const editor = richTextEditorRef.current;
    if (!editor) return;
    const value = dialog === "hint"
      ? problem.hints[dialogHintIndex ?? 0] || ""
      : problem[dialog];
    editor.innerHTML = markdownToEditorHtml(value);
    editor.focus({ preventScroll: true });
    setSelectedTextSize(null);
  }, [dialog, dialogHintIndex, selectedId, problem?.id]);

  useEffect(() => {
    if (!dialog) {
      setSelectedTextSize(null);
      return;
    }
    const editor = richTextEditorRef.current;
    if (!editor) return;

    const syncSelectedTextSize = () => {
      setSelectedTextSize(getSelectedTextSize(editor, window.getSelection()));
    };

    document.addEventListener("selectionchange", syncSelectedTextSize);
    editor.addEventListener("keyup", syncSelectedTextSize);
    editor.addEventListener("mouseup", syncSelectedTextSize);
    editor.addEventListener("focus", syncSelectedTextSize);
    return () => {
      document.removeEventListener("selectionchange", syncSelectedTextSize);
      editor.removeEventListener("keyup", syncSelectedTextSize);
      editor.removeEventListener("mouseup", syncSelectedTextSize);
      editor.removeEventListener("focus", syncSelectedTextSize);
    };
  }, [dialog, selectedId, problem?.id]);

  if (!problem) {
    return <div className="teacher-page">{loadError ? <ErrorState title={tr("Problem editor unavailable")} message={tr(loadError)} onRetry={() => window.location.reload()} /> : <Loading label={tr("Loading problem editor…")} />}</div>;
  }

  const schemaText = problem.schema || "";
  const databaseSetupComplete = Boolean(schemaText.trim());
  const schemaDiagramIsCurrent = schemaDiagram?.source === problem.schema;
  const schemaTables = parseDatabaseSchema(schemaText);
  const previewLibraryEntry = libraryEntries.find((entry) => entry.id === libraryPreviewEntryId) ?? null;
  const previewLibraryDatasets = previewLibraryEntry ? databaseLibraryDatasets(previewLibraryEntry) : [];
  const previewLibraryDataset = previewLibraryDatasets[libraryPreviewDatasetIndex] ?? previewLibraryDatasets[0] ?? null;
  const previewLibraryTables = previewLibraryEntry ? parseDatabaseSchema(previewLibraryEntry.createTableSql || "") : [];
  const seedDataText = problem.testCases?.[0]?.seedData || problem.seedData || "";
  const seedTables = parseSeedData(seedDataText);
  const visibleDatasetIndex = (problem.testCases || []).findIndex((dataset) => !dataset.isHidden);
  const expectedOutputSample = (problem.expectedOutputs || [])[visibleDatasetIndex >= 0 ? visibleDatasetIndex : 0] || null;

  function update<K extends keyof TeacherProblem>(
    field: K,
    value: TeacherProblem[K],
  ) {
    const invalidatesExpectedOutputs = field === "schema" && value !== problem?.schema
      || field === "testCases" && JSON.stringify((value as TeacherProblem["testCases"] || []).map((dataset) => dataset.seedData))
        !== JSON.stringify((problem?.testCases || []).map((dataset) => dataset.seedData))
      || field === "sqlSolutions" && JSON.stringify((value as TeacherProblem["sqlSolutions"] || []).map((solution) => solution.query))
        !== JSON.stringify((problem?.sqlSolutions || []).map((solution) => solution.query));
    setProblem((current) => current ? ({
      ...current,
      [field]: value,
      ...(invalidatesExpectedOutputs ? { expectedOutputs: [] } : {}),
    }) : null);
    markUnsaved();
    setSaveState("Unsaved changes");
  }

  async function openDatabaseLibrary() {
    setLibraryImportOpen(true);
    setLibraryLoading(true);
    setLibraryError("");
    setLibraryEntries([]);
    setLibraryPreviewEntryId(null);
    setLibraryPreviewDatasetIndex(0);
    try {
      setLibraryEntries(await teacherService.getDatabaseLibrary());
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : tr("Could not load database library."));
    } finally {
      setLibraryLoading(false);
    }
  }

  function importDatabaseEntry(entry: TeacherDatabaseLibraryEntry) {
    if (!problem) return;
    const currentDatasets = problem.testCases || [{ seedData: problem.seedData || "", isHidden: false }];
    if ((problem.schema.trim() || currentDatasets.some((dataset) => dataset.seedData.trim()))
      && !window.confirm(tr("Importing replaces the current database structure and datasets. Continue?"))) return;

    const fallbackName = entry.title.toLowerCase().replace(/đ/g, "d").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") || "database";
    const importedDatasets = databaseLibraryDatasets(entry);
    const testCases = importedDatasets.map((dataset) => ({ seedData: dataset.sql || "", isHidden: false }));
    const nextDatasetNames = importedDatasets.map((dataset, index) => dataset.fileName || (index === 0 ? `${fallbackName}_insertdata.sql` : `${fallbackName}_dataset_${index + 1}.sql`));
    changeDatasetNames(nextDatasetNames);
    setProblem((current) => current ? {
      ...current,
      schema: entry.createTableSql || "",
      schemaFileName: entry.createTableFileName || `${fallbackName}_createtable.sql`,
      seedData: importedDatasets[0]?.sql || "",
      testCases,
      expectedOutputs: [],
    } : null);
    setSchemaDiagram(null);
    markUnsaved();
    setSaveState("Unsaved changes");
    setLibraryImportOpen(false);
  }

  function runSchemaDdl() {
    if (!problem) return;
    setSchemaDiagram({ source: problem.schema, tables: parseDatabaseSchema(problem.schema) });
  }

  function updateRichTextValue() {
    if (!problem || !dialog) return;
    const editor = richTextEditorRef.current;
    if (!editor) return;
    const value = editorHtmlToMarkdown(editor.innerHTML);
    if (dialog === "hint") {
      const index = dialogHintIndex;
      if (index === null || index >= problem.hints.length) return;
      const hints = [...problem.hints];
      hints[index] = value;
      update("hints", hints);
    } else update(dialog, value);
  }

  function wrapSelectedInlineTag(tagName: "code") {
    const editor = richTextEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) return;
    const element = document.createElement(tagName);
    element.appendChild(range.extractContents());
    range.insertNode(element);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(nextRange);
  }

  function applyRichTextFormat(action: "bold" | "italic" | "code" | "bullets" | "numbers") {
    const editor = richTextEditorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    if (action === "code") {
      wrapSelectedInlineTag("code");
    } else {
      const command = action === "bold"
        ? "bold"
        : action === "italic"
          ? "italic"
          : action === "bullets"
            ? "insertUnorderedList"
            : "insertOrderedList";
      document.execCommand(command);
    }
    updateRichTextValue();
  }

  function adjustSelectedTextSize(delta: number) {
    const editor = richTextEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement
      : range.startContainer.parentElement;
    const currentSize = startElement ? parseFloat(window.getComputedStyle(startElement).fontSize) : 12;
    const nextSize = Math.max(10, Math.min(20, currentSize + delta));
    const wrapper = document.createElement("span");
    wrapper.style.fontSize = `${nextSize}px`;
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    setSelectedTextSize(nextSize);
    updateRichTextValue();
  }

  async function saveProblem(exitDestination?: string) {
    if (!problem || saving) return;
    if (!problem.title.trim()) { setSaveState("Enter a title before saving."); return; }
    const payload = {
        number: problem.number,
        title: problem.title,
        difficulty: problem.difficulty,
        visibility: problem.visibility,
        topics: problem.topics || "",
        statement: problem.statement,
        requirements: problem.requirements,
        hints: problem.hints.filter((_, index) => !disabledHints.has(index)),
        database: problem.database,
        schemaFileName: problem.schemaFileName || "database.sql",
        schema: problem.schema,
        testCases: problem.testCases || [{ seedData: problem.seedData, isHidden: false }],
        referenceSolution: problem.referenceSolution,
        expectedOutputs: problem.expectedOutputs || [],
        expectedOutputVisible: problem.expectedOutputVisible !== false,
        sqlSolutions: problem.sqlSolutions
    };
    setSaving(true);
    setSaveState("Saving to server...");
    try {
        let savedProblem: any = null;
        if (selectedId === "new") {
            savedProblem = await teacherService.createProblem(payload);
        } else {
            await teacherService.updateProblem(selectedId, payload);
        }
        markSaved();
        setSaveState("Saved");
        if (exitDestination) {
            navigate(exitDestination);
        } else if (selectedId === "new") {
            const createdId = savedProblem?.id;
            navigate(createdId ? `/teacher/problems/${createdId}/edit` : "/teacher/problems", { replace: true });
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save to server.";
        if (selectedId !== "new" && /internal server error/i.test(message)) {
          try {
            const savedProblem = await teacherService.getProblem(selectedId);
            if (problemPayloadWasSaved(savedProblem, payload)) {
              markSaved();
              setSaveState("Saved");
              if (exitDestination) navigate(exitDestination);
              return;
            }
          } catch {
            // Keep the original save error when the confirmation request also fails.
          }
        }
        setSaveState(/internal server error/i.test(message) ? "Save failed" : message);
    } finally {
        setSaving(false);
    }
  }

  return (
    <section className="teacher-page teacher-problem-page">
      <div
        ref={splitLayoutRef}
        className={`teacher-problem-workspace-layout${previewOpen ? " has-live-preview" : ""}${previewClosing ? " is-closing-preview" : ""}`}
        style={{ "--teacher-preview-width": `${previewWidth}px` } as CSSProperties}
      >
      <div className="teacher-problem-authoring-layout">
        <nav ref={problemNavigationRef} className="teacher-problem-navigation" aria-label={tr("Problem editor sections")}>
          <span
            className="teacher-problem-navigation-indicator"
            aria-hidden="true"
            style={{
              width: `${navigationIndicator.width}px`,
              height: `${navigationIndicator.height}px`,
              transform: `translate(${navigationIndicator.x}px, ${navigationIndicator.y}px)`,
            }}
          />
          <div className="teacher-problem-navigation-toolbar">
            <div className="teacher-problem-toolbar-title">
              <strong><TranslatedText>{tr(selectedId === "new" ? "New problem" : "Edit problem")}</TranslatedText></strong>
              <span className={hasUnsavedChanges || Boolean(saveState && saveState !== "Saved") ? "is-unsaved" : ""}>
                <span className="teacher-editor-state-dot" aria-hidden="true" />
                <TranslatedText>{saveState && saveState !== "Saved" ? tr(saveState) : hasUnsavedChanges ? tr("Unsaved changes") : tr("All changes saved")}</TranslatedText>
              </span>
            </div>
            <div className="teacher-problem-save-exit-actions">
              <button className="button" type="button" disabled={saving} onClick={() => requestNavigation("/teacher/problems")}><TranslatedText>{tr("Exit")}</TranslatedText></button>
              <button className="button primary" type="button" disabled={saving} onClick={() => void saveProblem()}>
                <TranslatedText>{saving ? tr("Saving…") : tr("Save")}</TranslatedText>
              </button>
            </div>
          </div>
          <span className="teacher-problem-navigation-label"><TranslatedText>{tr("On this page")}</TranslatedText></span>
          {[
            ["basic-information", "Basic information"],
            ["problem-statement", "Statement"],
            ["problem-requirements", "Requirements"],
            ["database", "Database"],
          ].map(([id, label]) => (
            <a
              key={id}
              ref={activePageSection === id ? activeNavigationLinkRef : undefined}
              href={`#${id}`}
              className={activePageSection === id ? "is-active" : undefined}
              aria-current={activePageSection === id ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigationScrollTargetRef.current = id;
                if (navigationScrollFallbackRef.current !== null) window.clearTimeout(navigationScrollFallbackRef.current);
                navigationScrollFallbackRef.current = window.setTimeout(() => {
                  navigationScrollTargetRef.current = null;
                  navigationScrollFallbackRef.current = null;
                }, 1800);
                setActivePageSection(id);
                document.getElementById(id)?.scrollIntoView({
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                  block: "start",
                });
              }}
            ><TranslatedText>{tr(label)}</TranslatedText></a>
          ))}
          <div className="teacher-problem-navigation-actions">
            <button
              className="button teacher-problem-preview-action"
              type="button"
              onClick={() => {
                if (previewOpen && !previewClosing) {
                  closePreview();
                  return;
                }
                setPreviewTab("Description");
                setPreviewHintOpen(false);
                setPreviewClosing(false);
                setPreviewOpen(true);
              }}
            ><TranslatedText>{tr("Preview")}</TranslatedText></button>
            {selectedId !== "new" && <button className="button teacher-danger-button" type="button" disabled={saving || validating || deleteBusy} onClick={() => { setDeleteError(""); setConfirmDelete(true); }}><TranslatedText>{tr("Delete")}</TranslatedText></button>}
          </div>
        </nav>
        <section className="teacher-problem-card teacher-editor-details">
          <section id="basic-information" className="teacher-problem-details-section teacher-problem-basics-section">
            <TeacherSectionTitle title={tr("Basic information")} />
          <div className="teacher-field-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px' }}>
            <TeacherField label={tr("NUMBER")}>
              <input
                value={problem.number}
                onChange={(event) => update("number", event.target.value)}
              />
            </TeacherField>
            <TeacherField label={tr("TITLE")}>
              <input
                value={problem.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </TeacherField>
          </div>
          <div className="teacher-field-row">
            <TeacherField label={tr("DIFFICULTY")}>
              <select
                value={problem.difficulty}
                onChange={(event) =>
                  update("difficulty", event.target.value as TeacherProblem["difficulty"])
                }
              >
                <option value="Easy">{tr("Easy")}</option>
                <option value="Medium">{tr("Medium")}</option>
                <option value="Hard">{tr("Hard")}</option>
              </select>
            </TeacherField>
          </div>
          </section>
          <section className="teacher-problem-details-section teacher-problem-content-section">
            <TeacherSectionTitle title={tr("Problem content")} />
          <div id="problem-statement" className="teacher-field teacher-long-text-field">
            <div className="teacher-long-text-heading">
              <span><TranslatedText>{tr("STATEMENT")}</TranslatedText></span>
            </div>
            <ProblemRichTextEditor
              value={problem.statement}
              label={tr("Problem statement")}
              onChange={(value) => update("statement", value)}
              onOpenExpanded={() => setDialog("statement")}
            />
          </div>
          <div id="problem-requirements" className="teacher-field teacher-long-text-field">
            <div className="teacher-long-text-heading">
              <span><TranslatedText>{tr("REQUIREMENTS")}</TranslatedText></span>
            </div>
            <ProblemRichTextEditor
              value={problem.requirements}
              label={tr("Problem requirements")}
              onChange={(value) => update("requirements", value)}
              onOpenExpanded={() => setDialog("requirements")}
            />
          </div>
          <div className="teacher-problem-hints-section">
            <div className="teacher-problem-section-heading">
              <span className="teacher-problem-hints-label"><TranslatedText>{tr("Hints")}</TranslatedText></span>
              <button
                className="button teacher-small-button"
                type="button"
                disabled={problem.hints.length >= MAX_HINTS}
                title={problem.hints.length >= MAX_HINTS ? tr("A problem can have up to 3 hints.") : undefined}
                onClick={() => {
                  if (problem.hints.length >= MAX_HINTS) return;
                  update("hints", [...problem.hints, ""]);
                }}
              >
                <TranslatedText>{problem.hints.length >= MAX_HINTS ? tr("Maximum 3 hints") : tr("Add hint")}</TranslatedText>
              </button>
            </div>
          <div className="teacher-hints">
            {problem.hints.length > 0 ? problem.hints.map((hint, index) => {
              const isDisabled = disabledHints.has(index);
              return (
                <div className={`teacher-hint-field${isDisabled ? " is-disabled" : ""}`} key={index}>
                  <div className="teacher-hint-label">
                    <span><TranslatedText>{tr("HINT")}</TranslatedText> {String(index + 1).padStart(2, "0")}</span>
                    <div className="teacher-hint-actions">
                      <button
                        className="button teacher-hint-toggle"
                        type="button"
                        onClick={() => {
                          setDisabledHints((current) => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          });
                          markUnsaved();
                          setSaveState("Unsaved changes");
                        }}
                      >
                        <TranslatedText>{isDisabled ? tr("Enable") : tr("Disable")}</TranslatedText>
                      </button>
                      <button
                        className="button teacher-hint-delete"
                        type="button"
                        onClick={() => {
                          update("hints", problem.hints.filter((_, hintIndex) => hintIndex !== index));
                          setDisabledHints((current) => new Set(
                            [...current]
                              .filter((hintIndex) => hintIndex !== index)
                              .map((hintIndex) => hintIndex > index ? hintIndex - 1 : hintIndex),
                          ));
                        }}
                      >
                        <TranslatedText>{tr("Delete")}</TranslatedText>
                      </button>
                    </div>
                  </div>
                  <ProblemRichTextEditor
                    value={hint}
                    label={`${tr("HINT")} ${String(index + 1).padStart(2, "0")}`}
                    disabled={isDisabled}
                    onChange={(value) => {
                      const hints = [...problem.hints];
                      hints[index] = value;
                      update("hints", hints);
                    }}
                    onOpenExpanded={() => {
                      setDialogHintIndex(index);
                      setDialog("hint");
                    }}
                  />
                </div>
              );
            }) : (
                <p className="teacher-empty-section"><TranslatedText>{tr("No hints added yet.")}</TranslatedText></p>
              )}
          </div>
          </div>
          </section>
        <section id="database" className="teacher-problem-database-section">
          <div className="teacher-problem-database-heading">
            <TeacherSectionTitle title={tr("Database")} />
            <span className="teacher-database-dialect-badge">SQL Server</span>
          </div>
          <div className="teacher-problem-database-tabs" role="tablist" aria-label={tr("Database configuration")}>
            {([
              ["schema", "Database structure"],
              ["datasets", "Test datasets"],
              ["solution", "SQL Solution"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={databaseTab === tab}
                aria-controls={`database-panel-${tab}`}
                disabled={(tab === "datasets" || tab === "solution") && !databaseSetupComplete}
                className={databaseTab === tab ? "is-active" : ""}
                onClick={() => setDatabaseTab(tab)}
              ><TranslatedText>{tr(label)}</TranslatedText></button>
            ))}
          </div>
          {databaseTab === "schema" && <section id="database-panel-schema" role="tabpanel" className="teacher-validation-section">
            <div className="teacher-schema-heading">
              <div className="teacher-schema-titleline">
                <TeacherSectionTitle title={tr("Provided database structure")} />
              </div>
              <div className="teacher-schema-actions">
                <label className="teacher-schema-filename">
                  <input
                    aria-label={tr("Database file name")}
                    value={(problem.schemaFileName || "database.sql").replace(/\.sql$/i, "")}
                    onChange={(event) => {
                      const base = event.target.value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/[. ]+$/g, "");
                      update("schemaFileName", base ? `${base}.sql` : "");
                    }}
                  />
                  <span>.sql</span>
                </label>
                <button className="button teacher-database-import-button" type="button" onClick={() => void openDatabaseLibrary()}>
                  <Download size={14} aria-hidden="true" />
                  <TranslatedText>{tr("Import library")}</TranslatedText>
                </button>
              </div>
            </div>
            <p className="teacher-seed-summary"><TranslatedText>{tr("This database structure is set up for students before they begin.")}</TranslatedText></p>
              <ProblemSqlEditor
                label={tr("Database structure SQL")}
                value={problem.schema}
                onChange={(value) => update("schema", value)}
                placeholder={tr("-- Example SQL Server DDL\nCREATE TABLE Customers (\n    CustomerId INT PRIMARY KEY,\n    FullName NVARCHAR(100) NOT NULL\n);")}
              />
            <div className="teacher-schema-run-row">
              <p><TranslatedText>{tr("Preview tables, keys, and relationships from this database script.")}</TranslatedText></p>
              <button className="button primary" type="button" onClick={runSchemaDdl} disabled={!problem.schema.trim()}>
                <Play size={14} aria-hidden="true" />
                <TranslatedText>{tr("Run DDL")}</TranslatedText>
              </button>
            </div>
            <div className="teacher-schema-diagram-result" aria-live="polite">
              {!schemaDiagram && <p className="teacher-schema-diagram-message"><TranslatedText>{tr("Run DDL to preview tables and key relationships.")}</TranslatedText></p>}
              {schemaDiagram && !schemaDiagramIsCurrent && <p className="teacher-schema-diagram-message is-stale"><TranslatedText>{tr("Database structure changed since the last preview. Run DDL to refresh the diagram.")}</TranslatedText></p>}
              {schemaDiagramIsCurrent && schemaDiagram.tables.length === 0 && <p className="teacher-schema-diagram-message is-error"><TranslatedText>{tr("No CREATE TABLE statements found. Add at least one table, then run DDL again.")}</TranslatedText></p>}
              {schemaDiagramIsCurrent && schemaDiagram.tables.length > 0 && <TeacherSchemaDiagram tables={schemaDiagram.tables} />}
            </div>
          </section>}
          {databaseSetupComplete && databaseTab === "datasets" && <section id="database-panel-datasets" role="tabpanel" className="teacher-validation-section teacher-test-cases-section">
            <div className="teacher-dataset-list">
          {(problem.testCases || [{seedData: problem.seedData, isHidden: false}]).map((tc, index) => (
            <div className="teacher-dataset-card" key={index}>
              <div className="teacher-dataset-card-heading">
                <div className="teacher-dataset-controls">
                <span className="teacher-dataset-number"><TranslatedText>{tr("Dataset")}</TranslatedText> {index + 1}</span>
                <div className="teacher-dataset-file-field">
                  <input className="teacher-dataset-filename" aria-label={tr("Dataset {value0} file name", { value0: index + 1 })} value={(datasetNames[index] ?? `seed_${index + 1}.sql`).replace(/\.sql$/i, "")} onChange={(event) => {
                    const names = [...datasetNames];
                    names[index] = event.target.value.replace(/\.sql$/i, "") + ".sql";
                    changeDatasetNames(names);
                  }} />
                  <span className="teacher-dataset-file-extension">.sql</span>
                </div>
                <div className="teacher-dataset-card-actions">
                  <div className={`teacher-dataset-visibility${tc.isHidden ? " is-hidden" : ""}`}>
                  <button
                    type="button"
                    className={"button teacher-small-button teacher-dataset-hidden-toggle" + (tc.isHidden ? " is-active" : "")}
                    aria-label={`${tr("Dataset")} ${index + 1}: ${tr("Hidden dataset")}`}
                    aria-pressed={tc.isHidden}
                    aria-describedby={tc.isHidden ? `dataset-hidden-notice-${index}` : undefined}
                    onClick={() => {
                      const datasets = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                      datasets[index] = { ...datasets[index], isHidden: !tc.isHidden };
                      update("testCases", datasets);
                    }}
                  ><TranslatedText>{tr("Hidden dataset")}</TranslatedText></button>
                  <div id={`dataset-hidden-notice-${index}`} className="teacher-dataset-hidden-notice" aria-hidden={!tc.isHidden}>
                    <div><span><TranslatedText>{tr("Hidden from students")}</TranslatedText></span></div>
                  </div>
                  </div>
                  <button
                    type="button"
                    className={`button teacher-small-button teacher-dataset-preview-toggle${previewDatasetIndex === index ? " is-active" : ""}`}
                    aria-expanded={previewDatasetIndex === index}
                    onClick={() => setPreviewDatasetIndex((current) => current === index ? null : index)}
                  >
                    <Table2 size={14} aria-hidden="true" />
                    <TranslatedText>{tr(previewDatasetIndex === index ? "Hide preview" : "Preview data")}</TranslatedText>
                  </button>
                  {index > 0 && (
                    <button type="button" className="button teacher-small-button teacher-dataset-delete" aria-label={`${tr("Delete")}: ${tr("Dataset")} ${index + 1}`} onClick={() => {
                        const currentTcs = problem.testCases || [{seedData: problem.seedData, isHidden: false}];
                        if (currentTcs[index]?.seedData?.trim() && !window.confirm(tr("Dataset {value0} contains SQL data. Delete it?", { value0: index + 1 }))) return;
                        const newTcs = [...currentTcs];
                        newTcs.splice(index, 1);
                        const names = newTcs.map((_, nextIndex) => datasetNames[nextIndex < index ? nextIndex : nextIndex + 1] || `seed_${(nextIndex < index ? nextIndex : nextIndex + 1) + 1}.sql`);
                        setPreviewDatasetIndex((current) => current === index ? null : current !== null && current > index ? current - 1 : current);
                        changeDatasetNames(names);
                        update("testCases", newTcs);
                    }}><TranslatedText>{tr("Delete")}</TranslatedText></button>
                  )}
                </div>
                {index === 0 && <button className="button teacher-small-button teacher-dataset-add" type="button" onClick={() => {
                  const datasets = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                  const names = datasets.map((_, datasetIndex) => datasetNames[datasetIndex] || `seed_${datasetIndex + 1}.sql`);
                  let fileNumber = datasets.length + 1;
                  while (names.includes(`seed_${fileNumber}.sql`)) fileNumber += 1;
                  changeDatasetNames([...names, `seed_${fileNumber}.sql`]);
                  datasets.push({seedData: "", isHidden: true});
                  update("testCases", datasets);
                }}><Plus size={14} aria-hidden="true" /><TranslatedText>{tr("Add dataset")}</TranslatedText></button>}
                </div>
              </div>
              <ProblemSqlEditor
                value={tc.seedData}
                label={tr("Test dataset {value0} SQL", { value0: index + 1 })}
                placeholder={tr("-- Example SQL Server test data\nINSERT INTO Customers (CustomerId, FullName)\nVALUES (1, N'Nguyen Van An'),\n       (2, N'Tran Thi Binh');")}
                onChange={(value) => {
                  const datasets = [...(problem.testCases || [{ seedData: problem.seedData, isHidden: false }])];
                  datasets[index] = { ...datasets[index], seedData: value };
                  update("testCases", datasets);
                }}
              />
              {previewDatasetIndex === index && <DatasetDataPreview datasetNumber={index + 1} seedData={tc.seedData} />}
            </div>
          ))}
            </div>
            <p className="teacher-seed-summary"><TranslatedText>{tr("Each dataset contains seed SQL loaded before checking a solution. Hidden datasets are not shown to students.")}</TranslatedText></p>
          </section>}
          {databaseSetupComplete && databaseTab === "solution" && <div id="database-panel-solution" role="tabpanel">
            <TeacherSqlSolutions
              solutions={initialSqlSolutions(problem.sqlSolutions, problem.referenceSolution, `legacy-${problem.id}`)}
              schema={problem.schema}
              datasets={problem.testCases || [{ seedData: problem.seedData }]}
              onChange={(solutions) => {
                update("sqlSolutions", solutions);
                update("referenceSolution", solutions.find((solution) => solution.enabled)?.query || "");
              }}
              expectedOutputs={problem.expectedOutputs || []}
              expectedOutputVisible={problem.expectedOutputVisible !== false}
              onExpectedOutputsChange={(outputs) => {
                update("expectedOutputs", outputs);
                update("expectedOutputVisible", true);
              }}
              onExpectedOutputVisibilityChange={(visible) => update("expectedOutputVisible", visible)}
              onRunningChange={setValidating}
            />
          </div>}
        </section>
        </section>


      </div>
      {previewOpen && (
        <aside
          className={`teacher-student-preview-panel${previewClosing ? " is-closing" : ""}`}
          aria-label={tr("Student preview")}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget || event.animationName !== "teacher-preview-panel-out") return;
            setPreviewOpen(false);
            setPreviewClosing(false);
          }}
        >
          <button
            className="teacher-student-preview-resize"
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={320}
            aria-valuemax={getMaxPreviewWidth()}
            aria-valuenow={previewWidth}
            aria-label={tr("Resize preview panel")}
            title={tr("Resize preview panel")}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const bounds = splitLayoutRef.current?.getBoundingClientRect();
              if (bounds) resizePreviewTo(bounds.right - event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              resizePreviewTo(previewWidth + (event.key === "ArrowLeft" ? 24 : -24));
            }}
            onDoubleClick={() => resizePreviewTo(420)}
          ><span aria-hidden="true" /></button>
          <header className="teacher-student-preview-heading">
            <h2><TranslatedText>{tr("Student preview")}</TranslatedText></h2>
            <button type="button" className="icon-button" aria-label={tr("Close preview")} title={tr("Close preview")} onClick={closePreview}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="teacher-student-preview">
            <div className="teacher-preview-tabs" role="tablist" aria-label={tr("Student preview sections")}>
              {(["Description", "Database"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={previewTab === tab}
                  className={previewTab === tab ? "active" : ""}
                  onClick={() => setPreviewTab(tab)}
                ><TranslatedText>{tr(tab)}</TranslatedText></button>
              ))}
            </div>
            <div className="teacher-student-preview-scroll">
              {previewTab === "Description" ? (
                <div className="teacher-student-preview-content">
                  <p className="teacher-student-preview-eyebrow"><TranslatedText>{tr("PROBLEM")}</TranslatedText> {problem.number}</p>
                  <h1><TranslatedText>{problem.title || tr("Untitled problem")}</TranslatedText></h1>
                  <div className="teacher-student-preview-meta">
                    <Status value={problem.difficulty || "Unknown"} />
                    <Status value={parseProblemTopics(problem.topics)[0] || "Uncategorized"} />
                    <Status value="Not started" />
                  </div>
                  <ProblemMarkdown>{problem.statement || tr("No statement yet.")}</ProblemMarkdown>
                  <h3><TranslatedText>{tr("Requirements")}</TranslatedText></h3>
                  <ProblemMarkdown>{problem.requirements || tr("No requirements yet.")}</ProblemMarkdown>
                  {problem.expectedOutputVisible !== false && expectedOutputSample && <section className="teacher-student-preview-expected-output">
                    <h3><TranslatedText>{tr("Expected output")}</TranslatedText></h3>
                    <div className="teacher-dataset-preview-scroll"><table className="teacher-table">
                      <thead><tr>{expectedOutputSample.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
                      <tbody>{expectedOutputSample.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${expectedOutputSample.columns[columnIndex] || columnIndex}-${columnIndex}`}>{String(value ?? "NULL")}</td>)}</tr>)}</tbody>
                    </table></div>
                  </section>}
                </div>
              ) : (
                <div className="teacher-student-preview-content teacher-student-preview-database">
                  <h2><TranslatedText>{tr("Database setup")}</TranslatedText></h2>
                  <p className="muted"><TranslatedText>{tr("SQL Server · read-only database structure and seed data used for evaluation")}</TranslatedText></p>
                  <section className="schema-section">
                    <h3><TranslatedText>{tr("Database structure")}</TranslatedText></h3>
                    {schemaTables.length ? (
                      <div className="workspace-schema-tables">
                        {schemaTables.map((table, tableIndex) => (
                          <section className="workspace-schema-table-card" key={`${table.name}-${tableIndex}`}>
                            <h4>{table.name}</h4>
                            <div className="workspace-schema-table-scroll">
                              <table className="workspace-schema-table">
                                <thead><tr><th><TranslatedText>{tr("Column")}</TranslatedText></th><th><TranslatedText>{tr("Type")}</TranslatedText></th><th><TranslatedText>{tr("Constraints")}</TranslatedText></th></tr></thead>
                                <tbody>{table.columns.map((column) => (
                                  <tr key={column.name}>
                                    <th scope="row">{column.name}</th>
                                    <td><TranslatedText>{tr(column.type)}</TranslatedText></td>
                                    <td>{column.constraints || "—"}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                            {(table.foreignKeys.length > 0 || table.constraints.length > 0) && <div className="workspace-schema-relations">
                              {table.foreignKeys.map((foreignKey, index) => (
                                <div className="workspace-schema-relation" key={`fk-${index}`}>
                                  <span className="workspace-schema-relation-label">FOREIGN KEY</span>
                                  <code>{foreignKey.columns.join(", ")}</code>
                                  <span aria-hidden="true">→</span>
                                  <code>{foreignKey.referencedTable}.{foreignKey.referencedColumns.join(", ")}</code>
                                </div>
                              ))}
                              {table.constraints.map((constraint, index) => (
                                <span className="workspace-schema-extra-constraint" key={`constraint-${index}`}><TranslatedText>{tr(constraint)}</TranslatedText></span>
                              ))}
                            </div>}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <pre className="workspace-schema-code"><code>{tr(schemaText) || tr("No schema provided.")}</code></pre>
                    )}
                  </section>
                  <section className="schema-section">
                    <h3><TranslatedText>{tr("Seed data")}</TranslatedText></h3>
                    {seedTables.length ? (
                      <div className="workspace-seed-tables">
                        {seedTables.map((table, tableIndex) => (
                          <section className="workspace-schema-table-card" key={`${table.name}-${tableIndex}`}>
                            <h4>{table.name}</h4>
                            <div className="workspace-schema-table-scroll">
                              <table className="workspace-seed-table">
                                <thead><tr>{table.columns.map((column) => <th key={column}><TranslatedText>{tr(column)}</TranslatedText></th>)}</tr></thead>
                                <tbody>{table.rows.map((row, rowIndex) => (
                                  <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${table.columns[columnIndex]}-${columnIndex}`}>{value}</td>)}</tr>
                                ))}</tbody>
                              </table>
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <pre className="workspace-schema-code"><code>{tr(seedDataText) || tr("No seed data provided.")}</code></pre>
                    )}
                  </section>
                </div>
              )}
            </div>
            {previewHintOpen && (
              <section className="teacher-student-preview-hint" aria-live="polite">
                <div className="teacher-student-preview-hint-heading">
                  <strong><TranslatedText>{tr("Hint")}</TranslatedText></strong>
                  <button type="button" onClick={() => setPreviewHintOpen(false)}><TranslatedText>{tr("Close")}</TranslatedText></button>
                </div>
                {problem.hints.filter((hint, index) => !disabledHints.has(index) && hint.trim()).length > 0 ? (
                  problem.hints
                    .filter((hint, index) => !disabledHints.has(index) && hint.trim())
                    .map((hint, index) => <ProblemMarkdown key={index}>{hint}</ProblemMarkdown>)
                ) : (
                  <p className="tiny muted"><TranslatedText>{tr("No hints are available for this problem.")}</TranslatedText></p>
                )}
              </section>
            )}
            <div className="teacher-student-preview-dock">
              <button type="button" onClick={() => setPreviewHintOpen((open) => !open)}>
                <TranslatedText>{previewHintOpen ? tr("Hide hint") : tr("Show hint")}</TranslatedText>
              </button>
            </div>
          </div>
        </aside>
      )}
      </div>
      {libraryImportOpen && (
        <Dialog title={tr("Import from database library")} onClose={() => setLibraryImportOpen(false)} className="teacher-database-import-dialog">
          <div className="teacher-database-import-content">
            <p><TranslatedText>{tr("Choose a saved database to import its table structure and initial data.")}</TranslatedText></p>
            {libraryLoading && <p role="status"><TranslatedText>{tr("Loading database library…")}</TranslatedText></p>}
            {libraryError && <p className="teacher-state-failed" role="alert">{libraryError}</p>}
            {!libraryLoading && !libraryError && !libraryEntries.length && <p><TranslatedText>{tr("No saved databases yet.")}</TranslatedText></p>}
            {!libraryLoading && !libraryError && libraryEntries.length > 0 && <div className="teacher-database-import-workspace">
              <nav className="teacher-database-import-list" aria-label={tr("Saved databases")}>
                {libraryEntries.map((entry) => {
                  const isSelected = libraryPreviewEntryId === entry.id;
                  const datasetCount = databaseLibraryDatasets(entry).length;
                  return (
                    <div key={entry.id} className={`teacher-database-import-item${isSelected ? " is-active" : ""}`}>
                      <span className="teacher-database-import-item-icon"><Database size={16} aria-hidden="true" /></span>
                      <span className="teacher-database-import-item-copy">
                        <strong>{entry.title}</strong>
                        <small>{entry.createTableFileName || entry.title} · {tr("{value0} datasets", { value0: datasetCount })}</small>
                      </span>
                      <button className="button teacher-database-import-preview-button" type="button" aria-pressed={isSelected} onClick={() => {
                        setLibraryPreviewEntryId(entry.id);
                        setLibraryPreviewDatasetIndex(0);
                      }}><Eye size={13} aria-hidden="true" /><TranslatedText>{tr("Preview")}</TranslatedText></button>
                    </div>
                  );
                })}
              </nav>

              <div className="teacher-database-import-preview">
                {previewLibraryEntry ? <>
                  <header className="teacher-database-import-preview-heading">
                    <div><strong>{previewLibraryEntry.title}</strong><span>{previewLibraryEntry.createTableFileName || previewLibraryEntry.title}</span></div>
                    <span className="teacher-database-import-preview-badge"><Database size={12} aria-hidden="true" />SQL Server</span>
                  </header>
                  <div className="teacher-database-import-preview-sections">
                    <section className="teacher-database-import-schema-preview">
                      <h3><TranslatedText>{tr("Database diagram")}</TranslatedText></h3>
                      {previewLibraryTables.length > 0
                        ? <TeacherSchemaDiagram tables={previewLibraryTables} />
                        : <p className="teacher-schema-diagram-message is-error"><TranslatedText>{tr("No CREATE TABLE statements in this database.")}</TranslatedText></p>}
                    </section>
                    <section className="teacher-database-import-data-preview">
                      <div className="teacher-database-import-data-heading">
                        <h3><TranslatedText>{tr("Test datasets")}</TranslatedText></h3>
                        <label>
                          <span><TranslatedText>{tr("Select test dataset")}</TranslatedText></span>
                          <select value={libraryPreviewDatasetIndex} onChange={(event) => setLibraryPreviewDatasetIndex(Number(event.target.value))}>
                            {previewLibraryDatasets.map((dataset, index) => <option key={`${dataset.fileName}-${index}`} value={index}>{tr("Dataset {value0}", { value0: index + 1 })} · {dataset.fileName}</option>)}
                          </select>
                        </label>
                      </div>
                      {previewLibraryDataset && <DatasetDataPreview datasetNumber={libraryPreviewDatasetIndex + 1} seedData={previewLibraryDataset.sql || ""} />}
                    </section>
                  </div>
                  <div className="teacher-database-import-dialog-actions">
                    <button className="button" type="button" onClick={() => setLibraryImportOpen(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
                    <button className="button primary" type="button" onClick={() => importDatabaseEntry(previewLibraryEntry)}><Download size={14} aria-hidden="true" /><TranslatedText>{tr("Import")}</TranslatedText></button>
                  </div>
                </> : <div className="teacher-database-import-preview-empty"><Database size={24} aria-hidden="true" /><p><TranslatedText>{tr("Select a database to preview its tables and data.")}</TranslatedText></p></div>}
              </div>
            </div>}
          </div>
        </Dialog>
      )}
      {pendingNavigation && (
        <Dialog title={tr("Unsaved changes")} onClose={() => setPendingNavigation(null)}>
          <div className="teacher-preview-dialog">
            <p><TranslatedText>{tr("You have unsaved changes. Would you like to save before leaving?")}</TranslatedText></p>
          {!saving && saveState && saveState !== "Unsaved changes" && saveState !== "Saved" && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(saveState)}</TranslatedText></p>}
            <div className="teacher-dialog-actions">
              <button className="button" type="button" disabled={saving} onClick={() => setPendingNavigation(null)}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
              <button className="button primary" type="button" disabled={saving || !problem.title.trim()} onClick={() => { if (pendingNavigation) void saveProblem(pendingNavigation); }}><TranslatedText>{tr("Save and exit")}</TranslatedText></button>
              <button className="button teacher-danger-button" type="button" disabled={saving} onClick={() => {
                const destination = pendingNavigation;
                setPendingNavigation(null);
                if (destination) navigate(destination);
              }}><TranslatedText>{tr("Leave without saving")}</TranslatedText></button>
            </div>
          </div>
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog title={tr("Delete problem")} onClose={() => { if (!deleteBusy) setConfirmDelete(false); }}>
          <div className="teacher-preview-dialog">
            <p><TranslatedText>{tr("Delete")}</TranslatedText> <strong>{problem.number} · {problem.title}</strong>?</p>
            <p className="muted"><TranslatedText>{tr("This cannot be undone. Related submissions and saved drafts will also be removed.")}</TranslatedText></p>
            {deleteError && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(deleteError)}</TranslatedText></p>}
            <div className="teacher-dialog-actions">
              <button className="button" type="button" disabled={deleteBusy} onClick={() => setConfirmDelete(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button>
              <button className="button teacher-danger-button" type="button" disabled={deleteBusy} onClick={() => void deleteProblem()}><TranslatedText>{deleteBusy ? tr("Deleting…") : tr("Delete")}</TranslatedText></button>
            </div>
          </div>
        </Dialog>
      )}
      {dialog && (
        <Dialog
          title={dialog === "statement" ? tr("Edit statement") : dialog === "requirements" ? tr("Edit requirements") : `${tr("HINT")} ${String((dialogHintIndex ?? 0) + 1).padStart(2, "0")}`}
          className="teacher-long-text-dialog"
          onClose={() => setDialog(null)}
          closeOnBackdrop={false}
          closeOnCancel={false}
        >
          <div className="teacher-long-text-dialog-body">
            <div className="teacher-long-text-editor-panel">
              <div className="teacher-markdown-toolbar" role="toolbar" aria-label={tr("Text formatting")}>
                <strong className="teacher-long-text-toolbar-title">
                  <TranslatedText>{dialog === "statement" ? tr("Edit statement") : dialog === "requirements" ? tr("Edit requirements") : `${tr("HINT")} ${String((dialogHintIndex ?? 0) + 1).padStart(2, "0")}`}</TranslatedText>
                </strong>
                <button type="button" aria-label={tr("Bold")} title={tr("Bold (Ctrl/Cmd+B)")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("bold")}><strong>B</strong></button>
                <button type="button" aria-label={tr("Italic")} title={tr("Italic (Ctrl/Cmd+I)")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("italic")}><em>I</em></button>
                <button type="button" aria-label={tr("Inline code")} title={tr("Inline code")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("code")}>&lt;/&gt;</button>
                <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
                <button type="button" aria-label={tr("Bulleted list")} title={tr("Bulleted list")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("bullets")}><TranslatedText>{tr("• List")}</TranslatedText></button>
                <button type="button" aria-label={tr("Numbered list")} title={tr("Numbered list")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("numbers")}><TranslatedText>{tr("1. List")}</TranslatedText></button>
                <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
                <output
                  className="teacher-markdown-toolbar-size"
                  aria-live="polite"
                  aria-label={tr("Selected text size")}
                  title={tr("Selected text size")}
                >
                  <TranslatedText>{selectedTextSize === "mixed" ? tr("Mixed") : selectedTextSize ? `${selectedTextSize} px` : "—"}</TranslatedText>
                </output>
                <button type="button" aria-label={tr("Decrease selected text size")} title={tr("Decrease selected text size")} onMouseDown={(event) => event.preventDefault()} onClick={() => adjustSelectedTextSize(-1)}>A−</button>
                <button type="button" aria-label={tr("Increase selected text size")} title={tr("Increase selected text size")} onMouseDown={(event) => event.preventDefault()} onClick={() => adjustSelectedTextSize(1)}>A+</button>
                <span className="teacher-markdown-toolbar-spacer" aria-hidden="true" />
                <button className="button primary teacher-long-text-done" type="button" onClick={() => setDialog(null)}>
                  <TranslatedText>{tr("Done")}</TranslatedText>
                </button>
              </div>
              <div
                className="teacher-long-text-editor teacher-rich-text-editor"
                aria-label={dialog === "statement" ? tr("Problem statement") : dialog === "requirements" ? tr("Problem requirements") : `${tr("HINT")} ${String((dialogHintIndex ?? 0) + 1).padStart(2, "0")}`}
                ref={richTextEditorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                suppressContentEditableWarning
                onInput={updateRichTextValue}
                onKeyDown={(event) => {
                  if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
                  if (event.key.toLowerCase() === "b") {
                    event.preventDefault();
                    applyRichTextFormat("bold");
                  } else if (event.key.toLowerCase() === "i") {
                    event.preventDefault();
                    applyRichTextFormat("italic");
                  }
                }}
              />
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
