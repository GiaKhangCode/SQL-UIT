import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog, Loading } from "../../components/ui";
import { teacherService } from "../../services/teacherService";
import { ClassPicker, TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";
import { toDateTimeLocal } from "../../utils/serverDateTime";
import { readContestMarkdown } from "../../utils/contestMarkdown";
import { ContestDetailView } from "../student/ContestDetailView";
import type { Contest } from "../../data/models";
import { ContestBannerCrop, defaultBannerCrop, type BannerCrop } from "../../components/ContestBannerCrop";

type BuilderProblem = { id: string; points: number };
type BuilderDraft = {
  title: string;
  classIds: string[];
  audienceType: "classes" | "all_students";
  shortDescription: string;
  description: string;
  rules: string;
  bannerUrl: string | null;
  bannerSourceUrl: string | null;
  bannerCrop: string | null;
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
  audienceType: "classes",
  shortDescription: "",
  description: "",
  rules: "",
  bannerUrl: null,
  bannerSourceUrl: null,
  bannerCrop: null,
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
  audienceType: "classes",
  shortDescription: "",
  description: "",
  rules: "",
  bannerUrl: null,
  bannerSourceUrl: null,
  bannerCrop: null,
  instructions: "",
  opens: "",
  closes: "",
  problems: [],
  studentOptions: { hints: false, comments: false, leaderboard: true, aiAllowed: false },
  published: false,
};

function previewDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Not set";
}

function ActivityPreview({ draft, contest, classes, problems }: {
  draft: BuilderDraft;
  contest: boolean;
  classes: { id: string; course?: string }[];
  problems: { id: string; title: string; topic?: string; difficulty?: string }[];
}) {
  const [phase, setPhase] = useState<"Upcoming" | "Live" | "Closed">("Upcoming");
  const [previewNow, setPreviewNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setPreviewNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [selectedClassId, setSelectedClassId] = useState(draft.classIds[0] || "");
  const classId = draft.classIds.includes(selectedClassId) ? selectedClassId : draft.classIds[0];
  const classLabel = classes.find((item) => item.id === classId)?.course || classId || "No class selected";
  const audience = contest && draft.audienceType === "all_students" ? "All students" : classLabel;
  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const title = draft.title.trim() || (contest ? "Untitled contest" : "Untitled assignment");

  return <div className="teacher-activity-preview">
    <div className="teacher-preview-mode-bar">
      <span>STUDENT PREVIEW · Draft content is not published</span>
      {draft.audienceType === "classes" && draft.classIds.length > 1 && <label>View as class
        <select value={classId} onChange={(event) => setSelectedClassId(event.target.value)}>
          {draft.classIds.map((id) => <option value={id} key={id}>{classes.find((item) => item.id === id)?.course || id}</option>)}
        </select>
      </label>}
    </div>
    {contest ? <>
      <div className="teacher-preview-phase-tabs" role="group" aria-label="Preview contest state">
        {(["Upcoming", "Live", "Closed"] as const).map((item) => <button type="button" key={item} className={phase === item ? "is-active" : ""} aria-pressed={phase === item} onClick={() => setPhase(item)}>{item}</button>)}
      </div>
      <ContestDetailView preview phase={phase} now={previewNow} contest={{
        id: "preview", title, status: phase, scope: audience, audienceType: draft.audienceType,
        shortDescription: draft.shortDescription, description: draft.description, rules: draft.rules,
        bannerUrl: draft.bannerUrl, opensAt: draft.opens ? new Date(draft.opens).toISOString() : "", closesAt: draft.closes ? new Date(draft.closes).toISOString() : "",
        date: draft.opens ? draft.opens.slice(0, 10) : "Not set",
        time: draft.opens ? draft.opens.slice(11, 16) : "",
        endDate: draft.closes ? draft.closes.slice(0, 10) : "Not set",
        endTime: draft.closes ? draft.closes.slice(11, 16) : "",
        problemCount: draft.problems.length, problemIds: draft.problems.map((item) => item.id),
        problemDetails: draft.problems.map((item) => { const problem = problems.find((row) => row.id === item.id); return {
          id: item.id, title: problem?.title || item.id, difficulty: problem?.difficulty || "SQL problem",
          topic: problem?.topic || "SQL", points: item.points,
        }; }),
        totalPoints, score: 0, rank: null, leaderboardEnabled: draft.studentOptions.leaderboard,
        aiAllowed: draft.studentOptions.aiAllowed, leaderboard: [], submitters: 0,
      } satisfies Contest} />
    </> : <>
      <header className="assignment-work-heading"><h1>{title}</h1><p>{audience}</p></header>
      <dl className="assignment-summary">
        <div><dt>DUE DATE</dt><dd>{previewDate(draft.closes)}</dd></div>
        <div><dt>PROBLEMS</dt><dd>{draft.problems.length} SQL problem{draft.problems.length === 1 ? "" : "s"}</dd></div>
        <div><dt>POINTS</dt><dd>{totalPoints}</dd></div>
        <div><dt>STATUS</dt><dd>Not started</dd></div>
      </dl>
      <section className="assignment-instructions"><h2>Instructions</h2><p>{draft.instructions || "No instructions yet."}</p></section>
      <section className="assignment-problems-card"><div className="section-heading"><h2>Problems</h2><small className="muted">{draft.problems.length} problem{draft.problems.length === 1 ? "" : "s"}</small></div>
        {draft.problems.map((item, index) => {
          const problem = problems.find((row) => row.id === item.id);
          return <div className="assignment-problem-row" key={item.id}><span className="assignment-problem-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{problem?.title || item.id}</h3><p>{problem?.topic || "SQL"} · {problem?.difficulty || "Problem"}</p></div><span className="assignment-problem-status">{item.points} points</span></div>;
        })}
        {!draft.problems.length && <p className="muted">No problems selected yet.</p>}
      </section>
    </>}
  </div>;
}

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
  const [descriptionMode, setDescriptionMode] = useState<"write" | "import">("write");
  const [importedFileName, setImportedFileName] = useState("");
  const [eligibleStudents, setEligibleStudents] = useState<number | null>(null);
  const bannerFileInput = useRef<HTMLInputElement>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropInitial, setCropInitial] = useState<BannerCrop>(defaultBannerCrop);

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
          audienceType: data.audienceType || "classes",
          shortDescription: data.shortDescription || "",
          description: data.description || "",
          rules: data.rules || (contest ? data.instructions || "" : ""),
          bannerUrl: contest ? data.bannerUrl || null : null,
          bannerSourceUrl: contest ? data.bannerSourceUrl || null : null,
          bannerCrop: contest ? data.bannerCrop || null : null,
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

  const audienceType = draft?.audienceType;
  const selectedIds = draft?.classIds.join("|") || "";
  useEffect(() => {
    if (!audienceType || (audienceType === "classes" && !selectedIds)) {
      setEligibleStudents(0);
      return;
    }
    let active = true;
    setEligibleStudents(null);
    teacherService.getAudienceCount(audienceType, selectedIds ? selectedIds.split("|") : [])
      .then((result) => { if (active) setEligibleStudents(result.eligibleStudents); })
      .catch(() => { if (active) setEligibleStudents(null); });
    return () => { active = false; };
  }, [audienceType, selectedIds]);

  if (!draft) {
    return <div className="teacher-page">{draftError ? <div className="empty-state" role="alert">{draftError}</div> : <Loading label="Loading builder…" />}</div>;
  }

  function update<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) {
    setDraft((current) => current ? ({ ...current, [field]: value }) : null);
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  async function importMarkdown(file?: File) {
    if (!file) return;
    try {
      update("description", await readContestMarkdown(file));
      setImportedFileName(file.name);
    } catch (error) {
      setAlertText(error instanceof Error ? error.message : "Could not read Markdown file.");
    }
  }

  function selectAudience(value: BuilderDraft["audienceType"]) {
    setDraft((current) => current ? { ...current, audienceType: value,
      classIds: value === "all_students" ? [] : current.classIds } : null);
    setSaveState("Unsaved changes");
    setAlertText("");
  }

  function closeCrop() {
    if (cropSource?.startsWith("blob:")) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  function chooseBanner(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAlertText("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAlertText("Choose an image smaller than 12 MB.");
      return;
    }
    closeCrop();
    setAlertText("");
    setCropInitial(defaultBannerCrop);
    setCropSource(URL.createObjectURL(file));
  }

  function adjustBanner() {
    if (!draft?.bannerSourceUrl) return;
    try {
      const saved = JSON.parse(draft.bannerCrop || "null") as BannerCrop | null;
      setCropInitial(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.zoom) ? saved : defaultBannerCrop);
    } catch {
      setCropInitial(defaultBannerCrop);
    }
    setCropSource(draft.bannerSourceUrl);
  }

  async function applyBanner(banner: Blob, source: Blob, crop: BannerCrop) {
    const urls = await teacherService.uploadContestBanner(banner, source);
    setDraft((current) => current ? { ...current, ...urls, bannerCrop: JSON.stringify(crop) } : null);
    setSaveState("Unsaved changes");
    setAlertText("");
    closeCrop();
  }

  const totalPoints = draft.problems.reduce((sum, item) => sum + item.points, 0);
  const scheduleValid =
    !!draft.opens && !!draft.closes && new Date(draft.opens) < new Date(draft.closes);
  const durationMinutes = scheduleValid ? Math.round((new Date(draft.closes).getTime() - new Date(draft.opens).getTime()) / 60000) : 0;
  const readyToPublish =
    !!draft.title.trim() &&
    (!contest || draft.audienceType === "all_students" || draft.classIds.length > 0) &&
    (contest || draft.classIds.length > 0) &&
    (!contest || (!!draft.shortDescription.trim() && !!draft.description.trim() && !!draft.rules.trim())) &&
    draft.problems.length > 0 &&
    draft.problems.every((item) => item.points > 0) &&
    scheduleValid;

  async function saveToServer(isPublished: boolean) {
    if (saveBusy) return;
    if (!draft || !draft.title.trim() || !scheduleValid) {
      setAlertText("Add a title and valid start and end times before saving.");
      return;
    }
    if (isPublished && !readyToPublish) {
      setAlertText(contest ? "Complete the audience, descriptions, rules, problems, and schedule before publishing." : "Select a class, add scored problems, and check the schedule before publishing.");
      return;
    }
    
    setSaveBusy(true);
    setSaveState("Saving to server...");
    try {
      const payload = {
        title: draft!.title,
        isContest: contest,
        classIds: draft!.classIds,
        audienceType: contest ? draft!.audienceType : "classes",
        shortDescription: contest ? draft!.shortDescription.trim() : "",
        description: contest ? draft!.description : "",
        rules: contest ? draft!.rules : "",
        ...(contest ? { bannerUrl: draft!.bannerUrl, bannerSourceUrl: draft!.bannerSourceUrl, bannerCrop: draft!.bannerCrop } : {}),
        instructions: contest ? "" : draft!.instructions,
        opens: draft!.opens ? new Date(draft!.opens).toISOString() : null,
        closes: draft!.closes ? new Date(draft!.closes).toISOString() : null,
        problems: draft!.problems,
        studentOptions: contest
          ? { leaderboard: draft!.studentOptions.leaderboard, aiAllowed: draft!.studentOptions.aiAllowed }
          : { hints: draft!.studentOptions.hints, comments: draft!.studentOptions.comments, aiAllowed: draft!.studentOptions.aiAllowed },
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
        <button className="button" type="button" onClick={() => setPreviewOpen(true)}>
          Preview {contest ? "contest" : "assignment"}
        </button>
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
            {contest && <fieldset className="teacher-field teacher-audience-field">
              <legend>AUDIENCE</legend>
              <div className="teacher-audience-options">
                <label><input type="radio" name="contest-audience" checked={draft.audienceType === "classes"} onChange={() => selectAudience("classes")} /> Selected classes</label>
                <label><input type="radio" name="contest-audience" checked={draft.audienceType === "all_students"} onChange={() => selectAudience("all_students")} /> All students</label>
              </div>
            </fieldset>}
            {(!contest || draft.audienceType === "classes") && <div className="teacher-field">
              <span>CLASSES</span>
              <ClassPicker
                selected={draft.classIds}
                onChange={(classes) => update("classIds", classes)}
                classes={availableClasses}
                loading={classesLoading}
                error={classesError}
              />
            </div>}
            <TeacherField label={contest ? "OPEN TO" : "ASSIGNED TO"}>
              <div className="teacher-readonly-field">
                {contest && draft.audienceType === "all_students" ? "All students" : `${draft.classIds.length} ${draft.classIds.length === 1 ? "class" : "classes"}`}
                {eligibleStudents !== null ? ` · ${eligibleStudents} eligible student${eligibleStudents === 1 ? "" : "s"}` : " · student count unavailable"}
              </div>
            </TeacherField>
            {contest && <>
              <TeacherField label="SHORT DESCRIPTION">
                <input value={draft.shortDescription} maxLength={180} onChange={(event) => update("shortDescription", event.target.value)} placeholder="One-line contest summary" />
              </TeacherField>
              <div className="teacher-field teacher-banner-field">
                <span>CONTEST BANNER</span>
                <input ref={bannerFileInput} className="teacher-banner-file-input" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => { chooseBanner(event.target.files?.[0]); event.target.value = ""; }} />
                <div className={`teacher-banner-preview${draft.bannerUrl ? " has-image" : ""}`}
                  style={draft.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(14, 14, 51, .82), rgba(14, 14, 51, .48)), url("${draft.bannerUrl}")` } : undefined}>
                  <span>{draft.bannerUrl ? "Current contest banner" : "Default contest banner"}</span>
                </div>
                <div className="teacher-banner-actions">
                  {draft.bannerUrl && <button className="button" type="button" onClick={adjustBanner}>Adjust crop</button>}
                  <button className="button" type="button" onClick={() => bannerFileInput.current?.click()}>{draft.bannerUrl ? "Replace image" : "Upload banner"}</button>
                  {draft.bannerUrl && <button className="button" type="button" onClick={() => {
                    setDraft((current) => current ? { ...current, bannerUrl: null, bannerSourceUrl: null, bannerCrop: null } : null);
                    setSaveState("Unsaved changes");
                  }}>Remove image</button>}
                </div>
                <small className="muted">JPEG, PNG, or WebP · up to 12 MB. Crop to a 3:1 banner before applying.</small>
              </div>
              <div className="teacher-field">
                <span>DESCRIPTION</span>
                <div className="teacher-description-modes" role="group" aria-label="Description input mode">
                  <button type="button" className={descriptionMode === "write" ? "is-active" : ""} aria-pressed={descriptionMode === "write"} onClick={() => setDescriptionMode("write")}>Write manually</button>
                  <button type="button" className={descriptionMode === "import" ? "is-active" : ""} aria-pressed={descriptionMode === "import"} onClick={() => setDescriptionMode("import")}>Import Markdown</button>
                </div>
                {descriptionMode === "import" && <label className="teacher-markdown-import">Choose .md file
                  <input type="file" accept=".md,text/markdown" onChange={(event) => { void importMarkdown(event.target.files?.[0]); event.target.value = ""; }} />
                </label>}
                {descriptionMode === "write" ? <>
                  <textarea rows={7} value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Introduce the contest. Markdown is supported." />
                  <small className="muted">Markdown text is saved as the contest description.</small>
                </> : <small className="muted">{importedFileName ? `${importedFileName} loaded. Switch to Write manually to edit the Markdown.` : draft.description ? "A description is already in this draft. Choose a .md file to replace it, or switch to Write manually to edit it." : "Choose a .md file to fill the description. Switch to Write manually to edit it."}</small>}
              </div>
            </>}
            <TeacherField label={contest ? "RULES" : "INSTRUCTIONS"}>
              <textarea
                rows={contest ? 5 : 3}
                value={contest ? draft.rules : draft.instructions}
                onChange={(event) => update(contest ? "rules" : "instructions", event.target.value)}
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
            <TeacherSectionTitle title={contest ? "Contest settings" : "Student options"} />
            {(contest ? ([
              ["leaderboard", "Leaderboard", "Show contest ranking to students"],
              ["aiAllowed", "AI assistance", draft.studentOptions.aiAllowed ? "Students can use AI assistance" : "AI assistance is not allowed"],
            ] as const) : ([
              ["hints", "Hints", "Students can open hints while solving"],
              ["comments", "Comments", "Students can comment on each problem"],
              ["aiAllowed", "AI assistance", draft.studentOptions.aiAllowed ? "Students can use AI assistance while solving" : "AI assistance is not allowed"],
            ] as const)).map(([key, label, help]) => (
              <div className="teacher-option-row" key={key}>
                <span><b>{label}</b><small>{help}</small></span>
                <button
                  type="button"
                  role="switch"
                  aria-label={key === "aiAllowed" ? "Allow AI assistance" : label}
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
              {draft.problems.length} problem{draft.problems.length === 1 ? "" : "s"} · {totalPoints} points
            </p>
            <ul>
              <li className={(contest && draft.audienceType === "all_students") || draft.classIds.length ? "is-valid" : ""}>
                {contest ? "Audience selected" : "Classes selected"}
              </li>
              {contest && <li className={draft.shortDescription.trim() && draft.description.trim() && draft.rules.trim() ? "is-valid" : ""}>Description and rules complete</li>}
              <li className={draft.problems.length && draft.problems.every((item) => item.points > 0) ? "is-valid" : ""}>
                Every problem has a score
              </li>
              <li className={scheduleValid ? "is-valid" : ""}>
                {contest ? "Start and end time are valid" : "Schedule is valid"}
              </li>
            </ul>
            <p className="teacher-draft-visibility">
              {draft.published
                ? (contest ? "Published — visible to eligible students." : "Published — available to assigned students.")
                : "Draft — students cannot see this yet."}
            </p>
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
          className="teacher-activity-preview-dialog"
        >
          <ActivityPreview draft={draft} contest={contest} classes={availableClasses} problems={allProblems} />
        </Dialog>
      )}
      {contest && cropSource && <ContestBannerCrop sourceUrl={cropSource} initialCrop={cropInitial} onClose={closeCrop} onApply={applyBanner} />}
    </section>
  );
}
