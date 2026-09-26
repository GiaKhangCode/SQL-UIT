import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { type Deadline } from "../../data/models";
import { useLoad } from "../../components/useLoad";
import { Dialog, Empty, ErrorState, Loading, Status } from "../../components/ui";
import { Calendar } from "../../components/Calendar";
function dateLabel(date: string) {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function AssignmentCalendar({
  items,
  onOpen,
}: {
  items: Deadline[];
  onOpen: () => void;
}) {
  return (
    <div className="assignment-calendar-content">
      <Calendar items={items} />
      <h3>Upcoming deadlines · {items.length}</h3>
      <div
        className="assignment-deadline-scroll"
        tabIndex={0}
        aria-label="Upcoming assignment deadlines"
      >
        {items.map((item) => (
          <Link key={item.id} to={item.to} onClick={onOpen}>
            <small>
              {dateLabel(item.date)} · {item.time}
            </small>
            <b>{item.title}</b>
            <small>{item.context}</small>
          </Link>
        ))}
      </div>
    </div>
  );
}
export function AssignmentsPage() {
  const { data, loading, error } = useLoad(studentApi.getAssignments);
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const [calendarOpen, setCalendarOpen] = useState(false);
  if (loading) return <section className="page assignments-page"><Loading label="Loading assignments…" /></section>;
  if (error || !data) return <section className="page assignments-page"><ErrorState title="Assignments unavailable" message={error || "Could not load assignments."} onRetry={() => window.location.reload()} /></section>;
  const assignmentDeadlines = data.deadlines.filter(
    (item) => item.kind === "Assignment",
  );
  const selectedWork = data.assignments.find(
    (a) => a.id === params.get("work"),
  );
  const cards = data.classes.map((c) => ({
    ...c,
    context: c.code,
    description: c.lecturer + " · Lecturer",
    work: data.assignments.filter((a) => a.classId === c.id),
  }));
  const filtered = cards.filter((c) =>
    (c.name + " " + c.context + " " + c.description)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="page assignments-page">
      <div className="assignment-mobile-deadlines">
        <b>
          Deadlines · Next:{" "}
          {assignmentDeadlines[0]
            ? dateLabel(assignmentDeadlines[0].date)
            : "None"}
        </b>
        <button className="text-button" onClick={() => setCalendarOpen(true)}>
          Calendar ›
        </button>
      </div>
      <div className="assignments-layout">
        <div className="assignment-class-panel">
          <div className="scope-toolbar">
            <h2 className="class-list-label">Class List</h2>
            <label className="sr-only" htmlFor="scope-search">
              Search classes
            </label>
            <input
              id="scope-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="⌕ Search classes…"
            />
          </div>
          <div
            className="class-grid-scroll"
            tabIndex={0}
            aria-label="Class list"
          >
            <div className="class-grid">
              {filtered.map((c) => {
                const pending = c.work
                  .filter((a) => a.status !== "Solved")
                  .sort((a, b) => a.date.localeCompare(b.date));
                return (
                  <Link
                    className="class-card"
                    key={c.id}
                    to={"/assignments/classes/" + c.id}
                  >
                    <div className="class-card-top">
                      <span className="class-glyph">{c.name[0]}</span>
                      <span className="status neutral">{c.mode}</span>
                    </div>
                    <div className="class-card-identity">
                      <small>{c.context}</small>
                      <h2>{c.name}</h2>
                      <p>{c.description}</p>
                      <span className="class-mobile-summary">
                        {c.mode} · {pending.length} pending
                      </span>
                    </div>
                    <div className="class-card-footer">
                      <div>
                        <b>
                          {pending.length} pending assignment
                          {pending.length === 1 ? "" : "s"}
                        </b>
                        <small>
                          <span className="class-next-prefix">Next due · </span>
                          {pending[0]
                            ? dateLabel(pending[0].date) +
                              " · " +
                              pending[0].time
                            : "None"}
                        </small>
                      </div>
                      <span className="class-desktop-arrow">↗</span>
                      <span className="class-mobile-arrow">›</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            {!filtered.length && (
              <Empty title="No matching classes" />
            )}
          </div>
        </div>
        <aside className="deadline-panel assignment-deadline-panel">
          <AssignmentCalendar
            items={assignmentDeadlines}
            onOpen={() => setCalendarOpen(false)}
          />
        </aside>
      </div>
      {calendarOpen && (
        <Dialog
          title="Calendar"
          className="assignment-calendar-dialog"
          onClose={() => setCalendarOpen(false)}
        >
          <AssignmentCalendar
            items={assignmentDeadlines}
            onOpen={() => setCalendarOpen(false)}
          />
        </Dialog>
      )}
      {selectedWork && (
        <Dialog
          title={selectedWork.title}
          onClose={() => setParams({})}
        >
          <Status value={selectedWork.status} />
          <p className="tiny muted">
            {data.classes.find((c) => c.id === selectedWork.classId)!.name}
            {selectedWork.groupId
              ? " · " +
                data.groups.find((g) => g.id === selectedWork.groupId)!.name
              : " · Individual"}{" "}
            · Due {dateLabel(selectedWork.date)} {selectedWork.time}
          </p>
          {selectedWork.problemIds.map((id) => (
            <Link
              className="assigned-problem"
              key={id}
              to={
                "/workspace/" +
                id +
                "?source=Assignments&context=" +
                encodeURIComponent(selectedWork.id) +
                "&contextTitle=" +
                encodeURIComponent(selectedWork.title)
              }
            >
              {data.problems?.find((p) => p.id === id)?.title || "SQL problem"}
              <span>Open problem →</span>
            </Link>
          ))}
        </Dialog>
      )}
    </section>
  );
}
