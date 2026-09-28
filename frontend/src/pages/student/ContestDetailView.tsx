import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Status } from "../../components/ui";
import type { Contest } from "../../data/models";
import { parseServerDateTime } from "../../utils/serverDateTime";

export type ContestPhase = "Upcoming" | "Live" | "Closed";

function timeRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function ContestDetailView({ contest, phase, now, preview = false }: {
  contest: Contest;
  phase: ContestPhase;
  now: number;
  preview?: boolean;
}) {
  const starts = parseServerDateTime(contest.opensAt).getTime();
  const ends = parseServerDateTime(contest.closesAt).getTime();
  const workspace = (id: string) =>
    `/workspace/${encodeURIComponent(id)}?source=Contests&context=${encodeURIComponent(contest.id)}` +
    `&contextTitle=${encodeURIComponent(contest.title)}&contest=${encodeURIComponent(contest.id)}` +
    (phase === "Closed" ? "&closed=1" : "") + (contest.aiAllowed ? "&aiAllowed=1" : "");

  return <>
    <header className={`contest-detail-banner contest-phase-${phase.toLowerCase()}${contest.bannerUrl ? " has-image" : ""}`}
      style={contest.bannerUrl ? { backgroundImage: `linear-gradient(90deg, rgba(14, 14, 51, .82), rgba(14, 14, 51, .48)), url("${contest.bannerUrl}")` } : undefined}>
      <div>
        <small>{phase.toUpperCase()} CONTEST</small>
        <h1>{contest.title}</h1>
        <p className="tiny">{contest.scope}</p>
        <p className="tiny">Starts {contest.date} {contest.time} · Ends {contest.endDate || contest.date} {contest.endTime} · {contest.problemCount} problem{contest.problemCount === 1 ? "" : "s"}</p>
      </div>
      <div className="contest-banner-summary">
        {phase === "Upcoming" && <p className="tiny">Starts in {Number.isFinite(starts) ? timeRemaining(starts - now) : "Not scheduled"}</p>}
        {phase === "Live" && <p className="tiny">Time remaining · {Number.isFinite(ends) ? timeRemaining(ends - now) : "Not scheduled"}</p>}
        {phase === "Closed" && <p className="tiny">Final score · {contest.score}/{contest.totalPoints}{contest.rank ? ` · Rank ${contest.rank}` : ""}</p>}
        {phase !== "Upcoming" && contest.problemIds.length > 0 && (preview
          ? <button className="button" type="button" disabled aria-label={`${phase === "Live" ? "Enter contest" : "Review problems"} unavailable in preview`}>{phase === "Live" ? "Enter contest" : "Review problems"} →</button>
          : <Link className="button" to={workspace(contest.problemIds[0])}>{phase === "Live" ? "Enter contest" : "Review problems"} →</Link>)}
      </div>
    </header>
    <div className="contest-detail-layout">
      <div>
        <section className="contest-information-section">
          <h2>About this contest</h2>
          {contest.shortDescription && <p className="tiny muted">{contest.shortDescription}</p>}
          <div className="contest-markdown"><ReactMarkdown skipHtml>{contest.description || "No description yet."}</ReactMarkdown></div>
        </section>
        <section className="contest-information-section"><h2>Contest rules</h2><p className="contest-rules tiny muted">{contest.rules || "No rules yet."}</p></section>
        <section className="contest-information-section">
          <div className="section-heading"><h2>Problems</h2><small className="muted">{contest.problemCount} problems</small></div>
          {phase === "Upcoming" ? <p className="muted">Problems become available when the contest starts.</p> : contest.problemIds.map((id, index) => {
            const problem = contest.problemDetails.find((item) => item.id === id);
            const content = <><div><b>{String.fromCharCode(65 + index)}. {problem?.title || `Problem ${index + 1}`}</b>
              <small>{problem ? `${problem.difficulty} · ${problem.topic}${problem.points == null ? "" : ` · ${problem.points} points`}` : "SQL problem"}</small></div>
              <span>{phase === "Closed" ? "Review" : "Open problem"} →</span></>;
            return preview
              ? <div className="contest-problem-row" key={id} aria-disabled="true">{content}</div>
              : <Link className="contest-problem-row" key={id} to={workspace(id)}>{content}</Link>;
          })}
          {phase !== "Upcoming" && !contest.problemIds.length && <p className="muted">No problems selected yet.</p>}
        </section>
      </div>
      <aside className="contest-participation"><h2>Participation</h2><dl>
        <div><dt>Status</dt><dd><Status value={phase} /></dd></div>
        <div><dt>Participants</dt><dd>{contest.submitters ?? 0}</dd></div>
        {phase !== "Upcoming" && <div><dt>Your score</dt><dd>{contest.score}/{contest.totalPoints}</dd></div>}
        <div><dt>AI assistance</dt><dd>{contest.aiAllowed ? "Allowed" : "Disabled"}</dd></div>
        {contest.leaderboardEnabled && phase !== "Upcoming" && contest.rank && <div><dt>Your rank</dt><dd>#{contest.rank}</dd></div>}
      </dl>
        {contest.leaderboardEnabled && phase !== "Upcoming" && <div className="contest-leaderboard"><h3>Leaderboard</h3>
          {contest.leaderboard.length ? <ol>{contest.leaderboard.map((entry, index) => <li key={`${entry.rank}-${entry.student}-${index}`}><span>#{entry.rank} {entry.student}</span><b>{entry.score}</b></li>)}</ol> : <p className="tiny muted">No submissions yet.</p>}
        </div>}
      </aside>
    </div>
  </>;
}
