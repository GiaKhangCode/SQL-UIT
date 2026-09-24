import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

export function ResultsDashboardPage() {
  const navigate = useNavigate();
  const [classFilter, setClassFilter] = useState("IS207.R11");
  const [assignmentFilter, setAssignmentFilter] = useState("Week 3 — JOIN practice");
  const [statusFilter, setStatusFilter] = useState("All submissions");

  const filtered = useMemo(
    () =>
      teacherSubmissions.filter((submission) => {
        if (
          classFilter !== "IS207.R11" ||
          assignmentFilter !== "Week 3 — JOIN practice"
        ) {
          return false;
        }
        if (statusFilter === "Needs review" && submission.status !== "Needs review") return false;
        if (statusFilter === "Reviewed" && submission.status !== "Accepted") return false;
        return true;
      }),
    [assignmentFilter, classFilter, statusFilter],
  );

  function exportCsv() {
    const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ["Student", "Problem", "Auto", "Final", "Status"],
      ...filtered.map((row) => [row.student, row.problem, `${row.autoScore}/${row.maxScore}`, row.finalScore === null ? "" : `${row.finalScore}/${row.maxScore}`, row.status]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "teacher-results-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openReview(submission: TeacherSubmission) {
    navigate(`/teacher/results/review/${submission.id}`);
  }

  return (
    <section className="teacher-page teacher-results-page">
      <TeacherPageIntro
        title="Results"
        context={`${classFilter} / ${assignmentFilter}`}
      >
        <button className="button primary" type="button" onClick={exportCsv}>
          Export CSV
        </button>
      </TeacherPageIntro>
      <div className="teacher-divider" />

      <div className="teacher-results-filters">
        <TeacherField label="CLASS">
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option>IS207.R11</option>
            <option>IS207.R12</option>
            <option>IS207.R13</option>
          </select>
        </TeacherField>
        <TeacherField label="ASSIGNMENT">
          <select value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}>
            <option>Week 3 — JOIN practice</option>
            <option>SQL Sprint #06</option>
            <option>Revenue by category</option>
          </select>
        </TeacherField>
        <TeacherField label="REVIEW STATUS">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All submissions</option>
            <option>Needs review</option>
            <option>Reviewed</option>
          </select>
        </TeacherField>
      </div>

      <div className="teacher-result-metrics">
        <div><strong>38 / 42</strong><small>Students submitted</small></div>
        <div><strong>82%</strong><small>Average score</small></div>
        <div><strong>6</strong><small>Awaiting review</small></div>
      </div>

      <div className="teacher-results-table-wrap">
        <div className="teacher-table-scroll">
          <table className="teacher-table teacher-results-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Problem</th>
                <th>Attempts</th>
                <th>Auto</th>
                <th>Final</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((submission) => (
                <tr key={submission.id}>
                  <td data-label="Student">{submission.student}</td>
                  <td data-label="Problem">{submission.problem}</td>
                  <td data-label="Attempts">{submission.attempts}</td>
                  <td data-label="Auto">{submission.autoScore} / {submission.maxScore}</td>
                  <td data-label="Final">{submission.finalScore === null ? "—" : `${submission.finalScore} / ${submission.maxScore}`}</td>
                  <td data-label="Status">
                    {submission.status === "Needs review"
                      ? <span className="teacher-state-warning">Needs review</span>
                      : <span className="teacher-state-success">Accepted</span>}
                  </td>
                  <td data-label="Actions"><button className="teacher-status-review" type="button" onClick={() => openReview(submission)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="teacher-results-footer">
        <button
          className="button"
          type="button"
          onClick={() => navigate("/teacher/results/review/1042")}
        >
          Open manual review
        </button>
        <small className="muted">Showing {filtered.length} of 38 submissions · Demo data</small>
      </div>
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
                    <td data-label="Detail">{testIndex < attemptPassCount ? test.detail : "Expected output mismatch"}</td>
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
