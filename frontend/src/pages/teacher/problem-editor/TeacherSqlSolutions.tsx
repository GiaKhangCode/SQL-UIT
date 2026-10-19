import { useEffect, useRef, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { TranslatedText } from "../../../components/TranslatedText";
import { useLanguage } from "../../../context/LanguageContext";
import type { DataTable } from "../../../data/models";
import type { TeacherSqlSolution } from "../../../data/teacherTypes";
import { teacherService } from "../../../services/teacherService";
import { ProblemSqlEditor } from "./ProblemSqlEditor";

type DatasetResult = {
  dataset: number;
  timeMs?: number;
  error?: string;
  table?: DataTable;
};
type Run = { running: boolean; source: string; results: DatasetResult[] };

export function initialSqlSolutions(solutions?: TeacherSqlSolution[] | null, legacyQuery = "", legacyId: string = crypto.randomUUID()): TeacherSqlSolution[] {
  return solutions?.length ? solutions.map(solution => ({ ...solution, description: solution.description || "", expectedOutputs: solution.expectedOutputs || [], expectedOutputVisible: solution.expectedOutputVisible !== false })) : [{ id: legacyId, name: "solution_1.sql", description: "", expectedOutputs: [], expectedOutputVisible: true, query: legacyQuery, enabled: true, timeLimitMs: 5000 }];
}

function TimeLimitInput({ value, onChange, id }: { value: number; onChange: (value: number) => void; id: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <input id={id} type="number" min={100} max={60000} step={100} value={draft}
    onChange={(event) => {
      setDraft(event.target.value);
      const next = event.target.valueAsNumber;
      if (Number.isFinite(next) && next >= 100 && next <= 60000) onChange(Math.round(next));
    }}
    onBlur={() => {
      const next = Math.round(Math.min(60000, Math.max(100, Number(draft) || value)));
      setDraft(String(next));
      if (next !== value) onChange(next);
    }}
  />;
}

export function TeacherSqlSolutions({ solutions, schema, datasets, onChange, expectedOutputs, expectedOutputVisible,
  onExpectedOutputsChange, onExpectedOutputVisibilityChange, onRunningChange }: {
  solutions: TeacherSqlSolution[];
  schema: string;
  datasets: { seedData: string; isHidden?: boolean }[];
  onChange: (solutions: TeacherSqlSolution[]) => void;
  expectedOutputs: DataTable[];
  expectedOutputVisible: boolean;
  onExpectedOutputsChange: (outputs: DataTable[]) => void;
  onExpectedOutputVisibilityChange: (visible: boolean) => void;
  onRunningChange: (running: boolean) => void;
}) {
  const { t: tr, locale } = useLanguage("teacher");
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const mounted = useRef(false);
  const latest = useRef({ solutions, schema, datasets, onExpectedOutputsChange, onChange });
  latest.current = { solutions, schema, datasets, onExpectedOutputsChange, onChange };
  const formatMs = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => onRunningChange(Object.values(runs).some((run) => run.running)), [runs, onRunningChange]);
  useEffect(() => () => onRunningChange(false), [onRunningChange]);

  function change(id: string, patch: Partial<TeacherSqlSolution>) {
    onChange(solutions.map((solution) => solution.id === id ? { ...solution, ...patch, ...(patch.query !== undefined && patch.query !== solution.query ? { expectedOutputs: [] } : {}) } : solution));
  }
  function sourceOf(solution: TeacherSqlSolution) {
    return JSON.stringify([schema, datasets.map((dataset) => dataset.seedData), solution.query]);
  }
  async function runSolution(solution: TeacherSqlSolution) {
    if (Object.values(runs).some(run => run.running) || !solution.enabled || !solution.query.trim()) return;
    const source = sourceOf(solution);
    const results: DatasetResult[] = [];
    setRuns((current) => ({ ...current, [solution.id]: { running: true, source, results: [] } }));
    try {
      for (const [index, dataset] of datasets.entries()) {
        try {
          const result = await teacherService.validateSolution({ database: "SQL Server", schema,
            seedData: dataset.seedData, referenceSolution: solution.query });
          results.push(result.status === "Success"
            ? { dataset: index + 1, timeMs: result.executionTimeMs, table: result.table }
            : { dataset: index + 1, error: result.message || tr("Run failed") });
        } catch (error) {
          results.push({ dataset: index + 1, error: error instanceof Error ? error.message : tr("Run failed") });
        }
        if (!mounted.current) return;
        setRuns((current) => ({ ...current, [solution.id]: { running: true, source, results: [...results] } }));
      }
    } finally {
      if (mounted.current) {
        const current = latest.current;
        const currentSolution = current.solutions.find((item) => item.id === solution.id);
        const sourceIsCurrent = currentSolution?.enabled
          && source === JSON.stringify([current.schema, current.datasets.map((dataset) => dataset.seedData), currentSolution.query]);
        if (sourceIsCurrent && datasets.length > 0 && results.length === datasets.length
          && results.every((result) => result.table && !result.error)) {
          const outputs = results.map((result) => result.table!);
          current.onChange(current.solutions.map(item => item.id === solution.id ? { ...item, expectedOutputs: outputs } : item));
          if (current.solutions[0]?.id === solution.id) current.onExpectedOutputsChange(outputs);
        }
        setRuns((current) => ({ ...current, [solution.id]: { running: false, source, results: [...results] } }));
      }
    }
  }

  return <div className="teacher-solution-list">
    {solutions.map((solution, index) => {
      const run = runs[solution.id];
      const stale = Boolean(run && run.source !== sourceOf(solution));
      const times = (run?.results || []).flatMap((result) => typeof result.timeMs === "number" ? [result.timeMs] : []);
      return <section className={`teacher-solution-card${solution.enabled ? "" : " is-disabled"}`} key={solution.id}>
        <div className="teacher-solution-heading">
          <span className="teacher-dataset-number"><TranslatedText>{tr("SQL Solution")}</TranslatedText></span>
          <div className="teacher-solution-filename">
            <input aria-label={tr("Solution {value0} file name", { value0: index + 1 })} maxLength={116}
              value={solution.name.replace(/\.sql$/i, "")}
              onChange={(event) => change(solution.id, { name: event.target.value.replace(/\.sql$/i, "") + ".sql" })} />
            <span>.sql</span>
          </div>
          <div className="teacher-solution-actions">
            {index === 0 && <button type="button" className="button teacher-small-button" disabled={solutions.length >= 50} onClick={() => {
              const names = new Set(solutions.map(item => item.name));
              let number = solutions.length + 1;
              while (names.has(`solution_${number}.sql`)) number++;
              onChange([...solutions, { id: crypto.randomUUID(), name: `solution_${number}.sql`, description: "", query: "", enabled: true, timeLimitMs: 5000, expectedOutputs: [], expectedOutputVisible: true }]);
            }}><Plus size={14} aria-hidden="true" /><TranslatedText>{tr("Add solution")}</TranslatedText></button>}
            {solutions.length > 1 && <button type="button" className="button teacher-small-button" disabled={run?.running} aria-label={tr("Delete solution {value0}", { value0: index + 1 })} onClick={() => {
              if ((solution.query.trim() || solution.description?.trim()) && !window.confirm(tr("Delete this solution and its question?"))) return;
              onChange(solutions.filter(item => item.id !== solution.id));
            }}><Trash2 size={14} aria-hidden="true" /><TranslatedText>{tr("Delete")}</TranslatedText></button>}
            <button className={`button teacher-small-button${solution.enabled ? "" : " is-active"}`} type="button"
              aria-pressed={!solution.enabled} disabled={run?.running}
              aria-label={tr("Disable solution {value0}", { value0: index + 1 })}
              onClick={() => change(solution.id, { enabled: !solution.enabled })}>
              <TranslatedText>{tr(solution.enabled ? "Disable" : "Disabled")}</TranslatedText>
            </button>
          </div>
        </div>
        {!solution.enabled && <p className="teacher-solution-note"><TranslatedText>{tr("Disabled solutions are excluded from grading.")}</TranslatedText></p>}
        <label className="teacher-solution-description"><TranslatedText>{tr("Question description")}</TranslatedText>
          <textarea rows={3} maxLength={20000} value={solution.description || ""} placeholder={tr("Describe what students must query for this question.")}
            onChange={event => change(solution.id, { description: event.target.value })} />
        </label>
        <ProblemSqlEditor value={solution.query} label={tr("Solution {value0} SQL", { value0: index + 1 })}
          placeholder={tr("-- Example SQL Server query\nSELECT CustomerId, FullName\nFROM Customers\nORDER BY CustomerId;")}
          onChange={(query) => change(solution.id, { query })} />
        <div className="teacher-solution-run-row">
          <span className="teacher-solution-timing" aria-live="polite">
            <TranslatedText>{tr(run?.running ? "Running…" : stale ? "Changed since last run" : times.length ? "Slowest dataset" : "Not run yet")}</TranslatedText>
            {!stale && times.length > 0 && <strong>{formatMs(Math.max(...times))} <TranslatedText>{tr("ms")}</TranslatedText></strong>}
          </span>
          <label className="teacher-solution-limit" htmlFor={`solution-limit-${solution.id}`}>
            <TranslatedText>{tr("Student time limit")}</TranslatedText>
            <TimeLimitInput id={`solution-limit-${solution.id}`} value={solution.timeLimitMs} onChange={(timeLimitMs) => change(solution.id, { timeLimitMs })} />
            <span><TranslatedText>{tr("ms")}</TranslatedText></span>
          </label>
          <button className="button primary" type="button" disabled={Object.values(runs).some(run => run.running) || !solution.enabled || !solution.query.trim()}
            onClick={() => void runSolution(solution)}><Play size={14} aria-hidden="true" /><TranslatedText>{tr(run?.running ? "Running…" : "Run")}</TranslatedText></button>
        </div>
        {run && !stale && run.results.map((result) => <details className={`teacher-solution-output${result.error ? " is-error" : ""}`} key={result.dataset}>
          <summary><TranslatedText>{tr("Dataset")}</TranslatedText> {result.dataset}
            {typeof result.timeMs === "number" && <span>{formatMs(result.timeMs)} <TranslatedText>{tr("ms")}</TranslatedText></span>}
            {result.error && <span><TranslatedText>{tr("Run failed")}</TranslatedText></span>}

          </summary>
          {result.error ? <p role="alert">{result.error}</p> : result.table && <div className="teacher-table-scroll"><table className="teacher-table">
            <thead><tr>{result.table.columns.map((column, columnIndex) => <th key={columnIndex}>{column}</th>)}</tr></thead>
            <tbody>{result.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{String(cell ?? "NULL")}</td>)}</tr>)}</tbody>
          </table></div>}
        </details>)}
        <div className="teacher-solution-expected-actions">
          {(solution.expectedOutputs?.length || (index === 0 ? expectedOutputs.length : 0)) > 0 && <button className="button teacher-small-button" type="button" aria-pressed={solution.expectedOutputVisible !== false}
            onClick={() => { change(solution.id, { expectedOutputVisible: solution.expectedOutputVisible === false }); if (index === 0) onExpectedOutputVisibilityChange(!expectedOutputVisible); }}>
            <TranslatedText>{tr(solution.expectedOutputVisible !== false ? "Hide expected output" : "Show expected output")}</TranslatedText>
          </button>}
          <span className="teacher-solution-expected-note"><TranslatedText>{tr("Successful runs automatically update the expected output. Open Preview to view it in the problem.")}</TranslatedText></span>
        </div>
      </section>;
    })}
  </div>;
}
