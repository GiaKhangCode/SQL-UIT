import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";


export function AssignmentWorkPage() {
  const { assignmentId } = useParams();
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  if (loading) return <section className="page assignment-work-page"><Loading label="Loading assignment…" /></section>;
  if (error || !data) return <section className="page assignment-work-page"><ErrorState title="Assignment unavailable" message={error || "Could not load assignment."} onRetry={() => window.location.reload()} /></section>;
  const work = data.assignments.find((a: any) => a.id === assignmentId);
  if (!work) return <Empty title="Assignment unavailable"><Link to="/assignments">Back to classes</Link></Empty>;
  const classInfo = data.classes.find((c: any) => c.id === work.classId);
  if (!classInfo) return <Empty title="Class unavailable"><Link to="/assignments">Back to assignments</Link></Empty>;
  const group = data.groups.find((g: any) => g.id === work.groupId);
  const number = data.assignments.filter((a: any) => a.classId === work.classId).findIndex((a: any) => a.id === work.id) + 1;
  const items = work.problemIds.map((id: string) => data.problems?.find((p: any) => p.id === id)).filter(Boolean);
  const solved = items.filter((p: any) => work.status === "Solved" || p.progress === "Solved").length;
  const due = work.date ? new Date(work.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No due date";
  return <section className="page assignment-work-page">
    <Link className="detail-back" to={"/assignments/classes/" + work.classId}>← {classInfo.name} / Assignments</Link>
    <header className="assignment-work-heading">
      <h1>Assignment {number}: {work.title}</h1>
      <p>AS-{String(number).padStart(2, "0")} · {group ? "Group submission" : "Individual"} · {classInfo.name}{group ? " · " + group.name : ""}</p>
    </header>
    <dl className="assignment-summary">
      <div><dt>DUE DATE</dt><dd>{due}{work.time ? ` · ${work.time}` : ""}</dd></div>
      <div><dt>PROBLEMS</dt><dd>{items.length} SQL problem{items.length === 1 ? "" : "s"}</dd></div>
      <div><dt>PROGRESS</dt><dd className="assignment-summary-progress">{solved} / {items.length} solved</dd></div>
      <div><dt>STATUS</dt><dd><Status value={work.status} /></dd></div>
    </dl>
    <section className="assignment-problems-card">
      <div className="section-heading"><h2>Problems</h2><small className="muted">{items.length} problem{items.length === 1 ? "" : "s"} · {solved} solved</small></div>
      {items.map((p: any, i: number) => {
        const progress = work.status === "Solved" ? "Solved" : p.progress;
        const to = "/workspace/" + p.id + "?source=Assignments&context=" + encodeURIComponent(work.id);
        return <article className="assignment-problem-row" key={p.id}>
          <span className="assignment-problem-number">{String(i + 1).padStart(2, "0")}</span>
          <div><h3>{p.title}</h3><p>{p.topic} · {p.difficulty}</p></div>
          <span className={"assignment-problem-status " + (progress === "Solved" ? "solved" : progress === "In progress" ? "in-progress" : "")}>{progress}</span>
          <Link className={"assignment-problem-action" + (progress === "Not started" ? " start" : "")} to={to}>{progress === "Solved" ? "Review" : progress === "In progress" ? "Continue" : "Start"} →</Link>
          <Link className="assignment-detail-arrow" to={to} aria-label={"Open " + p.title}>→</Link>
        </article>;
      })}
      {!items.length && <Empty title="No problems yet" />}
    </section>
  </section>;
}
