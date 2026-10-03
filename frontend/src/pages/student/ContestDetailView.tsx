import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Empty, Loading, Status } from "../../components/ui";
import { useLoad } from "../../components/useLoad";
import { studentApi } from "../../services/studentApi";
import type { Contest, Problem, Submission } from "../../data/models";
import { parseServerDateTime } from "../../utils/serverDateTime";
import { contestBannerClass, contestBannerStyle } from "../../utils/contestBanner";

export type ContestPhase = "Upcoming" | "Live" | "Closed";

function timeRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function ContestDetailView({ contest, phase, now, preview = false }: {
  contest: Contest;
  phase: ContestPhase;
  now: number;
  preview?: boolean;
}) {
  const [problemPage, setProblemPage] = useState(1);
  const problemScroll = useRef<HTMLDivElement>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const { data: attempts, loading: attemptsLoading, error: attemptsError } = useLoad<Submission[]>(
    () => preview || phase === "Upcoming" ? Promise.resolve([]) : studentApi.getSubmissions({ source: "Contests" }).then((items: Submission[]) => items.filter((item) => item.context === contest.id)),
    [contest.id, preview, phase === "Upcoming"],
  );
  const problemPageCount = Math.max(1, Math.ceil(contest.problemIds.length / 10));
  const currentProblemPage = Math.min(problemPage, problemPageCount);
  const firstProblemIndex = preview ? 0 : (currentProblemPage - 1) * 10;
  const visibleProblemIds = preview ? contest.problemIds : contest.problemIds.slice(firstProblemIndex, firstProblemIndex + 10);
  useEffect(() => { setProblemPage(1); setSelectedProblemId(null); }, [contest.id]);
  useEffect(() => { problemScroll.current?.scrollTo({ top: 0 }); }, [currentProblemPage, contest.id]);
  const starts = parseServerDateTime(contest.opensAt).getTime();
  const selectedId = phase === "Upcoming" || preview ? null : selectedProblemId && visibleProblemIds.includes(selectedProblemId) ? selectedProblemId : visibleProblemIds[0] || null;
  const selectedProblem = contest.problemDetails.find((item) => item.id === selectedId);
  const ends = parseServerDateTime(contest.closesAt).getTime();
  const topLeaderboard = [...contest.leaderboard].sort((a, b) => a.rank - b.rank).slice(0, 50);
  const workspace = (id: string) =>
    `/workspace/${encodeURIComponent(id)}?source=Contests&context=${encodeURIComponent(contest.id)}` +
    `&contextTitle=${encodeURIComponent(contest.title)}&contest=${encodeURIComponent(contest.id)}` +
    (phase === "Closed" ? "&closed=1" : "") + (contest.aiAllowed ? "&aiAllowed=1" : "");

  return <div className="contest-detail-shell">
    <div className="contest-detail-layout contest-detail-top">
      <div className="contest-detail-intro">
            <header className={`contest-detail-banner ${contestBannerClass(contest.id)} contest-phase-${phase.toLowerCase()}${contest.bannerUrl ? " has-image" : ""}`}
      style={contestBannerStyle(contest.bannerUrl)}>
      <div>
        <small>{phase.toUpperCase()} CONTEST</small>
        <h1>{contest.title}</h1>
        <p className="tiny">{contest.scope}</p>
        <p className="tiny">Starts {contest.date} {contest.time} · Ends {contest.endDate || contest.date} {contest.endTime} · {contest.problemCount} problem{contest.problemCount === 1 ? "" : "s"}</p>
      </div>
      <div className="contest-banner-summary">
        {phase === "Upcoming" && <p className="tiny">Starts in {Number.isFinite(starts) ? timeRemaining(starts - now) : "Not scheduled"}</p>}
        {phase === "Live" && <p className="tiny">Ends in {Number.isFinite(ends) ? timeRemaining(ends - now) : "Not scheduled"}</p>}
        {phase === "Closed" && <p className="tiny">Final score · {contest.score}/{contest.totalPoints}{contest.rank ? ` · Rank ${contest.rank}` : ""}</p>}
      </div>
    </header>
        <div className="contest-overview-card">
        <section className="contest-information-section">
          <h2>About this contest</h2>
          {contest.shortDescription && <p className="tiny muted">{contest.shortDescription}</p>}
          <div className="contest-markdown"><ReactMarkdown skipHtml>{contest.description || "No description yet."}</ReactMarkdown></div>
        </section>
        <section className="contest-information-section"><h2>Contest rules</h2><p className="contest-rules tiny muted">{contest.rules || "No rules yet."}</p></section>
        </div>
      </div>
            <aside className="contest-participation"><h2>Participation</h2><dl>
        <div><dt>Participants</dt><dd>{contest.submitters ?? 0}</dd></div>
        {phase === "Live" && <div><dt>Your score</dt><dd>{contest.score}/{contest.totalPoints}</dd></div>}
        <div><dt>AI assistance</dt><dd>{contest.aiAllowed ? "Allowed" : "Disabled"}</dd></div>
        {contest.leaderboardEnabled && phase === "Live" && contest.rank && <div><dt>Your rank</dt><dd>#{contest.rank}</dd></div>}
      </dl>
        {contest.leaderboardEnabled && phase !== "Upcoming" && <div className="contest-leaderboard"><h3>Leaderboard</h3>
          {topLeaderboard.length ? <ol className="contest-leaderboard-scroll" tabIndex={0} aria-label="Top 50 contest participants">{topLeaderboard.map((entry, index) => <li key={`${entry.rank}-${entry.student}-${index}`}><span>#{entry.rank} {entry.student}</span><b>{entry.score}</b></li>)}</ol> : <p className="tiny muted">No submissions yet.</p>}
        </div>}
      </aside>
    </div>
    <div className="contest-detail-layout contest-detail-bottom">
      <section className="contest-information-section contest-problems-panel">
          <div className="section-heading"><h2>Problems</h2>
            <div className="contest-problem-controls">
              <small className="muted">{phase === "Upcoming" || preview ? `${contest.problemCount} problems` : contest.problemIds.length ? `Showing ${firstProblemIndex + 1}–${Math.min(firstProblemIndex + 10, contest.problemIds.length)} of ${contest.problemIds.length}` : "0 problems"}</small>
              {!preview && phase !== "Upcoming" && problemPageCount > 1 && <nav aria-label="Contest problem pages">
                <button type="button" className="button" disabled={currentProblemPage === 1} onClick={() => setProblemPage(currentProblemPage - 1)}>← Previous</button>
                <span>Page {currentProblemPage} of {problemPageCount}</span>
                <button type="button" className="button" disabled={currentProblemPage === problemPageCount} onClick={() => setProblemPage(currentProblemPage + 1)}>Next →</button>
              </nav>}
            </div>
          </div>
          <div className="contest-problem-scroll" ref={problemScroll} tabIndex={0} aria-label="Contest problems">
          {phase === "Upcoming" ? <p className="muted">Problems become available when the contest starts.</p> : visibleProblemIds.map((id, pageIndex) => {
            const index = firstProblemIndex + pageIndex;
            const problem = contest.problemDetails.find((item) => item.id === id);
            const content = <><div><b>{String.fromCharCode(65 + index)}. {problem?.title || `Problem ${index + 1}`}</b>
              <small>{problem ? `${problem.difficulty} · ${problem.topic}${problem.points == null ? "" : ` · ${problem.points} points`}` : "SQL problem"}</small></div>
              {!preview && <Status value={attemptsLoading ? "Loading…" : attemptsError ? "Unavailable" : problemAttemptStatus((attempts || []).filter((item) => item.problemId === id))} />}</>;
            return preview
              ? <div className="contest-problem-row" key={id} aria-disabled="true">{content}</div>
              : <button type="button" className={`contest-problem-row contest-problem-select${selectedId === id ? " selected" : ""}`} key={id} aria-pressed={selectedId === id} onClick={() => setSelectedProblemId(id)}>{content}</button>;
          })}
          {phase !== "Upcoming" && !contest.problemIds.length && <p className="muted">No problems selected yet.</p>}
          </div>
        </section>
      {!preview && <aside className="contest-problem-details-panel" aria-label="Selected contest problem details">
        <header><h2>Problem details</h2></header>
        <div className="contest-selected-problem">
          {phase === "Upcoming" ? <p className="tiny muted">Problems become available when the contest starts.</p> : <>
            {selectedId ? <ContestSelectedProblem key={`${contest.id}:${selectedId}`} problemId={selectedId} contestId={contest.id} summary={selectedProblem} letter={String.fromCharCode(65 + contest.problemIds.indexOf(selectedId))} attempts={(attempts || []).filter((item) => item.problemId === selectedId)} attemptsLoading={attemptsLoading} attemptsError={attemptsError} workspaceUrl={workspace(selectedId)} closed={phase === "Closed"} /> : <Empty title="No problem selected" />}
          </>}
        </div>
      </aside>}
    </div>
  </div>;
}

function problemAttemptStatus(attempts: Submission[]) {
  return attempts.some((item) => item.result === "Accepted") ? "Solved" : attempts.length ? "In progress" : "Not submitted";
}

function ContestSelectedProblem({ problemId, contestId, summary, letter, attempts, attemptsLoading, attemptsError, workspaceUrl, closed }: {
  problemId: string; contestId: string; summary?: Contest["problemDetails"][number]; letter: string; attempts: Submission[]; attemptsLoading: boolean; attemptsError: string; workspaceUrl: string; closed: boolean;
}) {
  const { data: problem, loading, error } = useLoad<Problem>(() => studentApi.getProblem(problemId, contestId), [problemId, contestId]);
  const maximum = summary?.points ?? 100;
  const score = Math.round(Math.max(0, ...attempts.map((item) => {
    const max = item.maxScore ?? 100;
    return max > 0 ? ((item.evaluatedScore ?? item.score) / max) * maximum : 0;
  })) * 100) / 100;
  const status = problem?.draft && !attempts.length ? "In progress" : problemAttemptStatus(attempts);
  return <>
    <h4>{letter}. {summary?.title || problem?.title || "SQL problem"}</h4>
    <div className="contest-selected-meta"><Status value={attemptsLoading ? "Loading…" : attemptsError ? "Unavailable" : status} /><span>{summary?.difficulty || problem?.difficulty}</span></div>
    <Link className="button primary" to={workspaceUrl}>{closed ? "Review problem" : status === "In progress" ? "Continue solving" : "Open problem"} →</Link>
    <dl className="contest-selected-facts">
      <div><dt>Your best score</dt><dd>{attemptsLoading ? "Loading…" : attemptsError ? "Unavailable" : `${score}/${maximum}`}</dd></div>
      <div><dt>Submissions</dt><dd>{attemptsLoading ? "…" : attemptsError ? "Unavailable" : attempts.length}</dd></div>
      <div><dt>Topics</dt><dd>{summary?.topic || problem?.topic || "—"}</dd></div>
    </dl>
    {loading ? <Loading label="Loading problem…" /> : error ? <p className="tiny muted">Problem details could not be loaded. Use Open problem to try again.</p> : problem && <>
      <section><h4>Problem</h4><div className="contest-markdown"><ReactMarkdown skipHtml>{problem.description || "No description available."}</ReactMarkdown></div></section>
      {problem.requirements && <section><h4>Requirements</h4><div className="contest-markdown"><ReactMarkdown skipHtml>{problem.requirements}</ReactMarkdown></div></section>}
    </>}
  </>;
}
