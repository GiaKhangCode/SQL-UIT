import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../../../components/AppHeader";
import { useAuth } from "../../../context/AuthContext";
import type { Problem, WorkspacePart } from "../../../data/models";
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
import { parseDatabaseSchema } from "../../../utils/parseDatabaseSchema";
import type { WorkspaceDatabaseState } from "./components/WorkspaceDatabasePanel";
import { readLayouts, workspaceKey } from "../../../utils/workspacePreferences";
import "../../../styles/problem-workspace.css";

export function ProblemWorkspace({ problem }: { problem: Problem }) {
  const { t: tr } = useLanguage("workspace");
  const { session } = useAuth();
  const exam = useWorkspaceExam();
  const navigate = useNavigate();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [params] = useSearchParams();
  const source = params.get("source") === "Assignments" ? "Assignments" : params.get("source") === "Contests" ? "Contests" : "Practice";
  const context = params.get("context") || source;
  const parts = workspaceParts(problem.workspaceParts);
  const [active, setActive] = useState<WorkspacePart>(parts[0] || "SQL");
  const layoutKey = workspaceKey(session?.id || "anonymous", "preferences", "layouts");
  const [preferences, setPreferences] = useState(() => readLayouts(layoutKey));
  const draftKey = workspaceDraftKey(session?.id || "anonymous", problem.id, context);
  const [scripts, setScripts] = useState(() => {
    const restored = exam?.enabled ? exam.draft(problem.id) : undefined;
    if (exam?.enabled) return { ddl: restored?.ddl || "", dml: restored?.dml || "" };
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
  const [confirmedDdl, setConfirmedDdl] = useState<string | null>(null);
  const [database, setDatabase] = useState<WorkspaceDatabaseState>(() => ({
    schemaTables: parts.includes("DDL") ? [] : parseDatabaseSchema((problem as Problem & { schema?: string }).schema || ""),
    tables: parts.includes("DDL") ? [] : problem.tables || [],
  }));
  const ddlConfirmed = !parts.includes("DDL") || confirmedDdl === scripts.ddl;
  const databaseView = { ...database, stale: (executedDdl !== null && executedDdl !== scripts.ddl) || (executedDml !== null && executedDml !== scripts.dml) };
  function confirmDdl() {
    if (busy || !results.DDL || errors.DDL || executedDdl !== scripts.ddl) return;
    setConfirmedDdl(scripts.ddl);
    setActive(parts.includes("DML") ? "DML" : parts.find(part => part !== "DDL") || "DDL");
  }
  useEffect(() => { storage.set(draftKey, JSON.stringify(scripts)); }, [draftKey, scripts]);
  useEffect(() => { storage.set(layoutKey, JSON.stringify(preferences)); }, [layoutKey, preferences]);
  function updateScripts(change: Partial<typeof scripts>) {
    setScripts(value => ({ ...value, ...change }));
    exam?.update(problem.id, change);
  }
  async function submitAndExit() {
    if (submitting) return;
    setSubmitting(true); setSubmitError("");
    try {
      await studentApi.submitWorkspace(problem.id, { part: parts[0] || "SQL", ...scripts, query: storage.get(draftKey + ":SQL") || "", source, context });
      navigate(source === "Contests" ? `/contests/${encodeURIComponent(context)}` : source === "Assignments" ? `/assignments/work/${encodeURIComponent(context)}` : "/dashboard");
    } catch (error) { setSubmitError((error as Error).message); }
    finally { setSubmitting(false); }
  }
  async function run(part: "DDL" | "DML") {
    if (busy) return;
    if (part === "DDL") setConfirmedDdl(null);
    setBusy(true); setErrors(previous => ({ ...previous, [part]: "" }));
    try {
      const result = await studentApi.runWorkspace(problem.id, { part, ...scripts, query: "", source, context });
      if (result.status === "Error") {
        setResults(previous => ({ ...previous, [part]: result }));
        setErrors(previous => ({ ...previous, [part]: result.message }));
        return;
      }
      setResults(previous => ({ ...previous, [part]: result, ...(part === "DDL" ? { DML: undefined } : {}) }));
      if (part === "DDL") {
        setExecutedDdl(scripts.ddl); setExecutedDml(null); setConfirmedDdl(null);
        setErrors(previous => ({ ...previous, DML: "" }));
      } else setExecutedDml(scripts.dml);
      setDatabase(previous => ({ schemaTables: result.schemaTables || (part === "DDL" ? parseDatabaseSchema(scripts.ddl) : previous.schemaTables), tables: part === "DDL" ? [] : result.tables || [] }));
    } catch (error) {
      setResults(previous => ({ ...previous, [part]: undefined }));
      setErrors(previous => ({ ...previous, [part]: error instanceof Error ? error.message : "Unable to run your work." }));
    } finally { setBusy(false); }
  }
  if (parts.length === 1 && parts[0] === "SQL") return <SqlWorkspace problem={problem} />;
  if (!parts.length) return <p role="alert"><TranslatedText>{tr("No practice sections have been configured.")}</TranslatedText></p>;
  return <ProblemWorkspaceLayoutProvider value={{ preferences, setPreferences }}><div className="problem-workspace">
    <AppHeader
      workspace={{ title: problem.title, number: problem.number, topic: problem.topic || "SQL", source, context: params.get("contextTitle") || context, backTo: source === "Assignments" ? "/assignments" : source === "Contests" ? "/contests" : "/dashboard" }}
      workspaceProblemNavigation={source !== "Practice" && params.get("context") ? <WorkspaceProblemSwitcher source={source} context={context} problemId={problem.id} problemTitle={problem.title} /> : undefined}
      workspaceActions={<><WorkspaceNavigation parts={parts} active={active} onChange={part => { if (part === "DDL" || ddlConfirmed) setActive(part); }} lockedParts={ddlConfirmed ? [] : parts.filter(part => part !== "DDL")} /><WorkspaceExamFinishButton />{!exam?.enabled && <button className="button primary workspace-submit-exit" disabled={busy || submitting} onClick={() => setConfirmSubmit(true)}>{tr("Submit & Exit")}</button>}</>}
    />
    <main id="main-content" className="problem-workspace-body">
    {parts.map(part => <div key={part} id={`workspace-stage-${part}`} className="problem-workspace-stage" hidden={active !== part}>
      {part === "DDL" ? <DdlWorkspace database={databaseView} canContinue={Boolean(results.DDL) && !errors.DDL && executedDdl === scripts.ddl} onContinue={parts.length > 1 ? confirmDdl : undefined} problem={problem} value={scripts.ddl} onChange={ddl => updateScripts({ ddl })} onReset={() => { updateScripts({ ddl: "" }); setResults(value => ({ ...value, DDL: undefined })); setErrors(value => ({ ...value, DDL: "" })); }} onRun={() => run("DDL")} busy={busy} result={results.DDL} error={errors.DDL} />
        : part === "DML" ? <DmlWorkspace database={databaseView} problem={problem} value={scripts.dml} onChange={dml => updateScripts({ dml })} onReset={() => { updateScripts({ dml: "" }); setResults(value => ({ ...value, DML: undefined })); setErrors(value => ({ ...value, DML: "" })); }} onRun={() => run("DML")} busy={busy} result={results.DML} error={errors.DML} />
        : <SqlWorkspace problem={problem} embedded setupScripts={scripts} database={databaseView} />}
    </div>)}
    </main>
    {confirmSubmit && <Dialog title={tr("Submit & Exit")} onClose={() => { if (!submitting) setConfirmSubmit(false); }}><p>{tr("Submit all enabled sections of this problem for teacher review?")}</p>{submitError && <p role="alert">{submitError}</p>}<div className="workspace-finish-actions"><button className="button" disabled={submitting} onClick={() => setConfirmSubmit(false)}>{tr("Cancel")}</button><button className="button primary" disabled={submitting} onClick={() => void submitAndExit()}>{tr(submitting ? "Submitting…" : "Submit & Exit")}</button></div></Dialog>}
  </div></ProblemWorkspaceLayoutProvider>;
}
