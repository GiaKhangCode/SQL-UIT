import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
import { studentApi } from "../../services/studentApi";
import { type Assignment } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";

function AssignedWork({ items, selectedId, onSelect }: { items: Assignment[]; selectedId?: string; onSelect: (id: string) => void }) {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  return (
    <section className="detail-work-panel">
      <div className="section-heading">
        <h2><TranslatedText>{tr("Assignments")}</TranslatedText></h2>
        <small className="muted">{items.length} <TranslatedText>{tr("activities")}</TranslatedText></small>
      </div>
      <div className="class-assignment-scroll" tabIndex={0} aria-label={tr("Class assignments")}>
      {items.map((assignment, index) => {
        const completed = assignment.status === "Solved";
        const solved = assignment.problemIds.filter(
          (id) => assignment.problemProgress[id] === "Solved",
        ).length;
        return (
          <article className={`detail-work-row${selectedId === assignment.id ? " selected" : ""}`} key={assignment.id} onClick={() => onSelect(assignment.id)}>
            <span className="assignment-code">AS-{String(index + 1).padStart(2, "0")}</span>
            <div className="assignment-work-description">
              <h3><button type="button" className="class-assignment-select" aria-pressed={selectedId === assignment.id} onClick={() => onSelect(assignment.id)}><TranslatedText>{tr("Assignment")}</TranslatedText> {index + 1}: {assignment.title}</button></h3>
              <p className="tiny muted">
                {assignment.problemIds.length} <TranslatedText>{tr("SQL problem")}</TranslatedText><TranslatedText>{assignment.problemIds.length === 1 ? "" : tr("s")}</TranslatedText>
              </p>
            </div>
            <div className="assignment-work-due">
              <small><TranslatedText>{tr("Due")}</TranslatedText></small>
              <b>
                {new Date(assignment.date + "T00:00:00Z").toLocaleDateString(uiLocale, {
                  month: "short", day: "numeric", timeZone: "UTC",
                })}{" · "}{assignment.time}
              </b>
            </div>
            <div className="assignment-work-progress">
              <small>
                <TranslatedText>{completed ? tr("Completed") : assignment.status === "In progress" ? tr("{value0}/{value1} solved", { value0: solved, value1: assignment.problemIds.length }) : tr("Not started")}</TranslatedText>
              </small>
              <span className={completed ? "completed" : ""}>
                <TranslatedText>{completed ? tr("Completed") : tr(assignment.status)}</TranslatedText>
              </span>
            </div>
          </article>
        );
      })}
      {!items.length && <Empty title={tr("No assignments yet")} />}
      </div>
    </section>
  );
}

export function AssignmentDetailPage() {
  const { t: tr, locale: uiLocale } = useLanguage("student");
  const { scopeId = "" } = useParams();
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  const [tab, setTab] = useState("Work");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (loading) return <section className="page scope-detail-page"><Loading label={tr("Loading class work…")} /></section>;
  if (!data || error) return <section className="page scope-detail-page"><ErrorState title={tr("Class work unavailable")} message={tr(error) || tr("Could not load class work.")} onRetry={() => window.location.reload()} /></section>;

  const currentClass = data.classes.find((classInfo) => classInfo.id === scopeId);
  if (!currentClass) return <Empty title={tr("Class unavailable")}><Link to="/assignments"><TranslatedText>{tr("Back to assignments")}</TranslatedText></Link></Empty>;

  const work = data.assignments.filter((assignment) => assignment.classIds.includes(currentClass.id));
  const pending = work.filter((assignment) => assignment.status !== "Solved");
  const selected = work.find((assignment) => assignment.id === selectedId) || work[0];
  const solved = selected?.problemIds.filter((id) => selected.problemProgress[id] === "Solved").length || 0;
  return (
    <section className="page scope-detail-page class-assignment-selection">
      <div className="class-detail-toolbar">
      <Link className="detail-back" to="/assignments"><TranslatedText>{tr("← Classes")}</TranslatedText></Link>
      <div className="underline-tabs" aria-label={tr("Detail section")}>
        <button className={tab === "Work" ? "active" : ""} aria-pressed={tab === "Work"} onClick={() => setTab("Work")}>
          <TranslatedText>{tr("Assignments")}</TranslatedText> {work.length}
        </button>
        <button className={tab === "Members" ? "active" : ""} aria-pressed={tab === "Members"} onClick={() => setTab("Members")}>
          <TranslatedText>{tr("Members")}</TranslatedText>
        </button>
      </div>
      </div>
      <header className="scope-detail-header">
        <div className="scope-detail-main">
          <span className="class-glyph">{currentClass.name[0]}</span>
          <div>
            <small className="muted">{currentClass.code}</small>
            <h1>{currentClass.name}</h1>
            <p className="tiny muted">{currentClass.lecturer} <TranslatedText>{tr("· Lecturer")}</TranslatedText></p>
            <div className="scope-detail-summary class-pending-summary">
              <b>{pending.length} <TranslatedText>{tr("pending")}</TranslatedText></b>
              <small className="muted"><TranslatedText>{tr("Next deadline ·")}</TranslatedText> <TranslatedText>{pending[0]?.date || tr("None")}</TranslatedText></small>
            </div>
          </div>
        </div>
      </header>
      <div className={`scope-detail-layout${tab === "Work" ? " assignment-selection-layout" : ""}`}>
        <div>
          {tab === "Work" ? <AssignedWork items={work} selectedId={selected?.id} onSelect={setSelectedId} /> : (
            <section className="detail-work-panel">
              <h2><TranslatedText>{tr("Class members")}</TranslatedText></h2>
              <p className="tiny muted"><TranslatedText>{tr("The member roster is not available from the student API yet.")}</TranslatedText></p>
            </section>
          )}
        </div>
        <aside className="detail-side-panel class-assignment-details">
          {tab === "Work" && selected ? <>
            <h2><TranslatedText>{tr("Assignment details")}</TranslatedText></h2>
            <h3>{selected.title}</h3>
            <Status value={selected.status} />
            <dl className="class-assignment-facts">
              <div><dt><TranslatedText>{tr("Due")}</TranslatedText></dt><dd><TranslatedText>{selected.date ? new Date(selected.date + "T00:00:00Z").toLocaleDateString(uiLocale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : tr("No due date")}</TranslatedText>{selected.time ? ` · ${selected.time}` : ""}</dd></div>
              <div><dt><TranslatedText>{tr("Progress")}</TranslatedText></dt><dd>{solved}/{selected.problemIds.length} <TranslatedText>{tr("solved")}</TranslatedText></dd></div>
            </dl>
            <Link className="button primary" to={`/assignments/work/${selected.id}?classId=${encodeURIComponent(currentClass.id)}`}><TranslatedText>{tr("View assignment →")}</TranslatedText></Link>
            {selected.instructions && <section><h3><TranslatedText>{tr("Instructions")}</TranslatedText></h3><ProblemMarkdown className="contest-markdown">{selected.instructions}</ProblemMarkdown></section>}
            <section><h3><TranslatedText>{tr("Problems ·")}</TranslatedText> {selected.problemIds.length}</h3>
              {selected.problemIds.map((id, index) => {
                const problem = data.problems.find((item) => item.id === id);
                return <Link className="class-assignment-problem" key={id} to={`/workspace/${encodeURIComponent(id)}?source=Assignments&context=${encodeURIComponent(selected.id)}&contextTitle=${encodeURIComponent(selected.title)}`}>
                  <b>{index + 1}. <TranslatedText>{problem?.title || tr("SQL problem")}</TranslatedText></b>
                  <small><TranslatedText>{problem ? `${problem.topic} · ${tr(problem.difficulty)}` : ""}</TranslatedText></small>
                  <Status value={selected.problemProgress[id] || "Not started"} />
                </Link>;
              })}
              {!selected.problemIds.length && <p className="tiny muted"><TranslatedText>{tr("No problems yet.")}</TranslatedText></p>}
            </section>
          </> : <Empty title={tab === "Work" ? tr("No assignment selected") : tr("Class members")}><TranslatedText>{tab === "Work" ? tr("Select an assignment to view its details.") : tr("The member roster is not available yet.")}</TranslatedText></Empty>}
        </aside>
      </div>
    </section>
  );
}
