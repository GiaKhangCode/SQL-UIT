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

const activityResults: ActivityResult[] = [
  { id: "week-3", title: "Week 3 — JOIN practice", type: "Assignment", classes: "R11 · R12", submitted: "38 / 42", average: "82%", awaiting: 6, reviewId: "1042" },
  { id: "sprint-05", title: "SQL Sprint #05", type: "Contest", classes: "R11 · R12", submitted: "57 / 84", average: "64%", awaiting: 0 },
  { id: "week-2", title: "Week 2 — SELECT basics", type: "Assignment", classes: "R11", submitted: "42 / 42", average: "88%", awaiting: 0 },
  { id: "sprint-04", title: "SQL Sprint #04", type: "Contest", classes: "R11 · R12", submitted: "79 / 84", average: "71%", awaiting: 3, reviewId: "1043" },
  { id: "week-1", title: "Week 1 — Warm-up", type: "Assignment", classes: "R12", submitted: "39 / 39", average: "91%", awaiting: 0 },
  { id: "sprint-03", title: "SQL Sprint #03", type: "Contest", classes: "R11", submitted: "40 / 42", average: "69%", awaiting: 0 },
];

export function ResultsDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [classFilter, setClassFilter] = useState("All classes");
  const [typeFilter, setTypeFilter] = useState("All types");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedResultId, setSelectedResultId] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityResult | null>(null);

  const filtered = useMemo(
    () => activityResults.filter((item) =>
      `${item.title} ${item.classes}`.toLowerCase().includes(search.toLowerCase()) &&
      (classFilter === "All classes" || item.classes.includes(classFilter)) &&
      (typeFilter === "All types" || item.type === typeFilter) &&
      (statusFilter === "All" || (statusFilter === "Awaiting review" ? item.awaiting > 0 : item.awaiting === 0)),
    ),
    [search, classFilter, typeFilter, statusFilter],
  );
  const selectedResult = filtered.find((item) => item.id === selectedResultId) || null;

  function openResultDetails(activity: ActivityResult) {
    setSelectedActivity(activity);
  }

  return (
    <section className="teacher-page teacher-results-page">
      <TeacherPageIntro title="Results" context="Semester 2, 2026 · 9 assignments and contests · 6 awaiting review" />
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
        <div><strong>6</strong><small>Awaiting review</small></div>
        <div><strong>82%</strong><small>Average score</small></div>
        <div><strong>164</strong><small>Submissions received</small></div>
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
                    <td data-label="TYPE">{item.type}</td>
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
            <p className="muted">{selectedResult.type} · {selectedResult.classes}</p>
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
        <small className="muted">Showing {filtered.length} of 9 items</small>
      </div>
      {selectedActivity && <Dialog title={selectedActivity.title} onClose={() => setSelectedActivity(null)}>
        <div className="teacher-preview-dialog"><p>{selectedActivity.type} · {selectedActivity.classes}</p><p>{selectedActivity.submitted} submitted · {selectedActivity.average} average · {selectedActivity.awaiting} awaiting review</p><div className="teacher-dialog-actions"><button className="button" type="button" onClick={() => setSelectedActivity(null)}>Close</button>{selectedActivity.reviewId && <button className="button primary" type="button" onClick={() => navigate(`/teacher/results/review/${selectedActivity.reviewId}`)}>Review a submission</button>}</div></div>
      </Dialog>}
    </section>
  );
}

export function ManualReviewPage() {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const submission =
    teacherSubmissions.find((item) => item.id === submissionId) || teacherSubmissions[0];
  const [selectedAttemptNumber, setSelectedAttemptNumber] = useState(submission.id === "1042" ? 2 : 1);
  const attemptHistory = submission.id === "1042"
    ? [
        {
          number: 1,
          score: 6,
          submittedAt: "Sep 18, 14:10",
          query: `SELECT c.customer_id, c.customer_name\nFROM Customers AS c\nLEFT JOIN Orders AS o\n  ON c.customer_id = o.customer_id\nWHERE o.order_id IS NULL;`,
        },
        { number: 2, score: 8, submittedAt: submission.submittedAt, query: submission.query },
      ]
    : [{ number: 1, score: submission.autoScore, submittedAt: submission.submittedAt, query: submission.query }];
  const activeAttempt = attemptHistory.find((attempt) => attempt.number === selectedAttemptNumber) || attemptHistory[attemptHistory.length - 1];
  const attemptPassCount = activeAttempt.score >= 8 ? 4 : 3;
  const currentSubmissionIndex = teacherSubmissions.findIndex((item) => item.id === submission.id);
  const savedReviews = readTeacherDraft<Record<string, Review>>(reviewKey, {});
  const existing = savedReviews[submission.id];
  const [finalScore, setFinalScore] = useState(existing?.finalScore || (submission.finalScore === null ? "" : `${submission.finalScore} / ${submission.maxScore}`));
  const [feedback, setFeedback] = useState(existing?.feedback || (submission.id === "1042" ? "Correct JOIN and NULL handling. Add ORDER BY customer_id to meet the required output order." : "Review the aggregation and sorting against the problem requirements."));
  const [reason, setReason] = useState(existing?.reason || "No score adjustment");
  const [savedReview, setSavedReview] = useState(existing);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const saved = readTeacherDraft<Record<string, Review>>(reviewKey, {})[submission.id];
    setSelectedAttemptNumber(submission.id === "1042" ? 2 : 1);
    setFinalScore(saved?.finalScore || (submission.finalScore === null ? "" : `${submission.finalScore} / ${submission.maxScore}`));
    setFeedback(saved?.feedback || (submission.id === "1042" ? "Correct JOIN and NULL handling. Add ORDER BY customer_id to meet the required output order." : "Review the aggregation and sorting against the problem requirements."));
    setReason(saved?.reason || "No score adjustment");
    setSavedReview(saved);
  }, [submission.id]);

  const problem = teacherProblems.find((item) => item.title === submission.problem) || teacherProblems[0];

  function saveReview() {
    if (!finalScore.trim()) return;
    const nextReview = {
      finalScore: finalScore.trim(),
      feedback: feedback.trim(),
      reason: reason.trim(),
      savedAt: new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const next = { ...savedReviews, [submission.id]: nextReview };
    saveTeacherDraft(reviewKey, next);
    setSavedReview(nextReview);
    setDialogOpen(true);
  }

  return (
    <section className="teacher-page teacher-review-page">
      <TeacherPageIntro
        title="Manual review"
        context={`${submission.student} / ${submission.problem} / Attempt ${activeAttempt.number} of 3 / Submission #${submission.id}`}
      >
        <Link className="button" to="/teacher/results">Back to results</Link>
        <button className="button primary" type="button" onClick={saveReview}>Save review</button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-review-layout">
        <div className="teacher-review-main">
          <div className="teacher-attempt-switcher">
            <span className="teacher-attempt-label">ATTEMPT</span>
            {attemptHistory.slice().reverse().map((attempt) => (
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
            <button className="button teacher-small-button" type="button" onClick={() => navigate(`/teacher/results/review/${teacherSubmissions[(currentSubmissionIndex - 1 + teacherSubmissions.length) % teacherSubmissions.length].id}`)}>‹ Previous</button>
            <button className="button teacher-small-button" type="button" onClick={() => navigate(`/teacher/results/review/${teacherSubmissions[(currentSubmissionIndex + 1) % teacherSubmissions.length].id}`)}>Next ›</button>
          </div>
          <section className="teacher-review-code-section">
            <h2>Student SQL · submitted {activeAttempt.submittedAt}</h2>
            <pre className="teacher-readonly-code"><code>{activeAttempt.query}</code></pre>
          </section>
          <section className="teacher-review-code-section">
            <h2>Reference SQL</h2>
            <pre className="teacher-readonly-code"><code>{problem.referenceSolution}</code></pre>
          </section>
          <div className="teacher-table-scroll teacher-test-results-wrap">
            <table className="teacher-table teacher-test-results">
              <thead><tr><th>Test</th><th>Result</th><th>Detail</th></tr></thead>
              <tbody>
                {teacherTestResults.map((test, testIndex) => (
                  <tr key={test.test}>
                    <td data-label="Test">{test.test}</td>
                    <td data-label="Result" className={testIndex < attemptPassCount ? "teacher-state-success" : "teacher-state-failed"}>{testIndex < attemptPassCount ? "Passed" : "Failed"}</td>
                    <td data-label="Detail">{test.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="teacher-grading-panel">
          <TeacherSectionTitle title="Grading" />
          <strong className="teacher-test-summary">{attemptPassCount} / 5 tests passed</strong>
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
            {savedReview ? (
              <p className="tiny muted">Saved by Huy Lai · {savedReview.savedAt}<br />{savedReview.reason}</p>
            ) : (
              <p className="tiny muted">No manual changes yet.<br />Your saved review will include your name and time.</p>
            )}
          </div>
        </aside>
      </div>
      {dialogOpen && (
        <Dialog title="Review saved" onClose={() => setDialogOpen(false)}>
          <p className="tiny">This review is stored in the local teacher demo.</p>
          <p className="tiny muted">No grading API is connected.</p>
          <button className="button primary" type="button" onClick={() => setDialogOpen(false)}>Continue</button>
        </Dialog>
      )}
    </section>
  );
}
