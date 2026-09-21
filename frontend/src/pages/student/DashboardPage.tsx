import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Loading } from "../../components/ui";
import { Activity } from "../../components/Activity";
export function DashboardPage() {
  const { data, loading, error } = useLoad(studentApi.getDashboard);
  const location = useLocation();
  if (loading) return <Loading />;
  if (error || !data) return <p role="alert">{error}</p>;
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
                    <small>
                      {p.topic} · {p.difficulty} · Saved{" "}
                      {["2 hours ago", "yesterday", "2 days ago"][i]}
                    </small>
                  </div>
                  <Link
                    className={"dashboard-resume" + (i === 0 ? " primary" : "")}
                    to={"/workspace/" + p.id}
                  >
                    Continue
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="dashboard-deadlines deadline-panel">
          <div className="dashboard-deadlines-heading"><h2>Deadlines</h2><span>{Math.min(3, data.deadlines.length)} upcoming</span></div>
          <div className="deadline-scroll" tabIndex={0} aria-label="Upcoming deadlines">
            {data.deadlines.slice(0, 3).map((item) => <Link className="dashboard-deadline-row" key={item.id} to={item.to}><time><b>{item.date.slice(5, 7) === "09" ? "SEP" : item.date.slice(5, 7)}</b><strong>{item.date.slice(8)}</strong></time><span><b>{item.title}</b><small>{item.kind} · {item.context}</small></span><em>in {Math.max(1, Number(item.date.slice(8)) - 21)} days</em></Link>)}
          </div>
          <div className="dashboard-week"><div><b>This week</b><Link to="/assignments">Open calendar</Link></div><div className="dashboard-week-days">{[21,22,23,24,25,26,27].map((day) => <span key={day}><small>{["M","T","W","T","F","S","S"][day-21]}</small><b className={day===21 ? "today" : ""}>{day}</b>{day >= 23 && day <= 24 && <i />}</span>)}</div></div>
        </aside>
      </div>
      <section className="activity-section dashboard-activity-card">
        <div className="section-heading"><div><h2>SQL activity</h2><small className="muted">Mar 2 – Sep 21, 2026</small></div></div>
        <div className="dashboard-activity-body"><div className="dashboard-activity-stats"><div className="dashboard-solved"><b>{data.solved}</b><span>problems solved</span></div><p><span>● Easy</span><strong>{data.easy}</strong></p><p><span>● Medium</span><strong>{data.medium}</strong></p><p><span>● Hard</span><strong>{data.hard}</strong></p><small>Current streak: 7 days</small></div><Activity /></div>
      </section>
      <div className="quick-actions"><Link to="/practice">Browse practice →</Link><Link to="/assignments">View assignments →</Link><Link to="/contests">Explore contests →</Link></div>
    </section>
  );
}
