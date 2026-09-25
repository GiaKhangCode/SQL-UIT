import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Assignment } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
function AssignedWork({
  items,
  group,
  problemProgress,
}: {
  items: Assignment[];
  group: boolean;
  problemProgress: { id: string; progress: string }[];
}) {
  return (
    <section className="detail-work-panel">
      <div className="section-heading">
        <h2>{group ? "Assigned work" : "Assignments"}</h2>
        <small className="muted">{items.length} activities</small>
      </div>
      {items.map((a, i) => {
        const completed = a.status === "Solved";
        const solved = a.problemIds.filter(
          (id) => problemProgress.find((p) => p.id === id)?.progress === "Solved",
        ).length;
        return (
          <article className="detail-work-row" key={a.id}>
            <span className="assignment-code">
              AS-{String(i + 1).padStart(2, "0")}
            </span>
            <div className="assignment-work-description">
              <h3>
                {group ? "" : "Assignment " + (i + 1) + ": "}
                {a.title}
              </h3>
              <p className="tiny muted">
                {a.groupId ? "Group submission" : "Individual"} ·{" "}
                {a.problemIds.length} SQL problem{a.problemIds.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="assignment-work-due">
              <small>Due</small>
              <b>
                {new Date(a.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}{" "}
                · {a.time}
              </b>
            </div>
            <div className="assignment-work-progress">
              <small>
                {completed
                  ? "Completed"
                  : a.status === "In progress"
                    ? solved + "/" + a.problemIds.length + " solved"
                    : "Not started"}
              </small>
              <span className={completed ? "completed" : ""}>
                {completed ? "Completed" : a.status}
              </span>
            </div>
            <Link className="assignment-detail-arrow" to={"/assignments/work/" + a.id} aria-label={"View " + a.title + " details"}>→</Link>
          </article>
        );
      })}
      {!items.length && <Empty title="No assigned work yet" />}
    </section>
  );
}
export function AssignmentDetailPage({ group = false }: { group?: boolean }) {
  const { scopeId = "" } = useParams();
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  const [tab, setTab] = useState("Work");
  if (loading) return <section className="page scope-detail-page"><Loading label="Loading class work…" /></section>;
  if (!data || error) return <section className="page scope-detail-page"><ErrorState title="Class work unavailable" message={error || "Could not load class work."} onRetry={() => window.location.reload()} /></section>;
  const currentGroup = group
    ? data.groups.find((g) => g.id === scopeId)
    : data.groups.find((g) => g.classId === scopeId);
  const currentClass = data.classes.find(
    (c) => c.id === (group ? currentGroup?.classId : scopeId),
  );
  if (!currentClass || (group && !currentGroup))
    return (
      <Empty title={group ? "Group unavailable" : "Class unavailable"}>
        <Link to="/assignments">Back to assignments</Link>
      </Empty>
    );
  const work = data.assignments.filter((a) =>
    group ? a.groupId === currentGroup!.id : a.classId === currentClass.id,
  );
  const pending = work.filter((a) => a.status !== "Solved");
  const title = group ? currentGroup!.name : currentClass.name;
  return (
    <section className="page scope-detail-page">
      <Link
        className="detail-back"
        to={group ? "/assignments/classes/" + currentClass.id : "/assignments"}
      >
        ← {group ? currentClass.name : "Classes"}
      </Link>
      <header className="scope-detail-header">
        <div className="scope-detail-main">
          <span className="class-glyph">{title[0]}</span>
          <div>
            <small className="muted">{currentClass.code}</small>
            <h1>{title}</h1>
            <p className="tiny muted">
              {group
                ? currentClass.name +
                  " · " +
                  currentGroup!.members +
                  " members · Member"
                : currentClass.lecturer + " · " + currentClass.mode}
            </p>
          </div>
        </div>
        <div className="scope-detail-summary">
          {group ? (
            <Link
              className="button"
              to={"/assignments/classes/" + currentClass.id}
            >
              View {currentClass.name} →
            </Link>
          ) : (
            <>
              <b>{pending.length} pending</b>
              <small className="muted">
                Next deadline · {pending[0]?.date || "None"}
              </small>
            </>
          )}
        </div>
      </header>
      <div className="underline-tabs" aria-label="Detail section">
        <button
          className={tab === "Work" ? "active" : ""}
          aria-pressed={tab === "Work"}
          onClick={() => setTab("Work")}
        >
          {group ? "Assigned work" : "Assignments"} {work.length}
        </button>
        <button
          className={tab === "Members" ? "active" : ""}
          aria-pressed={tab === "Members"}
          onClick={() => setTab("Members")}
        >
          Members
        </button>
      </div>
      <div className="scope-detail-layout">
        <div>
          {tab === "Work" ? (
            <AssignedWork items={work} group={group} problemProgress={data.problems || []} />
          ) : (
            <section className="detail-work-panel">
              <h2>{group ? "Group members" : "Your class group"}</h2>
              <p className="tiny muted">The member roster is not available from the student API yet.</p>
            </section>
          )}
        </div>
        <aside className="detail-side-panel">
          {group ? (
            <>
              <h2>Members</h2>
              <p className="tiny muted">Member details are not available.</p>
            </>
          ) : currentGroup ? (
            <>
              <p className="tiny muted">YOUR GROUP</p>
              <h2>{currentGroup.name}</h2>
              <p className="tiny muted">
                {currentClass.code} · {currentGroup.members} members
              </p>
              <p className="tiny muted">
                One shared submission for group assignments
              </p>
              <Link
                className="button group-open-button"
                to={"/assignments/groups/" + currentGroup.id}
              >
                View {currentGroup.name} →
              </Link>
            </>
          ) : (
            <>
              <h2>Individual assignments</h2>
              <p className="tiny muted">
                Complete each problem in your own SQL workspace.
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
