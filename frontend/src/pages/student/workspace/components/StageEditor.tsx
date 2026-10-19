import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import CodeMirror from "@uiw/react-codemirror";
import { sqlEditorExtensions } from "../../../../components/sqlEditorExtensions";
import { Dialog } from "../../../../components/ui";
import { ProblemMarkdown } from "../../../../components/ProblemMarkdown";
import { ProblemExpectedOutput } from "../../../../components/ProblemExpectedOutput";
import { Play, RotateCcw } from "lucide-react";
import type { Problem } from "../../../../data/models";
import type { QueryResult } from "../../../../services/studentApi";
import { useProblemWorkspaceLayout } from "./ProblemWorkspaceLayoutContext";
import { WorkspaceResizeHandle } from "./WorkspaceResizeHandle";
import { WorkspaceDatabasePanel, type WorkspaceDatabaseState } from "./WorkspaceDatabasePanel";
import { WorkspaceSubmissionPanel, type WorkspaceAttempt } from "./WorkspaceSubmissionPanel";
import { defaults, type PaneSizes } from "../../../../utils/workspacePreferences";
import { WorkspaceEditorStatus } from "./WorkspaceEditorStatus";

export type StageEditorProps = {
  problem: Problem; value: string; onChange: (value: string) => void;
  onRun: (selection?: string) => void; onReset?: () => void; busy: boolean; result?: QueryResult | null; error?: string;
  database: WorkspaceDatabaseState;
  readOnly?: boolean; submissionAttempts?: WorkspaceAttempt[]; submissionBusy?: boolean;
  submissionNotice?: string; submissionSignal?: number; submissionsUsed?: number; maxSubmissions?: number | null;
};

export function StageEditor({ problem, value, onChange, onRun, onReset, busy, result, error, part, description, placeholder, database, readOnly = false, submissionAttempts = [], submissionBusy = false, submissionNotice = "", submissionSignal = 0, submissionsUsed, maxSubmissions }: StageEditorProps & {
  part: "DDL" | "DML"; description: string; placeholder: string;
}) {
  const { t: tr } = useLanguage("workspace");
  const layoutContext = useProblemWorkspaceLayout();
  if (!layoutContext) throw new Error("StageEditor must be rendered inside ProblemWorkspaceLayoutProvider.");
  const { preferences, setPreferences, focus } = layoutContext;
  const { layout } = preferences;
  const { problemWidth, secondBoundary } = preferences.sizes[layout];
  const targetDataset = part === "DML"
    ? problem.testCases?.find(testCase => !testCase.isHidden)?.seedData || ""
    : "";
  const [problemTab, setProblemTab] = useState<"Description" | "Database" | "Submission">("Description");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [selected, setSelected] = useState("");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const workspaceLayout = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (result || error) setProblemTab("Database"); }, [result, error]);
  useEffect(() => { if (layout === "Debug") setProblemTab("Database"); }, [layout]);
  useEffect(() => { if (submissionSignal) setProblemTab("Submission"); }, [submissionSignal]);
  function updateSizes(change: Partial<PaneSizes>) {
    setPreferences(previous => ({ ...previous, sizes: { ...previous.sizes, [layout]: { ...previous.sizes[layout], ...change } } }));
  }
  return <div ref={workspaceLayout} className={`stage-workspace${resizing ? " is-resizing" : ""}${focus ? " focus-mode" : ""}`} style={{ "--problem-pane-width": `${problemWidth}%` } as CSSProperties}>
    <aside id={`stage-problem-pane-${part}`} className="stage-problem problem-pane" aria-label={tr("Problem details")}>
      <div className="pane-tabs" role="tablist" aria-label={tr("Problem information")}>
        {(["Description", "Database", "Submission"] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={problemTab === tab} className={problemTab === tab ? "active" : ""} onClick={() => setProblemTab(tab)}><TranslatedText>{tr(tab)}</TranslatedText></button>)}
      </div>
      <div className="problem-scroll">
        {problemTab === "Submission" ? <WorkspaceSubmissionPanel attempts={submissionAttempts} busy={submissionBusy} notice={submissionNotice} submissionsUsed={submissionsUsed} maxSubmissions={maxSubmissions} /> : problemTab === "Database" ? <WorkspaceDatabasePanel database={database} result={result} error={error} /> : <>
          <h1>{problem.title}</h1>
          <p className="muted stage-problem-description"><TranslatedText>{tr(description)}</TranslatedText></p>
          <ProblemMarkdown>{problem.description}</ProblemMarkdown>
          {problem.requirements && <><h3><TranslatedText>{tr("Requirements")}</TranslatedText></h3><ProblemMarkdown>{problem.requirements}</ProblemMarkdown></>}
          {targetDataset && <details className="stage-target-dataset" open>
            <summary><TranslatedText>{tr("Target dataset")}</TranslatedText></summary>
            <p className="muted"><TranslatedText>{tr("Recreate these rows with INSERT statements.")}</TranslatedText></p>
            <CodeMirror value={targetDataset} height="200px" readOnly editable={false} extensions={sqlEditorExtensions} />
          </details>}
          <ProblemExpectedOutput table={problem.expected} samples={problem.expectedSamples} />
        </>}
      </div>
    </aside>
    <WorkspaceResizeHandle axis="vertical" containerRef={workspaceLayout} value={problemWidth} min={18} max={layout === "Note-taking" ? secondBoundary - 26 : 50} label={tr("Resize problem and editor panes")} controls={`stage-problem-pane-${part} stage-editor-pane-${part}`} onResize={value => updateSizes({ problemWidth: value })} onResizeStart={() => setResizing(true)} onResizeEnd={() => setResizing(false)} onReset={() => updateSizes({ problemWidth: defaults[layout].problemWidth })} />
    <section className="editor-pane stage-code-panel" id={`stage-editor-pane-${part}`} aria-label={tr("{value0} work", { value0: part })}>
      <div className="editor-toolbar stage-editor-toolbar">
        <span className="editor-dialect">SQL Server</span>
        <button type="button" className="icon-button" aria-label={tr("Reset {value0} script", { value0: part })} title={readOnly ? tr("Submitted work is read-only") : tr("Reset {value0} script", { value0: part })} disabled={readOnly} onClick={() => setConfirmReset(true)}><RotateCcw size={16} /></button>
        <b>{part.toLowerCase()}.sql</b>
        {readOnly && <small className="muted"><TranslatedText>{tr("View only")}</TranslatedText></small>}
      </div>
      <div className="stage-code"><CodeMirror value={value} height="100%" readOnly={readOnly} editable={!readOnly} extensions={sqlEditorExtensions} onChange={next => { if (!readOnly) onChange(next); }} onUpdate={update => {
        const selection = update.state.selection.main;
        const line = update.state.doc.lineAt(selection.head);
        setCursor({ line: line.number, column: selection.head - line.from + 1 });
        setSelected(update.state.sliceDoc(selection.from, selection.to));
      }} placeholder={tr(placeholder)} aria-label={tr("{value0} editor", { value0: part })} /></div>
      <div className="editor-actions stage-editor-actions">
        <WorkspaceEditorStatus {...cursor} executionTimeMs={result?.executionTimeMs} />
        <div className="stage-run-actions">
          <button type="button" className="button" onClick={() => onRun(selected)} disabled={readOnly || busy || !selected.trim()} title={!selected.trim() ? tr("Select SQL text in the editor first") : undefined}>{tr("Run selected")}</button>
          <button type="button" className="button primary" onClick={() => onRun()} disabled={readOnly || busy || !value.trim()}><Play size={15} /><TranslatedText>{busy ? tr("Running…") : tr(part === "DDL" ? "Run table" : "Run data")}</TranslatedText></button>
        </div>
      </div>
    </section>
    {confirmReset && !readOnly && <Dialog title={tr("Reset {value0} script?", { value0: part })} onClose={() => setConfirmReset(false)}>
      <p><TranslatedText>{tr("Your current SQL draft will be cleared from this browser.")}</TranslatedText></p>
      <div className="dialog-actions"><button className="button" type="button" onClick={() => setConfirmReset(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button className="button primary" type="button" onClick={() => { if (onReset) onReset(); else onChange(""); setConfirmReset(false); }}><TranslatedText>{tr("Clear script")}</TranslatedText></button></div>
    </Dialog>}
  </div>;
}
