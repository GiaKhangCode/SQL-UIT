import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, Settings2, X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import type { DatabaseRelationDescription, DataTable, WorkspacePart } from "../../data/models";
import { teacherService } from "../../services/teacherService";
import { WORKSPACE_PARTS, WORKSPACE_PART_LABELS } from "../../utils/workspaceParts";
import { parseDatabaseSchema } from "../../utils/parseDatabaseSchema";
import { parseSeedData } from "../../utils/parseSeedData";
import { TranslatedText } from "../../components/TranslatedText";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { ProblemDatabaseDescription } from "../../components/ProblemDatabaseDescription";
import { ProblemExpectedOutput } from "../../components/ProblemExpectedOutput";
import "../../styles/builder-problem-settings.css";

type Detail = {
  description?: string; requirements?: string; schema?: string; seedData?: string;
  databaseDescription?: DatabaseRelationDescription[];
  testCases?: { seedData: string; isHidden: boolean }[];
  sqlSolutions?: { id: string; name: string; query: string; enabled: boolean; timeLimitMs: number }[];
  referenceSolution?: string; expectedOutputs?: DataTable[];
};

export function BuilderProblemSettings({ problemId, title, parts, closing, onClose, onClosed, onPartsChange, onAdd, visibility = { databaseStructureVisible: true, databaseDescriptionVisible: true }, onVisibilityChange, datasetVisibility = {}, onDatasetVisibilityChange }: {
  datasetVisibility?: Record<string, boolean>;
  onDatasetVisibilityChange?: (visibility: Record<string, boolean>) => void;
  visibility?: { databaseStructureVisible: boolean; databaseDescriptionVisible: boolean };
  onVisibilityChange?: (visibility: { databaseStructureVisible: boolean; databaseDescriptionVisible: boolean }) => void;
  problemId: string; title: string; parts: WorkspacePart[]; closing: boolean;
  onClose: () => void; onClosed: () => void; onPartsChange: (parts: WorkspacePart[]) => void; onAdd?: () => void;
}) {
  const { t: tr } = useLanguage("teacher");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<WorkspacePart[]>(["DDL"]);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeButton.current?.focus(); }, []);
  useEffect(() => {
    let active = true;
    setDetail(null); setError("");
    teacherService.getProblem(problemId).then(data => { if (active) setDetail(data); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : tr("Could not load problem details.")); });
    return () => { active = false; };
  }, [problemId, attempt]);
  const tables = parseDatabaseSchema(detail?.schema || "");
  const datasets = detail?.testCases?.length ? detail.testCases : detail?.seedData ? [{ seedData: detail.seedData, isHidden: false }] : [];
  return <aside id="builder-problem-settings" className={`teacher-student-preview-panel builder-problem-settings${closing ? " is-closing" : ""}`} aria-labelledby="builder-problem-settings-title"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
    onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === "teacher-preview-panel-out") onClosed(); }}>
    <header className="teacher-student-preview-heading"><h2 id="builder-problem-settings-title"><Settings2 size={18} aria-hidden="true" /><TranslatedText>{tr("Problem settings")}</TranslatedText></h2><button ref={closeButton} type="button" className="icon-button" aria-label={tr("Close settings")} onClick={onClose}><X size={18} /></button></header>
    <div className="builder-problem-settings-scroll">
      <h3 className="builder-problem-settings-name">{title}</h3>
      <p className="muted"><TranslatedText>{tr("Choose sections for this activity. Expand each section to view its saved problem content.")}</TranslatedText></p>
      {!parts.length && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr("Select at least one section.")}</TranslatedText></p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="button" onClick={() => setAttempt(value => value + 1)}><TranslatedText>{tr("Retry")}</TranslatedText></button></div>}
      {!detail && !error && <p role="status"><TranslatedText>{tr("Loading problem details…")}</TranslatedText></p>}
      {WORKSPACE_PARTS.map(part => {
        const open = expanded.includes(part);
        const label = tr(WORKSPACE_PART_LABELS[part]);
        return <section className={`builder-settings-section${parts.includes(part) ? " is-enabled" : ""}`} key={part}>
          <div className="builder-settings-section-heading">
            <input type="checkbox" aria-label={label} checked={parts.includes(part)} onChange={event => onPartsChange(WORKSPACE_PARTS.filter(value => value === part ? event.target.checked : parts.includes(value)))} />
            <button type="button" aria-expanded={open} aria-controls={`builder-settings-${part}`} onClick={() => setExpanded(previous => open ? previous.filter(value => value !== part) : [...previous, part])}><strong><TranslatedText>{label}</TranslatedText></strong><ChevronDown size={17} className={open ? "is-expanded" : ""} aria-hidden="true" /></button>
          </div>
          <div className={`builder-settings-fold${open ? " is-expanded" : ""}`} ref={element => { if (element) element.inert = !open; }}>
            <div className="builder-settings-fold-inner"><div className="builder-settings-content" id={`builder-settings-${part}`}>
              {part === "SQL" && <>
      <div className="builder-settings-visibility" role="group" aria-label={tr("Student problem visibility")}>
        {([ ["databaseStructureVisible", "Hide Database structure", "Show Database structure"], ["databaseDescriptionVisible", "Hide statement", "Show statement"] ] as const).map(([field, hide, show]) => <button type="button" key={field} className="button teacher-small-button" aria-pressed={!visibility[field]} onClick={() => onVisibilityChange?.({ ...visibility, [field]: !visibility[field] })}>
          {visibility[field] ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}<TranslatedText>{tr(visibility[field] ? hide : show)}</TranslatedText>
        </button>)}
      </div>
              </>}
              {detail && <>
                {part !== "SQL" && detail.description && <ProblemMarkdown>{detail.description}</ProblemMarkdown>}
                {part === "DDL" && <>
                  <ProblemDatabaseDescription rows={detail.databaseDescription} />
                  <h4><TranslatedText>{tr("Database structure")}</TranslatedText></h4>
                  {tables.length ? tables.map((table, index) => <div key={index} className="builder-settings-data"><h5>{table.name}</h5><div className="table-scroll"><table className="data-table"><thead><tr><th><TranslatedText>{tr("Column")}</TranslatedText></th><th><TranslatedText>{tr("Type")}</TranslatedText></th><th><TranslatedText>{tr("Constraints")}</TranslatedText></th></tr></thead><tbody>{table.columns.map((column, i) => <tr key={i}><td>{column.name}</td><td>{column.type}</td><td>{column.constraints || "—"}</td></tr>)}</tbody></table></div></div>) : <p className="muted"><TranslatedText>{tr("No database structure yet.")}</TranslatedText></p>}
                </>}
                {part === "DML" && <>
                  {!datasets.length && <p className="muted"><TranslatedText>{tr("No datasets yet.")}</TranslatedText></p>}
                  {datasets.map((dataset, index) => {
                    const visible = datasetVisibility[String(index + 1)] ?? !dataset.isHidden;
                    return <section className="builder-settings-data" key={index}>
                    <div className="builder-settings-dataset-heading"><h4><TranslatedText>{tr("Dataset {value0}", { value0: index + 1 })}</TranslatedText></h4>
                      <button type="button" className="button teacher-small-button" aria-label={tr(visible ? "Hide Dataset {value0}" : "Show Dataset {value0}", { value0: index + 1 })} aria-pressed={!visible} onClick={() => onDatasetVisibilityChange?.({ ...datasetVisibility, [String(index + 1)]: !visible })}>
                        {visible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}<TranslatedText>{tr(visible ? "Hide dataset" : "Show dataset")}</TranslatedText>
                      </button>
                    </div>
                    {!visible && <p className="builder-settings-badge"><TranslatedText>{tr("Hidden from students")}</TranslatedText></p>}
                    {parseSeedData(dataset.seedData).map((table, tableIndex) => <div key={tableIndex}><h5>{table.name}</h5><div className="table-scroll"><table className="data-table"><thead><tr>{table.columns.map((column, i) => <th key={i}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value}</td>)}</tr>)}</tbody></table></div></div>)}
                    {!dataset.seedData && <p className="muted"><TranslatedText>{tr("No INSERT rows to preview in this dataset.")}</TranslatedText></p>}
                  </section>; })}
                </>}
                {part === "SQL" && <>
                  {(detail.sqlSolutions?.length ? detail.sqlSolutions : detail.referenceSolution ? [{ id: "reference", name: tr("Reference solution"), query: detail.referenceSolution, enabled: true, timeLimitMs: 5000 }] : []).map(solution => <section key={solution.id}><h4>{solution.name}</h4><p className="muted"><TranslatedText>{tr("Time limit: {value0} ms", { value0: solution.timeLimitMs })}</TranslatedText>{" · "}<TranslatedText>{tr(solution.enabled ? "Enabled" : "Disabled")}</TranslatedText></p></section>)}
                  <ProblemExpectedOutput samples={(detail.expectedOutputs || []).map((table, index) => ({ dataset: index + 1, table }))} />
                </>}
              </>}
            </div></div>
          </div>
        </section>;
      })}
    </div>
    <footer className="builder-problem-settings-footer">{onAdd ? <button type="button" className="button primary" disabled={!parts.length} onClick={onAdd}><TranslatedText>{tr("Add problem")}</TranslatedText></button> : <button type="button" className="button primary" onClick={onClose}><TranslatedText>{tr("Done")}</TranslatedText></button>}</footer>
  </aside>;
}
