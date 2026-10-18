import { useEffect, useRef, useState, type CSSProperties } from "react";
import { TranslatedText } from "../../../../components/TranslatedText";
import { useLanguage } from "../../../../context/LanguageContext";
import CodeMirror from "@uiw/react-codemirror";
import { sqlEditorExtensions } from "../../../../components/sqlEditorExtensions";
import { Dialog } from "../../../../components/ui";
import { ProblemMarkdown } from "../../../../components/ProblemMarkdown";
import { Check, Play, RotateCcw } from "lucide-react";
import type { Problem } from "../../../../data/models";
import type { QueryResult } from "../../../../services/studentApi";
import { useProblemWorkspaceLayout } from "./ProblemWorkspaceLayoutContext";
import { WorkspaceResizeHandle } from "./WorkspaceResizeHandle";
import { WorkspaceDatabasePanel, type WorkspaceDatabaseState } from "./WorkspaceDatabasePanel";
import { defaults, type PaneSizes } from "../../../../utils/workspacePreferences";

export type StageEditorProps = {
  problem: Problem; value: string; onChange: (value: string) => void;
  onRun: () => void; onReset?: () => void; busy: boolean; result?: QueryResult | null; error?: string;
  database: WorkspaceDatabaseState; canContinue?: boolean; onContinue?: () => void;
};

export function StageEditor({ problem, value, onChange, onRun, onReset, busy, result, error, part, description, placeholder, database, canContinue, onContinue }: StageEditorProps & {
  part: "DDL" | "DML"; description: string; placeholder: string;
}) {
  const { t: tr } = useLanguage("workspace");
  const layoutContext = useProblemWorkspaceLayout();
  if (!layoutContext) throw new Error("StageEditor must be rendered inside ProblemWorkspaceLayoutProvider.");
  const { preferences, setPreferences } = layoutContext;
  const { layout } = preferences;
  const { problemWidth, secondBoundary } = preferences.sizes[layout];
  const [problemTab, setProblemTab] = useState<"Description" | "Database">("Description");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resizing, setResizing] = useState(false);
  const workspaceLayout = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (result || error) setProblemTab("Database"); }, [result, error]);
  function updateSizes(change: Partial<PaneSizes>) {
    setPreferences(previous => ({ ...previous, sizes: { ...previous.sizes, [layout]: { ...previous.sizes[layout], ...change } } }));
  }
  return <div ref={workspaceLayout} className={`stage-workspace${resizing ? " is-resizing" : ""}`} style={{ "--problem-pane-width": `${problemWidth}%` } as CSSProperties}>
    <aside id={`stage-problem-pane-${part}`} className="stage-problem problem-pane" aria-label={tr("Problem details")}>
      <div className="pane-tabs" role="tablist" aria-label={tr("Problem information")}>
        {(["Description", "Database"] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={problemTab === tab} className={problemTab === tab ? "active" : ""} onClick={() => setProblemTab(tab)}><TranslatedText>{tr(tab)}</TranslatedText></button>)}
      </div>
      <div className="problem-scroll">
        {problemTab === "Description" ? <>
          <p className="tiny"><TranslatedText>{tr("PROBLEM")}</TranslatedText> {problem.number}</p>
          <h1>{problem.title}</h1>
          <p className="muted stage-problem-description"><TranslatedText>{tr(description)}</TranslatedText></p>
          <ProblemMarkdown>{problem.description}</ProblemMarkdown>
          {problem.requirements && <><h3><TranslatedText>{tr("Requirements")}</TranslatedText></h3><ProblemMarkdown>{problem.requirements}</ProblemMarkdown></>}
        </> : <WorkspaceDatabasePanel database={database} result={result} error={error} />}
      </div>
    </aside>
    <WorkspaceResizeHandle axis="vertical" containerRef={workspaceLayout} value={problemWidth} min={18} max={layout === "Note-taking" ? secondBoundary - 26 : 50} label={tr("Resize problem and editor panes")} controls={`stage-problem-pane-${part} stage-editor-pane-${part}`} onResize={value => updateSizes({ problemWidth: value })} onResizeStart={() => setResizing(true)} onResizeEnd={() => setResizing(false)} onReset={() => updateSizes({ problemWidth: defaults[layout].problemWidth })} />
    <section className="editor-pane stage-code-panel" id={`stage-editor-pane-${part}`} aria-label={tr("{value0} work", { value0: part })}>
      <div className="editor-toolbar stage-editor-toolbar">
        <span className="editor-dialect">SQL Server</span>
        <button type="button" className="icon-button" aria-label={tr("Reset {value0} script", { value0: part })} title={tr("Reset {value0} script", { value0: part })} onClick={() => setConfirmReset(true)}><RotateCcw size={16} /></button>
        <b>{part.toLowerCase()}.sql</b>
      </div>
      <div className="stage-code"><CodeMirror value={value} height="100%" extensions={sqlEditorExtensions} onChange={onChange} placeholder={tr(placeholder)} aria-label={tr("{value0} editor", { value0: part })} /></div>
      <div className="editor-actions stage-editor-actions">
        <span className="muted">{result?.executionTimeMs != null ? `${tr("Execution time")} · ${result.executionTimeMs.toFixed(2)} ms` : tr("Ready to run {value0}", { value0: part })}</span>
        <div className="stage-run-actions">
          <button type="button" className="button primary" onClick={onRun} disabled={busy || !value.trim()}><Play size={15} /><TranslatedText>{busy ? tr("Running…") : tr("Run {value0}", { value0: part })}</TranslatedText></button>
          {onContinue && <button type="button" className="button" onClick={onContinue} disabled={busy || !canContinue} title={!canContinue ? tr("Run DDL successfully before continuing.") : undefined}><Check size={15} /><TranslatedText>{tr("Confirm & Continue")}</TranslatedText></button>}
        </div>
      </div>
    </section>
    {confirmReset && <Dialog title={tr("Reset {value0} script?", { value0: part })} onClose={() => setConfirmReset(false)}>
      <p><TranslatedText>{tr("Your current SQL draft will be cleared from this browser.")}</TranslatedText></p>
      <div className="dialog-actions"><button className="button" type="button" onClick={() => setConfirmReset(false)}><TranslatedText>{tr("Cancel")}</TranslatedText></button><button className="button primary" type="button" onClick={() => { if (onReset) onReset(); else onChange(""); setConfirmReset(false); }}><TranslatedText>{tr("Clear script")}</TranslatedText></button></div>
    </Dialog>}
  </div>;
}
