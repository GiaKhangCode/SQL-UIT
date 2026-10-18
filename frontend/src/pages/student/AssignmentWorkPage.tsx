import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";

const ASSIGNMENT_PROBLEM_PAGE_SIZE = 10;


export function AssignmentWorkPage() {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  const { assignmentId } = useParams();
  const [params] = useSearchParams();
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [problemPage, setProblemPage] = useState(1);
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  if (loading) return <section className="page assignment-work-page"><Loading label={tr("Loading assignment…")} /></section>;
  if (error || !data) return <section className="page assignment-work-page"><ErrorState title={tr("Assignment unavailable")} message={tr(error) || tr("Could not load assignment.")} onRetry={() => window.location.reload()} /></section>;
  const work = data.assignments.find((a) => a.id === assignmentId);
  if (!work) return <Empty title={tr("Assignment unavailable")}><Link to="/assignments"><TranslatedText>{tr("Back to classes")}</TranslatedText></Link></Empty>;
  const classInfo = data.classes.find((c) => c.id === params.get("classId") && work.classIds.includes(c.id))
    || data.classes.find((c) => work.classIds.includes(c.id));
  if (!classInfo) return <Empty title={tr("Class unavailable")}><Link to="/assignments"><TranslatedText>{tr("Back to assignments")}</TranslatedText></Link></Empty>;
  const number = data.assignments.filter((a) => a.classIds.includes(classInfo.id)).findIndex((a) => a.id === work.id) + 1;
  const items = work.problemIds.map((id) => data.problems.find((p) => p.id === id)).filter((p) => p !== undefined);
  const solved = work.problemIds.filter((id) => work.problemProgress[id] === "Solved").length;
  const problemPageCount = Math.max(1, Math.ceil(items.length / ASSIGNMENT_PROBLEM_PAGE_SIZE));
  const currentProblemPage = Math.min(problemPage, problemPageCount);
  const firstProblemIndex = (currentProblemPage - 1) * ASSIGNMENT_PROBLEM_PAGE_SIZE;
  const pageItems = items.slice(firstProblemIndex, firstProblemIndex + ASSIGNMENT_PROBLEM_PAGE_SIZE);
  const pageSelectedProblem = pageItems.find((problem) => problem.id === selectedProblemId) || pageItems[0];
  const due = work.date ? new Date(work.date + "T00:00:00Z").toLocaleDateString(uiLocale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No due date";
  return <section className="page assignment-work-page compact-assignment-work">
    <Link className="detail-back assignment-work-back" to={"/assignments/classes/" + classInfo.id}>← {classInfo.name} <TranslatedText>{tr("/ Assignments")}</TranslatedText></Link>
    <h1 className="sr-only"><TranslatedText>{tr("Assignment")}</TranslatedText> {number}: {work.title}</h1>
    <div className="assignment-work-content">
    <header className="assignment-work-heading">
      <div><h1><TranslatedText>{tr("Assignment")}</TranslatedText> {number}: {work.title}</h1><p>AS-{String(number).padStart(2, "0")} · {classInfo.name}</p></div>
      <dl className="assignment-summary">
      <div><dt><TranslatedText>{tr("DUE DATE")}</TranslatedText></dt><dd><TranslatedText>{tr(due)}</TranslatedText>{work.time ? ` · ${work.time}` : ""}</dd></div>
      <div><dt><TranslatedText>{tr("PROBLEMS")}</TranslatedText></dt><dd>{items.length} <TranslatedText>{tr("SQL problem")}</TranslatedText><TranslatedText>{items.length === 1 ? "" : tr("s")}</TranslatedText></dd></div>
      <div><dt><TranslatedText>{tr("PROGRESS")}</TranslatedText></dt><dd className="assignment-summary-progress">{solved} / {items.length} <TranslatedText>{tr("solved")}</TranslatedText></dd></div>
      <div><dt><TranslatedText>{tr("STATUS")}</TranslatedText></dt><dd><Status value={work.status} /></dd></div>
      </dl>
    </header>
    <div className="assignment-work-columns">
    <div className="assignment-work-main">
    {work.instructions && <section className="assignment-instructions"><h2><TranslatedText>{tr("Instructions")}</TranslatedText></h2><ProblemMarkdown className="contest-markdown">{work.instructions}</ProblemMarkdown></section>}
    <section className="assignment-problems-card">
      <div className="section-heading"><h2><TranslatedText>{tr("Problems")}</TranslatedText></h2>
        <div className="assignment-problem-pagination">
          <small className="muted"><TranslatedText>{items.length ? tr("Showing {value0}–{value1} of {value2}", { value0: firstProblemIndex + 1, value1: Math.min(firstProblemIndex + ASSIGNMENT_PROBLEM_PAGE_SIZE, items.length), value2: items.length }) : tr("0 problems")}</TranslatedText> · {solved} <TranslatedText>{tr("solved")}</TranslatedText></small>
          {problemPageCount > 1 && <nav aria-label={tr("Assignment problem pages")}>
            <button type="button" className="button" disabled={currentProblemPage === 1} onClick={() => setProblemPage(currentProblemPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
            <span><TranslatedText>{tr("Page")}</TranslatedText> {currentProblemPage} <TranslatedText>{tr("of")}</TranslatedText> {problemPageCount}</span>
            <button type="button" className="button" disabled={currentProblemPage === problemPageCount} onClick={() => setProblemPage(currentProblemPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
          </nav>}
        </div>
      </div>
      {pageItems.map((p, i) => {
        const progress = work.problemProgress[p.id] || "Not started";
        return <button type="button" className={`assignment-problem-row assignment-problem-select${pageSelectedProblem?.id === p.id ? " selected" : ""}`} key={p.id} aria-pressed={pageSelectedProblem?.id === p.id} onClick={() => setSelectedProblemId(p.id)}>
          <span className="assignment-problem-number">{String(firstProblemIndex + i + 1).padStart(2, "0")}</span>
          <div><h3>{p.title}</h3><p>{p.topic} · <TranslatedText>{tr(p.difficulty)}</TranslatedText></p></div>
          <span className={"assignment-problem-status " + (progress === "Solved" ? "solved" : progress === "In progress" ? "in-progress" : "")}><TranslatedText>{tr(progress)}</TranslatedText></span>
        </button>;
      })}
      {!items.length && <Empty title={tr("No problems yet")} />}
    </section>
    </div>
    <aside className="assignment-selected-details"><AssignmentProblemDetails key={`${work.id}:${pageSelectedProblem?.id}`} problemId={pageSelectedProblem?.id || ""} assignmentId={work.id} problem={pageSelectedProblem} progress={pageSelectedProblem ? work.problemProgress[pageSelectedProblem.id] || "Not started" : "Not started"} /></aside>
    </div>
    </div>
  </section>;
}

function AssignmentProblemDetails({ problemId, assignmentId, problem, progress }: { problemId: string; assignmentId: string; problem?: { id: string; title: string; topic: string; difficulty: string }; progress: string }) {
  const { t: tr } = useLanguage("student");
  const { data, loading, error } = useLoad(() => studentApi.getProblem(problemId, assignmentId), [problemId, assignmentId]);
  const to = `/workspace/${encodeURIComponent(problemId)}?source=Assignments&context=${encodeURIComponent(assignmentId)}`;
  if (!problem) return <div className="assignment-selected-empty"><h2><TranslatedText>{tr("Problem details")}</TranslatedText></h2><p className="tiny muted"><TranslatedText>{tr("Select a problem to view its details.")}</TranslatedText></p></div>;
  return <>
    <h2><TranslatedText>{tr("Problem details")}</TranslatedText></h2>
    <h3>{problem.title}</h3>
    <div className="assignment-selected-meta"><span className={`assignment-problem-status ${progress === "Solved" ? "solved" : progress === "In progress" ? "in-progress" : ""}`}><TranslatedText>{tr(progress)}</TranslatedText></span><span><TranslatedText>{tr(problem.difficulty)}</TranslatedText></span></div>
    <Link className="button primary" to={to}><TranslatedText>{progress === "Solved" ? tr("Review") : progress === "In progress" ? tr("Continue solving") : tr("Start solving")}</TranslatedText> →</Link>
    <dl className="assignment-selected-facts"><div><dt><TranslatedText>{tr("Topic")}</TranslatedText></dt><dd>{problem.topic}</dd></div></dl>
    {loading ? <p className="tiny muted"><TranslatedText>{tr("Loading problem details…")}</TranslatedText></p> : error ? <p className="tiny muted"><TranslatedText>{tr("Problem details could not be loaded.")}</TranslatedText></p> : data && <>
      <section><h4><TranslatedText>{tr("Problem")}</TranslatedText></h4><ProblemMarkdown className="contest-markdown">{data.description || tr("No description available.")}</ProblemMarkdown></section>
      {data.requirements && <section><h4><TranslatedText>{tr("Requirements")}</TranslatedText></h4><ProblemMarkdown className="contest-markdown">{data.requirements}</ProblemMarkdown></section>}
    </>}
  </>;
}
