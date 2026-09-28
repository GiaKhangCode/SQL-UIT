import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Assignment } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading } from "../../components/ui";

function AssignedWork({ items, classId }: { items: Assignment[]; classId: string }) {
  return (
    <section className="detail-work-panel">
      <div className="section-heading">
        <h2>Assignments</h2>
        <small className="muted">{items.length} activities</small>
      </div>
      {items.map((assignment, index) => {
        const completed = assignment.status === "Solved";
        const solved = assignment.problemIds.filter(
          (id) => assignment.problemProgress[id] === "Solved",
        ).length;
        return (
          <article className="detail-work-row" key={assignment.id}>
            <span className="assignment-code">AS-{String(index + 1).padStart(2, "0")}</span>
            <div className="assignment-work-description">
              <h3>Assignment {index + 1}: {assignment.title}</h3>
              <p className="tiny muted">
                {assignment.problemIds.length} SQL problem{assignment.problemIds.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="assignment-work-due">
              <small>Due</small>
              <b>
                {new Date(assignment.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  month: "short", day: "numeric", timeZone: "UTC",
                })}{" · "}{assignment.time}
              </b>
            </div>
            <div className="assignment-work-progress">
              <small>
                {completed ? "Completed" : assignment.status === "In progress"
                  ? `${solved}/${assignment.problemIds.length} solved` : "Not started"}
              </small>
              <span className={completed ? "completed" : ""}>
                {completed ? "Completed" : assignment.status}
              </span>
            </div>
            <Link
              className="assignment-detail-arrow"
              to={`/assignments/work/${assignment.id}?classId=${encodeURIComponent(classId)}`}
              aria-label={`View ${assignment.title} details`}
            >→</Link>
          </article>
        );
      })}
      {!items.length && <Empty title="No assignments yet" />}
    </section>
  );
}

export function AssignmentDetailPage() {
  const { scopeId = "" } = useParams();
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  const [tab, setTab] = useState("Work");
  if (loading) return <section className="page scope-detail-page"><Loading label="Loading class work…" /></section>;
  if (!data || error) return <section className="page scope-detail-page"><ErrorState title="Class work unavailable" message={error || "Could not load class work."} onRetry={() => window.location.reload()} /></section>;

  const currentClass = data.classes.find((classInfo) => classInfo.id === scopeId);
  if (!currentClass) return <Empty title="Class unavailable"><Link to="/assignments">Back to assignments</Link></Empty>;

  const work = data.assignments.filter((assignment) => assignment.classIds.includes(currentClass.id));
  const pending = work.filter((assignment) => assignment.status !== "Solved");
  return (
    <section className="page scope-detail-page">
      <Link className="detail-back" to="/assignments">← Classes</Link>
      <header className="scope-detail-header">
        <div className="scope-detail-main">
          <span className="class-glyph">{currentClass.name[0]}</span>
          <div>
            <small className="muted">{currentClass.code}</small>
            <h1>{currentClass.name}</h1>
            <p className="tiny muted">{currentClass.lecturer} · Lecturer</p>
          </div>
        </div>
        <div className="scope-detail-summary">
          <b>{pending.length} pending</b>
          <small className="muted">Next deadline · {pending[0]?.date || "None"}</small>
        </div>
      </header>
      <div className="underline-tabs" aria-label="Detail section">
        <button className={tab === "Work" ? "active" : ""} aria-pressed={tab === "Work"} onClick={() => setTab("Work")}>
          Assignments {work.length}
        </button>
        <button className={tab === "Members" ? "active" : ""} aria-pressed={tab === "Members"} onClick={() => setTab("Members")}>
          Members
        </button>
      </div>
      <div className="scope-detail-layout">
        <div>
          {tab === "Work" ? <AssignedWork items={work} classId={currentClass.id} /> : (
            <section className="detail-work-panel">
              <h2>Class members</h2>
              <p className="tiny muted">The member roster is not available from the student API yet.</p>
            </section>
          )}
        </div>
        <aside className="detail-side-panel">
          <h2>Assignments</h2>
          <p className="tiny muted">Complete each problem in your own SQL workspace.</p>
        </aside>
      </div>
    </section>
  );
}
