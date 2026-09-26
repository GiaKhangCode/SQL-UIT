import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog, Loading } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { ClassPicker, TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";
import { toDateTimeLocal } from "../../utils/serverDateTime";

type BuilderProblem = { id: string; points: number };
type BuilderDraft = {
  title: string;
  classIds: string[];
  format: "Group work" | "Individual";
  instructions: string;
  opens: string;
  closes: string;
  problems: BuilderProblem[];
  studentOptions: { hints: boolean; comments: boolean; leaderboard: boolean; aiAllowed: boolean };
  published: boolean;
};

const assignmentSeed: BuilderDraft = {
  title: "",
  classIds: [],
  format: "Individual",
  instructions: "",
  opens: "",
  closes: "",
  problems: [],
  studentOptions: { hints: true, comments: true, leaderboard: false, aiAllowed: true },
  published: false,
};
const contestSeed: BuilderDraft = {
  title: "",
  classIds: [],
  format: "Individual",
  instructions: "Hints and AI assistance are disabled during the contest.",
  opens: "",
  closes: "",
  problems: [],
  studentOptions: { hints: false, comments: false, leaderboard: true, aiAllowed: false },
  published: false,
};

export function AssignmentBuilderPage() {
  return <BuilderPage contest={false} />;
}

export function ContestBuilderPage() {
  return <BuilderPage contest />;
}

function BuilderPage({ contest }: { contest: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [allProblems, setAllProblems] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState("");
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsError, setProblemsError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [alertText, setAlertText] = useState("");
  const [addProblemOpen, setAddProblemOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    async function fetchClasses() {
      try {
        const data = await teacherService.getClasses();
        const activeClasses = data.filter((c: any) => c.status === "Active");
        setAvailableClasses(activeClasses);
      } catch (e) {
        setClassesError(e instanceof Error ? e.message : "Could not load classes.");
      } finally {
        setClassesLoading(false);
      }
    }
    fetchClasses();

    async function fetchProblems() {
      try {
        const data = await teacherService.getAllProblems();
        setAllProblems(data);
      } catch (e) {
        setProblemsError(e instanceof Error ? e.message : "Could not load problems.");
      } finally {
        setProblemsLoading(false);
      }
    }
    fetchProblems();

    if (isNew) {
      setDraft(contest ? contestSeed : assignmentSeed);
      return;
    }
    
    async function fetchAssignment() {
      try {
        const data = await teacherService.getAssignment(id!);
        setDraft({
          title: data.title,
          classIds: data.classIds || [],
          format: data.format as "Group work" | "Individual",
          instructions: data.instructions || "",
          opens: toDateTimeLocal(data.opens),
          closes: toDateTimeLocal(data.closes),
          problems: data.problemList || [],
          studentOptions: data.studentOptions || (contest ? contestSeed.studentOptions : assignmentSeed.studentOptions),
          published: data.published
        });
      } catch (e) {
        setDraftError(e instanceof Error ? e.message : "Could not load this activity.");
      }
    }
    fetchAssignment();
  }, [id, isNew, contest]);

  if (!draft) {
    return <div className="teacher-page">{draftError ? <div className="empty-state" role="alert">{draftError}</div> : <Loading label="Loading builder…" />}</div>;
  }

  function update<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) {
    setDraft((current) => current ? ({ ...current, [field]: value }) : null);
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  function setAiAllowed(allowed: boolean) {
    setDraft((current) => {
      if (!current) return current;
      const disabledSentence = "Hints and AI assistance are disabled during the contest.";
      const allowedSentence = "Hints are disabled during the contest. AI assistance is allowed.";
      const instructions = contest
        ? allowed
          ? current.instructions.replace(disabledSentence, allowedSentence)
          : current.instructions.replace(allowedSentence, disabledSentence)
        : current.instructions;
      return {
        ...current,
        instructions,
        studentOptions: { ...current.studentOptions, aiAllowed: allowed },
      };
    });
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const scheduleValid =
    !!draft.opens && !!draft.closes && new Date(draft.opens) < new Date(draft.closes);
  const durationMinutes = scheduleValid ? Math.round((new Date(draft.closes).getTime() - new Date(draft.opens).getTime()) / 60000) : 0;
  const readyToPublish =
    !!draft.title.trim() &&
    draft.classIds.length > 0 &&
    draft.problems.length > 0 &&
    draft.problems.every((item) => item.points > 0) &&
    scheduleValid;

  const selectedClassesData = availableClasses.filter(c => draft.classIds.includes(c.id));
  const studentCount = selectedClassesData.reduce((sum, c) => sum + (c.students || 0), 0);
  async function saveToServer(isPublished: boolean) {
    if (saveBusy) return;
    if (!draft || !draft.title.trim() || !scheduleValid) {
      setAlertText("Add a title and valid start and end times before saving.");
      return;
    }
    if (isPublished && !readyToPublish) {
      setAlertText("Select a class, add scored problems, and check the schedule before publishing.");
      return;
    }
    
    setSaveBusy(true);
    setSaveState("Saving to server...");
    try {
      const payload = {
        title: draft!.title,
        isContest: contest,
        classIds: draft!.classIds,
        format: draft!.format,
        instructions: draft!.instructions,
        opens: draft!.opens ? new Date(draft!.opens).toISOString() : null,
        closes: draft!.closes ? new Date(draft!.closes).toISOString() : null,
        problems: draft!.problems,
        studentOptions: draft!.studentOptions,
        published: isPublished
      };
      
      if (isNew) {
        await teacherService.createAssignment(payload);
      } else {
        await teacherService.updateAssignment(id!, payload);
      }
      
      setDraft({ ...draft!, published: isPublished });
      setSaveState("All changes saved");
      setAlertText(isPublished ? "Successfully published." : "Draft saved successfully.");
      
      if (isNew) {
        navigate(contest ? "/teacher/contests" : "/teacher/assignments");
      }
    } catch (e) {
      setSaveState(e instanceof Error ? e.message : "Could not save to server.");
    } finally {
      setSaveBusy(false);
    }
  }

  function saveDraft() {
    saveToServer(false);
  }

  function publishDraft() {
    saveToServer(true);
  }

  function addProblem(problemId: string) {
    if (!draft!.problems.some((item) => item.id === problemId)) {
      update("problems", [...draft!.problems, { id: problemId, points: 10 }]);
    }
    setAddProblemOpen(false);
  }

  const availableProblems = allProblems.filter(
    (problem) => !draft!.problems.some((item) => item.id === problem.id),
  );

  return (
    <section className="teacher-page teacher-builder-page">
      <TeacherPageIntro
        title={contest ? "Contest builder" : "Assignment builder"}
        context={`${contest ? "Contests" : "Assignments"} / ${draft.title || "New activity"}`}
      >
        <button className="button" type="button" onClick={saveDraft} disabled={saveBusy || !draft.title.trim() || !scheduleValid}>
          {saveBusy ? "Saving…" : "Save draft"}
        </button>
        <button className="button primary" type="button" onClick={publishDraft} disabled={saveBusy || !readyToPublish}>
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
                  classes={availableClasses}
                  loading={classesLoading}
                  error={classesError}
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
                {classesLoading ? " · loading student count" : classesError ? " · student count unavailable" : ` · ${studentCount} student${studentCount === 1 ? "" : "s"}`}
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
            {problemsError && <p className="teacher-state-failed" role="alert">{problemsError}</p>}
            <div className="teacher-table-scroll">
              <table className="teacher-table teacher-problem-points-table">
                <thead>
                  <tr>
                    <th>Order / problem</th>
                    <th>Difficulty</th>
                    <th>Points / order</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.problems.map((item, index) => {
                    const problem = allProblems.find((row) => row.id === item.id);
                    if (!problem) return null;
                    return (
                      <tr key={item.id}>
                        <td data-label="Order / problem">
                          <span className="teacher-problem-order">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {problem.title}
                        </td>
                        <td data-label="Difficulty">{problem.difficulty}</td>
                        <td data-label="Points / order" className="builder-points-actions"><input type="number" min="1" aria-label={`Points for ${problem.title}`} value={item.points} onChange={event => update("problems", draft.problems.map(row => row.id === item.id ? { ...row, points: Number(event.target.value) } : row))} /><button type="button" aria-label={`Move ${problem.title} up`} disabled={index === 0} onClick={() => { const next = [...draft.problems]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update("problems", next); }}>↑</button><button type="button" aria-label={`Move ${problem.title} down`} disabled={index === draft.problems.length - 1} onClick={() => { const next = [...draft.problems]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; update("problems", next); }}>↓</button><button type="button" aria-label={`Remove ${problem.title}`} onClick={() => update("problems", draft.problems.filter(row => row.id !== item.id))}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="button teacher-small-button"
              type="button"
              disabled={problemsLoading || !!problemsError}
              onClick={() => setAddProblemOpen(true)}
            >
              {problemsLoading ? "Loading library…" : "Add from library"}
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
              Timezone · Asia/Ho_Chi_Minh{contest && durationMinutes > 0 ? ` · Duration ${durationMinutes} min` : ""}
            </p>
          </div>
          <div className="teacher-student-options">
            <TeacherSectionTitle title="Student options" />
            {([
              ["hints", "Hints", "Students can open hints while solving"],
              ["comments", "Comments", "Students can comment on each problem"],
              ["leaderboard", "Leaderboard", "Show live ranking to students"],
              ["aiAllowed", "AI assistance", draft.studentOptions.aiAllowed ? "Students can use AI assistance while solving" : "AI assistance is not allowed"],
            ] as const).map(([key, label, help]) => (
              <div className="teacher-option-row" key={key}>
                <span><b>{label}</b><small>{help}</small></span>
                <button
                  type="button"
                  role="switch"
                  aria-label={key === "aiAllowed" ? "Allow AI assistance" : label}
                  aria-checked={draft.studentOptions[key]}
                  className={`teacher-toggle${draft.studentOptions[key] ? " is-on" : ""}`}
                  onClick={() => key === "aiAllowed"
                    ? setAiAllowed(!draft.studentOptions.aiAllowed)
                    : update("studentOptions", {
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
              {draft.problems.length} problem{draft.problems.length === 1 ? "" : "s"} · {totalPoints} points
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
                ? "Published — available to assigned students."
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
            )) : <p className="tiny muted">All available problems are already included.</p>}
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
                const problem = allProblems.find((row) => row.id === item.id);
                if (!problem) return null;
                return <li key={item.id}>{problem.title} · {item.points} points</li>;
              })}
            </ul>
            <p className="tiny muted">Preview of the current form. Save to apply changes.</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
