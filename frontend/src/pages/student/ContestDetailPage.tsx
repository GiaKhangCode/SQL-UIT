import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { Dialog, Empty, Loading, Status } from "../../components/ui";
import { problems, type Submission } from "../../data/mockData";
export function ContestDetailPage() {
  const { contestId } = useParams();
  const { data, loading, error } = useLoad(studentApi.getContests);
  const [standings, setStandings] = useState(false);
  const { data: attempts } = useLoad<Submission[]>(() =>
    studentApi.getSubmissions({ source: "Contests" }),
  );
  if (loading) return <Loading />;
  if (!data || error) return <p role="alert">{error}</p>;
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
  const ranking = [
    {
      name: "Ngoc Linh",
      solved: Math.min(3, contest.problemIds.length),
      minutes: 18,
    },
    {
      name: "Minh Anh",
      solved: Math.min(2, contest.problemIds.length),
      minutes: 29,
    },
    { name: "Bao Tran", solved: 1, minutes: 35 },
    { name: "You", solved: solved.length, minutes: 45 },
  ].sort((a, b) => b.solved - a.solved || a.minutes - b.minutes);
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
          <p className="tiny">Organized by SQL Community · Mock contest</p>
          <p className="tiny">
            {contest.date} · {contest.time}–{contest.endTime} ICT ·{" "}
            {contest.problemIds.length} problems
          </p>
        </div>
        <div>
          <p className="tiny">{contest.participants} participants</p>
          <Link
            className="button"
            to={workspace(
              contest.problemIds.find((id) => !solved.includes(id)) ||
                contest.problemIds[0],
            )}
          >
            {contest.status === "Active"
              ? "Continue"
              : "Preview problems"}{" "}
            →
          </Link>
        </div>
      </header>
      <div className="contest-detail-layout">
        <div>
          <h2>Contest rules</h2>
          <p className="tiny muted">
            Ranked by solved problems, then completion time. Hints and AI
            assistance are disabled during the mock contest.
          </p>
          <div className="section-heading">
            <h2>Problems</h2>
            <small className="muted">
              Solved {solved.length} / {contest.problemIds.length}
            </small>
          </div>
          {contest.problemIds.map((id, i) => {
            const p = problems.find((p) => p.id === id)!;
            return (
              <Link className="contest-problem-row" key={id} to={workspace(id)}>
                <div>
                  <b>
                    {String.fromCharCode(65 + i)}. {p.title}
                  </b>
                  <small>
                    {p.difficulty} · {p.topic}
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
              <dt>Format</dt>
              <dd>
                {contest.scope.includes("Individual") ? "Individual" : "Group"}
              </dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{contest.participants}</dd>
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
          <h2>Current leaders</h2>
          {ranking.slice(0, 3).map((row, i) => (
            <div className="leader-row" key={row.name}>
              <span className="accent">0{i + 1}</span>
              <b>{row.name}</b>
              <small>{row.solved} solved</small>
            </div>
          ))}
          <button className="text-button" onClick={() => setStandings(true)}>
            View full standings →
          </button>
          <p className="tiny muted">Illustrative standings · No live ranking</p>
        </aside>
      </div>
      {standings && (
        <Dialog title="Standings" onClose={() => setStandings(false)}>
          <p>{contest.title}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Solved</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row, i) => (
                <tr key={row.name}>
                  <td>{i + 1}</td>
                  <td>
                    {row.name}
                    <small>{row.minutes} minutes · Demo</small>
                  </td>
                  <td>
                    {row.solved}/{contest.problemIds.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">
            Equal solved counts are ranked by the earlier completion time.
            Sample ranking only.
          </p>
          <button className="button" onClick={() => setStandings(false)}>
            Close
          </button>
        </Dialog>
      )}
    </section>
  );
}
