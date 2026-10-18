import { TranslatedText } from "../../components/TranslatedText";
import { LanguageText } from "../../components/LanguageSwitch";
import { useLanguage } from "../../context/LanguageContext";
import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../../services/studentApi";
import { useLoad } from "../../components/useLoad";
import { ErrorState, Loading, Status } from "../../components/ui";
import { Activity } from "../../components/Activity";
import { formatLocalDate } from "../../utils/serverDateTime";
function ContinueProblemDetails({ problemId }: { problemId: string }) {
  const { t: tr } = useLanguage("student");
  const { t, locale } = useLanguage();
  const { data: problem, loading, error } = useLoad(() => studentApi.getProblem(problemId), [problemId]);
  if (loading) return <Loading label={t("Loading problem details\u2026")} />;
  if (error || !problem) return <ErrorState title={t("Could not load problem details")} message={tr(error) || t("Please try again.")} onRetry={() => window.location.reload()} />;
  const topics = Array.isArray(problem.topics) && problem.topics.length ? problem.topics.join(" · ") : problem.topic || "—";
  return <>
    <div className="continue-detail-header">
    <h2>{problem.number}. {problem.title}</h2>
    <div className="continue-detail-meta"><Status value={problem.progress || "In progress"} /><span><TranslatedText>{t(problem.difficulty)}</TranslatedText></span></div>
    <Link className="button primary" to={"/workspace/" + problemId}><LanguageText text="Continue solving →" order={2} /></Link>
    </div>
    <dl className="continue-detail-facts">
      <div><dt><TranslatedText>{t("Topics")}</TranslatedText></dt><dd>{topics}</dd></div>
      <div><dt><TranslatedText>{t("Database")}</TranslatedText></dt><dd>{problem.databaseType || "SQL Server"}</dd></div>
    </dl>
    {problem.description && <section><h3><TranslatedText>{t("Problem")}</TranslatedText></h3><p>{problem.description}</p></section>}
    {problem.requirements && <section><h3><TranslatedText>{t("Requirements")}</TranslatedText></h3><p>{problem.requirements}</p></section>}
  </>;
}

const CONTINUE_PAGE_SIZE = 10;

export function DashboardPage() {
  const { t: tr } = useLanguage("student");
  const { t, locale } = useLanguage();
  const { data, loading, error } = useLoad(studentApi.getDashboard);
  const location = useLocation();
  const [selectedProblemId, setSelectedProblemId] = useState("");
  const [continuePage, setContinuePage] = useState(1);
  const learningRef = useRef<HTMLDivElement>(null);
  if (loading) return <section className="page dashboard-page dashboard-reordered"><Loading label={t("Loading dashboard\u2026")} /></section>;
  if (error || !data) return <section className="page dashboard-page dashboard-reordered"><ErrorState title={t("Dashboard unavailable")} message={tr(error) || t("Could not load dashboard.")} onRetry={() => window.location.reload()} /></section>;
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
        <p className="welcome-message" role="status"><TranslatedText>{t("Account created. Welcome to your Student workspace.")}</TranslatedText></p>
      )}
      <div className="dashboard-layout">
        <div>
      <section className="activity-section dashboard-activity-card">
        <div className="section-heading dashboard-activity-heading">
          <div>
            <h2><LanguageText text="SQL activity" order={2} /></h2>
            <small className="muted">
              {(() => {
                const today = new Date();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setDate(today.getDate() - 26 * 7);
                return `${sixMonthsAgo.toLocaleString(locale, { month: "short" })} ${sixMonthsAgo.getDate()} – ${today.toLocaleString(locale, { month: "short" })} ${today.getDate()}, ${today.getFullYear()}`;
              })()}
            </small>
          </div>
        </div>
        <div className="dashboard-activity-body">
          <div className="dashboard-activity-stats">
            <div className="dashboard-solved">
              <b>{data.solved}</b>
              <span><TranslatedText>{t("problems solved")}</TranslatedText></span>
            </div>
            <p>
              <span><TranslatedText>{t("● Easy")}</TranslatedText></span>
              <strong>{data.easy}</strong>
            </p>
            <p>
              <span><TranslatedText>{t("● Medium")}</TranslatedText></span>
              <strong>{data.medium}</strong>
            </p>
            <p>
              <span><TranslatedText>{t("● Hard")}</TranslatedText></span>
              <strong>{data.hard}</strong>
            </p>
            <small><TranslatedText>{t("Current streak: {count} days", { count: data.currentStreak })}</TranslatedText></small>
          </div>
          <Activity submissions={data.submissionsPerDay} />
        </div>
      </section>
        </div>
        <aside className="dashboard-deadlines deadline-panel">
          <div className="dashboard-deadlines-heading"><h2><LanguageText text="Deadlines" order={2} /></h2><span><TranslatedText>{t("{count} upcoming", { count: data.deadlines.length })}</TranslatedText></span></div>
          <div className="deadline-scroll" tabIndex={0} aria-label={t("Upcoming deadlines")}>
            {data.deadlines.map((item) => <Link className="dashboard-deadline-row" key={item.id} to={item.to}><time><b>{new Date(item.date + "T00:00:00").toLocaleString(locale, { month: "short" }).toUpperCase()}</b><strong>{item.date.slice(8)}</strong></time><span><b>{item.title}</b><small><TranslatedText>{tr(item.kind)}</TranslatedText> · {item.context}</small></span><em>{item.time}</em></Link>)}
            {data.deadlinesError ? <p className="tiny muted" role="alert">{data.deadlinesError}</p> : !data.deadlines.length && <p className="tiny muted"><TranslatedText>{t("No upcoming deadlines.")}</TranslatedText></p>}
          </div>
          <div className="dashboard-week">
            <div><b><TranslatedText>{t("This week")}</TranslatedText></b><Link to="/assignments"><TranslatedText>{t("Open calendar")}</TranslatedText></Link></div>
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
                    <small>{(locale === "vi-VN" ? ["T2","T3","T4","T5","T6","T7","CN"] : ["M","T","W","T","F","S","S"])[i]}</small>
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
            <h1><LanguageText text="Continue learning" order={2} /></h1>
            <div className="dashboard-continue-controls">
              <span aria-live="polite" className="muted"><TranslatedText>{t("Showing {start}–{end} of {total}", { start: data.continuing.length ? firstIndex + 1 : 0, end: Math.min(firstIndex + CONTINUE_PAGE_SIZE, data.continuing.length), total: data.continuing.length })}</TranslatedText></span>
              <nav className="dashboard-continue-pagination" aria-label={t("Continue learning pages")}>
                <button type="button" className="button" disabled={currentPage === 1} onClick={() => changeContinuePage(currentPage - 1)}><TranslatedText>{t("← Previous")}</TranslatedText></button>
                <span><TranslatedText>{t("Page {page} of {total}", { page: currentPage, total: pageCount })}</TranslatedText></span>
                <button type="button" className="button" disabled={currentPage === pageCount} onClick={() => changeContinuePage(currentPage + 1)}><TranslatedText>{t("Next →")}</TranslatedText></button>
              </nav>
            </div>
          </div>
          <div className="learning-scroll" ref={learningRef} tabIndex={0} aria-label={t("Continue learning problems")}>
            {pageProblems.map((problem) => (
              <button type="button" className={"continue-row continue-select-row" + (selectedProblem?.id === problem.id ? " selected" : "")} key={problem.id} aria-pressed={selectedProblem?.id === problem.id} onClick={() => setSelectedProblemId(problem.id)}>
                <span className="continue-info">
                  <b><span className="continue-problem-number">{problem.number}.</span> {problem.title}</b>
                  <small className="continue-meta"><span><TranslatedText>{problem.topic || tr("SQL practice")}</TranslatedText></span><span aria-hidden="true">·</span><span><TranslatedText>{t(problem.difficulty)}</TranslatedText></span></small>
                </span>
                <Status value="In progress" />
              </button>
            ))}
            {!data.continuing.length && <div className="empty-state"><h3><TranslatedText>{t("No work in progress")}</TranslatedText></h3><p><TranslatedText>{t("Browse Practice to start a SQL problem.")}</TranslatedText></p></div>}
          </div>
        </section>
        <aside className="dashboard-continue-details" aria-label={t("Selected problem details")}>
          {selectedProblem ? <ContinueProblemDetails key={selectedProblem.id} problemId={selectedProblem.id} /> : <p className="muted"><TranslatedText>{t("Select a problem to view details.")}</TranslatedText></p>}
        </aside>
      </div>
    </section>
  );
}
