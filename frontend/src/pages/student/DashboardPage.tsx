import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { ErrorState, Loading, Status } from "../../components/ui";
import { Activity } from "../../components/Activity";
import { formatLocalDate } from "../../utils/serverDateTime";
function ContinueProblemDetails({ problemId }: { problemId: string }) {
  const { data: problem, loading, error } = useLoad(() => studentApi.getProblem(problemId), [problemId]);
  if (loading) return <Loading label="Loading problem details…" />;
  if (error || !problem) return <ErrorState title="Could not load problem details" message={error || "Please try again."} onRetry={() => window.location.reload()} />;
  const topics = Array.isArray(problem.topics) && problem.topics.length ? problem.topics.join(" · ") : problem.topic || "—";
  return <>
    <div className="continue-detail-header">
    <h2>{problem.number}. {problem.title}</h2>
    <div className="continue-detail-meta"><Status value={problem.progress || "In progress"} /><span>{problem.difficulty}</span></div>
    <Link className="button primary" to={"/workspace/" + problemId}>Continue solving →</Link>
    </div>
    <dl className="continue-detail-facts">
      <div><dt>Topics</dt><dd>{topics}</dd></div>
      <div><dt>Database</dt><dd>{problem.databaseType || "SQL Server"}</dd></div>
    </dl>
    {problem.description && <section><h3>Problem</h3><p>{problem.description}</p></section>}
    {problem.requirements && <section><h3>Requirements</h3><p>{problem.requirements}</p></section>}
  </>;
}

const CONTINUE_PAGE_SIZE = 10;

export function DashboardPage() {
  const { data, loading, error } = useLoad(studentApi.getDashboard);
  const location = useLocation();
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [continuePage, setContinuePage] = useState(1);
  const learningRef = useRef<HTMLDivElement>(null);
  if (loading) return <section className="page dashboard-page dashboard-reordered"><Loading label="Loading dashboard…" /></section>;
  if (error || !data) return <section className="page dashboard-page dashboard-reordered"><ErrorState title="Dashboard unavailable" message={error || "Could not load dashboard."} onRetry={() => window.location.reload()} /></section>;
  const pageCount = Math.max(1, Math.ceil(data.continuing.length / CONTINUE_PAGE_SIZE));
  const currentPage = Math.min(continuePage, pageCount);
  const firstIndex = (currentPage - 1) * CONTINUE_PAGE_SIZE;
  const pageProblems = data.continuing.slice(firstIndex, firstIndex + CONTINUE_PAGE_SIZE);
  const selectedProblem = pageProblems.find((problem) => problem.id === selectedProblemId) || pageProblems[0];
  function changeContinuePage(nextPage: number) {
    setContinuePage(nextPage);
    learningRef.current?.scrollTo({ top: 0 });
  }
  return (
    <section className="page dashboard-page dashboard-reordered">
      {(location.state as { welcome?: boolean } | null)?.welcome && (
        <p className="welcome-message" role="status">
          Account created. Welcome to your Student workspace.
        </p>
      )}
      <div className="dashboard-layout">
        <div>
      <section className="activity-section dashboard-activity-card">
        <div className="section-heading dashboard-activity-heading">
          <div>
            <h2>SQL activity</h2>
            <small className="muted">
              {(() => {
                const today = new Date();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setDate(today.getDate() - 26 * 7);
                return `${sixMonthsAgo.toLocaleString("default", { month: "short" })} ${sixMonthsAgo.getDate()} – ${today.toLocaleString("default", { month: "short" })} ${today.getDate()}, ${today.getFullYear()}`;
              })()}
            </small>
          </div>
        </div>
        <div className="dashboard-activity-body">
          <div className="dashboard-activity-stats">
            <div className="dashboard-solved">
              <b>{data.solved}</b>
              <span>problems solved</span>
            </div>
            <p>
              <span>● Easy</span>
              <strong>{data.easy}</strong>
            </p>
            <p>
              <span>● Medium</span>
              <strong>{data.medium}</strong>
            </p>
            <p>
              <span>● Hard</span>
              <strong>{data.hard}</strong>
            </p>
            <small>Current streak: {data.currentStreak} days</small>
          </div>
          <Activity submissions={data.submissionsPerDay} />
        </div>
      </section>
        </div>
        <aside className="dashboard-deadlines deadline-panel">
          <div className="dashboard-deadlines-heading"><h2>Deadlines</h2><span>{data.deadlines.length} upcoming</span></div>
          <div className="deadline-scroll" tabIndex={0} aria-label="Upcoming deadlines">
            {data.deadlines.map((item) => <Link className="dashboard-deadline-row" key={item.id} to={item.to}><time><b>{new Date(item.date + "T00:00:00").toLocaleString("en-US", { month: "short" }).toUpperCase()}</b><strong>{item.date.slice(8)}</strong></time><span><b>{item.title}</b><small>{item.kind} · {item.context}</small></span><em>{item.time}</em></Link>)}
            {data.deadlinesError ? <p className="tiny muted" role="alert">{data.deadlinesError}</p> : !data.deadlines.length && <p className="tiny muted">No upcoming deadlines.</p>}
          </div>
          <div className="dashboard-week">
            <div><b>This week</b><Link to="/assignments">Open calendar</Link></div>
            <div className="dashboard-week-days">
              {(() => {
                const today = new Date();
                const currentDayOfWeek = today.getDay();
                const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
                const monday = new Date(today);
                monday.setDate(today.getDate() + mondayOffset);

                const weekDays = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(monday);
                  d.setDate(monday.getDate() + i);
                  return {
                    date: d.getDate(),
                    fullDate: formatLocalDate(d),
                    isToday: d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
                  };
                });
                
                const deadlineDates = new Set(data.deadlines.map((item: any) => item.date));

                return weekDays.map((wd, i) => (
                  <span key={i}>
                    <small>{["M","T","W","T","F","S","S"][i]}</small>
                    <b className={wd.isToday ? "today" : ""}>{wd.date}</b>
                    {deadlineDates.has(wd.fullDate) && <i />}
                  </span>
                ));
              })()}
            </div>
          </div>
        </aside>
      </div>
          <div className="dashboard-continue-region">
        <section className="dashboard-learning-panel">
          <div className="dashboard-learning-heading">
            <h1>Continue learning</h1>
            <div className="dashboard-continue-controls">
              <span aria-live="polite" className="muted">Showing {data.continuing.length ? firstIndex + 1 : 0}–{Math.min(firstIndex + CONTINUE_PAGE_SIZE, data.continuing.length)} of {data.continuing.length}</span>
              <nav className="dashboard-continue-pagination" aria-label="Continue learning pages">
                <button type="button" className="button" disabled={currentPage === 1} onClick={() => changeContinuePage(currentPage - 1)}>← Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button type="button" className="button" disabled={currentPage === pageCount} onClick={() => changeContinuePage(currentPage + 1)}>Next →</button>
              </nav>
            </div>
          </div>
          <div className="learning-scroll" ref={learningRef} tabIndex={0} aria-label="Continue learning problems">
            {pageProblems.map((problem) => (
              <button type="button" className={"continue-row continue-select-row" + (selectedProblem?.id === problem.id ? " selected" : "")} key={problem.id} aria-pressed={selectedProblem?.id === problem.id} onClick={() => setSelectedProblemId(problem.id)}>
                <span className="continue-info">
                  <b><span className="continue-problem-number">{problem.number}.</span> {problem.title}</b>
                  <small className="continue-meta"><span>{problem.topic || "SQL practice"}</span><span aria-hidden="true">·</span><span>{problem.difficulty}</span></small>
                </span>
                <Status value="In progress" />
              </button>
            ))}
            {!data.continuing.length && <div className="empty-state"><h3>No work in progress</h3><p>Browse Practice to start a SQL problem.</p></div>}
          </div>
        </section>
        <aside className="dashboard-continue-details" aria-label="Selected problem details">
          {selectedProblem ? <ContinueProblemDetails key={selectedProblem.id} problemId={selectedProblem.id} /> : <p className="muted">Select a problem to view details.</p>}
        </aside>
      </div>
    </section>
  );
}
