import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";

const ASSIGNMENT_PROBLEM_PAGE_SIZE = 10;


export function AssignmentWorkPage() {
  const { assignmentId } = useParams();
  const [params] = useSearchParams();
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [problemPage, setProblemPage] = useState(1);
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  if (loading) return <section className="page assignment-work-page"><Loading label="Loading assignment…" /></section>;
  if (error || !data) return <section className="page assignment-work-page"><ErrorState title="Assignment unavailable" message={error || "Could not load assignment."} onRetry={() => window.location.reload()} /></section>;
  const work = data.assignments.find((a) => a.id === assignmentId);
  if (!work) return <Empty title="Assignment unavailable"><Link to="/assignments">Back to classes</Link></Empty>;
  const classInfo = data.classes.find((c) => c.id === params.get("classId") && work.classIds.includes(c.id))
    || data.classes.find((c) => work.classIds.includes(c.id));
  if (!classInfo) return <Empty title="Class unavailable"><Link to="/assignments">Back to assignments</Link></Empty>;
  const number = data.assignments.filter((a) => a.classIds.includes(classInfo.id)).findIndex((a) => a.id === work.id) + 1;
  const items = work.problemIds.map((id) => data.problems.find((p) => p.id === id)).filter((p) => p !== undefined);
  const solved = work.problemIds.filter((id) => work.problemProgress[id] === "Solved").length;
  const problemPageCount = Math.max(1, Math.ceil(items.length / ASSIGNMENT_PROBLEM_PAGE_SIZE));
  const currentProblemPage = Math.min(problemPage, problemPageCount);
  const firstProblemIndex = (currentProblemPage - 1) * ASSIGNMENT_PROBLEM_PAGE_SIZE;
  const pageItems = items.slice(firstProblemIndex, firstProblemIndex + ASSIGNMENT_PROBLEM_PAGE_SIZE);
  const pageSelectedProblem = pageItems.find((problem) => problem.id === selectedProblemId) || pageItems[0];
  const due = work.date ? new Date(work.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No due date";
  return <section className="page assignment-work-page compact-assignment-work">
    <Link className="detail-back assignment-work-back" to={"/assignments/classes/" + classInfo.id}>← {classInfo.name} / Assignments</Link>
    <h1 className="sr-only">Assignment {number}: {work.title}</h1>
    <div className="assignment-work-content">
    <header className="assignment-work-heading">
      <div><h1>Assignment {number}: {work.title}</h1><p>AS-{String(number).padStart(2, "0")} · {classInfo.name}</p></div>
      <dl className="assignment-summary">
      <div><dt>DUE DATE</dt><dd>{due}{work.time ? ` · ${work.time}` : ""}</dd></div>
      <div><dt>PROBLEMS</dt><dd>{items.length} SQL problem{items.length === 1 ? "" : "s"}</dd></div>
      <div><dt>PROGRESS</dt><dd className="assignment-summary-progress">{solved} / {items.length} solved</dd></div>
      <div><dt>STATUS</dt><dd><Status value={work.status} /></dd></div>
      </dl>
    </header>
    <div className="assignment-work-columns">
    <div className="assignment-work-main">
    {work.instructions && <section className="assignment-instructions"><h2>Instructions</h2><p>{work.instructions}</p></section>}
    <section className="assignment-problems-card">
      <div className="section-heading"><h2>Problems</h2>
        <div className="assignment-problem-pagination">
          <small className="muted">{items.length ? `Showing ${firstProblemIndex + 1}–${Math.min(firstProblemIndex + ASSIGNMENT_PROBLEM_PAGE_SIZE, items.length)} of ${items.length}` : "0 problems"} · {solved} solved</small>
          {problemPageCount > 1 && <nav aria-label="Assignment problem pages">
            <button type="button" className="button" disabled={currentProblemPage === 1} onClick={() => setProblemPage(currentProblemPage - 1)}>← Previous</button>
            <span>Page {currentProblemPage} of {problemPageCount}</span>
            <button type="button" className="button" disabled={currentProblemPage === problemPageCount} onClick={() => setProblemPage(currentProblemPage + 1)}>Next →</button>
          </nav>}
        </div>
      </div>
      {pageItems.map((p, i) => {
        const progress = work.problemProgress[p.id] || "Not started";
        return <button type="button" className={`assignment-problem-row assignment-problem-select${pageSelectedProblem?.id === p.id ? " selected" : ""}`} key={p.id} aria-pressed={pageSelectedProblem?.id === p.id} onClick={() => setSelectedProblemId(p.id)}>
          <span className="assignment-problem-number">{String(firstProblemIndex + i + 1).padStart(2, "0")}</span>
          <div><h3>{p.title}</h3><p>{p.topic} · {p.difficulty}</p></div>
          <span className={"assignment-problem-status " + (progress === "Solved" ? "solved" : progress === "In progress" ? "in-progress" : "")}>{progress}</span>
        </button>;
      })}
      {!items.length && <Empty title="No problems yet" />}
    </section>
    </div>
    <aside className="assignment-selected-details"><AssignmentProblemDetails key={`${work.id}:${pageSelectedProblem?.id}`} problemId={pageSelectedProblem?.id || ""} assignmentId={work.id} problem={pageSelectedProblem} progress={pageSelectedProblem ? work.problemProgress[pageSelectedProblem.id] || "Not started" : "Not started"} /></aside>
    </div>
    </div>
  </section>;
}

function AssignmentProblemDetails({ problemId, assignmentId, problem, progress }: { problemId: string; assignmentId: string; problem?: { id: string; title: string; topic: string; difficulty: string }; progress: string }) {
  const { data, loading, error } = useLoad(() => studentApi.getProblem(problemId, assignmentId), [problemId, assignmentId]);
  const to = `/workspace/${encodeURIComponent(problemId)}?source=Assignments&context=${encodeURIComponent(assignmentId)}`;
  if (!problem) return <div className="assignment-selected-empty"><h2>Problem details</h2><p className="tiny muted">Select a problem to view its details.</p></div>;
  return <>
    <h2>Problem details</h2>
    <h3>{problem.title}</h3>
    <div className="assignment-selected-meta"><span className={`assignment-problem-status ${progress === "Solved" ? "solved" : progress === "In progress" ? "in-progress" : ""}`}>{progress}</span><span>{problem.difficulty}</span></div>
    <Link className="button primary" to={to}>{progress === "Solved" ? "Review" : progress === "In progress" ? "Continue solving" : "Start solving"} →</Link>
    <dl className="assignment-selected-facts"><div><dt>Topic</dt><dd>{problem.topic}</dd></div></dl>
    {loading ? <p className="tiny muted">Loading problem details…</p> : error ? <p className="tiny muted">Problem details could not be loaded.</p> : data && <>
      <section><h4>Problem</h4><p>{data.description || "No description available."}</p></section>
      {data.requirements && <section><h4>Requirements</h4><p>{data.requirements}</p></section>}
    </>}
  </>;
}
