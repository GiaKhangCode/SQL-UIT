import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { workspaceDraftKey, workspaceParts } from "../../../utils/workspaceParts";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { X, Star, RotateCcw, Maximize2, Minimize2, Braces } from "lucide-react";
import { indentRange } from "@codemirror/language";
import { sqlEditorExtensions } from "../../../components/sqlEditorExtensions";
import { useAuth } from "../../../context/AuthContext";
import { WorkspaceTools } from "../../../components/WorkspaceTools";
import { clamp as clampPaneSize, defaults, readLayouts, workspaceKey, type Layout, type PaneSizes } from "../../../utils/workspacePreferences";
import "../../../styles/workspace.css";
import { AppHeader } from "../../../components/AppHeader";
import { DataGrid, Dialog, Loading, Status } from "../../../components/ui";
import { ProblemExpectedOutput } from "../../../components/ProblemExpectedOutput";
import { ProblemMarkdown } from "../../../components/ProblemMarkdown";
import { studentApi, type QueryResult } from "../../../services/studentApi";
import { storage } from "../../../services/storage";
import type { Problem, Submission } from "../../../data/models";
import { parseDatabaseSchema } from "../../../utils/parseDatabaseSchema";
import { parseSeedData } from "../../../utils/parseSeedData";
import { AiChatPanel } from "../../../components/AiChatPanel";
import { AlertCircle, Play, LayoutGrid } from "lucide-react";
import { type ContestWorkspaceController } from "./useContestWorkspace";
import type { Contest } from "../../../data/models";
import { useProblemWorkspaceLayout } from "./components/ProblemWorkspaceLayoutContext";
import { WorkspaceResizeHandle } from "./components/WorkspaceResizeHandle";
import { WorkspaceDatabasePanel, type WorkspaceDatabaseState } from "./components/WorkspaceDatabasePanel";
import { WorkspaceSubmissionPanel, type WorkspaceAttempt } from "./components/WorkspaceSubmissionPanel";
import { WorkspaceProblemSwitcher } from "./components/WorkspaceProblemSwitcher";

import { WorkspaceEditorStatus } from "./components/WorkspaceEditorStatus";
import { useWorkspaceExam, WorkspaceExamFinishButton } from "./components/WorkspaceExamContext";

const DEFAULT_EDITOR_HEIGHT = 58;

const MIN_PROBLEM_WIDTH = 18;

const MAX_PROBLEM_WIDTH = 50;

const MIN_EDITOR_HEIGHT = 30;

const MAX_EDITOR_HEIGHT = 75;


export function SqlWorkspace({ problem, embedded = false, setupScripts, database, readOnly: parentReadOnly = false, onUserEdit, submissionAttempts: externalAttempts, submissionBusy = false, submissionNotice = "", submissionSignal = 0, submissionsUsed: parentSubmissionsUsed, maxSubmissions: parentMaxSubmissions }: {
  problem: Problem; database?: WorkspaceDatabaseState; embedded?: boolean; setupScripts?: { ddl: string; dml: string };
  readOnly?: boolean; onUserEdit?: () => void; submissionAttempts?: WorkspaceAttempt[]; submissionBusy?: boolean; submissionNotice?: string;
  submissionSignal?: number; submissionsUsed?: number; maxSubmissions?: number | null;
}) {
  const { t: tr } = useLanguage("workspace");
  const { session } = useAuth();
  const exam = useWorkspaceExam();
  const layoutKey = workspaceKey(session?.id || "anonymous", "preferences", "layouts");
  const notesKey = workspaceKey(session?.id || "anonymous", problem.id, "notes");
  const sharedLayout = useProblemWorkspaceLayout();
  const [localPreferences, setLocalPreferences] = useState(() => readLayouts(layoutKey));
  const preferences = sharedLayout?.preferences ?? localPreferences;
  const setPreferences = sharedLayout?.setPreferences ?? setLocalPreferences;
  const layout = preferences.layout;
  const [localFocus, setLocalFocus] = useState(false);
  const focus = sharedLayout?.focus ?? localFocus;
  const setFocus = sharedLayout?.setFocus ?? setLocalFocus;
  const [focusHeight, setFocusHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [notes, setNotes] = useState(() => storage.get(notesKey) || "");
  const { problemWidth, secondBoundary } = preferences.sizes[layout];
  const editorHeight = focus ? focusHeight : preferences.sizes[layout].editorHeight;
  const threeColumns = !focus && (layout === "Leet" || layout === "Debug");
  function updateSizes(change: Partial<PaneSizes>) {
    setPreferences(value => ({ ...value, sizes: { ...value.sizes, [value.layout]: { ...value.sizes[value.layout], ...change } } }));
  }
  function setProblemWidth(value: number | ((previous: number) => number)) {
    updateSizes({ problemWidth: typeof value === "function" ? value(problemWidth) : value });
  }
  function setEditorHeight(value: number | ((previous: number) => number)) {
    const next = typeof value === "function" ? value(editorHeight) : value;
    if (focus) setFocusHeight(next); else updateSizes({ editorHeight: next });
  }
  function chooseLayout(value: Layout) {
    setPreferences(previous => ({ ...previous, layout: value }));
    setExpanded(false);
    setFocus(false);
    if (value === "Debug") setProblemTab("Database");
  }
  function toggleFocus() {
    if (!focus) setFocusHeight(preferences.sizes[layout].editorHeight);
    setFocus(value => !value); setExpanded(false); setMobileTab("SQL");
  }
  const [params] = useSearchParams();
  const source: Submission["source"] =
    params.get("source") === "Assignments"
      ? "Assignments"
      : params.get("source") === "Contests"
        ? "Contests"
        : "Practice";
  const context = params.get("context") || source;
  const contextTitle = params.get("contextTitle") || context;
  const sqlDraftKey = workspaceDraftKey(session?.id || "anonymous", problem.id, context) + ":SQL";
  const contestMode = source === "Contests";
  const navigate = useNavigate();
  const contestId = params.get("contest") || (contestMode ? context : "");
  useEffect(() => {
    if (!contestMode || !contestId) return;
    let cancelled = false;
    studentApi.getContests().then((contests) => {
      if (!cancelled && contests.find((item) => item.id === contestId)?.examType === "comprehensive") {
        navigate(`/contests/${encodeURIComponent(contestId)}/exam`, { replace: true });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [contestMode, contestId, navigate]);
  const contestClosed = contestMode && params.get("closed") === "1";
  const contestAiAllowed = !contestMode || params.get("aiAllowed") === "1";
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [resizing, setResizing] = useState<"vertical" | "horizontal" | "secondary" | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const editor = useRef<EditorView | null>(null);
  const workspaceLayout = useRef<HTMLDivElement | null>(null);
  const editorResults = useRef<HTMLDivElement | null>(null);
  const activeResize = useRef<"vertical" | "horizontal" | "secondary" | null>(null);
  const expandTrigger = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState(
    () => (exam?.draft(problem.id)?.query ?? (exam?.enabled ? "" : undefined)) ?? (setupScripts || source !== "Practice" ? storage.get(sqlDraftKey) : studentApi.getDraft(problem.id)) ?? (problem.draft || ""),
  );
  const syncDraft = exam?.update;
  useEffect(() => { syncDraft?.(problem.id, { query: code }); }, [syncDraft, problem.id]);
  const [selected, setSelected] = useState("");
  const [problemTab, setProblemTab] = useState(layout === "Debug" ? "Database" : "Description");
  const [resultTab, setResultTab] = useState("Run result");
  const [mobileTab, setMobileTab] = useState("Problem");
  const [help, setHelp] = useState<"Hint" | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<WorkspaceAttempt[]>([]);
  const attemptCounter = useRef(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [lastSubmit, setLastSubmit] = useState<QueryResult | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [editedSinceSubmission, setEditedSinceSubmission] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(Boolean(embedded || exam?.enabled));
  const [historySubmissionsUsed, setHistorySubmissionsUsed] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const submissionsUsed = parentSubmissionsUsed ?? lastSubmit?.submissionsUsed ?? exam?.submissionCounts[problem.id] ?? historySubmissionsUsed;
  const maxSubmissions = parentMaxSubmissions ?? lastSubmit?.maxSubmissions ?? exam?.maxSubmissions ?? null;
  const submissionLimitReached = maxSubmissions != null && submissionsUsed >= maxSubmissions;
  const isReadOnly = parentReadOnly || reviewMode || (!embedded && !historyLoaded && !exam?.enabled);
  const exitDestination = source === "Contests" ? `/contests/${encodeURIComponent(context)}` : source === "Assignments" ? `/assignments/work/${encodeURIComponent(context)}` : "/dashboard";
  const [confirmResetQuery, setConfirmResetQuery] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (focus) { setExpanded(false); setMobileTab("SQL"); }
  }, [focus]);
  useEffect(() => { if (layout === "Debug") setProblemTab("Database"); }, [layout]);
  const helpTrigger = useRef<HTMLButtonElement | null>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const aiTrigger = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (setupScripts || source !== "Practice") storage.set(sqlDraftKey, code);
    else studentApi.saveDraft(problem.id, code);
  }, [code, problem.id, sqlDraftKey, Boolean(setupScripts)]);
  useEffect(() => { if (!sharedLayout) storage.set(layoutKey, JSON.stringify(preferences)); }, [layoutKey, preferences, sharedLayout]);
  useEffect(() => {
    const node = workspaceLayout.current;
    if (!node) return;
    const observer = new ResizeObserver(() => editor.current?.requestMeasure());
    const editorNode = node.querySelector(".sql-editor");
    if (editorNode) observer.observe(editorNode);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    studentApi.getPreferences().then((preferences) => {
      if (active) setFavorite(preferences.favorites.includes(problem.id));
    }).catch(() => { if (active) setNotice("Could not load saved problems."); });
    return () => { active = false; };
  }, [problem.id]);
  useEffect(() => {
    if (embedded || exam?.enabled) return;
    let active = true;
    if (typeof studentApi.getSubmissions !== "function") {
      setHistoryLoaded(true);
      return () => { active = false; };
    }
    studentApi.getSubmissions({ source }).then((response) => {
      if (!active || !Array.isArray(response)) return;
      const matching = (response as Submission[])
        .filter(item => item.problemId === problem.id && item.context === context && [source, source === "Assignments" ? "Assignment" : source === "Contests" ? "Contest" : "Practice"].includes(item.source))
        .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      setHistorySubmissionsUsed(matching.length);
      if (matching.length) {
        const latest = matching[0];
        setReviewMode(true);
        setHasSubmitted(true);
        setEditedSinceSubmission(false);
        setProblemTab("Submission");
        setLastSubmit({
          status: latest.result,
          message: latest.feedback || (latest.result === "Pending review" ? "Your work has been submitted for teacher review." : "Previously submitted work."),
          score: latest.score,
          scoreVisible: latest.scoreVisible,
          maxScore: latest.maxScore,
        });
        setAttempts(matching.slice(0, 20).map((item, index) => ({
          id: matching.length - index,
          kind: "submit" as const,
          result: {
            status: item.result,
            message: item.feedback || (item.result === "Pending review" ? "Your work has been submitted for teacher review." : "Previously submitted work."),
            score: item.score,
            scoreVisible: item.scoreVisible,
            maxScore: item.maxScore,
          },
        })));
        if (typeof latest.query === "string") setCode(latest.query);
      }
    }).catch(() => {}).finally(() => { if (active) setHistoryLoaded(true); });
    return () => { active = false; };
  }, [embedded, exam?.enabled, problem.id, source, context]);
  useEffect(() => {
    if (!submissionSignal) return;
    setProblemTab("Submission");
    if (embedded) {
      const submittedQuery = storage.get(sqlDraftKey);
      if (submittedQuery !== null) setCode(submittedQuery);
    }
  }, [submissionSignal, embedded, sqlDraftKey]);
  async function toggleSaved() {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      const response = await studentApi.toggleFavorite(problem.id);
      setFavorite(response.status === "added");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update saved problems.");
    } finally {
      setFavoriteBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    if (help) {
      setHelpText("Loading guidance…");
      studentApi.getHint(problem.id, source === "Practice" ? undefined : context).then((t) => {
        if (active) setHelpText(t);
      }).catch(() => { if (active) setHelpText("Guidance is unavailable right now."); });
      helpClose.current?.focus();
    }
    return () => {
      active = false;
    };
  }, [help, problem.id, source, context]);
  function closeHelp() {
    setHelp(null);
    helpTrigger.current?.focus();
  }
  function closeAiPanel() {
    setIsAiPanelOpen(false);
    aiTrigger.current?.focus();
  }
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expanded) {
          setExpanded(false);
          expandTrigger.current?.focus();
          return;
        }
        if (help) {
          setHelp(null);
          helpTrigger.current?.focus();
        }
      }
    }
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
    };
  }, [help, expanded]);
  async function run(kind: "selected" | "all" | "submit") {
    if (busy || isReadOnly || (!historyLoaded && !embedded) || (kind === "submit" && (setupScripts || exam?.enabled))) return;
    setBusy(true);
    setExpanded(false);
    setNotice("");
    setResultTab(kind === "submit" ? "Submissions" : "Run result");
    setMobileTab("Problem");
    setProblemTab("Submission");
    setFocus(false);
    try {
      const value =
        kind === "submit"
          ? await studentApi.submitSolution(
              problem.id,
              code,
              "SQL Server",
              source,
              context,
            )
          : setupScripts
            ? await studentApi.runWorkspace(problem.id, { part: "SQL", query: kind === "selected" ? selected : code, ...setupScripts, source, context })
            : await studentApi.runQuery(problem.id, kind === "selected" ? selected : code, "SQL Server", source, context);
      if (alive.current) {
        if (kind === "submit") { setLastSubmit(value); setReviewMode(true); setHasSubmitted(true); setEditedSinceSubmission(false); }
        else setResult(value);
        const attempt: WorkspaceAttempt = { id: Date.now() + ++attemptCounter.current, kind: kind === "submit" ? "submit" : "run", result: value };
        setAttempts(previous => [attempt, ...previous].slice(0, 20));
        setMobileTab("Problem");
      }
    } catch (error) {
      if (alive.current) {
        const message = error instanceof Error ? error.message : "The SQL runner is unavailable. Try again.";
        const attempt: WorkspaceAttempt = { id: Date.now() + ++attemptCounter.current, kind: kind === "submit" ? "submit" : "run", result: { status: "Error", message } };
        setAttempts(previous => [attempt, ...previous].slice(0, 20));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function resizeFromPointer(
    orientation: "vertical" | "horizontal" | "secondary",
    clientX: number,
    clientY: number,
  ) {
    if (orientation === "vertical") {
      const bounds = workspaceLayout.current?.getBoundingClientRect();
      if (!bounds?.width) return;
      setProblemWidth(
        clampPaneSize(
          ((clientX - bounds.left) / bounds.width) * 100,
          MIN_PROBLEM_WIDTH,
          layout === "Note-taking" ? secondBoundary - 26 : MAX_PROBLEM_WIDTH,
        ),
      );
      return;
    }
    if (orientation === "secondary") {
      const bounds = workspaceLayout.current?.getBoundingClientRect();
      if (bounds?.width) updateSizes({ secondBoundary: clampPaneSize(((clientX - bounds.left) / bounds.width) * 100, problemWidth + 26, 82) });
      return;
    }
    const bounds = editorResults.current?.getBoundingClientRect();
    if (!bounds?.height) return;
    setEditorHeight(
      clampPaneSize(
        ((clientY - bounds.top) / bounds.height) * 100,
        MIN_EDITOR_HEIGHT,
        MAX_EDITOR_HEIGHT,
      ),
    );
  }
  function startResize(
    orientation: "vertical" | "horizontal" | "secondary",
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeResize.current = orientation;
    setResizing(orientation);
    resizeFromPointer(orientation, event.clientX, event.clientY);
  }
  function moveResize(
    orientation: "vertical" | "horizontal" | "secondary",
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (activeResize.current !== orientation) return;
    resizeFromPointer(orientation, event.clientX, event.clientY);
  }
  function stopResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeResize.current = null;
    setResizing(null);
  }
  function resizeWithKeyboard(
    orientation: "vertical" | "horizontal" | "secondary",
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    const direction = orientation !== "horizontal"
      ? event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
      : event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (orientation === "vertical") {
      setProblemWidth((value) =>
        clampPaneSize(value + direction * 2, MIN_PROBLEM_WIDTH, layout === "Note-taking" ? secondBoundary - 26 : MAX_PROBLEM_WIDTH),
      );
    } else if (orientation === "secondary") {
      updateSizes({ secondBoundary: clampPaneSize(secondBoundary + direction * 2, problemWidth + 26, 82) });
    } else {
      setEditorHeight((value) =>
        clampPaneSize(value + direction * 2, MIN_EDITOR_HEIGHT, MAX_EDITOR_HEIGHT),
      );
    }
  }
  const schemaText = setupScripts && workspaceParts(problem.workspaceParts).includes("DDL") ? setupScripts.ddl : (problem as Problem & { schema?: string }).schema || "";
  const schemaTables = parseDatabaseSchema(schemaText);
  const seedDataText = (problem as Problem & { seedData?: string }).seedData || "";
  const seedTables = parseSeedData(seedDataText);
  return (
    <div className={"workspace unified-output" + (expanded ? " editor-expanded" : "") + (focus ? " focus-mode" : "") + (resizing ? ` is-resizing resizing-${resizing === "secondary" ? "vertical" : resizing}` : "")}>
      {!embedded && (
      <AppHeader
        workspaceActions={<><WorkspaceTools layout={layout} onLayout={chooseLayout} focus={focus} onFocus={toggleFocus} timerKey={workspaceKey(session?.id || "anonymous", source === "Practice" ? problem.id : `${source}:${context}`, "timer")} /><WorkspaceExamFinishButton />{!exam?.enabled && <button type="button" className="button workspace-submit-exit" disabled={!historyLoaded} onClick={() => setConfirmExit(true)}>{tr("Exit")}</button>}</>}
        workspaceProblemNavigation={source !== "Practice" && params.get("context") ? <WorkspaceProblemSwitcher source={source} context={context} problemId={problem.id} problemTitle={problem.title} /> : undefined}
        workspace={{
          title: problem.title,
          number: problem.number,
          topic: problem.topic || "Uncategorized",
          source,
          context: source === "Practice" ? problem.topic || "Uncategorized" : contextTitle,
          backTo: source === "Assignments" ? "/assignments" : source === "Contests" ? "/contests" : "/dashboard",
        }}
      />
      )}
      <div id={embedded ? undefined : "main-content"} role={embedded ? undefined : "main"} className="workspace-main">
        <div
          className="workspace-mobile-tabs"
          role="tablist"
          aria-label={tr("Workspace pane")}
        >
          {(focus ? ["SQL"] : layout === "Note-taking" ? ["Problem", "SQL", "Notes"] : ["Problem", "SQL"]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={mobileTab === t}
              className={mobileTab === t ? "active" : ""}
              onClick={() => setMobileTab(t)}
            >
              <TranslatedText>{tr(t)}</TranslatedText>
            </button>
          ))}
        </div>
        <div
          ref={workspaceLayout}
          className={`workspace-layout layout-${layout.toLowerCase()} ${isAiPanelOpen ? "with-ai" : ""}`}
          style={{
            "--problem-pane-width": `${problemWidth}%`,
            "--middle-pane-width": `${secondBoundary - problemWidth}%`,
            "--last-pane-width": `${100 - secondBoundary}%`,
            "--editor-pane-height": `${editorHeight}%`,
          } as CSSProperties}
        >
          <section
            id="workspace-problem-pane"
            className={
              "problem-pane mobile-pane" +
              (mobileTab === "Problem" ? " mobile-visible" : "")
            }
            aria-label={tr("Problem description")}
          >
            <div
              className="pane-tabs"
              role="tablist"
              aria-label={tr("Problem information")}
            >
              {["Description", "Database", "Submission"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={problemTab === t}
                  className={problemTab === t ? "active" : ""}
                  onClick={() => setProblemTab(t)}
                >
                  <TranslatedText>{tr(t)}</TranslatedText>
                </button>
              ))}
            </div>
            <div className="problem-scroll">
              {problemTab === "Description" ? (
                <>

                  <h1>{problem.title}</h1>
                  <div className="problem-meta">
                    <Status value={problem.difficulty || "Unknown"} />
                    <Status value={problem.topic || "Uncategorized"} />
                    <Status
                      value={
                        lastSubmit?.status === "Accepted"
                          ? "Solved"
                          : (problem.progress || "Not started")
                      }
                    />
                  </div>
                  <ProblemMarkdown>{problem.description || ""}</ProblemMarkdown>
                  <h3><TranslatedText>{tr("Requirements")}</TranslatedText></h3>
                  <ProblemMarkdown>{problem.requirements || ""}</ProblemMarkdown>
                  <ProblemExpectedOutput table={problem.expected} samples={problem.expectedSamples} />
                  <hr />
                </>
              ) : problemTab === "Database" ? (
                <WorkspaceDatabasePanel database={database || { schemaTables, tables: seedTables.length ? seedTables : problem.tables || [] }} />
              ) : <WorkspaceSubmissionPanel submissionsUsed={source !== "Practice" ? submissionsUsed : undefined} maxSubmissions={maxSubmissions} attempts={externalAttempts ? [...externalAttempts, ...attempts].sort((a, b) => b.id - a.id) : attempts} busy={busy || submissionBusy} notice={submissionNotice || notice} />}
            </div>
            <div
              id="workspace-hint-panel"
              className={"help-drawer-region" + (help ? " is-open" : "")}
              aria-hidden={!help}
            >
              <div className="help-drawer-region-inner">
                <section className="help-drawer" aria-label={tr("Problem help")}>
                  <div className="section-heading">
                    <div className="help-tabs">
                      {(["Hint"] as const).map((t) => (
                        <button
                          className={help === t ? "active" : ""}
                          onClick={() => setHelp(t)}
                          key={t}
                        >
                          <TranslatedText>{tr(t)}</TranslatedText>
                        </button>
                      ))}
                    </div>
                    <button
                      className="icon-button"
                      ref={helpClose}
                      onClick={closeHelp}
                      aria-label={tr("Collapse help")}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <ProblemMarkdown className="workspace-hint-content" aria-live="polite">
                    {tr(helpText)}
                  </ProblemMarkdown>
                  <small className="muted">
                    <TranslatedText>{tr("Guidance only · no complete solution.")}</TranslatedText>
                  </small>
                </section>
              </div>
            </div>
            <div className="help-dock">
              <button
                ref={helpTrigger}
                disabled={contestMode}
                aria-expanded={!!help}
                aria-controls="workspace-hint-panel"
                title={
                  contestMode ? tr("Hints are disabled during contests") : undefined
                }
                onClick={() => {
                  if (help) closeHelp();
                  else setHelp("Hint");
                }}
              >
                <TranslatedText>{help ? tr("Hide hint") : tr("Show hint")}</TranslatedText>
              </button>
              <button
                ref={aiTrigger}
                disabled={!contestAiAllowed}
                aria-expanded={isAiPanelOpen}
                aria-controls="workspace-ai-panel"
                title={
                  !contestAiAllowed ? tr("AI assistance is disabled during contests") : undefined
                }
                onClick={() => {
                  if (isAiPanelOpen) closeAiPanel();
                  else {
                    setIsAiPanelOpen(true);
                    if (expanded) setExpanded(false);
                  }
                }}
              >
                <TranslatedText>{tr("Ask AI")}</TranslatedText>
              </button>
              <button
                className="save-problem"
                aria-pressed={favorite}
                disabled={favoriteBusy}
                onClick={() => void toggleSaved()}
              >
                <Star size={15} fill={favorite ? "currentColor" : "none"} />
                <TranslatedText>{favorite ? tr("Saved") : tr("Save")}</TranslatedText>
              </button>
            </div>
          </section>
          <WorkspaceResizeHandle
            axis="vertical"
            containerRef={workspaceLayout}
            value={problemWidth}
            min={MIN_PROBLEM_WIDTH}
            max={layout === "Note-taking" ? secondBoundary - 26 : MAX_PROBLEM_WIDTH}
            label={tr("Resize problem and editor panes")}
            controls="workspace-problem-pane workspace-editor-results"
            valueText={`Problem pane ${Math.round(problemWidth)} percent`}
            onResize={setProblemWidth}
            onResizeStart={() => setResizing("vertical")}
            onResizeEnd={() => setResizing(null)}
            onReset={() => setProblemWidth(clampPaneSize(defaults[layout].problemWidth, MIN_PROBLEM_WIDTH, layout === "Note-taking" ? secondBoundary - 26 : MAX_PROBLEM_WIDTH))}
          />
          <div id="workspace-editor-results" className="editor-results" ref={editorResults}>
            <section
              id="workspace-editor-pane"
              className={
                "editor-pane mobile-pane" +
                (mobileTab === "SQL" ? " mobile-visible" : "")
              }
              aria-label={tr("SQL editor")}
            >
              <div className="editor-toolbar">
                <span className="editor-dialect">SQL Server</span>
                <button className="icon-button" type="button" aria-label={tr("Reset SQL query")} title={isReadOnly ? tr("Submitted work is read-only") : tr("Reset SQL query")} disabled={isReadOnly} onClick={() => setConfirmResetQuery(true)}><RotateCcw size={16} /></button>
                <b>query.sql</b>
                {isReadOnly && <small className="muted"><TranslatedText>{tr("View only")}</TranslatedText></small>}
                <button
                  className="icon-button format-query"
                  disabled={busy || isReadOnly}
                  aria-label={tr("Format SQL indentation")}
                  title={tr("Format SQL indentation")}
                  onClick={() => {
                    const view = editor.current;
                    if (view) {
                      view.dispatch({
                        changes: indentRange(
                          view.state,
                          0,
                          view.state.doc.length,
                        ),
                      });
                      view.focus();
                    }
                  }}
                >
                  <Braces size={17} />
                </button>
                <small className="muted"><TranslatedText>{tr("Draft saved locally")}</TranslatedText></small>
                <button
                  className="icon-button expand-editor"
                  ref={expandTrigger}
                  aria-label={
                    expanded ? tr("Restore editor layout") : tr("Expand SQL editor")
                  }
                  aria-pressed={expanded}
                  onClick={() => {
                    setExpanded((value) => !value);
                    setMobileTab("SQL");
                  }}
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
              {Boolean(problem.sqlChecks?.length) && <div className="workspace-sql-checks">
                <ol>{problem.sqlChecks?.map((check) => <li key={check.id}>{check.name} <span>{check.timeLimitMs} <TranslatedText>{tr("ms")}</TranslatedText></span></li>)}</ol>
              </div>}
              <div className="sql-editor">
                <CodeMirror
                  value={code}
                  height="100%"
                  readOnly={isReadOnly}
                  editable={!isReadOnly}
                  extensions={sqlEditorExtensions}
                  onChange={value => { if (!isReadOnly) { setCode(value); setEditedSinceSubmission(true); onUserEdit?.(); exam?.update(problem.id, { query: value }); } }}
                  onCreateEditor={(view) => {
                    editor.current = view;
                  }}
                  onUpdate={(v) => {
                    const selection = v.state.selection.main;
                    const line = v.state.doc.lineAt(selection.head);
                    setCursor({
                      line: line.number,
                      column: selection.head - line.from + 1,
                    });
                    setSelected(v.state.sliceDoc(selection.from, selection.to));
                  }}
                  aria-label={tr("SQL query")}
                  basicSetup={{ foldGutter: false, highlightActiveLine: true }}
                />
              </div>
              <div className="editor-actions">
                <WorkspaceEditorStatus {...cursor} executionTimeMs={result?.executionTimeMs} />
                <button
                  className="button"
                  disabled={isReadOnly || busy || !selected.trim()}
                  title={
                    !selected.trim() ? tr("Select SQL text in the editor first") : undefined
                  }
                  onClick={() => void run("selected")}
                >
                  <TranslatedText>{tr("Run selected")}</TranslatedText>
                </button>
                <button
                  className="button"
                  disabled={isReadOnly || busy}
                  onClick={() => void run("all")}
                >
                  <TranslatedText>{tr("Run query")}</TranslatedText>
                </button>
                {!setupScripts && !exam?.enabled && (<button
                  className="button primary"
                  disabled={busy || !historyLoaded || contestClosed || (!reviewMode && submissionLimitReached)}
                  title={submissionLimitReached && !reviewMode ? tr("Submission limit reached") : contestClosed ? tr("Contest submissions are closed") : undefined}
                  onClick={() => reviewMode ? setReviewMode(false) : void run("submit")}
                >
                  <TranslatedText>{reviewMode ? tr("Edit again") : busy && resultTab === "Submissions" ? tr("Submitting…") : contestClosed ? tr("Submissions closed") : tr("Submit")}</TranslatedText>
                </button>)}
              </div>
            </section>
          </div>
          <div className="workspace-splitter workspace-splitter-vertical notes-splitter" role="separator" aria-label={tr("Resize notes pane")} aria-orientation="vertical" aria-valuemin={problemWidth + 26} aria-valuemax={82} aria-valuenow={secondBoundary} tabIndex={0}
            onPointerDown={event => startResize("secondary", event)} onPointerMove={event => moveResize("secondary", event)} onPointerUp={stopResize} onPointerCancel={stopResize}
            onLostPointerCapture={() => { activeResize.current = null; setResizing(null); }} onKeyDown={event => resizeWithKeyboard("secondary", event)} onDoubleClick={() => updateSizes({ secondBoundary: clampPaneSize(defaults[layout].secondBoundary, problemWidth + 26, 82) })} />
          <section className={`notes-pane mobile-pane${mobileTab === "Notes" ? " mobile-visible" : ""}`} aria-label={tr("Notes")}>
            <div className="pane-tabs"><b><TranslatedText>{tr("Notes")}</TranslatedText></b><small className="muted"><TranslatedText>{tr("Saved locally")}</TranslatedText></small></div>
            <textarea aria-label={tr("Problem notes")} placeholder={tr("Write your approach, observations or SQL reminders...")} value={notes} onChange={event => { setNotes(event.target.value); storage.set(notesKey, event.target.value); }} />
          </section>
          <div
            id="workspace-ai-panel"
            className="workspace-ai-region"
            aria-hidden={!isAiPanelOpen}
          >
            <AiChatPanel
              problem={problem}
              code={code}
              onClose={closeAiPanel}
            />
          </div>
        </div>
      </div>
      {confirmResetQuery && !isReadOnly && <Dialog title={tr("Reset SQL query?")} onClose={() => setConfirmResetQuery(false)}><p><TranslatedText>{tr("Your current SQL draft will be cleared from this browser.")}</TranslatedText></p><div className="dialog-actions"><button className="button" type="button" onClick={() => setConfirmResetQuery(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button className="button primary" type="button" onClick={() => { setCode(""); setEditedSinceSubmission(true); onUserEdit?.(); exam?.update(problem.id, { query: "" }); setResult(null); setAttempts(previous => previous.filter(attempt => attempt.kind === "submit")); setConfirmResetQuery(false); }}><TranslatedText>{tr("Clear query")}</TranslatedText></button></div></Dialog>}
      {!embedded && !exam?.enabled && confirmExit && <Dialog title={tr("Exit workspace?")} onClose={() => setConfirmExit(false)}><p><TranslatedText>{tr(editedSinceSubmission ? "You have unsubmitted changes. Exit without submitting them?" : hasSubmitted ? "Your submission is saved. Are you sure you want to exit?" : "You have not submitted your work. Are you sure you want to exit without submitting?")}</TranslatedText></p><div className="dialog-actions"><button className="button" type="button" onClick={() => setConfirmExit(false)}><TranslatedText>{tr("Stay here")}</TranslatedText></button><button className="button primary" type="button" onClick={() => navigate(exitDestination)}><TranslatedText>{tr("Exit")}</TranslatedText></button></div></Dialog>}
    </div>
  );
}


export function ContestSqlWorkspace({ state }: { state: ContestWorkspaceController & { contest: Contest } }) {
  const { t: tr } = useLanguage("workspace");
  const {
    contest,
    error,
    setShowFullscreenDiagram,
    activeQuestionIndex,
    setActiveQuestionIndex,
    queryAnswers,
    setQueryAnswers,
    queryRunning,
    queryResult,
    setQueryResult,
    handleRunQuery
  } = state;
  const activeQuestion = contest.problemDetails[activeQuestionIndex];
  return (
          <div className="contest-queries-layout">
            {/* Questions sidebar */}
            <aside className="contest-questions-sidebar">
              <div className="contest-questions-header">
                <span><TranslatedText>{tr("Questions (")}</TranslatedText>{contest.problemDetails.length})</span>
              </div>
              <div className="contest-questions-list">
                {contest.problemDetails.map((q, idx) => {
                  const hasAnswer = Boolean(queryAnswers[q.id]?.trim());
                  const isActive = idx === activeQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`contest-question-btn ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setActiveQuestionIndex(idx);
                        setQueryResult(null);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`contest-question-status-dot ${hasAnswer ? "answered" : ""}`} />
                        <span><TranslatedText>{tr("Question")}</TranslatedText> {idx + 1}. {q.title}</span>
                      </div>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{q.points ?? 10} <TranslatedText>{tr("pts")}</TranslatedText></span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Query Workspace */}
            <div className="contest-query-workspace">
              {activeQuestion ? (
                <>
                  <div className="contest-prompt-pane">
                    <h2>
                      <span><TranslatedText>{tr("Question")}</TranslatedText> {activeQuestionIndex + 1}: {activeQuestion.title}</span>
                      <span className="contest-prompt-points">{activeQuestion.points ?? 10} <TranslatedText>{tr("points")}</TranslatedText></span>
                    </h2>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
                      <ProblemMarkdown>{activeQuestion.description || tr("No description available.")}</ProblemMarkdown>
                      {activeQuestion.requirements && <ProblemMarkdown>{activeQuestion.requirements}</ProblemMarkdown>}
                    </div>
                  </div>

                  <div className="contest-query-editor-area">
                    <div className="contest-editor-header">
                      <span><TranslatedText>{tr("Your SQL query")}</TranslatedText></span>
                      <div className="contest-editor-actions">
                        <button
                          type="button"
                          className="contest-btn-secondary"
                          onClick={() => setShowFullscreenDiagram(true)}
                          title={tr("View the database diagram while writing your query")}
                        >
                          <LayoutGrid size={13} />
                          <span><TranslatedText>{tr("View database diagram")}</TranslatedText></span>
                        </button>
                        <button
                          type="button"
                          className="contest-btn-primary"
                          disabled={queryRunning}
                          onClick={handleRunQuery}
                        >
                          <Play size={13} />
                          <span><TranslatedText>{queryRunning ? tr("Running...") : tr("▶ Run query")}</TranslatedText></span>
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: 1, overflow: "auto" }}>
                      <CodeMirror
                        value={queryAnswers[activeQuestion.id] || ""}
                        height="100%"
                        extensions={sqlEditorExtensions}
                        onChange={(val) => {
                          setQueryAnswers((prev) => ({ ...prev, [activeQuestion.id]: val }));
                        }}
                        placeholder={`-- Write your query for question ${activeQuestionIndex + 1} here...\nSELECT ...`}
                        basicSetup={{ foldGutter: true, highlightActiveLine: true }}
                      />
                    </div>

                    {/* Result table pane */}
                    <div className="contest-query-result-pane">
                      <div className="contest-result-header">
                        <span><TranslatedText>{tr("Exam query results")}</TranslatedText></span>
                        {queryResult && !queryResult.error && (
                          <span style={{ color: "#22c55e" }}>
                            <TranslatedText>{tr("✓ Returned")}</TranslatedText> {queryResult.rowCount} <TranslatedText>{tr("rows")}</TranslatedText>
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
                        {queryRunning && <Loading label={tr("Executing the query on the exam database...")} />}
                        {queryResult?.error && (
                          <div style={{ color: "#ef4444", padding: 12, background: "rgba(239, 68, 68, 0.08)", borderRadius: 6, fontSize: 13 }}>
                            <AlertCircle size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                            <span><TranslatedText>{tr(queryResult.error)}</TranslatedText></span>
                          </div>
                        )}
                        {queryResult && !queryResult.error && queryResult.columns.length > 0 && (
                          <DataGrid
                            table={{
                              name: "Query results",
                              columns: queryResult.columns,
                              rows: queryResult.rows,
                            }}
                          />
                        )}
                        {!queryRunning && !queryResult && (
                          <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                            <TranslatedText>{tr("Click \"Run query\" to check the results from your database.")}</TranslatedText>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  <TranslatedText>{tr("No questions available.")}</TranslatedText>
                </div>
              )}
            </div>
          </div>
  );
}
