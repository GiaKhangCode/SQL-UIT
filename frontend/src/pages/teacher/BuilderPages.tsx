import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  readTeacherDraft,
  saveTeacherDraft,
  teacherClasses,
  teacherProblems,
} from "../../data/teacherDemoData";
import { ClassPicker, TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";

type BuilderProblem = { id: string; points: number };
type BuilderDraft = {
  title: string;
  classIds: string[];
  format: "Group work" | "Individual";
  instructions: string;
  opens: string;
  closes: string;
  problems: BuilderProblem[];
  studentOptions: { hints: boolean; comments: boolean; leaderboard: boolean };
  published?: boolean;
};

const assignmentKey = "querylab:teacher:assignment-draft:v1";
const contestKey = "querylab:teacher:contest-draft:v1";
const assignmentSeed: BuilderDraft = {
  title: "Week 3 — JOIN practice",
  classIds: ["IS207.R11", "IS207.R12"],
  format: "Group work",
  instructions:
    "Work together on JOIN queries. Submit one solution per group for each problem.",
  opens: "2026-09-23T08:00",
  closes: "2026-09-30T23:59",
  problems: [
    { id: "p1", points: 10 },
    { id: "p11", points: 15 },
    { id: "p12", points: 15 },
  ],
  studentOptions: { hints: true, comments: true, leaderboard: false },
};
const contestSeed: BuilderDraft = {
  title: "SQL Sprint #06",
  classIds: ["IS207.R11", "IS207.R12"],
  format: "Individual",
  instructions:
    "Ranked by solved problems, then completion time. Hints and AI assistance are disabled during the contest.",
  opens: "2026-09-26T19:00",
  closes: "2026-09-26T20:30",
  problems: [
    { id: "p1", points: 10 },
    { id: "p11", points: 15 },
    { id: "p12", points: 15 },
  ],
  studentOptions: { hints: false, comments: false, leaderboard: true },
};

export function AssignmentBuilderPage() {
  return <BuilderPage contest={false} />;
}

export function ContestBuilderPage() {
  return <BuilderPage contest />;
}

function BuilderPage({ contest }: { contest: boolean }) {
  const key = contest ? contestKey : assignmentKey;
  const [draft, setDraft] = useState(() => {
    const defaults = contest
      ? contestSeed.studentOptions
      : assignmentSeed.studentOptions;
    const saved = readTeacherDraft<BuilderDraft>(key, contest ? contestSeed : assignmentSeed);
    return { ...saved, studentOptions: saved.studentOptions || defaults };
  });
  const [saveState, setSaveState] = useState("All changes saved");
  const [alertText, setAlertText] = useState("");
  const [addProblemOpen, setAddProblemOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function update<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value, published: false }));
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const scheduleValid =
    !!draft.opens && !!draft.closes && new Date(draft.opens) < new Date(draft.closes);
  const readyToPublish =
    draft.classIds.length > 0 &&
    draft.problems.length > 0 &&
    draft.problems.every((item) => item.points > 0) &&
    scheduleValid;
  const studentCount = contest ? 84 : 42;

  function saveDraft() {
    saveTeacherDraft(key, draft);
    setSaveState("All changes saved");
    setAlertText("Saved in this browser for the teacher demo.");
  }

  function publishDraft() {
    if (!readyToPublish) {
      setAlertText("Select a class, add scored problems, and check the schedule before publishing.");
      return;
    }
    const publishedDraft = { ...draft, published: true };
    setDraft(publishedDraft);
    saveTeacherDraft(key, publishedDraft);
    setSaveState("All changes saved");
    setAlertText("Published in the demo preview. No students or backend are connected.");
  }

  function addProblem(id: string) {
    if (!draft.problems.some((item) => item.id === id)) {
      update("problems", [...draft.problems, { id, points: 10 }]);
    }
    setAddProblemOpen(false);
  }

  const availableProblems = teacherProblems.filter(
    (problem) => !draft.problems.some((item) => item.id === problem.id),
  );

  return (
    <section className="teacher-page teacher-builder-page">
      <TeacherPageIntro
        title={contest ? "Contest builder" : "Assignment builder"}
        context={`${contest ? "Contests" : "Assignments"} / ${draft.title}`}
      >
        <Link
          className="teacher-builder-switch"
          to={contest ? "/teacher/assignments" : "/teacher/contests/new"}
        >
          {contest ? "Build an assignment" : "Build a contest"}
        </Link>
        <button className="button" type="button" onClick={saveDraft}>
          Save draft
        </button>
        <button className="button primary" type="button" onClick={publishDraft}>
          Publish
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-builder-layout">
        <section className="teacher-builder-main">
          <div className="teacher-builder-setup">
            <TeacherSectionTitle title={contest ? "Contest setup" : "Assignment setup"} />
            <TeacherField label="TITLE">
              <input
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </TeacherField>
            <div className="teacher-builder-row">
              <div className="teacher-field">
                <span>CLASS</span>
                <ClassPicker
                  selected={draft.classIds}
                  onChange={(classes) => update("classIds", classes)}
                />
              </div>
              <TeacherField label={contest ? "FORMAT" : "WORK MODE"}>
                <select
                  value={draft.format}
                  onChange={(event) =>
                    update("format", event.target.value as BuilderDraft["format"])
                  }
                >
                  <option>Group work</option>
                  <option>Individual</option>
                </select>
              </TeacherField>
            </div>
            <TeacherField label={contest ? "OPEN TO" : "ASSIGNED TO"}>
              <div className="teacher-readonly-field">
                {draft.classIds.length} {draft.classIds.length === 1 ? "class" : "classes"}
                {contest
                  ? ` · ${studentCount} students`
                  : ` · 9 groups / ${studentCount} students`}
              </div>
            </TeacherField>
            <TeacherField label={contest ? "RULES" : "INSTRUCTIONS"}>
              <textarea
                rows={3}
                value={draft.instructions}
                onChange={(event) => update("instructions", event.target.value)}
              />
            </TeacherField>
          </div>

          <div className="teacher-builder-problems">
            <TeacherSectionTitle title="Problems & points" />
            <div className="teacher-table-scroll">
              <table className="teacher-table teacher-problem-points-table">
                <thead>
                  <tr>
                    <th>Order / problem</th>
                    <th>Difficulty</th>
                    <th>Points</th>
                    <th><span className="sr-only">Remove problem</span></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.problems.map((item, index) => {
                    const problem = teacherProblems.find((row) => row.id === item.id)!;
                    return (
                      <tr key={item.id}>
                        <td data-label="Order / problem">
                          <span className="teacher-problem-order">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {problem.title}
                        </td>
                        <td data-label="Difficulty">{problem.difficulty}</td>
                        <td data-label="Points">
                          <input
                            aria-label={`${problem.title} points`}
                            type="number"
                            min="1"
                            value={item.points}
                            onChange={(event) =>
                              update(
                                "problems",
                                draft.problems.map((row) =>
                                  row.id === item.id
                                    ? { ...row, points: Number(event.target.value) }
                                    : row,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="teacher-remove-row"
                            type="button"
                            onClick={() =>
                              update(
                                "problems",
                                draft.problems.filter((row) => row.id !== item.id),
                              )
                            }
                            aria-label={`Remove ${problem.title}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="button teacher-small-button"
              type="button"
              onClick={() => setAddProblemOpen(true)}
            >
              Add from library
            </button>
          </div>
        </section>

        <aside className="teacher-builder-sidebar">
          <div className="teacher-schedule-section">
            <TeacherSectionTitle title="Schedule" />
            <TeacherField label={contest ? "STARTS" : "OPENS"}>
              <input
                type="datetime-local"
                value={draft.opens}
                onChange={(event) => update("opens", event.target.value)}
              />
            </TeacherField>
            <TeacherField label={contest ? "ENDS" : "DUE DATE"}>
              <input
                type="datetime-local"
                value={draft.closes}
                onChange={(event) => update("closes", event.target.value)}
              />
            </TeacherField>
            <p className="teacher-timezone">
              Timezone · Asia/Ho_Chi_Minh{contest ? " · Duration 90 min" : ""}
            </p>
          </div>
          <div className="teacher-student-options">
            <TeacherSectionTitle title="Student options" />
            {([
              ["hints", "Hints", "Students can open hints while solving"],
              ["comments", "Comments", "Students can comment on each problem"],
              ["leaderboard", "Leaderboard", "Show live ranking to students"],
            ] as const).map(([key, label, help]) => (
              <div className="teacher-option-row" key={key}>
                <span><b>{label}</b><small>{help}</small></span>
                <button
                  type="button"
                  role="switch"
                  aria-label={label}
                  aria-checked={draft.studentOptions[key]}
                  className={`teacher-toggle${draft.studentOptions[key] ? " is-on" : ""}`}
                  onClick={() => update("studentOptions", {
                    ...draft.studentOptions,
                    [key]: !draft.studentOptions[key],
                  })}
                ><span /></button>
              </div>
            ))}
          </div>
          <div className="teacher-publish-checklist">
            <TeacherSectionTitle title="Before publishing" />
            <p className="teacher-total-points">
              {draft.problems.length} problems · {totalPoints} points
            </p>
            <ul>
              <li className={draft.classIds.length ? "is-valid" : ""}>
                {contest ? "Classes selected" : "Classes and groups selected"}
              </li>
              <li className={draft.problems.length && draft.problems.every((item) => item.points > 0) ? "is-valid" : ""}>
                Every problem has a score
              </li>
              <li className={scheduleValid ? "is-valid" : ""}>
                {contest ? "Start and end time are valid" : "Schedule is valid"}
              </li>
            </ul>
            <p className="teacher-draft-visibility">
              {draft.published
                ? "Published to the local demo preview."
                : "Draft — students cannot see this yet."}
            </p>
            <button
              className="button teacher-preview-button"
              type="button"
              onClick={() => setPreviewOpen(true)}
            >
              Preview {contest ? "contest" : "assignment"}
            </button>
          </div>
          {alertText && <p className="teacher-form-message" role="status">{alertText}</p>}
          <p className="teacher-builder-save-state tiny muted">{saveState}</p>
        </aside>
      </div>

      {addProblemOpen && (
        <Dialog title="Add problem" onClose={() => setAddProblemOpen(false)}>
          <div className="teacher-add-problem-list">
            {availableProblems.length ? availableProblems.map((problem) => (
              <div key={problem.id}>
                <span>
                  <b>{problem.number} · {problem.title}</b>
                  <small>{problem.difficulty} · {problem.topics}</small>
                </span>
                <button className="button" type="button" onClick={() => addProblem(problem.id)}>
                  Add
                </button>
              </div>
            )) : <p className="tiny muted">All demo problems are already included.</p>}
          </div>
        </Dialog>
      )}
      {previewOpen && (
        <Dialog
          title={`${contest ? "Contest" : "Assignment"} preview`}
          onClose={() => setPreviewOpen(false)}
        >
          <div className="teacher-preview-dialog">
            <h3>{draft.title}</h3>
            <p>{draft.classIds.join(" · ")} · {draft.format}</p>
            <p>{draft.instructions}</p>
            <ul>
              {draft.problems.map((item) => {
                const problem = teacherProblems.find((row) => row.id === item.id)!;
                return <li key={item.id}>{problem.title} · {item.points} points</li>;
              })}
            </ul>
            <p className="tiny muted">Preview only · saved to this browser for the demo.</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
