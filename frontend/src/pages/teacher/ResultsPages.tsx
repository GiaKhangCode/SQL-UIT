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

  if (loading) return <div className="teacher-page"><Loading label="Loading results…" /></div>;
  if (error) return <div className="teacher-page"><TeacherPageIntro compact title="Results" context="Results unavailable" /><ErrorState title="Could not load results" message={error} onRetry={() => window.location.reload()} /></div>;

  return (
    <section className="teacher-page teacher-results-page compact-teacher-results">
      <h1 className="sr-only">Results</h1>

      <div className="teacher-list-filters teacher-results-filters">
        <TeacherField label="SEARCH">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assignments or contests…" />
        </TeacherField>
        <TeacherField label="CLASS">
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option>All classes</option>{Array.from(new Set((assignments || []).flatMap((item: any) => String(item.classes).split(", ")))).filter(name => name && name !== "No classes").map(name => <option key={name}>{name}</option>)}
          </select>
        </TeacherField>
        <TeacherField label="TYPE">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option>All types</option><option>Assignment</option><option>Contest</option>
          </select>
        </TeacherField>
        <TeacherField label="REVIEW STATUS">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All</option><option>Awaiting review</option><option>Reviewed</option>
          </select>
        </TeacherField>
      </div>


      <div className="teacher-list-detail-layout teacher-results-detail-layout">
        <div className="teacher-list-detail-main teacher-results-table-wrap">
          <div ref={tableScrollRef} className="teacher-table-scroll teacher-list-table-scroll sticky-list-table-wrap">
            <table className="teacher-table teacher-results-table teacher-activity-results-table sticky-list-table">
              <thead>
                <tr>
                  <th>ASSIGNMENT / CONTEST</th><th>TYPE</th><th>CLASSES</th><th>SUBMITTED</th><th>AVG SCORE</th><th>AWAITING REVIEW</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pageResults.map((item) => (
                  <tr
                    className={`teacher-selectable-list-row${selectedResult?.id === item.id ? " is-selected" : ""}`}
                    key={item.id}
                    onClick={() => setSelectedResultId(item.id)}
                  >
                    <td data-label="ASSIGNMENT / CONTEST"><button className="teacher-selectable-row-title teacher-list-row-title" type="button" aria-label={`Show details for ${item.title}`} onClick={(event) => { event.stopPropagation(); setSelectedResultId(item.id); }}>{item.title}</button></td>
                    <td data-label="TYPE">{item.isContest ? "Contest" : "Assignment"}</td>
                    <td data-label="CLASSES">{item.classes}</td>
                    <td data-label="SUBMITTED">{item.submitted}</td>
                    <td data-label="AVG SCORE">{item.average}</td>
                    <td data-label="AWAITING REVIEW" className={item.awaiting ? "teacher-state-warning" : ""}>{item.awaiting}</td>
                    <td data-label="ACTIONS" className="teacher-list-actions">
                      <button type="button" onClick={() => openResultDetails(item)}>Open results</button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td className="teacher-empty-row" colSpan={7}>No results match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="teacher-list-footer teacher-library-pagination">
            <span>Showing {filtered.length ? firstIndex + 1 : 0}–{firstIndex + pageResults.length} of {filtered.length} items</span>
            <nav aria-label="Results pagination">
              <button className="button" type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedResultId(""); }}>← Previous</button>
              <span>Page {currentPage} of {pageCount}</span>
              <button className="button" type="button" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedResultId(""); }}>Next →</button>
            </nav>
          </div>
        </div>
        <aside className="teacher-list-detail-panel">
          {selectedResult ? <>
            <span className="teacher-detail-eyebrow">RESULT DETAILS</span>
            <h2>{selectedResult.title}</h2>
            <p className="muted">{selectedResult.isContest ? "Contest" : "Assignment"} · {selectedResult.classes}</p>
            <dl className="teacher-list-detail-facts">
              <div><dt>Submitted</dt><dd>{selectedResult.submitted}</dd></div>
              <div><dt>Average score</dt><dd>{selectedResult.average}</dd></div>
              <div><dt>Awaiting review</dt><dd>{selectedResult.awaiting}</dd></div>
            </dl>
            <button className="button primary teacher-list-detail-edit" type="button" onClick={() => openResultDetails(selectedResult)}>View submissions</button>
          </> : <p className="muted">Select a result to view its details.</p>}
        </aside>
      </div>
      {selectedActivity && <AssignmentSubmissionsDialog activity={selectedActivity} onClose={() => setSelectedActivity(null)} />}
    </section>
  );
}

function AssignmentSubmissionsDialog({ activity, onClose }: { activity: any, onClose: () => void }) {
  const navigate = useNavigate();
  const { data: submissions, loading, error } = useLoad(() => teacherService.getAssignmentSubmissions(activity.id));

  return (
    <Dialog title={activity.title} onClose={onClose}>
      <div className="teacher-preview-dialog" style={{ width: 600, maxWidth: "100%" }}>
        <p>{activity.isContest ? "Contest" : "Assignment"} · {activity.classes}</p>
        <p>{activity.submitted} submitted · {activity.average} average · {activity.awaiting} awaiting review</p>
        
        {loading && <Loading label="Loading submissions…" />}
        {error && <p className="teacher-state-error">Could not load submissions: {error}</p>}
        {submissions && (
          <div className="teacher-table-scroll" style={{ maxHeight: 300, margin: "1rem 0" }}>
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>PROBLEM</th>
                  <th>SCORE</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub: any) => (
                  <tr key={sub.id}>
                    <td>{sub.student}</td>
                    <td>{sub.problem}</td>
                    <td>{sub.score}</td>
                    <td className={
                      sub.status === "Needs review" || sub.status === "Partial" ? "teacher-state-warning" : 
                      sub.status === "Accepted" ? "teacher-state-success" : 
                      "teacher-state-failed"
                    }>{sub.status}</td>
                    <td>
                      <button className="button teacher-small-button" type="button" onClick={() => navigate(`/teacher/results/review/${sub.id}`)}>Review</button>
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="teacher-empty-row">No submissions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="teacher-dialog-actions">
          <button className="button" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </Dialog>
  );
}

export function ManualReviewPage() {
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

  if (loading) return <div className="teacher-page"><Loading label="Loading submission…" /></div>;
  if (error || !submission) return <div className="teacher-page"><p className="teacher-state-error">Error loading submission.</p></div>;

  const attemptHistory = [
    { number: 1, score: submission.autoScore, submittedAt: submission.submittedAt, query: submission.query }
  ];
  const activeAttempt = attemptHistory[0];


  return (
    <section className="teacher-page teacher-review-page">
      <TeacherPageIntro
        title="Manual review"
        context={`${submission.student} / ${submission.problem} / ${submission.attempts} / Submission #${submission.id.substring(0, 8)}`}
      >
        <Link className="button" to="/teacher/results">Back to results</Link>
        <button className="button primary" type="button" onClick={saveReview} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save review"}
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-review-layout">
        <div className="teacher-review-main">
          <div className="teacher-attempt-switcher">
            <span className="teacher-attempt-label">ATTEMPT</span>
            {attemptHistory.map((attempt) => (
              <button
                type="button"
                key={attempt.number}
                className={`teacher-attempt-pill${activeAttempt.number === attempt.number ? " active" : ""}`}
                aria-pressed={activeAttempt.number === attempt.number}
              >
                Attempt {attempt.number} · {attempt.score} / {submission.maxScore ?? 100}
              </button>
            ))}
          </div>
          <section className="teacher-review-code-section">
            <h2>Student SQL · submitted {activeAttempt.submittedAt}</h2>
            <pre className="teacher-readonly-code"><code>{activeAttempt.query}</code></pre>
          </section>
          <section className="teacher-review-code-section">
            <h2>Reference SQL</h2>
            <pre className="teacher-readonly-code"><code>{submission.referenceSolution || "No reference solution provided"}</code></pre>
          </section>
          <p className="tiny muted">Per-test-case results are unavailable for this submission.</p>
        </div>
        <aside className="teacher-grading-panel">
          <TeacherSectionTitle title="Grading" />
          <strong className="teacher-test-summary">Evaluated by platform</strong>
          <p className="teacher-auto-score">Automatic score · {activeAttempt.score} / {submission.maxScore ?? 100}</p>
          <TeacherField label="FINAL SCORE">
            <input
              type="number"
              min="0"
              max={submission.maxScore ?? 100}
              value={finalScore}
              onChange={(event) => setFinalScore(event.target.value)}
              aria-label="Final score"
              placeholder={`0–${submission.maxScore ?? 100}`}
              inputMode="numeric"
            />
          </TeacherField>
          <TeacherField label="FEEDBACK">
            <textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </TeacherField>
          {saveError && <p className="teacher-state-failed" role="alert">{saveError}</p>}
          <div className="teacher-review-history">
            <TeacherSectionTitle title="Saved review" />
            {submission.finalScore !== null ? (
              <p className="tiny muted">
                Saved in database<br />
                Final Score: {submission.finalScore}<br />
                {submission.feedback && <>Feedback: {submission.feedback}</>}
              </p>
            ) : (
              <p className="tiny muted">No manual changes yet.<br />Your saved review will update the student's score.</p>
            )}
          </div>
        </aside>
      </div>
      {dialogOpen && (
        <Dialog title="Review saved" onClose={() => setDialogOpen(false)}>
          <p className="tiny">The score has been updated in the database.</p>
          <div className="teacher-dialog-actions">
            <button className="button primary" type="button" onClick={() => { setDialogOpen(false); navigate("/teacher/results"); }}>Continue</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
