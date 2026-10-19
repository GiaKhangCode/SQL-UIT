import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ProblemMarkdown } from "../../components/ProblemMarkdown";
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
  const { t: tr, locale: uiLocale } = useLanguage("student");
  const isComprehensive = contest.examType === "comprehensive";
  const examUrl = `/contests/${encodeURIComponent(contest.id)}/exam`;
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
    isComprehensive ? examUrl : `/workspace/${encodeURIComponent(id)}?source=Contests&context=${encodeURIComponent(contest.id)}` +
    `&contextTitle=${encodeURIComponent(contest.title)}&contest=${encodeURIComponent(contest.id)}` +
    (phase === "Closed" ? "&closed=1" : "") + (contest.aiAllowed ? "&aiAllowed=1" : "");

  return <div className="contest-detail-shell">
    <div className="contest-detail-layout contest-detail-top">
      <div className="contest-detail-intro">
            <header className={`contest-detail-banner ${contestBannerClass(contest.id)} contest-phase-${phase.toLowerCase()}${contest.bannerUrl ? " has-image" : ""}`}
      style={contestBannerStyle(contest.bannerUrl)}>
      <div>
        <small><TranslatedText>{tr(phase).toLocaleUpperCase(uiLocale)}</TranslatedText> <TranslatedText>{tr("CONTEST")}</TranslatedText></small>
        <h1>{contest.title}</h1>
        <p className="tiny">{contest.scope}</p>
        <p className="tiny"><TranslatedText>{tr("Starts")}</TranslatedText> {contest.date} {contest.time} <TranslatedText>{tr("· Ends")}</TranslatedText> {contest.endDate || contest.date} {contest.endTime} · {contest.problemCount} <TranslatedText>{tr("problem")}</TranslatedText><TranslatedText>{contest.problemCount === 1 ? "" : tr("s")}</TranslatedText></p>
      </div>
      <div className="contest-banner-summary">
        {phase === "Upcoming" && <p className="tiny"><TranslatedText>{tr("Starts in")}</TranslatedText> <TranslatedText>{Number.isFinite(starts) ? timeRemaining(starts - now) : tr("Not scheduled")}</TranslatedText></p>}
        {phase === "Live" && <p className="tiny"><TranslatedText>{tr("Ends in")}</TranslatedText> <TranslatedText>{Number.isFinite(ends) ? timeRemaining(ends - now) : tr("Not scheduled")}</TranslatedText></p>}
        {phase === "Closed" && <p className="tiny"><TranslatedText>{tr("Final score ·")}</TranslatedText> {contest.score == null ? tr("Score hidden by instructor") : `${contest.score}/${contest.totalPoints}`}<TranslatedText>{contest.rank ? tr("· Rank {value0}", { value0: contest.rank }) : ""}</TranslatedText></p>}
      </div>
    </header>
        <div className="contest-overview-card">
        <section className="contest-information-section">
          <h2><TranslatedText>{tr("About this contest")}</TranslatedText></h2>
          {contest.shortDescription && <p className="tiny muted">{contest.shortDescription}</p>}
          <ProblemMarkdown className="contest-markdown">{contest.description || tr("No description yet.")}</ProblemMarkdown>
        </section>
        <section className="contest-information-section">
          <h2><TranslatedText>{tr("Contest rules")}</TranslatedText></h2>
          <ProblemMarkdown className="contest-rules tiny muted contest-markdown">{contest.rules || tr("No rules yet.")}</ProblemMarkdown>
        </section>
        </div>
      </div>
            <aside className="contest-participation"><h2><TranslatedText>{tr("Participation")}</TranslatedText></h2><dl>
        <div><dt><TranslatedText>{tr("Participants")}</TranslatedText></dt><dd>{contest.submitters ?? 0}</dd></div>
        {phase === "Live" && <div><dt><TranslatedText>{tr("Your score")}</TranslatedText></dt><dd>{contest.score == null ? tr("Score hidden by instructor") : `${contest.score}/${contest.totalPoints}`}</dd></div>}
        <div><dt><TranslatedText>{tr("AI assistance")}</TranslatedText></dt><dd><TranslatedText>{contest.aiAllowed ? tr("Allowed") : tr("Disabled")}</TranslatedText></dd></div>
        {contest.leaderboardEnabled && phase === "Live" && contest.rank && <div><dt><TranslatedText>{tr("Your rank")}</TranslatedText></dt><dd>#{contest.rank}</dd></div>}
      </dl>
        {isComprehensive && phase === "Live" && (preview
          ? <button className="button primary" type="button" disabled><TranslatedText>{tr("Enter exam →")}</TranslatedText></button>
          : <Link className="button primary" to={examUrl}><TranslatedText>{tr("Enter exam →")}</TranslatedText></Link>)}
        {contest.leaderboardEnabled && phase !== "Upcoming" && <div className="contest-leaderboard"><h3><TranslatedText>{tr("Leaderboard")}</TranslatedText></h3>
          {topLeaderboard.length ? <ol className="contest-leaderboard-scroll" tabIndex={0} aria-label={tr("Top 50 contest participants")}>{topLeaderboard.map((entry, index) => <li key={`${entry.rank}-${entry.student}-${index}`}><span>#{entry.rank} {entry.student}</span><b>{entry.score}</b></li>)}</ol> : <p className="tiny muted"><TranslatedText>{tr("No submissions yet.")}</TranslatedText></p>}
        </div>}
      </aside>
    </div>
    <div className="contest-detail-layout contest-detail-bottom">
      <section className="contest-information-section contest-problems-panel">
          <div className="section-heading"><h2><TranslatedText>{tr("Problems")}</TranslatedText></h2>
            <div className="contest-problem-controls">
              <small className="muted"><TranslatedText>{phase === "Upcoming" || preview ? tr("{value0} problems", { value0: contest.problemCount }) : contest.problemIds.length ? tr("Showing {value0}–{value1} of {value2}", { value0: firstProblemIndex + 1, value1: Math.min(firstProblemIndex + 10, contest.problemIds.length), value2: contest.problemIds.length }) : tr("0 problems")}</TranslatedText></small>
              {!preview && phase !== "Upcoming" && problemPageCount > 1 && <nav aria-label={tr("Contest problem pages")}>
                <button type="button" className="button" disabled={currentProblemPage === 1} onClick={() => setProblemPage(currentProblemPage - 1)}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
                <span><TranslatedText>{tr("Page")}</TranslatedText> {currentProblemPage} <TranslatedText>{tr("of")}</TranslatedText> {problemPageCount}</span>
                <button type="button" className="button" disabled={currentProblemPage === problemPageCount} onClick={() => setProblemPage(currentProblemPage + 1)}><TranslatedText>{tr("Next →")}</TranslatedText></button>
              </nav>}
            </div>
          </div>
          <div className="contest-problem-scroll" ref={problemScroll} tabIndex={0} aria-label={tr("Contest problems")}>
          {phase === "Upcoming" ? <p className="muted"><TranslatedText>{tr("Problems become available when the contest starts.")}</TranslatedText></p> : visibleProblemIds.map((id, pageIndex) => {
            const index = firstProblemIndex + pageIndex;
            const problem = contest.problemDetails.find((item) => item.id === id);
            const content = <><div><b>{String.fromCharCode(65 + index)}. <TranslatedText>{problem?.title || tr("Problem {value0}", { value0: index + 1 })}</TranslatedText></b>
              <small><TranslatedText>{problem ? `${tr(problem.difficulty)} · ${problem.topic}${problem.points == null ? "" : ` · ${problem.points} ${tr("points")}`}` : tr("SQL problem")}</TranslatedText></small></div>
              {!preview && <Status value={attemptsLoading ? "Loading…" : attemptsError ? "Unavailable" : problemAttemptStatus((attempts || []).filter((item) => item.problemId === id))} />}</>;
            return preview
              ? <div className="contest-problem-row" key={id} aria-disabled="true">{content}</div>
              : <button type="button" className={`contest-problem-row contest-problem-select${selectedId === id ? " selected" : ""}`} key={id} aria-pressed={selectedId === id} onClick={() => setSelectedProblemId(id)}>{content}</button>;
          })}
          {phase !== "Upcoming" && !contest.problemIds.length && <p className="muted"><TranslatedText>{tr("No problems selected yet.")}</TranslatedText></p>}
          </div>
        </section>
      {!preview && <aside className="contest-problem-details-panel" aria-label={tr("Selected contest problem details")}>
        <header><h2><TranslatedText>{tr("Problem details")}</TranslatedText></h2></header>
        <div className="contest-selected-problem">
          {phase === "Upcoming" ? <p className="tiny muted"><TranslatedText>{tr("Problems become available when the contest starts.")}</TranslatedText></p> : <>
            {selectedId ? <ContestSelectedProblem key={`${contest.id}:${selectedId}`} problemId={selectedId} contestId={contest.id} summary={selectedProblem} letter={String.fromCharCode(65 + contest.problemIds.indexOf(selectedId))} attempts={(attempts || []).filter((item) => item.problemId === selectedId)} attemptsLoading={attemptsLoading} attemptsError={attemptsError} workspaceUrl={workspace(selectedId)} closed={phase === "Closed"} showScores={contest.showScoresAfterSubmit !== false} /> : <Empty title={tr("No problem selected")} />}
          </>}
        </div>
      </aside>}
    </div>
  </div>;
}

function problemAttemptStatus(attempts: Submission[]) {
  return attempts.some((item) => item.result === "Accepted") ? "Solved" : attempts.length ? "In progress" : "Not submitted";
}

function ContestSelectedProblem({ problemId, contestId, summary, letter, attempts, attemptsLoading, attemptsError, workspaceUrl, closed, showScores }: {
  problemId: string; contestId: string; summary?: Contest["problemDetails"][number]; letter: string; attempts: Submission[]; attemptsLoading: boolean; attemptsError: string; workspaceUrl: string; closed: boolean; showScores: boolean;
}) {
  const { t: tr } = useLanguage("student");
  const { data: problem, loading, error } = useLoad<Problem>(() => studentApi.getProblem(problemId, contestId), [problemId, contestId]);
  const maximum = summary?.points ?? 100;
  const score = Math.round(Math.max(0, ...attempts.map((item) => {
    const max = item.maxScore ?? 100;
    return max > 0 ? ((item.evaluatedScore ?? item.score ?? 0) / max) * maximum : 0;
  })) * 100) / 100;
  const status = problem?.draft && !attempts.length ? "In progress" : problemAttemptStatus(attempts);
  return <>
    <h4><TranslatedText>{tr(letter)}</TranslatedText>. <TranslatedText>{summary?.title || problem?.title || tr("SQL problem")}</TranslatedText></h4>
    <div className="contest-selected-meta"><Status value={attemptsLoading ? "Loading…" : attemptsError ? "Unavailable" : status} /><span><TranslatedText>{tr(summary?.difficulty) || tr(problem?.difficulty)}</TranslatedText></span></div>
    <Link className="button primary" to={workspaceUrl}><TranslatedText>{closed ? tr("Review problem") : status === "In progress" ? tr("Continue solving") : tr("Open problem")}</TranslatedText> →</Link>
    <dl className="contest-selected-facts">
      <div><dt><TranslatedText>{tr("Your best score")}</TranslatedText></dt><dd><TranslatedText>{attemptsLoading ? tr("Loading…") : attemptsError ? tr("Unavailable") : !showScores ? tr("Score hidden by instructor") : `${score}/${maximum}`}</TranslatedText></dd></div>
      <div><dt><TranslatedText>{tr("Submissions")}</TranslatedText></dt><dd><TranslatedText>{attemptsLoading ? "…" : attemptsError ? tr("Unavailable") : attempts.length}</TranslatedText></dd></div>
      <div><dt><TranslatedText>{tr("Topics")}</TranslatedText></dt><dd>{summary?.topic || problem?.topic || "—"}</dd></div>
    </dl>
    {loading ? <Loading label={tr("Loading problem…")} /> : error ? <p className="tiny muted"><TranslatedText>{tr("Problem details could not be loaded. Use Open problem to try again.")}</TranslatedText></p> : problem && <>
      <section><h4><TranslatedText>{tr("Problem")}</TranslatedText></h4><ProblemMarkdown className="contest-markdown">{problem.description || tr("No description available.")}</ProblemMarkdown></section>
      {problem.requirements && <section><h4><TranslatedText>{tr("Requirements")}</TranslatedText></h4><ProblemMarkdown className="contest-markdown">{problem.requirements}</ProblemMarkdown></section>}
    </>}
  </>;
}
