import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import CodeMirror from "@uiw/react-codemirror";
import { sql, MySQL, PLSQL, MSSQL } from "@codemirror/lang-sql";
import { EditorView } from "@codemirror/view";
import { X, Star, RotateCcw, Maximize2, Minimize2, Braces } from "lucide-react";
import { indentRange } from "@codemirror/language";
import {
  getFavorites,
  toggleFavorite,
} from "../../services/studentPreferences";
import { AppHeader } from "../../components/AppHeader";
import { DataGrid, Dialog, Empty, Loading, Status } from "../../components/ui";
import { useLoad } from "../../components/useLoad";
import { useTheme } from "../../context/ThemeContext";
import { studentApi, type QueryResult } from "../../services/studentApi";
import type { DataTable, Problem, Submission } from "../../data/mockData";
import { AiChatPanel } from "../../components/AiChatPanel";
const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: '"JetBrains Mono", monospace',
    padding: "24px 0",
    lineHeight: "24px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--muted)",
    border: "none",
    padding: "0 8px 0 16px",
  },
  ".cm-activeLine": { backgroundColor: "var(--subtle)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-cursor": { borderLeftColor: "var(--accent)" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
});
export function WorkspacePage() {
  const { problemId = "" } = useParams();
  const { data, loading, error } = useLoad(
    () => studentApi.getProblem(problemId),
    [problemId],
  );
  if (loading)
    return (
      <>
        <AppHeader
          workspace={{ title: "Loading problem…", number: "", topic: "" }}
        />
        <main id="main-content">
          <Loading />
        </main>
      </>
    );
  if (error || !data)
    return (
      <>
        <AppHeader />
        <main id="main-content">
          <Empty title="Problem unavailable">
            {error || "This problem ID does not exist."}{" "}
            <Link to="/practice">Back to practice</Link>
          </Empty>
        </main>
      </>
    );
  return <Workspace key={data.id} problem={data} />;
}
function Workspace({ problem }: { problem: Problem }) {
  const { dark } = useTheme();
  const [params] = useSearchParams();
  const source: Submission["source"] =
    params.get("source") === "Assignments"
      ? "Assignments"
      : params.get("source") === "Contests"
        ? "Contests"
        : "Practice";
  const context = params.get("context") || source;
  const contestMode = source === "Contests" && Boolean(params.get("contest"));
  const [favorite, setFavorite] = useState(() =>
    getFavorites().includes(problem.id),
  );
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const editor = useRef<EditorView | null>(null);
  const expandTrigger = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState(
    () => studentApi.getDraft(problem.id) ?? problem.draft,
  );
  const [selected, setSelected] = useState("");
  const [database, setDatabase] = useState("MySQL");
  const [databaseMenu, setDatabaseMenu] = useState(false);
  const [tables, setTables] = useState<DataTable[]>(problem.tables);
  const [problemTab, setProblemTab] = useState("Description");
  const [resultTab, setResultTab] = useState("Run result");
  const [mobileTab, setMobileTab] = useState("Problem");
  const [help, setHelp] = useState<"Hint" | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [helpText, setHelpText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [lastSubmit, setLastSubmit] = useState<QueryResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const databaseTrigger = useRef<HTMLButtonElement>(null);
  const dbContainer = useRef<HTMLDivElement>(null);
  const helpTrigger = useRef<HTMLButtonElement | null>(null);
  const helpClose = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    studentApi.saveDraft(problem.id, code);
  }, [code, problem.id]);
  useEffect(() => {
    let active = true;
    if (help) {
      setHelpText("Loading guidance…");
      studentApi.getHint(problem.id, help).then((t) => {
        if (active) setHelpText(t);
      });
      helpClose.current?.focus();
    }
    return () => {
      active = false;
    };
  }, [help, problem.id]);
  function closeHelp() {
    setHelp(null);
    helpTrigger.current?.focus();
  }
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (expanded) {
          setExpanded(false);
          expandTrigger.current?.focus();
          return;
        }
        if (databaseMenu) {
          setDatabaseMenu(false);
          databaseTrigger.current?.focus();
        } else if (help) {
          setHelp(null);
          helpTrigger.current?.focus();
        }
      }
    }
    function outside(e: PointerEvent) {
      if (!dbContainer.current?.contains(e.target as Node))
        setDatabaseMenu(false);
    }
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [help, databaseMenu, expanded]);
  async function run(kind: "selected" | "all" | "submit") {
    if (busy) return;
    setBusy(true);
    setExpanded(false);
    setNotice("");
    setResultTab(kind === "submit" ? "Submissions" : "Run result");
    setMobileTab("Result");
    try {
      const value =
        kind === "submit"
          ? await studentApi.submitSolution(
              problem.id,
              code,
              database,
              source,
              context,
            )
          : await studentApi.runQuery(
              problem.id,
              kind === "selected" ? selected : code,
              database,
            );
      if (alive.current) {
        if (kind === "submit") setLastSubmit(value);
        else setResult(value);
        setMobileTab("Result");
      }
    } catch {
      if (alive.current)
        setNotice("The mock runner is unavailable. Try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function reset() {
    setConfirmReset(false);
    setBusy(true);
    try {
      const restored = await studentApi.resetDatabase(problem.id, database);
      if (alive.current) {
        setTables(restored);
        setNotice("Mock schema and sample rows restored. SQL draft preserved.");
        setDatabaseMenu(false);
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        databaseTrigger.current?.focus();
      }
    }
  }
  const display = resultTab === "Submissions" ? lastSubmit : result;
  return (
    <div className={"workspace" + (expanded ? " editor-expanded" : "")}>
      <AppHeader
        workspace={{
          title: problem.title,
          number: problem.number,
          topic: problem.topic,
        }}
      />
      <main id="main-content" className="workspace-main">
        <div
          className="workspace-mobile-tabs"
          role="tablist"
          aria-label="Workspace pane"
        >
          {["Problem", "SQL", "Result"].map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={mobileTab === t}
              className={mobileTab === t ? "active" : ""}
              onClick={() => setMobileTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className={`workspace-layout ${isAiPanelOpen ? "with-ai" : ""}`}>
          <section
            className={
              "problem-pane mobile-pane" +
              (mobileTab === "Problem" ? " mobile-visible" : "")
            }
            aria-label="Problem description"
          >
            <div
              className="pane-tabs"
              role="tablist"
              aria-label="Problem information"
            >
              {["Description", "Database"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={problemTab === t}
                  className={problemTab === t ? "active" : ""}
                  onClick={() => setProblemTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="problem-scroll">
              {problemTab === "Description" ? (
                <>
                  <p className="tiny">PROBLEM {problem.number}</p>
                  <h1>{problem.title}</h1>
                  <div className="problem-meta">
                    <Status value={problem.difficulty} />
                    <Status value={problem.topic} />
                    <Status
                      value={
                        lastSubmit?.status === "Accepted"
                          ? "Solved"
                          : problem.progress
                      }
                    />
                  </div>
                  <p className="muted">{problem.description}</p>
                  <h3>Requirements</h3>
                  <p>{problem.requirements}</p>
                  <h3>Expected output</h3>
                  <DataGrid table={problem.expected} />
                  <p className="tiny">
                    {problem.id === "p1"
                      ? "Bao Tran and Ngoc Linh have no matching rows in Orders."
                      : "Output shown for the sample dataset."}
                  </p>
                  <hr />
                </>
              ) : (
                <>
                  <h2>Mock database</h2>
                  <p className="muted">
                    {database} · read-only sample schema and data
                  </p>
                  {tables.map((t) => (
                    <section className="schema-section" key={t.name}>
                      <h3>{t.name}</h3>
                      <p className="schema-metadata">
                        {t.columns
                          .map(
                            (c) =>
                              c +
                              " " +
                              (c.includes("name") || c === "month"
                                ? "VARCHAR"
                                : "NUMBER"),
                          )
                          .join(" · ")}
                      </p>
                      <DataGrid table={t} />
                    </section>
                  ))}
                </>
              )}
            </div>
            {help && (
              <section className="help-drawer" aria-label="Problem help">
                <div className="section-heading">
                  <div className="help-tabs">
                    {(["Hint"] as const).map((t) => (
                      <button
                        className={help === t ? "active" : ""}
                        onClick={() => setHelp(t)}
                        key={t}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button
                    className="icon-button"
                    ref={helpClose}
                    onClick={closeHelp}
                    aria-label="Collapse help"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p aria-live="polite">{helpText}</p>
                <small className="muted">
                  Guidance only · mock response, no complete solution.
                </small>
              </section>
            )}
            <div className="help-dock">
              <button
                disabled={contestMode}
                title={
                  contestMode ? "Hints are disabled during contests" : undefined
                }
                onClick={(e) => {
                  helpTrigger.current = e.currentTarget;
                  setHelp("Hint");
                }}
              >
                Show hint
              </button>
              <button
                disabled={contestMode}
                title={
                  contestMode
                    ? "AI assistance is disabled during contests"
                    : undefined
                }
                onClick={(e) => {
                  setIsAiPanelOpen(true);
                  if (expanded) setExpanded(false);
                }}
              >
                Ask AI
              </button>
              <button
                className="save-problem"
                aria-pressed={favorite}
                onClick={() => setFavorite(toggleFavorite(problem.id))}
              >
                <Star size={15} fill={favorite ? "currentColor" : "none"} />
                {favorite ? "Saved" : "Save"}
              </button>
            </div>
          </section>
          <div className="editor-results">
            <section
              className={
                "editor-pane mobile-pane" +
                (mobileTab === "SQL" ? " mobile-visible" : "")
              }
              aria-label="SQL editor"
            >
              <div className="editor-toolbar">
                <div className="database-container" ref={dbContainer}>
                  <button
                    className="button"
                    ref={databaseTrigger}
                    aria-expanded={databaseMenu}
                    aria-controls="database-options"
                    disabled={busy}
                    onClick={() => setDatabaseMenu((o) => !o)}
                  >
                    {database} ⌄
                  </button>
                  {databaseMenu && (
                    <div className="database-menu" id="database-options">
                      {["MySQL", "Oracle", "SQL Server"].map((db) => (
                        <button
                          key={db}
                          aria-pressed={database === db}
                          onClick={() => {
                            setDatabase(db);
                            setDatabaseMenu(false);
                            databaseTrigger.current?.focus();
                          }}
                        >
                          {db}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="icon-button reset-database"
                  disabled={busy}
                  aria-label="Reset database"
                  title="Reset database"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw size={16} />
                </button>
                <b>query.sql</b>
                <button
                  className="icon-button format-query"
                  disabled={busy}
                  aria-label="Format SQL indentation"
                  title="Format SQL indentation"
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
                <small className="muted">Draft saved locally</small>
                <button
                  className="icon-button expand-editor"
                  ref={expandTrigger}
                  aria-label={
                    expanded ? "Restore editor layout" : "Expand SQL editor"
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
              <div className="sql-editor">
                <CodeMirror
                  value={code}
                  height="100%"
                  theme={dark ? "dark" : "light"}
                  extensions={[
                    sql({
                      dialect:
                        database === "Oracle"
                          ? PLSQL
                          : database === "SQL Server"
                            ? MSSQL
                            : MySQL,
                    }),
                    editorTheme,
                  ]}
                  onChange={setCode}
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
                  aria-label="SQL query"
                  basicSetup={{ foldGutter: false, highlightActiveLine: true }}
                />
              </div>
              <div className="editor-actions">
                <span className="cursor-position muted">
                  Ln {cursor.line}, Col {cursor.column}
                </span>
                <button
                  className="button"
                  disabled={busy || !selected.trim()}
                  title={
                    !selected.trim()
                      ? "Select SQL text in the editor first"
                      : undefined
                  }
                  onClick={() => void run("selected")}
                >
                  Run selected
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void run("all")}
                >
                  Run all
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void run("submit")}
                >
                  {busy && resultTab === "Submissions"
                    ? "Submitting…"
                    : "Submit"}
                </button>
              </div>
            </section>
            <section
              className={
                "result-pane mobile-pane" +
                (mobileTab === "Result" ? " mobile-visible" : "")
              }
              aria-label="Query output"
            >
              <div
                className="pane-tabs"
                role="tablist"
                aria-label="Execution output"
              >
                {["Run result", "Submissions"].map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={resultTab === t}
                    className={resultTab === t ? "active" : ""}
                    onClick={() => setResultTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div
                className={"result-scroll" + (!display ? " idle" : "")}
                aria-live="polite"
              >
                {busy ? (
                  <Loading
                    label={
                      resultTab === "Submissions"
                        ? "Submitting solution…"
                        : "Running query…"
                    }
                  />
                ) : display ? (
                  <>
                    <Status value={display.status} />
                    <p>{display.message}</p>
                    {display.table && <DataGrid table={display.table} />}
                    <p className="tiny muted">
                      {resultTab === "Submissions"
                        ? "Score: " +
                          (display.status === "Accepted" ? "100" : "0") +
                          "/100 · "
                        : ""}
                      Frontend simulation · SQL has not been executed.
                    </p>
                    {resultTab === "Submissions" && (
                      <Link className="text-button" to="/submissions">
                        View submission history →
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <h2>
                      {resultTab === "Submissions"
                        ? "No submissions yet"
                        : "No result yet"}
                    </h2>
                    <p className="muted">
                      Run the query to preview returned data. Submit when ready
                      to simulate grading.
                    </p>
                    <small>
                      Sample data ·{" "}
                      {problem.tables.map((t) => t.name).join(" and ")}
                    </small>
                  </>
                )}
                {notice && (
                  <p role="status" className="form-message">
                    {notice}
                  </p>
                )}
              </div>
            </section>
          </div>
          {isAiPanelOpen && (
            <AiChatPanel 
              problem={problem} 
              code={code} 
              onClose={() => setIsAiPanelOpen(false)} 
            />
          )}
        </div>
      </main>
      {confirmReset && (
        <Dialog
          title="Reset mock database?"
          onClose={() => setConfirmReset(false)}
        >
          <p>
            Restore the original schema and sample rows for {database}. Your SQL
            draft will be preserved.
          </p>
          <div className="dialog-actions">
            <button className="button" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button className="button primary" onClick={() => void reset()}>
              Reset database
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
