import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WorkspaceTools } from "../../../components/WorkspaceTools";
import { AppHeader } from "../../../components/AppHeader";
import { useAuth } from "../../../context/AuthContext";
import type { Problem, Submission, WorkspacePart } from "../../../data/models";
import { studentApi, type QueryResult } from "../../../services/studentApi";
import { storage } from "../../../services/storage";
import { workspaceDraftKey, workspaceParts } from "../../../utils/workspaceParts";
import { Dialog } from "../../../components/ui";
import { WorkspaceExamFinishButton, useWorkspaceExam } from "./components/WorkspaceExamContext";
import { DdlWorkspace } from "./DdlWorkspace";
import { DmlWorkspace } from "./DmlWorkspace";
import { SqlWorkspace } from "./SqlWorkspace";
import { WorkspaceNavigation } from "./components/WorkspaceNavigation";
import { WorkspaceProblemSwitcher } from "./components/WorkspaceProblemSwitcher";
import { ProblemWorkspaceLayoutProvider } from "./components/ProblemWorkspaceLayoutContext";
import type { WorkspaceAttempt } from "./components/WorkspaceSubmissionPanel";
import { parseDatabaseSchema } from "../../../utils/parseDatabaseSchema";
import type { WorkspaceDatabaseState } from "./components/WorkspaceDatabasePanel";
import { readLayouts, workspaceKey } from "../../../utils/workspacePreferences";
import "../../../styles/problem-workspace.css";

function readSubmittedWorkspaceScripts(value: string | undefined) {
  if (!value) return null;
  const markers = [...value.matchAll(/(?:^|\r?\n)-- (DDL|DML|SQL)\r?\n/g)];
  if (!markers.length) return null;
  const scripts = { ddl: "", dml: "", sql: "" };
  markers.forEach((marker, index) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? value.length;
    const part = marker[1].toLowerCase() as keyof typeof scripts;
    scripts[part] = value.slice(start, end).replace(/\s+$/, "");
  });
  return scripts;
}

function readSavedSubmissionSnapshot(value: string | null) {
  if (!value) return null;
  try {
    const saved = JSON.parse(value);
    if ([saved.ddl, saved.dml, saved.sql].every(script => typeof script === "string")) return saved as { ddl: string; dml: string; sql: string };
  } catch { /* Ignore invalid local snapshots and restore from submission history. */ }
  return null;
}

export function ProblemWorkspace({ problem }: { problem: Problem }) {
  const { t: tr } = useLanguage("workspace");
  const { session } = useAuth();
  const exam = useWorkspaceExam();
  const navigate = useNavigate();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [editedSinceSubmission, setEditedSinceSubmission] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(Boolean(exam?.enabled));
  const [submissionAttempts, setSubmissionAttempts] = useState<WorkspaceAttempt[]>([]);
  const [submissionSignal, setSubmissionSignal] = useState(0);
  const [submissionReceipt, setSubmissionReceipt] = useState<QueryResult | null>(null);
  const submissionCounter = useRef(0);
  const [params] = useSearchParams();
  const source = params.get("source") === "Assignments" ? "Assignments" : params.get("source") === "Contests" ? "Contests" : "Practice";
  const context = params.get("context") || source;
  const parts = workspaceParts(problem.workspaceParts);
  const sqlOnly = parts.length === 1 && parts[0] === "SQL";
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState<WorkspacePart>(parts[0] || "SQL");
  const layoutKey = workspaceKey(session?.id || "anonymous", "preferences", "layouts");
  const [preferences, setPreferences] = useState(() => readLayouts(layoutKey));
  const draftKey = workspaceDraftKey(session?.id || "anonymous", problem.id, context);
  const [scripts, setScripts] = useState(() => {
    const restored = exam?.draft(problem.id);
    if (exam?.enabled || restored) return { ddl: restored?.ddl || "", dml: restored?.dml || "" };
    try {
      const saved = JSON.parse(storage.get(draftKey) || "{}");
      return { ddl: typeof saved.ddl === "string" ? saved.ddl : "", dml: typeof saved.dml === "string" ? saved.dml : "" };
    } catch { return { ddl: "", dml: "" }; }
  });
  const [results, setResults] = useState<Partial<Record<WorkspacePart, QueryResult>>>({});
  const [errors, setErrors] = useState<Partial<Record<WorkspacePart, string>>>({});
  const [busy, setBusy] = useState(false);
  const [executedDdl, setExecutedDdl] = useState<string | null>(null);
  const [executedDml, setExecutedDml] = useState<string | null>(null);
  const [database, setDatabase] = useState<WorkspaceDatabaseState>(() => ({
    schemaTables: parts.includes("DDL") ? [] : parseDatabaseSchema((problem as Problem & { schema?: string }).schema || ""),
    tables: parts.includes("DDL") ? [] : problem.tables || [],
  }));
  const databaseView = { ...database, stale: (executedDdl !== null && executedDdl !== scripts.ddl) || (executedDml !== null && executedDml !== scripts.dml) };
  useEffect(() => { storage.set(draftKey, JSON.stringify(scripts)); }, [draftKey, scripts]);
  useEffect(() => { storage.set(layoutKey, JSON.stringify(preferences)); }, [layoutKey, preferences]);
  const syncDraft = exam?.update;
  useEffect(() => { syncDraft?.(problem.id, scripts); }, [syncDraft, problem.id]);
  function updateScripts(change: Partial<typeof scripts>) {
    if (reviewMode || (!historyLoaded && !exam?.enabled)) return;
    setEditedSinceSubmission(true);
    setScripts(value => ({ ...value, ...change }));
    exam?.update(problem.id, change);
  }
  const submissionsUsed = submissionReceipt?.submissionsUsed ?? exam?.submissionCounts[problem.id] ?? submissionAttempts.filter(attempt => attempt.kind === "submit").length;
  const maxSubmissions = submissionReceipt?.maxSubmissions ?? exam?.maxSubmissions ?? null;
  const submissionLimitReached = maxSubmissions != null && submissionsUsed >= maxSubmissions;
  const isReadOnly = reviewMode || (!historyLoaded && !exam?.enabled);
  const exitDestination = source === "Contests" ? `/contests/${encodeURIComponent(context)}` : source === "Assignments" ? `/assignments/work/${encodeURIComponent(context)}` : "/dashboard";
  useEffect(() => {
    if (exam?.enabled || sqlOnly) return;
    let activeRequest = true;
    if (typeof studentApi.getSubmissions !== "function") {
      setHistoryLoaded(true);
      return () => { activeRequest = false; };
    }
    studentApi.getSubmissions({ source }).then((response) => {
      if (!activeRequest || !Array.isArray(response)) return;
      const matching = (response as Submission[])
        .filter(item => item.problemId === problem.id && item.context === context && [source, source === "Assignments" ? "Assignment" : source === "Contests" ? "Contest" : "Practice"].includes(item.source))
        .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
      if (matching.length) {
        const snapshot = readSavedSubmissionSnapshot(storage.get(draftKey + ":submitted"));
        const expectedSubmissionText = snapshot && parts.map(part => `-- ${part}\n${snapshot[part === "DDL" ? "ddl" : part === "DML" ? "dml" : "sql"]}`).join("\n\n");
        const submittedScripts = snapshot && matching[0].query === expectedSubmissionText ? snapshot : readSubmittedWorkspaceScripts(matching[0].query);
        if (submittedScripts) {
          setScripts({ ddl: submittedScripts.ddl, dml: submittedScripts.dml });
          storage.set(draftKey + ":SQL", submittedScripts.sql);
          setEditedSinceSubmission(false);
        }
        setReviewMode(true);
        setSubmissionSignal(value => value + 1);
        setSubmissionAttempts(matching.slice(0, 20).map((item, index) => ({
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
      }
    }).catch(() => {}).finally(() => { if (activeRequest) setHistoryLoaded(true); });
    return () => { activeRequest = false; };
  }, [problem.id, source, context, exam?.enabled, draftKey, sqlOnly]);
  async function submitWork() {
    if (submitting) return;
    setSubmitting(true); setSubmitError("");
    try {
      const submittedQuery = storage.get(draftKey + ":SQL") || "";
      const result = await studentApi.submitWorkspace(problem.id, { part: parts[0] || "SQL", ...scripts, query: submittedQuery, source, context });
      storage.set(draftKey + ":submitted", JSON.stringify({ ...scripts, sql: submittedQuery }));
      setSubmissionReceipt(result);
      setReviewMode(true);
      setEditedSinceSubmission(false);
      setSubmissionAttempts(previous => [{ id: Date.now() + ++submissionCounter.current, kind: "submit" as const, result }, ...previous].slice(0, 20));
      setSubmissionSignal(value => value + 1);
      setConfirmSubmit(false);
    } catch (error) { setSubmitError((error as Error).message); }
    finally { setSubmitting(false); }
  }
  async function run(part: "DDL" | "DML", selection?: string) {
    if (busy || isReadOnly) return;
    setBusy(true); setErrors(previous => ({ ...previous, [part]: "" }));
    try {
      const executed = selection == null ? scripts : { ...scripts, [part === "DDL" ? "ddl" : "dml"]: selection };
      const result = await studentApi.runWorkspace(problem.id, { part, ...executed, query: "", source, context });
      if (result.status === "Error") {
        setResults(previous => ({ ...previous, [part]: result }));
        setErrors(previous => ({ ...previous, [part]: result.message }));
        return;
      }
      setResults(previous => ({ ...previous, [part]: result, ...(part === "DDL" ? { DML: undefined } : {}) }));
      if (part === "DDL") {
        setExecutedDdl(executed.ddl); setExecutedDml(null);
        setErrors(previous => ({ ...previous, DML: "" }));
      } else setExecutedDml(executed.dml);
      setDatabase(previous => ({ schemaTables: result.schemaTables || (part === "DDL" ? parseDatabaseSchema(executed.ddl) : previous.schemaTables), tables: part === "DDL" ? [] : result.tables || [] }));
    } catch (error) {
      setResults(previous => ({ ...previous, [part]: undefined }));
      setErrors(previous => ({ ...previous, [part]: error instanceof Error ? error.message : "Unable to run your work." }));
    } finally { setBusy(false); }
  }
  if (sqlOnly) return <SqlWorkspace problem={problem} />;
  if (!parts.length) return <p role="alert"><TranslatedText>{tr("No practice sections have been configured.")}</TranslatedText></p>;
  return <ProblemWorkspaceLayoutProvider value={{ preferences, setPreferences, focus, setFocus }}><div className="problem-workspace">
    <AppHeader
      workspace={{ title: problem.title, number: problem.number, topic: problem.topic || "SQL", source, context: params.get("contextTitle") || context, backTo: source === "Assignments" ? "/assignments" : source === "Contests" ? "/contests" : "/dashboard" }}
      workspaceProblemNavigation={source !== "Practice" && params.get("context") ? <WorkspaceProblemSwitcher source={source} context={context} problemId={problem.id} problemTitle={problem.title} /> : undefined}
      workspaceActions={<><WorkspaceTools layout={preferences.layout} onLayout={layout => { setPreferences(value => ({ ...value, layout })); setFocus(false); }} focus={focus} onFocus={() => setFocus(value => !value)} timerKey={workspaceKey(session?.id || "anonymous", source === "Practice" ? problem.id : `${source}:${context}`, "timer")} /><WorkspaceNavigation parts={parts} active={active} onChange={setActive} /><WorkspaceExamFinishButton />{!exam?.enabled && <><button className={`button ${reviewMode ? "" : "primary"} workspace-submit-exit`} disabled={busy || submitting || (!reviewMode && submissionLimitReached) || !historyLoaded} title={submissionLimitReached && !reviewMode ? tr("Submission limit reached") : undefined} onClick={() => reviewMode ? setReviewMode(false) : setConfirmSubmit(true)}>{tr(reviewMode ? "Edit again" : "Submit")}</button><button className="button workspace-submit-exit" disabled={submitting || !historyLoaded} onClick={() => setConfirmExit(true)}>{tr("Exit")}</button></>}</>}
    />
    <main id="main-content" className="problem-workspace-body">
    {parts.map(part => <div key={part} id={`workspace-stage-${part}`} className="problem-workspace-stage" hidden={active !== part}>
      {part === "DDL" ? <DdlWorkspace database={databaseView} problem={problem} value={scripts.ddl} onChange={ddl => updateScripts({ ddl })} onReset={() => { updateScripts({ ddl: "" }); setResults(value => ({ ...value, DDL: undefined })); setErrors(value => ({ ...value, DDL: "" })); }} onRun={selection => run("DDL", selection)} busy={busy} result={results.DDL} error={errors.DDL} readOnly={isReadOnly} submissionAttempts={submissionAttempts} submissionBusy={submitting} submissionNotice={submitError} submissionSignal={submissionSignal} submissionsUsed={submissionsUsed} maxSubmissions={maxSubmissions} />
        : part === "DML" ? <DmlWorkspace database={databaseView} problem={problem} value={scripts.dml} onChange={dml => updateScripts({ dml })} onReset={() => { updateScripts({ dml: "" }); setResults(value => ({ ...value, DML: undefined })); setErrors(value => ({ ...value, DML: "" })); }} onRun={selection => run("DML", selection)} busy={busy} result={results.DML} error={errors.DML} readOnly={isReadOnly} submissionAttempts={submissionAttempts} submissionBusy={submitting} submissionNotice={submitError} submissionSignal={submissionSignal} submissionsUsed={submissionsUsed} maxSubmissions={maxSubmissions} />
        : <SqlWorkspace problem={problem} embedded setupScripts={scripts} database={databaseView} readOnly={isReadOnly} onUserEdit={() => setEditedSinceSubmission(true)} submissionAttempts={submissionAttempts} submissionBusy={submitting} submissionNotice={submitError} submissionSignal={submissionSignal} submissionsUsed={submissionsUsed} maxSubmissions={maxSubmissions} />}
    </div>)}
    </main>
    {confirmSubmit && <Dialog title={tr("Submit work?")} onClose={() => { if (!submitting) setConfirmSubmit(false); }}><p>{tr("Submit all enabled sections of this problem for automatic grading?")}</p>{submitError && <p role="alert">{submitError}</p>}<div className="workspace-finish-actions"><button className="button" disabled={submitting} onClick={() => setConfirmSubmit(false)}>{tr("Cancel")}</button><button className="button primary" disabled={submitting} onClick={() => void submitWork()}>{tr(submitting ? "Submitting…" : "Submit")}</button></div></Dialog>}
    {confirmExit && <Dialog title={tr("Exit workspace?")} onClose={() => { if (!submitting) setConfirmExit(false); }}><p>{tr(editedSinceSubmission ? "You have unsubmitted changes. Exit without submitting them?" : reviewMode || submissionAttempts.some(attempt => attempt.kind === "submit") ? "Your submission is saved. Are you sure you want to exit?" : "You have not submitted your work. Are you sure you want to exit without submitting?")}</p><div className="workspace-finish-actions"><button className="button" disabled={submitting} onClick={() => setConfirmExit(false)}>{tr("Stay here")}</button><button className="button primary" disabled={submitting} onClick={() => navigate(exitDestination)}>{tr("Exit")}</button></div></Dialog>}
  </div></ProblemWorkspaceLayoutProvider>;
}
