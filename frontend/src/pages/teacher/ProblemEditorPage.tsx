import CodeMirror from "@uiw/react-codemirror";
import { sql, MSSQL } from "@codemirror/lang-sql";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog, ErrorState, Loading, Status } from "../../components/ui";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { teacherService } from "../../services/teacherService";
import { type TeacherProblem } from "../../data/teacherTypes";
import { TeacherField, TeacherSectionTitle } from "./TeacherPageParts";
import { parseDatabaseSchema } from "../../utils/parseDatabaseSchema";
import { parseSeedData } from "../../utils/parseSeedData";

const PROBLEM_TOPIC_OPTIONS = [
  "SELECT",
  "JOIN",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "WHERE",
  "SUBQUERY",
  "CTE",
  "WINDOW FUNCTION",
  "NULL",
] as const;
const MAX_HINTS = 3;

function parseProblemTopics(value: unknown): string[] {
  const topics = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,·]+/)
      : [];

  return [...new Set(topics.map((topic) => String(topic).trim()).filter(Boolean))];
}

function formatProblemTopics(knownTopics: string[], customTopics: string[]) {
  return [...knownTopics, ...customTopics].join(", ");
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
    && (data?.referenceSolution || "") === (payload?.referenceSolution || "")
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
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
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
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
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
    if (tag === "ul") {
      return `${Array.from(element.children).map((child) => `- ${render(child).trim()}`).join("\n")}\n\n`;
    }
    if (tag === "ol") {
      return `${Array.from(element.children).map((child, index) => `${index + 1}. ${render(child).trim()}`).join("\n")}\n\n`;
    }
    if (tag === "li") return children;
    if (["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) return `${children}\n\n`;
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

function SqlPreview({ value, label, onOpen }: { value: string; label: string; onOpen: () => void }) {
  return (
    <div className="teacher-sql-inline-preview" role="button" tabIndex={0} aria-label={label + " — open editor"} aria-haspopup="dialog"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".cm-gutters")) return;
        const scroller = event.currentTarget.querySelector(".cm-scroller");
        if (scroller) {
          const bounds = scroller.getBoundingClientRect();
          if (event.clientX >= bounds.left + scroller.clientLeft + scroller.clientWidth ||
              event.clientY >= bounds.top + scroller.clientTop + scroller.clientHeight) return;
        }
        onOpen();
      }}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onOpen(); } }}>
      <CodeMirror value={value} height="140px" editable={false} readOnly extensions={[sql({ dialect: MSSQL })]}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }} />
    </div>
  );
}

export function ProblemEditorPage() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const selectedId = problemId || "new";
  const [problem, setProblem] = useState<TeacherProblem | null>(null);
  const [loadError, setLoadError] = useState("");
  const [otherTopicEnabled, setOtherTopicEnabled] = useState(false);
  const [otherTopic, setOtherTopic] = useState("");
  const [preservedCustomTopics, setPreservedCustomTopics] = useState<string[]>([]);
  const [otherTopicError, setOtherTopicError] = useState("");
  const [disabledHints, setDisabledHints] = useState<Set<number>>(new Set());
  
  useEffect(() => {
    async function fetchProblem() {
      setOtherTopicEnabled(false);
      setOtherTopic("");
      setPreservedCustomTopics([]);
      setOtherTopicError("");
      setDisabledHints(new Set());
      setSaveState("");
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
            number: nextNumber, 
            title: "",
            difficulty: "Easy",
            visibility: "Private", 
            topics: "", 
            database: "SQL Server",
            statement: "",
            requirements: "",
            hints: [],
            schema: "",
            seedData: "",
            seedSummary: "",
            referenceSolution: "",
            expectedColumns: [],
            expectedRows: [],
            testCases: [{ seedData: "", isHidden: false }]
          });
          return;
        }

        const data = await teacherService.getProblem(selectedId);
        const loadedTopics = parseProblemTopics(data.topics?.length ? data.topics : data.topic);
        const customTopics = loadedTopics.filter(
          (topic) => !PROBLEM_TOPIC_OPTIONS.includes(topic as (typeof PROBLEM_TOPIC_OPTIONS)[number]),
        );
        setOtherTopicEnabled(customTopics.length > 0);
        setOtherTopic(customTopics[0] || "");
        setPreservedCustomTopics(customTopics.slice(1));
        setDisabledHints(new Set());
        setProblem({
          id: data.id,
          number: data.number || "000",
          title: data.title || "",
          difficulty: data.difficulty || "Easy",
          topics: loadedTopics.join(", "),
          visibility: data.practiceListed ? "Public" : "Private",
          database: data.databaseType || "SQL Server",
          statement: data.description || "",
          requirements: data.requirements || "",
          hints: data.hint ? data.hint.split('\n') : [],
          schema: data.schema || "",
          seedData: data.seedData || "",
          seedSummary: "",
          referenceSolution: data.referenceSolution || "",
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
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationState, setValidationState] = useState("Not validated");
  const [dialog, setDialog] = useState<"preview" | "statement" | "requirements" | null>(null);
  const [sqlEditor, setSqlEditor] = useState<{ field: "schema" | "referenceSolution" | "seed"; index: number; title: string } | null>(null);
  const [sqlDraft, setSqlDraft] = useState("");
  const [activeDataset, setActiveDataset] = useState(0);
  const [datasetNames, setDatasetNames] = useState<string[]>([]);
  useEffect(() => {
    setActiveDataset(0);
    try {
      const stored = JSON.parse(localStorage.getItem(`teacher-dataset-names:${selectedId}`) || "[]");
      setDatasetNames(Array.isArray(stored) ? stored.map((name) => typeof name === "string" ? name : "") : []);
    } catch { setDatasetNames([]); }
  }, [selectedId]);
  function changeDatasetNames(names: string[]) {
    setDatasetNames(names);
    try { localStorage.setItem(`teacher-dataset-names:${selectedId}`, JSON.stringify(names)); } catch { /* Editing remains available when storage is blocked. */ }
  }
  const [previewTab, setPreviewTab] = useState<"Description" | "Database">("Description");
  const [previewHintOpen, setPreviewHintOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    if (!problem || (dialog !== "statement" && dialog !== "requirements")) return;
    const editor = richTextEditorRef.current;
    if (!editor) return;
    editor.innerHTML = markdownToEditorHtml(problem[dialog]);
    editor.focus({ preventScroll: true });
    setSelectedTextSize(null);
  }, [dialog, selectedId, problem?.id]);

  useEffect(() => {
    if (dialog !== "statement" && dialog !== "requirements") {
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
    return <div className="teacher-page">{loadError ? <ErrorState title="Problem editor unavailable" message={loadError} onRetry={() => window.location.reload()} /> : <Loading label="Loading problem editor…" />}</div>;
  }

  const selectedKnownTopics = parseProblemTopics(problem.topics).filter((topic) =>
    PROBLEM_TOPIC_OPTIONS.includes(topic as (typeof PROBLEM_TOPIC_OPTIONS)[number]),
  );
  const preservedTopics = otherTopicEnabled ? preservedCustomTopics : [];
  const customTopicPrefix = formatProblemTopics(selectedKnownTopics, preservedTopics);
  const availableCustomTopicLength = Math.max(
    0,
    100 - customTopicPrefix.length - (customTopicPrefix ? 2 : 0),
  );
  const schemaText = problem.schema || "";
  const schemaTables = parseDatabaseSchema(schemaText);
  const seedDataText = problem.testCases?.[0]?.seedData || problem.seedData || "";
  const seedTables = parseSeedData(seedDataText);

  function update<K extends keyof TeacherProblem>(
    field: K,
    value: TeacherProblem[K],
  ) {
    setProblem((current) => current ? ({ ...current, [field]: value }) : null);
    setSaveState("Unsaved changes");
    setValidationState("Not validated");
  }

  function openSqlEditor(field: "schema" | "referenceSolution" | "seed", index = 0) {
    if (!problem) return;
    const title = field === "schema" ? "Schema SQL" : field === "referenceSolution" ? "Reference solution SQL" : `Test dataset ${index + 1} SQL`;
    setSqlDraft(field === "seed" ? (problem.testCases || [{ seedData: problem.seedData, isHidden: false }])[index].seedData : problem[field]);
    setSqlEditor({ field, index, title });
  }

  function applySqlEditor() {
    if (!problem || !sqlEditor) return;
    if (sqlEditor.field === "seed") {
      const datasets = [...(problem.testCases || [{ seedData: problem.seedData, isHidden: false }])];
      datasets[sqlEditor.index] = { ...datasets[sqlEditor.index], seedData: sqlDraft };
      update("testCases", datasets);
    } else update(sqlEditor.field, sqlDraft);
    setSqlEditor(null);
  }

  function updateRichTextValue() {
    if (!problem || (dialog !== "statement" && dialog !== "requirements")) return;
    const editor = richTextEditorRef.current;
    if (!editor) return;
    update(dialog, editorHtmlToMarkdown(editor.innerHTML));
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

  async function validate() {
    if (!problem || validating) return;
    setValidating(true);
    setValidationState("Validating...");
    try {
      const tc = (problem.testCases || [{seedData: problem.seedData}])[0];
      const result = await teacherService.validateSolution({
        database: problem.database,
        schema: problem.schema,
        seedData: tc.seedData,
        referenceSolution: problem.referenceSolution
      });
      if ((result.status === "Success" || result.status === "Tabular result") && result.table) {
        update("expectedColumns", result.table.columns);
        update("expectedRows", result.table.rows);
        setValidationState("Validation passed · Output updated");
      } else if (result.status === "Success") {
        setValidationState("Validation passed · no tabular output");
      } else {
        setValidationState(`Validation error: ${result.message}`);
      }
    } catch (e: any) {
      setValidationState(`Validation error: ${e.message}`);
    } finally {
      setValidating(false);
    }
  }

  async function saveProblem() {
    if (!problem || saving) return;
    if (!problem.title.trim()) { setSaveState("Enter a title before saving."); return; }
    if (otherTopicEnabled && !otherTopic.trim()) {
      setOtherTopicError("Enter a name for the custom topic.");
      setSaveState("Enter a name for the custom topic before saving.");
      return;
    }
    if (otherTopicEnabled && otherTopic.includes(",")) {
      setOtherTopicError("Commas cannot be used in a topic name.");
      setSaveState("Remove the comma from the custom topic before saving.");
      return;
    }
    const customTopics = otherTopicEnabled
      ? [...preservedCustomTopics, otherTopic.trim()]
      : [];
    const topicsValue = formatProblemTopics(selectedKnownTopics, customTopics);
    if (topicsValue.length > 100) {
      setOtherTopicError("The combined topic names must be 100 characters or fewer.");
      setSaveState("Shorten the topic names before saving.");
      return;
    }
    const payload = {
        number: problem.number,
        title: problem.title,
        difficulty: problem.difficulty,
        visibility: problem.visibility,
        topics: topicsValue,
        statement: problem.statement,
        requirements: problem.requirements,
        hints: problem.hints.filter((_, index) => !disabledHints.has(index)),
        database: problem.database,
        schema: problem.schema,
        testCases: problem.testCases || [{ seedData: problem.seedData, isHidden: false }],
        referenceSolution: problem.referenceSolution
    };
    setSaving(true);
    setSaveState("Saving to server...");
    try {
        if (selectedId === "new") {
            await teacherService.createProblem(payload);
        } else {
            await teacherService.updateProblem(selectedId, payload);
        }
        
        setSaveState("Saved");
        if (selectedId === "new") {
            navigate("/teacher/problems");
        }
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to save to server.";
        if (selectedId !== "new" && /internal server error/i.test(message)) {
          try {
            const savedProblem = await teacherService.getProblem(selectedId);
            if (problemPayloadWasSaved(savedProblem, payload)) {
              setSaveState("Saved");
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
      <div className="teacher-builder-layout teacher-problem-editor-layout">
        <section className="teacher-builder-main teacher-editor-details">
          <TeacherSectionTitle title="Problem details" />
          <section className="teacher-problem-details-section teacher-problem-basics-section">
            <TeacherSectionTitle title="Basic information" />
          <div className="teacher-field-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px' }}>
            <TeacherField label="NUMBER">
              <input
                value={problem.number}
                onChange={(event) => update("number", event.target.value)}
              />
            </TeacherField>
            <TeacherField label="TITLE">
              <input
                value={problem.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </TeacherField>
          </div>
          <div className="teacher-field-row">
            <TeacherField label="DIFFICULTY">
              <select
                value={problem.difficulty}
                onChange={(event) =>
                  update("difficulty", event.target.value as TeacherProblem["difficulty"])
                }
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </TeacherField>
          </div>
          </section>
          <section className="teacher-problem-details-section teacher-problem-topics-section">
            <TeacherSectionTitle title="Topics & visibility" />
          <TeacherField label="TOPICS">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {[...PROBLEM_TOPIC_OPTIONS, "OTHER"].map(t => {
                const isOther = t === "OTHER";
                const isSelected = isOther
                  ? otherTopicEnabled
                  : selectedKnownTopics.includes(t);
                return (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '6px', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        if (isOther && e.target.checked) {
                          setOtherTopicEnabled(true);
                          setOtherTopicError("");
                          update("topics", formatProblemTopics(selectedKnownTopics, preservedCustomTopics));
                        } else if (isOther) {
                          setOtherTopicEnabled(false);
                          setOtherTopic("");
                          setPreservedCustomTopics([]);
                          setOtherTopicError("");
                          update("topics", formatProblemTopics(selectedKnownTopics, []));
                        } else if (e.target.checked) {
                          const nextTopics = [...new Set([...selectedKnownTopics, t])];
                          update("topics", formatProblemTopics(
                            nextTopics,
                            otherTopicEnabled
                              ? [...preservedCustomTopics, ...(otherTopic.trim() ? [otherTopic.trim()] : [])]
                              : [],
                          ));
                        } else {
                          const nextTopics = selectedKnownTopics.filter((topic) => topic !== t);
                          update("topics", formatProblemTopics(
                            nextTopics,
                            otherTopicEnabled
                              ? [...preservedCustomTopics, ...(otherTopic.trim() ? [otherTopic.trim()] : [])]
                              : [],
                          ));
                        }
                      }}
                      style={{ margin: 0, width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: isSelected ? 500 : 400 }}>{t}</span>
                  </label>
                )
              })}
            </div>
          </TeacherField>
          {otherTopicEnabled && (
            <div className="teacher-custom-topic">
              <TeacherField label="OTHER TOPIC">
                <input
                  value={otherTopic}
                  maxLength={availableCustomTopicLength}
                  aria-invalid={Boolean(otherTopicError)}
                  aria-describedby="other-topic-help other-topic-error"
                  onChange={(event) => {
                    const value = event.target.value;
                    setOtherTopic(value);
                    if (value.includes(",")) {
                      setOtherTopicError("Commas cannot be used in a topic name.");
                    } else {
                      setOtherTopicError("");
                    }
                    update("topics", formatProblemTopics(
                      selectedKnownTopics,
                      [...preservedCustomTopics, ...(value.trim() && !value.includes(",") ? [value.trim()] : [])],
                    ));
                  }}
                />
              </TeacherField>
              <small id="other-topic-help" className="teacher-visibility-help">
                Enter one topic name. Commas separate topics; all topic names together can use up to 100 characters.
              </small>
              {otherTopicError && (
                <small id="other-topic-error" className="field-error" role="alert">
                  {otherTopicError}
                </small>
              )}
            </div>
          )}
          <TeacherField label="VISIBILITY">
            <select
              value={problem.visibility}
              onChange={(event) => update("visibility", event.target.value as TeacherProblem["visibility"])}
            >
              <option>Private</option>
              <option>Public</option>
            </select>
            <small className="teacher-visibility-help">
              {problem.visibility === "Private"
                ? "Private problems are available to students through assigned work. Public problems appear in Practice."
                : "Public problems are listed in Practice for all students."}
            </small>
          </TeacherField>
          </section>
          <section className="teacher-problem-details-section teacher-problem-content-section">
            <TeacherSectionTitle title="Problem content" />
          <div className="teacher-field teacher-long-text-field">
            <div className="teacher-long-text-heading">
              <span>STATEMENT</span>
              <button className="button teacher-small-button" type="button" onClick={() => setDialog("statement")}>
                Open editor
              </button>
            </div>
            <div
              className="teacher-long-text-inline-preview"
              role="button"
              tabIndex={0}
              aria-label="Open statement editor"
              onClick={() => setDialog("statement")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setDialog("statement");
              }}
            >
              <ProblemMarkdown>{problem.statement || "No statement yet."}</ProblemMarkdown>
            </div>
          </div>
          <div className="teacher-field teacher-long-text-field">
            <div className="teacher-long-text-heading">
              <span>REQUIREMENTS</span>
              <button className="button teacher-small-button" type="button" onClick={() => setDialog("requirements")}>
                Open editor
              </button>
            </div>
            <div
              className="teacher-long-text-inline-preview"
              role="button"
              tabIndex={0}
              aria-label="Open requirements editor"
              onClick={() => setDialog("requirements")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setDialog("requirements");
              }}
            >
              <ProblemMarkdown>{problem.requirements || "No requirements yet."}</ProblemMarkdown>
            </div>
          </div>
          </section>
          <section className="teacher-problem-details-section teacher-problem-hints-section">
            <div className="teacher-problem-section-heading">
              <TeacherSectionTitle title="Hints" />
              <button
                className="button teacher-small-button"
                type="button"
                disabled={problem.hints.length >= MAX_HINTS}
                title={problem.hints.length >= MAX_HINTS ? "A problem can have up to 3 hints." : undefined}
                onClick={() => {
                  if (problem.hints.length >= MAX_HINTS) return;
                  update("hints", [...problem.hints, ""]);
                }}
              >
                {problem.hints.length >= MAX_HINTS ? "Maximum 3 hints" : "Add hint"}
              </button>
            </div>
          <div className="teacher-hints">
            {problem.hints.length > 0 ? problem.hints.map((hint, index) => {
              const isDisabled = disabledHints.has(index);
              return (
                <div className={`teacher-hint-field${isDisabled ? " is-disabled" : ""}`} key={index}>
                  <div className="teacher-hint-label">
                    <span>HINT {String(index + 1).padStart(2, "0")}</span>
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
                          setSaveState("Unsaved changes");
                          setValidationState("Not validated");
                        }}
                      >
                        {isDisabled ? "Enable" : "Disable"}
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
                        Delete
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    disabled={isDisabled}
                    value={hint}
                    onChange={(event) => {
                      const hints = [...problem.hints];
                      hints[index] = event.target.value;
                      update("hints", hints);
                    }}
                  />
                </div>
              );
            }) : (
                <p className="teacher-empty-section">No hints added yet.</p>
              )}
          </div>
          </section>
          <div className="teacher-problem-footer">
            <div className="teacher-editor-state" role="status" aria-label="Problem status">
              <span className={`teacher-editor-state-item${saveState === "Saved" ? " is-success" : " is-pending"}`}>
                <span className="teacher-editor-state-dot" aria-hidden="true" />
                {saveState || "Unsaved form"}
              </span>
              <span className="teacher-editor-state-separator" aria-hidden="true">·</span>
              <span className={`teacher-editor-state-item${validationState.startsWith("Validation passed") ? " is-success" : validationState.startsWith("Validation error") ? " is-error" : " is-pending"}`}>
                <span className="teacher-editor-state-dot" aria-hidden="true" />
                {validationState}
              </span>
            </div>
            <div className="teacher-page-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setPreviewTab("Description");
                  setPreviewHintOpen(false);
                  setDialog("preview");
                }}
              >
                Preview
              </button>
              {selectedId !== "new" && <button className="button teacher-danger-button" type="button" disabled={saving || validating || deleteBusy} onClick={() => { setDeleteError(""); setConfirmDelete(true); }}>Delete</button>}
              <button className="button primary" type="button" disabled={saving} onClick={saveProblem}>
                {saving ? "Saving…" : "Save problem"}
              </button>
            </div>
          </div>
        </section>

        <aside className="teacher-builder-sidebar teacher-problem-editor-validation">
          <TeacherSectionTitle title="Database & validation" />
          <section className="teacher-validation-section teacher-validation-overview">
            <TeacherField label="SQL DIALECT">
              <select
                value={problem.database}
                onChange={(event) => update("database", event.target.value)}
              >
                <option>SQL Server</option>
              </select>
            </TeacherField>
            <p className="tiny muted">Validation and student execution currently use SQL Server.</p>
          </section>
          <section className="teacher-validation-section">
            <div className="teacher-schema-heading">
              <TeacherSectionTitle title="Schema" />
              <span className="teacher-schema-filename">schema.sql</span>
              <button type="button" className="button teacher-small-button teacher-open-sql-editor" onClick={() => openSqlEditor("schema")}>Open editor</button>
            </div>
            <div className="teacher-code-section">
              <SqlPreview value={problem.schema} label={"Schema SQL"} onOpen={() => openSqlEditor("schema")} />
            </div>
          </section>
          <section className="teacher-validation-section teacher-test-cases-section">
            <div className="teacher-dataset-heading">
              <TeacherSectionTitle title="Test datasets" />
              <span className="teacher-dataset-heading-label">Dataset {activeDataset + 1} /</span>
              <div className="teacher-dataset-file-field">
              <input className="teacher-dataset-filename" aria-label={`Dataset ${activeDataset + 1} file name`} value={(datasetNames[activeDataset] ?? `seed_${activeDataset + 1}.sql`).replace(/\.sql$/i, "")} onChange={(event) => {
                const names = [...datasetNames];
                names[activeDataset] = event.target.value.replace(/\.sql$/i, "") + ".sql";
                changeDatasetNames(names);
              }} />
              <span className="teacher-dataset-file-extension">.sql</span>
              </div>
              <button type="button" className="button teacher-small-button teacher-open-sql-editor" onClick={() => openSqlEditor("seed", activeDataset)}>Open editor</button>
            </div>
            <div className="teacher-dataset-picker">
              <label htmlFor="teacher-dataset-select">Dataset</label>
              <select id="teacher-dataset-select" aria-label="Select test dataset" value={activeDataset} onChange={(event) => setActiveDataset(Number(event.target.value))}>
                {(problem.testCases || [{seedData: problem.seedData, isHidden: false}]).map((_, index) => (
                  <option key={index} value={index}>Dataset {index + 1} / {datasetNames[index] || `seed_${index + 1}.sql`}</option>
                ))}
              </select>
              <button
                type="button"
                className={"button teacher-small-button teacher-dataset-hidden-toggle" + ((problem.testCases || [{seedData: problem.seedData, isHidden: false}])[activeDataset]?.isHidden ? " is-active" : "")}
                aria-pressed={(problem.testCases || [{seedData: problem.seedData, isHidden: false}])[activeDataset]?.isHidden ?? false}
                onClick={() => {
                  const datasets = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                  datasets[activeDataset] = { ...datasets[activeDataset], isHidden: !datasets[activeDataset].isHidden };
                  update("testCases", datasets);
                }}
              >
                Hidden dataset
              </button>
              <button className="button teacher-small-button" type="button" onClick={() => {
                const datasets = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                datasets.push({seedData: "", isHidden: true});
                setActiveDataset(datasets.length - 1);
                update("testCases", datasets);
              }}>Add dataset</button>
            </div>
          {(problem.testCases || [{seedData: problem.seedData, isHidden: false}]).map((tc, index) => index === activeDataset ? (
            <div className="teacher-code-section teacher-test-case" key={index}>
              <div className="teacher-code-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

                  {index > 0 && (
                    <button type="button" className="text-button" style={{ color: 'var(--error)', padding: 0 }} onClick={() => {
                        const newTcs = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                        newTcs.splice(index, 1);
                        const names = newTcs.map((_, nextIndex) => datasetNames[nextIndex < index ? nextIndex : nextIndex + 1] || `seed_${(nextIndex < index ? nextIndex : nextIndex + 1) + 1}.sql`);
                        changeDatasetNames(names);
                        setActiveDataset(Math.min(index, newTcs.length - 1));
                        update("testCases", newTcs);
                    }}>Delete</button>
                  )}
                </div>
              </div>
              <SqlPreview value={tc.seedData} label={`Test dataset ${index + 1} SQL`} onOpen={() => openSqlEditor("seed", index)} />
            </div>
          ) : null)}
            <p className="teacher-seed-summary">Each dataset contains seed SQL loaded before checking a solution. Hidden datasets are not shown to students.</p>
          </section>
          <section className="teacher-validation-section teacher-reference-section">
            <div className="teacher-schema-heading">
              <TeacherSectionTitle title="Reference solution" />
              <span className="teacher-schema-filename">solution.sql</span>
              <button type="button" className="button teacher-small-button teacher-open-sql-editor" onClick={() => openSqlEditor("referenceSolution")}>Open editor</button>
            </div>
            <div className="teacher-code-section">
              <SqlPreview value={problem.referenceSolution} label={"Reference solution SQL"} onOpen={() => openSqlEditor("referenceSolution")} />
            </div>
          </section>
          <section className="teacher-validation-section teacher-validation-run">
            <div className="teacher-validation-run-heading">
              <div>
                <TeacherSectionTitle title="Check solution" />
                <p className="teacher-validation-state">{validationState}</p>
              </div>
              <button className="button primary" type="button" disabled={validating} onClick={validate}>
                {validating ? "Validating…" : "Validate solution"}
              </button>
            </div>
            <div className="teacher-expected-output">
              <TeacherSectionTitle title="Expected output" />
              <div className="teacher-table-scroll">
                <table className="teacher-table">
                  <thead>
                    <tr>
                      {problem.expectedColumns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {problem.expectedRows.map((row, index) => (
                      <tr key={index}>
                        {row.map((value, cellIndex) => (
                          <td key={cellIndex}>{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </aside>
      </div>
      {sqlEditor && (
        <Dialog title={sqlEditor.title} className="teacher-sql-editor-dialog" onClose={() => setSqlEditor(null)} closeOnBackdrop={false} hideClose headerActions={
          <div className="teacher-sql-editor-actions">
            <button type="button" className="button" onClick={() => setSqlEditor(null)}>Cancel</button>
            <button type="button" className="button primary" onClick={applySqlEditor}>Apply changes</button>
          </div>
        }>
          <div className="teacher-sql-editor-content">
            <CodeMirror
              className="teacher-sql-popup-codemirror"
              aria-label={sqlEditor.title}
              autoFocus
              value={sqlDraft}
              height="clamp(240px, 55dvh, 600px)"
              extensions={[sql({ dialect: MSSQL })]}
              basicSetup={{ lineNumbers: true, foldGutter: false }}
              onChange={setSqlDraft}
            />
          </div>
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog title="Delete problem" onClose={() => { if (!deleteBusy) setConfirmDelete(false); }}>
          <div className="teacher-preview-dialog">
            <p>Delete <strong>{problem.number} · {problem.title}</strong>?</p>
            <p className="muted">This cannot be undone. Related submissions and saved drafts will also be removed.</p>
            {deleteError && <p className="teacher-state-failed" role="alert">{deleteError}</p>}
            <div className="teacher-dialog-actions">
              <button className="button" type="button" disabled={deleteBusy} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="button teacher-danger-button" type="button" disabled={deleteBusy} onClick={() => void deleteProblem()}>{deleteBusy ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </Dialog>
      )}
      {dialog === "preview" && (
        <Dialog title="Student preview" className="teacher-student-preview-dialog" onClose={() => setDialog(null)}>
          <div className="teacher-student-preview">
            <div className="teacher-preview-tabs" role="tablist" aria-label="Student preview sections">
              {(["Description", "Database"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={previewTab === tab}
                  className={previewTab === tab ? "active" : ""}
                  onClick={() => setPreviewTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="teacher-student-preview-scroll">
              {previewTab === "Description" ? (
                <div className="teacher-student-preview-content">
                  <p className="teacher-student-preview-eyebrow">PROBLEM {problem.number}</p>
                  <h1>{problem.title || "Untitled problem"}</h1>
                  <div className="teacher-student-preview-meta">
                    <Status value={problem.difficulty || "Unknown"} />
                    <Status value={parseProblemTopics(problem.topics)[0] || "Uncategorized"} />
                    <Status value="Not started" />
                  </div>
                  <ProblemMarkdown>{problem.statement || "No statement yet."}</ProblemMarkdown>
                  <h3>Requirements</h3>
                  <ProblemMarkdown>{problem.requirements || "No requirements yet."}</ProblemMarkdown>
                </div>
              ) : (
                <div className="teacher-student-preview-content teacher-student-preview-database">
                  <h2>Database setup</h2>
                  <p className="muted">SQL Server · read-only schema and seed data used for evaluation</p>
                  <section className="schema-section">
                    <h3>Schema</h3>
                    {schemaTables.length ? (
                      <div className="workspace-schema-tables">
                        {schemaTables.map((table, tableIndex) => (
                          <section className="workspace-schema-table-card" key={`${table.name}-${tableIndex}`}>
                            <h4>{table.name}</h4>
                            <div className="workspace-schema-table-scroll">
                              <table className="workspace-schema-table">
                                <thead><tr><th>Column</th><th>Type</th><th>Constraints</th></tr></thead>
                                <tbody>{table.columns.map((column) => (
                                  <tr key={column.name}>
                                    <th scope="row">{column.name}</th>
                                    <td>{column.type}</td>
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
                                <span className="workspace-schema-extra-constraint" key={`constraint-${index}`}>{constraint}</span>
                              ))}
                            </div>}
                          </section>
                        ))}
                      </div>
                    ) : (
                      <pre className="workspace-schema-code"><code>{schemaText || "No schema provided."}</code></pre>
                    )}
                  </section>
                  <section className="schema-section">
                    <h3>Seed data</h3>
                    {seedTables.length ? (
                      <div className="workspace-seed-tables">
                        {seedTables.map((table, tableIndex) => (
                          <section className="workspace-schema-table-card" key={`${table.name}-${tableIndex}`}>
                            <h4>{table.name}</h4>
                            <div className="workspace-schema-table-scroll">
                              <table className="workspace-seed-table">
                                <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                                <tbody>{table.rows.map((row, rowIndex) => (
                                  <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${table.columns[columnIndex]}-${columnIndex}`}>{value}</td>)}</tr>
                                ))}</tbody>
                              </table>
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <pre className="workspace-schema-code"><code>{seedDataText || "No seed data provided."}</code></pre>
                    )}
                  </section>
                </div>
              )}
            </div>
            {previewHintOpen && (
              <section className="teacher-student-preview-hint" aria-live="polite">
                <div className="teacher-student-preview-hint-heading">
                  <strong>Hint</strong>
                  <button type="button" onClick={() => setPreviewHintOpen(false)}>Close</button>
                </div>
                {problem.hints.filter((hint, index) => !disabledHints.has(index) && hint.trim()).length > 0 ? (
                  problem.hints
                    .filter((hint, index) => !disabledHints.has(index) && hint.trim())
                    .map((hint, index) => <ProblemMarkdown key={index}>{hint}</ProblemMarkdown>)
                ) : (
                  <p className="tiny muted">No hints are available for this problem.</p>
                )}
              </section>
            )}
            <div className="teacher-student-preview-dock">
              <button type="button" onClick={() => setPreviewHintOpen((open) => !open)}>
                {previewHintOpen ? "Hide hint" : "Show hint"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {(dialog === "statement" || dialog === "requirements") && (
        <Dialog
          title={dialog === "statement" ? "Edit statement" : "Edit requirements"}
          className="teacher-long-text-dialog"
          onClose={() => setDialog(null)}
          closeOnBackdrop={false}
          closeOnCancel={false}
        >
          <div className="teacher-long-text-dialog-body">
            <div className="teacher-long-text-editor-panel">
              <div className="teacher-markdown-toolbar" role="toolbar" aria-label="Text formatting">
                <strong className="teacher-long-text-toolbar-title">
                  {dialog === "statement" ? "Edit statement" : "Edit requirements"}
                </strong>
                <button type="button" aria-label="Bold" title="Bold (Ctrl/Cmd+B)" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("bold")}><strong>B</strong></button>
                <button type="button" aria-label="Italic" title="Italic (Ctrl/Cmd+I)" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("italic")}><em>I</em></button>
                <button type="button" aria-label="Inline code" title="Inline code" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("code")}>&lt;/&gt;</button>
                <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
                <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("bullets")}>• List</button>
                <button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextFormat("numbers")}>1. List</button>
                <span className="teacher-markdown-toolbar-divider" aria-hidden="true" />
                <output
                  className="teacher-markdown-toolbar-size"
                  aria-live="polite"
                  aria-label="Selected text size"
                  title="Selected text size"
                >
                  {selectedTextSize === "mixed" ? "Mixed" : selectedTextSize ? `${selectedTextSize} px` : "—"}
                </output>
                <button type="button" aria-label="Decrease selected text size" title="Decrease selected text size" onMouseDown={(event) => event.preventDefault()} onClick={() => adjustSelectedTextSize(-1)}>A−</button>
                <button type="button" aria-label="Increase selected text size" title="Increase selected text size" onMouseDown={(event) => event.preventDefault()} onClick={() => adjustSelectedTextSize(1)}>A+</button>
                <span className="teacher-markdown-toolbar-spacer" aria-hidden="true" />
                <button className="button primary teacher-long-text-done" type="button" onClick={() => setDialog(null)}>
                  Done
                </button>
              </div>
              <div
                className="teacher-long-text-editor teacher-rich-text-editor"
                aria-label={dialog === "statement" ? "Problem statement" : "Problem requirements"}
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
