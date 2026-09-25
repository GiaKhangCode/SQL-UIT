import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Empty, ErrorState, Loading, Status } from "../../components/ui";
import { type Submission } from "../../data/models";
export function ContestDetailPage() {
  const { contestId } = useParams();
  const { data, loading, error } = useLoad(studentApi.getContests);
  const { data: problems } = useLoad(studentApi.getProblems);
  const { data: attempts } = useLoad<Submission[]>(() =>
    studentApi.getSubmissions({ source: "Contests" }),
  );
  if (loading) return <section className="page contest-detail-page"><Loading label="Loading contest…" /></section>;
  if (!data || error) return <section className="page contest-detail-page"><ErrorState title="Contest unavailable" message={error || "Could not load contest."} onRetry={() => window.location.reload()} /></section>;
  const contest = data.find((c) => c.id === contestId);
  if (!contest)
    return (
      <Empty title="Contest unavailable">
        <Link to="/contests">Back to contests</Link>
      </Empty>
    );
  const solved = contest.problemIds.filter((id) =>
    attempts?.some(
      (s) =>
        s.problemId === id &&
        s.context === contest.title &&
        s.result === "Accepted",
    ),
  );
  const workspace = (id: string) =>
    "/workspace/" +
    id +
    "?source=" +
    (contest.status === "Active" ? "Contests" : "Practice") +
    "&context=" +
    encodeURIComponent(contest.title) +
    (contest.status === "Active" ? "&contest=" + contest.id : "");
  return (
    <section className="page contest-detail-page">
      <Link className="detail-back" to="/contests">
        ← Back to contests
      </Link>
      <header className="contest-detail-banner">
        <div>
          <small>
            {contest.status === "Active"
              ? "LIVE CONTEST"
              : contest.status.toUpperCase() + " CONTEST"}
          </small>
          <h1>{contest.title}</h1>
          <p className="tiny">{contest.scope}</p>
          <p className="tiny">
            Starts {contest.date} {contest.time} · Ends {contest.endDate || contest.date} {contest.endTime} ·{" "}
            {contest.problemIds.length} problem{contest.problemIds.length === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="tiny">{contest.submitters ?? "—"} student{contest.submitters === 1 ? "" : "s"} submitted on included problems</p>
          {contest.status !== "Upcoming" && contest.problemIds.length > 0 && <Link
            className="button"
            to={workspace(
              contest.problemIds.find((id) => !solved.includes(id)) ||
                contest.problemIds[0],
            )}
          >
            {contest.status === "Active"
              ? "Continue"
              : "Review problems"}{" "}
            →
          </Link>}
        </div>
      </header>
      <div className="contest-detail-layout">
        <div>
          <h2>Contest rules</h2>
          <p className="tiny muted">
            {contest.description}
          </p>
          <div className="section-heading">
            <h2>Problems</h2>
            {contest.status !== "Upcoming" && <small className="muted">Solved {solved.length} / {contest.problemIds.length}</small>}
          </div>
          {contest.status === "Upcoming" ? <p className="muted">Problems become available when the contest starts.</p> : contest.problemIds.map((id, i) => {
            const p = problems?.find((p) => p.id === id);
            return (
              <Link className="contest-problem-row" key={id} to={workspace(id)}>
                <div>
                  <b>
                    {String.fromCharCode(65 + i)}. {p?.title || `Problem ${i + 1}`}
                  </b>
                  <small>
                    {p ? `${p.difficulty} · ${p.topic}` : "SQL problem"}
                  </small>
                </div>
                <span className={solved.includes(id) ? "success-text" : ""}>
                  {solved.includes(id) ? "Accepted" : "Open problem"} →
                </span>
              </Link>
            );
          })}
        </div>
        <aside className="contest-participation">
          <h2>Participation</h2>
          <dl>
            <div>
              <dt>Problem submitters</dt>
              <dd>{contest.submitters ?? "—"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Status value={contest.status} />
              </dd>
            </div>
            <div>
              <dt>AI assistance</dt>
              <dd>Disabled in contest</dd>
            </div>
          </dl>
          <p className="tiny muted">Counts include submissions on these problems from your assigned classes.</p>
          <p className="tiny muted">A live leaderboard is not available yet.</p>
        </aside>
      </div>
    </section>
  );
}
