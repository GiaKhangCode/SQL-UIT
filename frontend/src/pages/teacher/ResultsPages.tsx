import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Dialog } from "../../components/ui";
import {
  readTeacherDraft,
  saveTeacherDraft,
  teacherProblems,
  teacherSubmissions,
  teacherTestResults,
  type TeacherSubmission,
} from "../../data/teacherDemoData";
import { TeacherField, TeacherPageIntro, TeacherSectionTitle } from "./TeacherPageParts";
import { teacherService } from "../../services/teacherService";
import { useLoad } from "../../components/useLoad";

const reviewKey = "querylab:teacher:reviews:v1";
type Review = { finalScore: string; feedback: string; reason: string; savedAt: string };

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

  const selectedResult = filtered.find((item: any) => item.id === selectedResultId) || null;

  function openResultDetails(activity: any) {
    setSelectedActivity(activity);
  }

  if (loading) return <div className="teacher-page"><p>Loading results...</p></div>;
  if (error) return <div className="teacher-page"><p className="teacher-state-error">Failed to load results: {error.message}</p></div>;

  return (
    <section className="teacher-page teacher-results-page">
      <TeacherPageIntro title="Results" context={`Semester 2, 2026 · ${assignments?.length || 0} assignments and contests · ${assignments?.filter((a: any) => a.awaiting > 0).length || 0} awaiting review`} />
      <div className="teacher-divider" />

      <div className="teacher-list-filters teacher-results-filters">
        <TeacherField label="SEARCH">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assignments or contests…" />
        </TeacherField>
        <TeacherField label="CLASS">
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option>All classes</option><option>R11</option><option>R12</option><option>R13</option>
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

      <div className="teacher-result-metrics">
        <div><strong>{assignments?.reduce((sum: number, a: any) => sum + (a.awaiting || 0), 0) || 0}</strong><small>Awaiting review</small></div>
        <div>
          <strong>
            {assignments?.length ? Math.round(assignments.reduce((sum: number, a: any) => sum + parseInt(a.average || "0"), 0) / assignments.length) : 0}%
          </strong>
          <small>Average score</small>
        </div>
        <div>
          <strong>
            {assignments?.reduce((sum: number, a: any) => {
              const parts = (a.submitted || "0/0").split("/");
              return sum + parseInt(parts[0] || "0");
            }, 0) || 0}
          </strong>
          <small>Submissions received</small>
        </div>
      </div>

      <div className="teacher-list-detail-layout teacher-results-detail-layout">
        <div className="teacher-list-detail-main teacher-results-table-wrap">
          <div className="teacher-table-scroll">
            <table className="teacher-table teacher-results-table teacher-activity-results-table">
              <thead>
                <tr>
                  <th>ASSIGNMENT / CONTEST</th><th>TYPE</th><th>CLASSES</th><th>SUBMITTED</th><th>AVG SCORE</th><th>AWAITING REVIEW</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
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
            <button className="button primary teacher-list-detail-edit" type="button" onClick={() => openResultDetails(selectedResult)}>Edit</button>
          </> : <p className="muted">Select a result to view its details.</p>}
        </aside>
      </div>
      <div className="teacher-results-footer">
        <small className="muted">Showing {filtered.length} of {assignments?.length || 0} items</small>
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
        
        {loading && <p>Loading submissions...</p>}
        {error && <p className="teacher-state-error">Failed to load submissions</p>}
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
                    <td className={sub.status === "Needs review" ? "teacher-state-warning" : "teacher-state-success"}>{sub.status}</td>
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
  
  const { data: submission, loading, error, setData: setSubmission } = useLoad(
    () => teacherService.getSubmission(submissionId!)
  );

  const [selectedAttemptNumber, setSelectedAttemptNumber] = useState(1);
  const [finalScore, setFinalScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("No score adjustment");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (submission) {
      setFinalScore(submission.finalScore === null ? "" : `${submission.finalScore} / ${submission.maxScore}`);
      setFeedback("");
    }
  }, [submission]);

  async function saveReview() {
    if (!finalScore.trim() || !submission) return;
    setIsSaving(true);
    try {
      const numericScore = parseInt(finalScore.split("/")[0].trim()) || 0;
      const updated = await teacherService.updateSubmissionReview(submission.id, numericScore, feedback);
      setSubmission(updated);
      setDialogOpen(true);
    } catch (err) {
      console.error("Failed to save review:", err);
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <div className="teacher-page"><p>Loading submission...</p></div>;
  if (error || !submission) return <div className="teacher-page"><p className="teacher-state-error">Error loading submission.</p></div>;

  const attemptHistory = [
    { number: 1, score: submission.autoScore, submittedAt: submission.submittedAt, query: submission.query }
  ];
  const activeAttempt = attemptHistory[0];
  const attemptPassCount = activeAttempt.score >= 8 ? 4 : 3;
  const currentSubmissionIndex = 0; // Pagination can be added later


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
                onClick={() => setSelectedAttemptNumber(attempt.number)}
              >
                Attempt {attempt.number} · {attempt.score} / {submission.maxScore}
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
          <div className="teacher-table-scroll teacher-test-results-wrap">
            <table className="teacher-table teacher-test-results">
              <thead><tr><th>Test</th><th>Result</th><th>Detail</th></tr></thead>
              <tbody>
                {/* We would fetch test cases here, mock for now */}
                <tr>
                  <td data-label="Test">01 · Execution</td>
                  <td data-label="Result" className="teacher-state-success">Passed</td>
                  <td data-label="Detail">Query executed successfully</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <aside className="teacher-grading-panel">
          <TeacherSectionTitle title="Grading" />
          <strong className="teacher-test-summary">Evaluated by platform</strong>
          <p className="teacher-auto-score">Automatic score · {activeAttempt.score} / {submission.maxScore}</p>
          <TeacherField label="FINAL SCORE">
            <input
              value={finalScore}
              onChange={(event) => setFinalScore(event.target.value)}
              aria-label="Final score"
              placeholder={`— / ${submission.maxScore}`}
            />
          </TeacherField>
          <TeacherField label="FEEDBACK">
            <textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
          </TeacherField>
          <TeacherField label="REASON FOR CHANGE">
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </TeacherField>
          <div className="teacher-review-history">
            <TeacherSectionTitle title="Review history" />
            {submission.finalScore !== null ? (
              <p className="tiny muted">Saved in database<br />Final Score: {submission.finalScore}</p>
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
            <button className="button primary" type="button" onClick={() => setDialogOpen(false)}>Continue</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
