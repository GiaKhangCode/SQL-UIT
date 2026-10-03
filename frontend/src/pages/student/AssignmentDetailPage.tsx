import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { studentApi } from "../../services/studentApi";
import { type Assignment } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";

function AssignedWork({ items, selectedId, onSelect }: { items: Assignment[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <section className="detail-work-panel">
      <div className="section-heading">
        <h2>Assignments</h2>
        <small className="muted">{items.length} activities</small>
      </div>
      <div className="class-assignment-scroll" tabIndex={0} aria-label="Class assignments">
      {items.map((assignment, index) => {
        const completed = assignment.status === "Solved";
        const solved = assignment.problemIds.filter(
          (id) => assignment.problemProgress[id] === "Solved",
        ).length;
        return (
          <article className={`detail-work-row${selectedId === assignment.id ? " selected" : ""}`} key={assignment.id} onClick={() => onSelect(assignment.id)}>
            <span className="assignment-code">AS-{String(index + 1).padStart(2, "0")}</span>
            <div className="assignment-work-description">
              <h3><button type="button" className="class-assignment-select" aria-pressed={selectedId === assignment.id} onClick={() => onSelect(assignment.id)}>Assignment {index + 1}: {assignment.title}</button></h3>
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
          </article>
        );
      })}
      {!items.length && <Empty title="No assignments yet" />}
      </div>
    </section>
  );
}

export function AssignmentDetailPage() {
  const { scopeId = "" } = useParams();
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  const [tab, setTab] = useState("Work");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (loading) return <section className="page scope-detail-page"><Loading label="Loading class work…" /></section>;
  if (!data || error) return <section className="page scope-detail-page"><ErrorState title="Class work unavailable" message={error || "Could not load class work."} onRetry={() => window.location.reload()} /></section>;

  const currentClass = data.classes.find((classInfo) => classInfo.id === scopeId);
  if (!currentClass) return <Empty title="Class unavailable"><Link to="/assignments">Back to assignments</Link></Empty>;

  const work = data.assignments.filter((assignment) => assignment.classIds.includes(currentClass.id));
  const pending = work.filter((assignment) => assignment.status !== "Solved");
  const selected = work.find((assignment) => assignment.id === selectedId) || work[0];
  const solved = selected?.problemIds.filter((id) => selected.problemProgress[id] === "Solved").length || 0;
  return (
    <section className="page scope-detail-page class-assignment-selection">
      <div className="class-detail-toolbar">
      <Link className="detail-back" to="/assignments">← Classes</Link>
      <div className="underline-tabs" aria-label="Detail section">
        <button className={tab === "Work" ? "active" : ""} aria-pressed={tab === "Work"} onClick={() => setTab("Work")}>
          Assignments {work.length}
        </button>
        <button className={tab === "Members" ? "active" : ""} aria-pressed={tab === "Members"} onClick={() => setTab("Members")}>
          Members
        </button>
      </div>
      </div>
      <header className="scope-detail-header">
        <div className="scope-detail-main">
          <span className="class-glyph">{currentClass.name[0]}</span>
          <div>
            <small className="muted">{currentClass.code}</small>
            <h1>{currentClass.name}</h1>
            <p className="tiny muted">{currentClass.lecturer} · Lecturer</p>
            <div className="scope-detail-summary class-pending-summary">
              <b>{pending.length} pending</b>
              <small className="muted">Next deadline · {pending[0]?.date || "None"}</small>
            </div>
          </div>
        </div>
      </header>
      <div className={`scope-detail-layout${tab === "Work" ? " assignment-selection-layout" : ""}`}>
        <div>
          {tab === "Work" ? <AssignedWork items={work} selectedId={selected?.id} onSelect={setSelectedId} /> : (
            <section className="detail-work-panel">
              <h2>Class members</h2>
              <p className="tiny muted">The member roster is not available from the student API yet.</p>
            </section>
          )}
        </div>
        <aside className="detail-side-panel class-assignment-details">
          {tab === "Work" && selected ? <>
            <h2>Assignment details</h2>
            <h3>{selected.title}</h3>
            <Status value={selected.status} />
            <dl className="class-assignment-facts">
              <div><dt>Due</dt><dd>{selected.date ? new Date(selected.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No due date"}{selected.time ? ` · ${selected.time}` : ""}</dd></div>
              <div><dt>Progress</dt><dd>{solved}/{selected.problemIds.length} solved</dd></div>
            </dl>
            <Link className="button primary" to={`/assignments/work/${selected.id}?classId=${encodeURIComponent(currentClass.id)}`}>View assignment →</Link>
            {selected.instructions && <section><h3>Instructions</h3><div className="contest-markdown"><ReactMarkdown skipHtml>{selected.instructions}</ReactMarkdown></div></section>}
            <section><h3>Problems · {selected.problemIds.length}</h3>
              {selected.problemIds.map((id, index) => {
                const problem = data.problems.find((item) => item.id === id);
                return <Link className="class-assignment-problem" key={id} to={`/workspace/${encodeURIComponent(id)}?source=Assignments&context=${encodeURIComponent(selected.id)}&contextTitle=${encodeURIComponent(selected.title)}`}>
                  <b>{index + 1}. {problem?.title || "SQL problem"}</b>
                  <small>{problem ? `${problem.topic} · ${problem.difficulty}` : ""}</small>
                  <Status value={selected.problemProgress[id] || "Not started"} />
                </Link>;
              })}
              {!selected.problemIds.length && <p className="tiny muted">No problems yet.</p>}
            </section>
          </> : <Empty title={tab === "Work" ? "No assignment selected" : "Class members"}>{tab === "Work" ? "Select an assignment to view its details." : "The member roster is not available yet."}</Empty>}
        </aside>
      </div>
    </section>
  );
}
