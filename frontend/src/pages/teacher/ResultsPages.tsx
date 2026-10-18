import { TranslatedText } from "../../components/TranslatedText";
import { useLanguage } from "../../context/LanguageContext";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Dialog, ErrorState, Loading } from "../../components/ui";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";
import { useLoad } from "../../components/useLoad";

type ActivityResult = {
  id: string;
  title: string;
  type: "Assignment" | "Contest";
  classes: string;
  submitted: string;
  average: string;
  awaiting: number;
  reviewId?: string;
};



export function ResultsDashboardPage() {
  const { t: tr } = useLanguage("teacher");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [classFilter, setClassFilter] = useState("All classes");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedResultId, setSelectedResultId] = useState("");
  const [page, setPage] = useState(1);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityResult | null>(null);

  const { data: assignments, loading, error } = useLoad(teacherService.getAssignments);

  const filtered = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter((item: any) => {
      const typeStr = item.isContest ? "Contest" : "Assignment";
      return `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
      (classFilter === "All classes" || item.classes.includes(classFilter)) &&
      (typeFilter === "All types" || typeStr === typeFilter) &&
      (statusFilter === "All" || (statusFilter === "Awaiting review" ? item.awaiting > 0 : item.awaiting === 0));
    });
  }, [search, classFilter, typeFilter, statusFilter, assignments]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * 15;
  const pageResults = filtered.slice(firstIndex, firstIndex + 15);
  const selectedResult = pageResults.find((item: any) => item.id === selectedResultId) || pageResults[0] || null;
  useEffect(() => { setPage(1); setSelectedResultId(""); }, [search, classFilter, typeFilter, statusFilter]);
  useEffect(() => { tableScrollRef.current?.scrollTo({ top: 0 }); }, [currentPage, search, classFilter, typeFilter, statusFilter]);

  function openResultDetails(activity: any) {
    setSelectedActivity(activity);
  }

  if (loading) return <div className="teacher-page"><Loading label={tr("Loading results…")} /></div>;
  if (error) return <div className="teacher-page"><TeacherPageIntro compact title={tr("Results")} context={tr("Results unavailable")} /><ErrorState title={tr("Could not load results")} message={tr(error)} onRetry={() => window.location.reload()} /></div>;

  return (
    <section className="teacher-page teacher-results-page compact-teacher-results">
      <h1 className="sr-only"><TranslatedText>{tr("Results")}</TranslatedText></h1>

      <div className="teacher-list-filters teacher-results-filters">
        <TeacherField label={tr("SEARCH")}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Search assignments or contests…")} />
        </TeacherField>
        <TeacherField label={tr("CLASS")}>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="All classes">{tr("All classes")}</option>{Array.from(new Set((assignments || []).flatMap((item: any) => String(item.classes).split(", ")))).filter(name => name && name !== "No classes").map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </TeacherField>
        <TeacherField label={tr("TYPE")}>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="All types">{tr("All types")}</option><option value="Assignment">{tr("Assignment")}</option><option value="Contest">{tr("Contest")}</option>
          </select>
        </TeacherField>
        <TeacherField label={tr("REVIEW STATUS")}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">{tr("All")}</option><option value="Awaiting review">{tr("Awaiting review")}</option><option value="Reviewed">{tr("Reviewed")}</option>
          </select>
        </TeacherField>
      </div>


      <div className="teacher-list-detail-layout teacher-results-detail-layout">
        <div className="teacher-list-detail-main teacher-results-table-wrap">
          <div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap">
            <table className="teacher-table teacher-results-table teacher-activity-results-table sticky-list-table">
              <thead>
                <tr>
                  <th><TranslatedText>{tr("ASSIGNMENT / CONTEST")}</TranslatedText></th><th><TranslatedText>{tr("TYPE")}</TranslatedText></th><th><TranslatedText>{tr("CLASSES")}</TranslatedText></th><th><TranslatedText>{tr("SUBMITTED")}</TranslatedText></th><th><TranslatedText>{tr("AVG SCORE")}</TranslatedText></th><th><TranslatedText>{tr("AWAITING REVIEW")}</TranslatedText></th><th><TranslatedText>{tr("ACTIONS")}</TranslatedText></th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((item) => (
                  <tr
                    className={`teacher-selectable-list-row${selectedResult?.id === item.id ? " is-selected" : ""}`}
                    key={item.id}
                    onClick={() => setSelectedResultId(item.id)}
                  >
                    <td data-label={tr("ASSIGNMENT / CONTEST")}><button className="teacher-selectable-row-title teacher-list-row-title" type="button" aria-label={tr("Show details for {value0}", { value0: item.title })} onClick={(event) => { event.stopPropagation(); setSelectedResultId(item.id); }}>{item.title}</button></td>
                    <td data-label={tr("TYPE")}><TranslatedText>{item.isContest ? tr("Contest") : tr("Assignment")}</TranslatedText></td>
                    <td data-label={tr("CLASSES")}>{item.classes}</td>
                    <td data-label={tr("SUBMITTED")}>{item.submitted}</td>
                    <td data-label={tr("AVG SCORE")}>{item.average}</td>
                    <td data-label={tr("AWAITING REVIEW")} className={item.awaiting ? "teacher-state-warning" : ""}>{item.awaiting}</td>
                    <td data-label={tr("ACTIONS")} className="teacher-list-actions">
                      <button type="button" onClick={() => openResultDetails(item)}><TranslatedText>{tr("Open results")}</TranslatedText></button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={7}><TranslatedText>{tr("No results match these filters.")}</TranslatedText></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="teacher-list-footer teacher-library-pagination">
            <span><TranslatedText>{tr("Showing")}</TranslatedText> {filtered.length ? firstIndex + 1 : 0}–{firstIndex + pageResults.length} <TranslatedText>{tr("of")}</TranslatedText> {filtered.length} <TranslatedText>{tr("items")}</TranslatedText></span>
            <nav aria-label={tr("Results pagination")}>
              <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedResultId(""); }}><TranslatedText>{tr("← Previous")}</TranslatedText></button>
              <span><TranslatedText>{tr("Page")}</TranslatedText> {currentPage} <TranslatedText>{tr("of")}</TranslatedText> {pageCount}</span>
              <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedResultId(""); }}><TranslatedText>{tr("Next →")}</TranslatedText></button>
            </nav>
          </div>
        </div>
        <aside className="teacher-list-detail-panel">
          {selectedResult ? <>
            <span className="teacher-detail-eyebrow"><TranslatedText>{tr("RESULT DETAILS")}</TranslatedText></span>
            <h2>{selectedResult.title}</h2>
            <p className="muted"><TranslatedText>{selectedResult.isContest ? tr("Contest") : tr("Assignment")}</TranslatedText> · {selectedResult.classes}</p>
            <dl className="teacher-list-detail-facts">
              <div><dt><TranslatedText>{tr("Submitted")}</TranslatedText></dt><dd>{selectedResult.submitted}</dd></div>
              <div><dt><TranslatedText>{tr("Average score")}</TranslatedText></dt><dd>{selectedResult.average}</dd></div>
              <div><dt><TranslatedText>{tr("Awaiting review")}</TranslatedText></dt><dd>{selectedResult.awaiting}</dd></div>
            </dl>
            <button className="button primary teacher-list-detail-edit" type="button" onClick={() => openResultDetails(selectedResult)}><TranslatedText>{tr("View submissions")}</TranslatedText></button>
          </> : <p className="muted"><TranslatedText>{tr("Select a result to view its details.")}</TranslatedText></p>}
        </aside>
      </div>
      {selectedActivity && <AssignmentSubmissionsDialog activity={selectedActivity} onClose={() => setSelectedActivity(null)} />}
    </section>
  );
}

function AssignmentSubmissionsDialog({ activity, onClose }: { activity: any, onClose: () => void }) {
  const { t: tr } = useLanguage("teacher");
  const navigate = useNavigate();
  const { data: submissions, loading, error } = useLoad(() => teacherService.getAssignmentSubmissions(activity.id));

  const [studentSearch, setStudentSearch] = useState("");
  const [problemSearch, setProblemSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredSubmissions = useMemo(() => {
    if (!submissions) return [];
    return submissions.filter((sub: any) => {
      const matchStudent = sub.student.toLowerCase().includes(studentSearch.toLowerCase());
      const matchProblem = sub.problem.toLowerCase().includes(problemSearch.toLowerCase());
      const matchStatus = statusFilter === "All statuses" || sub.status === statusFilter;
      return matchStudent && matchProblem && matchStatus;
    });
  }, [submissions, studentSearch, problemSearch, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [studentSearch, problemSearch, statusFilter]);

  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage) || 1;
  const paginatedSubmissions = filteredSubmissions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <Dialog title={activity.title} onClose={onClose}>
      <div className="teacher-preview-dialog" style={{ width: 800, maxWidth: "100%" }}>
        <p><TranslatedText>{activity.isContest ? tr("Contest") : tr("Assignment")}</TranslatedText> · {activity.classes}</p>
        <p>{activity.submitted} <TranslatedText>{tr("submitted ·")}</TranslatedText> {activity.average} <TranslatedText>{tr("average ·")}</TranslatedText> {activity.awaiting} <TranslatedText>{tr("awaiting review")}</TranslatedText></p>

        {loading && <Loading label={tr("Loading submissions…")} />}
        {error && <p className="teacher-state-error"><TranslatedText>{tr("Could not load submissions:")}</TranslatedText> <TranslatedText>{tr(error)}</TranslatedText></p>}
        {submissions && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
              <div>
                <label className="teacher-label" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}><TranslatedText>{tr("STUDENT")}</TranslatedText></label>
                <input type="text" className="teacher-input" style={{ width: "100%", boxSizing: "border-box" }} placeholder={tr("Search student...")} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
              <div>
                <label className="teacher-label" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}><TranslatedText>{tr("PROBLEM")}</TranslatedText></label>
                <input type="text" className="teacher-input" style={{ width: "100%", boxSizing: "border-box" }} placeholder={tr("Search problem...")} value={problemSearch} onChange={e => setProblemSearch(e.target.value)} />
              </div>
              <div>
                <label className="teacher-label" style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}><TranslatedText>{tr("STATUS")}</TranslatedText></label>
                <select className="teacher-input" style={{ width: "100%", boxSizing: "border-box", padding: "0.375rem" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="All statuses">{tr("All statuses")}</option>
                  <option value="Needs review">{tr("Needs review")}</option>
                  <option value="Accepted">{tr("Accepted")}</option>
                  <option value="Partial">{tr("Partial")}</option>
                  <option value="Failed">{tr("Failed")}</option>
                </select>
              </div>
            </div>

            <div className="teacher-table-scroll" style={{ maxHeight: 350, margin: "1rem 0" }}>
              <table className="teacher-table">
                <thead>
                  <tr>
                    <th><TranslatedText>{tr("STUDENT")}</TranslatedText></th>
                    <th><TranslatedText>{tr("PROBLEM")}</TranslatedText></th>
                    <th><TranslatedText>{tr("SCORE")}</TranslatedText></th>
                    <th><TranslatedText>{tr("STATUS")}</TranslatedText></th>
                    <th><TranslatedText>{tr("ACTIONS")}</TranslatedText></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubmissions.map((sub: any) => (
                    <tr key={sub.id}>
                      <td>{sub.student}</td>
                      <td>{sub.problem}</td>
                      <td>{sub.score}</td>
                      <td className={
                        sub.status === "Needs review" || sub.status === "Partial" ? "teacher-state-warning" :
                        sub.status === "Accepted" ? "teacher-state-success" :
                        "teacher-state-failed"
                      }><TranslatedText>{tr(sub.status)}</TranslatedText></td>
                      <td>
                        <button className="button teacher-small-button" type="button" onClick={() => navigate(`/teacher/results/review/${sub.id}`)}><TranslatedText>{tr("Review")}</TranslatedText></button>
                      </td>
                    </tr>
                  ))}
                  {paginatedSubmissions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="teacher-empty-row"><TranslatedText>{tr("No submissions match these filters.")}</TranslatedText></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
              <small className="muted">
                <TranslatedText>{tr("Showing")}</TranslatedText> {filteredSubmissions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredSubmissions.length)} <TranslatedText>{tr("of")}</TranslatedText> {filteredSubmissions.length} <TranslatedText>{tr("results")}</TranslatedText>
              </small>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="button teacher-small-button" type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><TranslatedText>{tr("Previous")}</TranslatedText></button>
                <button className="button teacher-small-button" type="button" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}><TranslatedText>{tr("Next")}</TranslatedText></button>
              </div>
            </div>
          </>
        )}

        <div className="teacher-dialog-actions" style={{ marginTop: "1.5rem" }}>
          <button className="button" type="button" onClick={onClose}><TranslatedText>{tr("Close")}</TranslatedText></button>
        </div>
      </div>
    </Dialog>
  );
}

export function ManualReviewPage() {
  const { t: tr } = useLanguage("teacher");
  const navigate = useNavigate();
  const { submissionId } = useParams();

  const { data: submission, loading, error, mutate: setSubmission } = useLoad(
    () => teacherService.getSubmission(submissionId!)
  );

  const [finalScore, setFinalScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (submission) {
      setFinalScore(submission.finalScore == null ? "" : `${submission.finalScore}`);
      setFeedback(submission.feedback || "");
    }
  }, [submission]);

  async function saveReview() {
    if (!finalScore.trim() || !submission) return;
    const numericScore = Number(finalScore.split("/")[0].trim());
    const max = submission.maxScore ?? 100;
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > max) {
      setSaveError(`Enter a score from 0 to ${max}.`);
      return;
    }
    setSaveError("");
    setIsSaving(true);
    try {
      const updated = await teacherService.updateSubmissionReview(submission.id, numericScore, feedback);
      setSubmission(updated);
      setDialogOpen(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save review.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <div className="teacher-page"><Loading label={tr("Loading submission…")} /></div>;
  if (error || !submission) return <div className="teacher-page"><p className="teacher-state-error"><TranslatedText>{tr("Error loading submission.")}</TranslatedText></p></div>;

  const attemptHistory = [
    { number: 1, score: submission.autoScore, submittedAt: submission.submittedAt, query: submission.query }
  ];
  const activeAttempt = attemptHistory[0];


  return (
    <section className="teacher-page teacher-review-page">
      <TeacherPageIntro
        title={tr("Manual review")}
        context={tr("{value0} / {value1} / {value2} / Submission #{value3}", { value0: submission.student, value1: submission.problem, value2: submission.attempts, value3: submission.id.substring(0, 8) })}
      >
        <Link className="button" to="/teacher/results"><TranslatedText>{tr("Back to results")}</TranslatedText></Link>
        <button className="button primary" type="button" onClick={saveReview} disabled={isSaving}>
          <TranslatedText>{isSaving ? tr("Saving...") : tr("Save review")}</TranslatedText>
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-review-layout">
        <div className="teacher-review-main">
          <div className="teacher-attempt-switcher">
            <span className="teacher-attempt-label"><TranslatedText>{tr("ATTEMPT")}</TranslatedText></span>
            {attemptHistory.map((attempt) => (
              <button
                type="button"
                key={attempt.number}
                className={`teacher-attempt-pill${activeAttempt.number === attempt.number ? " active" : ""}`}
                aria-pressed={activeAttempt.number === attempt.number}
              >
                <TranslatedText>{tr("Attempt")}</TranslatedText> {attempt.number} · {attempt.score} / {submission.maxScore ?? 100}
              </button>
            ))}
          </div>
          <section className="teacher-review-code-section">
            <h2><TranslatedText>{tr("Student SQL · submitted")}</TranslatedText> {activeAttempt.submittedAt}</h2>
            <pre className="teacher-readonly-code"><code>{activeAttempt.query}</code></pre>
          </section>
          <section className="teacher-review-code-section">
            <h2><TranslatedText>{tr("Reference SQL")}</TranslatedText></h2>
            <pre className="teacher-readonly-code"><code>{submission.referenceSolution || tr("No reference solution provided")}</code></pre>
          </section>
          <p className="tiny muted"><TranslatedText>{tr("Per-test-case results are unavailable for this submission.")}</TranslatedText></p>
        </div>
        <aside className="teacher-grading-panel">
          <TeacherSectionTitle title={tr("Grading")} />
          <strong className="teacher-test-summary"><TranslatedText>{tr("Evaluated by platform")}</TranslatedText></strong>
          <p className="teacher-auto-score"><TranslatedText>{tr("Automatic score ·")}</TranslatedText> {activeAttempt.score} / {submission.maxScore ?? 100}</p>
          <TeacherField label={tr("FINAL SCORE")}>
            <input
              type="number"
              min="0"
              max={submission.maxScore ?? 100}
              value={finalScore}
              onChange={(event) => setFinalScore(event.target.value)}
              aria-label={tr("Final score")}
              placeholder={`0–${submission.maxScore ?? 100}`}
              inputMode="numeric"
            />
          </TeacherField>
          <TeacherField label={tr("FEEDBACK")}>
            <textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </TeacherField>
          {saveError && <p className="teacher-state-failed" role="alert"><TranslatedText>{tr(saveError)}</TranslatedText></p>}
          <div className="teacher-review-history">
            <TeacherSectionTitle title={tr("Saved review")} />
            {submission.finalScore !== null ? (
              <p className="tiny muted">
                <TranslatedText>{tr("Saved in database")}</TranslatedText><br />
                <TranslatedText>{tr("Final Score:")}</TranslatedText> {submission.finalScore}<br />
                {submission.feedback && <><TranslatedText>{tr("Feedback:")}</TranslatedText> {submission.feedback}</>}
              </p>
            ) : (
              <p className="tiny muted"><TranslatedText>{tr("No manual changes yet.")}</TranslatedText><br /><TranslatedText>{tr("Your saved review will update the student's score.")}</TranslatedText></p>
            )}
          </div>
        </aside>
      </div>
      {dialogOpen && (
        <Dialog title={tr("Review saved")} onClose={() => setDialogOpen(false)}>
          <p className="tiny"><TranslatedText>{tr("The score has been updated in the database.")}</TranslatedText></p>
          <div className="teacher-dialog-actions">
            <button className="button primary" type="button" onClick={() => { setDialogOpen(false); navigate("/teacher/results"); }}><TranslatedText>{tr("Continue")}</TranslatedText></button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
