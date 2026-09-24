import { useState } from "react";
import { Dialog } from "../../components/ui";
import {
  readTeacherDraft,
  saveTeacherDraft,
  teacherProblems,
  type TeacherProblem,
} from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";

const draftKey = "querylab:teacher:problem-draft:v1";

export function ProblemEditorPage() {
  const [problem, setProblem] = useState(() => {
    const saved = readTeacherDraft<TeacherProblem>(draftKey, teacherProblems[0]);
    return { ...saved, visibility: saved.visibility || "Private" };
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
    saveTeacherDraft(draftKey, problem);
    setSaveState("All changes saved");
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
        ? "Validation passed · sample data preview"
        : "Validation error · complete the required fields",
    );
  }

  function markReady() {
    saveTeacherDraft(draftKey, problem);
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
          <TeacherField label="TOPICS">
            <input
              value={problem.topics}
              onChange={(event) => update("topics", event.target.value)}
            />
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
          <p className="teacher-seed-summary">Seed data · {problem.seedSummary}</p>
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
          <p className="teacher-demo-note">
            Demo validation checks required fields and shows the saved sample output. SQL is not executed.
          </p>
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
