import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  readTeacherDraft,
  saveTeacherDraft as saveDraftData,
  teacherProblems,
  type TeacherProblem,
} from "../../data/teacherDemoData";
import { teacherProblemLibraryKey, teacherProblemLibrarySeed } from "./TeacherLandingPages";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";

const legacyDraftKey = "querylab:teacher:problem-draft:v1";

export function ProblemEditorPage() {
  const { problemId } = useParams();
  const location = useLocation();
  const selectedId = problemId || (location.pathname.endsWith("/new") ? "new" : "p1");
  const draftKey = selectedId === "p1" ? legacyDraftKey : `querylab:teacher:problem-draft:${selectedId}`;
  const [problem, setProblem] = useState(() => {
    const catalog = selectedId === "new" ? undefined : teacherProblemLibrarySeed.find((row) => row.id === selectedId);
    const base = teacherProblems.find((row) => row.id === selectedId) || teacherProblems[0];
    const fallback: TeacherProblem = selectedId === "new"
      ? { ...base, id: "new", number: "023", title: "New SQL problem", visibility: "Private", topics: "" }
      : catalog
        ? { ...base, id: selectedId, number: catalog.number, title: catalog.title, difficulty: catalog.difficulty, visibility: catalog.visibility, topics: catalog.topics }
        : { ...base, id: selectedId };
    const saved = readTeacherDraft<TeacherProblem>(draftKey, fallback);
    return {
      ...fallback,
      ...saved,
      visibility: saved.visibility || "Private",
      seedData:
        typeof saved.seedData === "string"
          ? saved.seedData
          : teacherProblems[0].seedData,
    };
  });
  const [saveState, setSaveState] = useState("All changes saved");
  const [validationState, setValidationState] = useState("Validation passed");
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<"preview" | null>(null);

  function update<K extends keyof TeacherProblem>(
    field: K,
    value: TeacherProblem[K],
  ) {
    setProblem((current) => ({ ...current, [field]: value }));
    setSaveState("Unsaved changes");
    setReady(false);
  }

  function saveDraft() {
    saveDraftData(draftKey, problem);
    saveLibraryRow();
    setSaveState("All changes saved");
  }

  function saveLibraryRow() {
    const rows = readTeacherDraft<typeof teacherProblemLibrarySeed>(teacherProblemLibraryKey, teacherProblemLibrarySeed);
    const existing = rows.find((row) => row.id === problem.id);
    const nextRow = {
      id: problem.id,
      number: problem.number,
      title: problem.title,
      difficulty: problem.difficulty,
      topics: problem.topics,
      visibility: problem.visibility,
      usedIn: existing?.usedIn ?? 0,
      updated: "Sep 24",
    };
    saveDraftData(teacherProblemLibraryKey, existing
      ? rows.map((row) => row.id === problem.id ? nextRow : row)
      : [...rows, nextRow]);
  }

  function validate() {
    const valid =
      problem.title.trim() &&
      problem.statement.trim() &&
      problem.requirements.trim() &&
      problem.referenceSolution.trim() &&
      problem.expectedColumns.length > 0;
    setValidationState(
      valid
        ? "Fields complete · SQL execution unavailable in demo"
        : "Validation error · complete the required fields",
    );
  }

  function markReady() {
    saveDraftData(draftKey, problem);
    saveLibraryRow();
    setSaveState("All changes saved");
    setReady(true);
  }

  return (
    <section className="teacher-page teacher-problem-page">
      <TeacherPageIntro
        title="Problem editor"
        context={`Problem ${problem.number} / ${problem.title}`}
      >
        <button className="button" type="button" onClick={saveDraft}>
          Save draft
        </button>
        <button
          className="button"
          type="button"
          onClick={() => setDialog("preview")}
        >
          Preview
        </button>
        <button className="button primary" type="button" onClick={markReady}>
          Mark as ready
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />
      <p className={`teacher-editor-state${ready ? " is-published" : ""}`}>
        {ready ? "Ready" : "Draft"} · {problem.visibility} · {saveState} · {validationState}
      </p>

      <div className="teacher-editor-layout">
        <section className="teacher-editor-details">
          <TeacherSectionTitle title="Problem details" />
          <TeacherField label="TITLE">
            <input
              value={problem.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </TeacherField>
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
          <TeacherField label="TOPICS">
            <input
              value={problem.topics}
              onChange={(event) => update("topics", event.target.value)}
            />
          </TeacherField>
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
                ? "Private: only you can use it. Public: listed in Practice for all students."
                : "Public problems are listed in Practice for all students."}
            </small>
          </TeacherField>
          <TeacherField label="STATEMENT">
            <textarea
              rows={3}
              value={problem.statement}
              onChange={(event) => update("statement", event.target.value)}
            />
          </TeacherField>
          <TeacherField label="REQUIREMENTS">
            <textarea
              rows={3}
              value={problem.requirements}
              onChange={(event) => update("requirements", event.target.value)}
            />
          </TeacherField>
          <div className="teacher-hints">
            {problem.hints.map((hint, index) => (
              <TeacherField label={`HINT ${String(index + 1).padStart(2, "0")}`} key={index}>
                <textarea
                  rows={2}
                  value={hint}
                  onChange={(event) => {
                    const hints = [...problem.hints];
                    hints[index] = event.target.value;
                    update("hints", hints);
                  }}
                />
              </TeacherField>
            ))}
            <button
              className="button teacher-small-button"
              type="button"
              onClick={() => update("hints", [...problem.hints, ""])}
            >
              Add hint
            </button>
          </div>
        </section>

        <section className="teacher-editor-validation">
          <TeacherSectionTitle title="Database & validation" />
          <TeacherField label="DATABASE">
            <select
              value={problem.database}
              onChange={(event) => update("database", event.target.value)}
            >
              <option>MySQL 8.0</option>
              <option>PostgreSQL 16</option>
              <option>SQLite 3</option>
            </select>
          </TeacherField>
          <div className="teacher-code-section">
            <div className="teacher-code-title">
              <span>Schema</span>
              <span>/</span>
              <span>schema.sql</span>
            </div>
            <textarea
              className="teacher-code-editor teacher-schema-editor"
              aria-label="Schema SQL"
              spellCheck={false}
              value={problem.schema}
              onChange={(event) => update("schema", event.target.value)}
            />
          </div>
          <div className="teacher-code-section">
            <div className="teacher-code-title">
              <span>Seed data</span>
              <span>/</span>
              <span>seed.sql</span>
            </div>
            <textarea
              className="teacher-code-editor teacher-seed-editor"
              aria-label="Seed data SQL"
              spellCheck={false}
              value={problem.seedData}
              onChange={(event) => update("seedData", event.target.value)}
            />
          </div>
          <p className="teacher-seed-summary">
            {problem.seedSummary} · loaded before every run
          </p>
          <div className="teacher-code-section">
            <div className="teacher-code-title">
              <span>Reference solution</span>
              <span>/</span>
              <span>solution.sql</span>
            </div>
            <textarea
              className="teacher-code-editor teacher-solution-editor"
              aria-label="Reference solution SQL"
              spellCheck={false}
              value={problem.referenceSolution}
              onChange={(event) => update("referenceSolution", event.target.value)}
            />
          </div>
          <button className="button" type="button" onClick={validate}>
            Validate solution
          </button>
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
      </div>
      {dialog === "preview" && (
        <Dialog title="Student preview" onClose={() => setDialog(null)}>
          <div className="teacher-preview-dialog">
            <p className="tiny muted">
              Problem {problem.number} · {problem.difficulty} · {problem.topics}
            </p>
            <h3>{problem.title}</h3>
            <p>{problem.statement}</p>
            <p>{problem.requirements}</p>
            <pre>{problem.schema}</pre>
            <p className="tiny muted">Preview only · no student data is connected.</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
