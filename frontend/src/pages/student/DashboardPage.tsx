import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { ErrorState, Loading } from "../../components/ui";
import { Activity } from "../../components/Activity";
import { formatLocalDate } from "../../utils/serverDateTime";
export function DashboardPage() {
  const { data, loading, error } = useLoad(studentApi.getDashboard);
  const location = useLocation();
  if (loading) return <section className="page dashboard-page"><Loading label="Loading dashboard…" /></section>;
  if (error || !data) return <section className="page dashboard-page"><ErrorState title="Dashboard unavailable" message={error || "Could not load dashboard."} onRetry={() => window.location.reload()} /></section>;
  return (
    <section className="page dashboard-page">
      {(location.state as { welcome?: boolean } | null)?.welcome && (
        <p className="welcome-message" role="status">
          Account created. Welcome to your Student workspace.
        </p>
      )}
      <div className="dashboard-layout">
        <div>
          <section>
            <div className="section-heading">
              <h1>Continue learning</h1>
              <span className="dashboard-heading-actions"><span className="muted">{data.continuing.length} in progress</span><Link to="/practice">View all {data.continuing.length}</Link></span>
            </div>
            <div
              className="learning-scroll"
              tabIndex={0}
              aria-label="Continue learning problems"
            >
              {data.continuing.map((p, i) => (
                <div className="continue-row" key={p.id}>
                  <div>
                    <b>{p.title}</b>
                    <small>{p.topic} · {p.difficulty}</small>
                  </div>
                  <Link
                    className={"dashboard-resume" + (i === 0 ? " primary" : "")}
                    to={"/workspace/" + p.id}
                  >
                    Continue
                  </Link>
                </div>
              ))}
              {!data.continuing.length && <div className="empty-state"><h3>No work in progress</h3><p>Browse Practice to start a SQL problem.</p></div>}
            </div>
          </section>
        </div>
        <aside className="dashboard-deadlines deadline-panel">
          <div className="dashboard-deadlines-heading"><h2>Deadlines</h2><span>{Math.min(3, data.deadlines.length)} upcoming</span></div>
          <div className="deadline-scroll" tabIndex={0} aria-label="Upcoming deadlines">
            {data.deadlines.slice(0, 3).map((item) => <Link className="dashboard-deadline-row" key={item.id} to={item.to}><time><b>{new Date(item.date + "T00:00:00").toLocaleString("en-US", { month: "short" }).toUpperCase()}</b><strong>{item.date.slice(8)}</strong></time><span><b>{item.title}</b><small>{item.kind} · {item.context}</small></span><em>{item.time}</em></Link>)}
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
      <section className="activity-section dashboard-activity-card">
        <div className="section-heading">
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
      <div className="quick-actions"><Link to="/practice">Browse practice →</Link><Link to="/assignments">View assignments →</Link><Link to="/contests">Explore contests →</Link></div>
    </section>
  );
}
