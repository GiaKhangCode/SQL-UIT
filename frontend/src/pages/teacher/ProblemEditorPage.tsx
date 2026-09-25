import { useState, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Dialog } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { teacherProblems, type TeacherProblem } from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";

export function ProblemEditorPage() {
  const { problemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedId = problemId || (location.pathname.endsWith("/new") ? "new" : "p1");
  const [problem, setProblem] = useState<TeacherProblem | null>(null);
  
  useEffect(() => {
    async function fetchProblem() {
      try {
        if (selectedId === "new") {
          const allProblems = await teacherService.getAllProblems();
          let maxNum = 0;
          allProblems.forEach((p: any) => {
            const num = parseInt(p.number, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          });
          const nextNumber = String(maxNum + 1).padStart(3, '0');
          
          const base = teacherProblems[0];
          setProblem({ 
            ...base, 
            id: "new", 
            number: nextNumber, 
            title: "New SQL problem", 
            visibility: "Private", 
            topics: "", 
            database: "SQL Server",
            testCases: [{ seedData: base.seedData, isHidden: false }]
          });
          return;
        }

        const data = await teacherService.getProblem(selectedId);
        setProblem({
          id: data.id,
          number: data.number || "000",
          title: data.title || "",
          difficulty: data.difficulty || "Easy",
          topics: data.topics ? data.topics.join(", ") : (data.topic || ""),
          visibility: data.practiceListed ? "Public" : "Private",
          database: data.databaseType || "SQL Server",
          statement: data.description || "",
          requirements: data.requirements || "",
          hints: data.hint ? data.hint.split('\n') : [],
          schema: data.schema || "",
          seedData: data.seedData || "",
          seedSummary: "1 table · 5 rows",
          referenceSolution: data.referenceSolution || "",
          testCases: data.testCases && data.testCases.length > 0 ? data.testCases : [{ seedData: data.seedData || "", isHidden: false }],
          expectedColumns: [],
          expectedRows: []
        });
      } catch(e) {
        console.error("Failed to load problem:", e);
      }
    }
    fetchProblem();
  }, [selectedId]);

  const [saveState, setSaveState] = useState("All changes saved");
  const [validationState, setValidationState] = useState("Validation passed");
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState<"preview" | null>(null);

  if (!problem) {
    return <div style={{ padding: '24px' }}>Loading...</div>;
  }

  function update<K extends keyof TeacherProblem>(
    field: K,
    value: TeacherProblem[K],
  ) {
    setProblem((current) => current ? ({ ...current, [field]: value }) : null);
    setSaveState("Unsaved changes");
    setReady(false);
  }

  function saveDraft() {
    setSaveState("Draft saved");
  }

  async function validate() {
    setValidationState("Validating...");
    try {
      const tc = (problem.testCases || [{seedData: problem.seedData}])[0];
      const result = await teacherService.validateSolution({
        database: problem.database,
        schema: problem.schema,
        seedData: tc.seedData,
        referenceSolution: problem.referenceSolution
      });
      if (result.status === "Success" || result.status === "Tabular result") {
        setValidationState("Validation passed · Output updated");
        update("expectedColumns", result.table.columns);
        update("expectedRows", result.table.rows);
      } else {
        setValidationState(`Validation error: ${result.message}`);
      }
    } catch (e: any) {
      setValidationState(`Validation error: ${e.message}`);
    }
  }

  async function markReady() {
    setSaveState("Saving to server...");
    try {
        const payload = {
            number: problem.number,
            title: problem.title,
            difficulty: problem.difficulty,
            visibility: problem.visibility,
            topics: problem.topics,
            statement: problem.statement,
            requirements: problem.requirements,
            hints: problem.hints,
            database: problem.database,
            schema: problem.schema,
            testCases: problem.testCases || [{ seedData: problem.seedData, isHidden: false }],
            referenceSolution: problem.referenceSolution
        };
        
        if (selectedId === "new") {
            await teacherService.createProblem(payload);
        } else {
            await teacherService.updateProblem(selectedId, payload);
        }
        
        setSaveState("All changes saved");
        setReady(true);
        if (selectedId === "new") {
            navigate("/teacher/problems");
        }
    } catch (e) {
        setSaveState("Failed to save to server");
    }
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
          <div className="teacher-field-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px' }}>
            <TeacherField label="NUMBER">
              <input
                value={problem.number}
                onChange={(event) => update("number", event.target.value)}
              />
            </TeacherField>
            <TeacherField label="TITLE">
              <input
                value={problem.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </TeacherField>
          </div>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {["SELECT", "JOIN", "GROUP BY", "ORDER BY", "HAVING", "WHERE", "SUBQUERY", "CTE", "WINDOW FUNCTION", "NULL"].map(t => {
                const selected = problem.topics.split(/[,·]+/).map(s => s.trim()).filter(Boolean);
                const isSelected = selected.includes(t);
                return (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--surface)', padding: '6px 12px', borderRadius: '6px', border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          update("topics", [...selected, t].join(', '));
                        } else {
                          update("topics", selected.filter(x => x !== t).join(', '));
                        }
                      }}
                      style={{ margin: 0, width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: isSelected ? 500 : 400 }}>{t}</span>
                  </label>
                )
              })}
            </div>
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
              <option>SQL Server</option>
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
          <TeacherSectionTitle title="Test cases (Seed Data)" />
          {(problem.testCases || [{seedData: problem.seedData, isHidden: false}]).map((tc, index) => (
            <div className="teacher-code-section" key={index} style={{ marginBottom: '16px' }}>
              <div className="teacher-code-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span>Test Case {index + 1}</span>
                  <span>/</span>
                  <span>seed_{index + 1}.sql</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--muted)' }}>
                    <input 
                      type="checkbox" 
                      checked={tc.isHidden} 
                      onChange={(e) => {
                        const newTcs = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                        newTcs[index] = { ...tc, isHidden: e.target.checked };
                        update("testCases", newTcs);
                      }} 
                      style={{ margin: 0, width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--accent)' }}
                    />
                    Hidden test
                  </label>
                  {index > 0 && (
                    <button type="button" className="text-button" style={{ color: 'var(--error)', padding: 0 }} onClick={() => {
                        const newTcs = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                        newTcs.splice(index, 1);
                        update("testCases", newTcs);
                    }}>Delete</button>
                  )}
                </div>
              </div>
              <textarea
                className="teacher-code-editor teacher-seed-editor"
                aria-label={`Test case ${index + 1} SQL`}
                spellCheck={false}
                value={tc.seedData}
                onChange={(event) => {
                    const newTcs = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
                    newTcs[index] = { ...tc, seedData: event.target.value };
                    update("testCases", newTcs);
                }}
              />
            </div>
          ))}
          <button className="button teacher-small-button" type="button" style={{ marginBottom: '16px' }} onClick={() => {
              const newTcs = [...(problem.testCases || [{seedData: problem.seedData, isHidden: false}])];
              newTcs.push({ seedData: "", isHidden: true });
              update("testCases", newTcs);
          }}>
            Add test case
          </button>
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
          <button className="button" type="button" onClick={validate} style={{ marginTop: '16px', marginBottom: '24px' }}>
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
