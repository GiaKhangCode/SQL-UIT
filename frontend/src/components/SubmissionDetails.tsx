import { useState } from "react";
import { Link } from "react-router-dom";
import { type Submission } from "../data/models";
import { Dialog, Status } from "./ui";
import { submissionTimeLabel } from "../utils/serverDateTime";
export function SubmissionDetails({
  submission,
  problem,
  onClose,
}: {
  submission: Submission;
  problem: any;
  onClose: () => void;
}) {
  const [copy, setCopy] = useState("");
  const p = problem;
  // Read the immutable attempt snapshot, never the current draft.
  const query = submission.query;
  return (
    <Dialog
      className="submission-drawer"
      title="Submission details"
      onClose={onClose}
    >
      <div className="submission-detail-content">
        <p className="tiny muted submission-detail-id">
          #{submission.id} · Read-only
        </p>
        <h1>
          {p.number}. {p.title}
        </h1>
        <p className="tiny muted">
          {submissionTimeLabel(submission.submittedAt)}
        </p>
        <p className="tiny">
          {submission.source} · {submission.contextTitle || submission.context}
        </p>
        <section
          className="submission-evaluation"
          aria-label="Submission evaluation"
        >
          <div className="submission-verdict">
            <Status value={submission.result} />
            <p className="tiny muted">
              {submission.result === "Accepted"
                ? "The automatic evaluation accepted this submission."
                : "Automatic evaluation result"}
            </p>
          </div>
          <div className="submission-score-grid">
            <div>
              <small>Auto score</small>
              <strong>{submission.score}/100</strong>
            </div>
            <div>
              <small>Final score</small>
              <strong>
                {submission.evaluatedScore == null
                  ? "Pending"
                  : `${submission.evaluatedScore}/100`}
              </strong>
            </div>
          </div>
        </section>
        <section className="submitted-query">
          <div className="section-heading">
            <h3>Submitted SQL</h3>
            {query && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(query);
                    setCopy("Copied SQL.");
                  } catch {
                    setCopy(
                      "Copy unavailable. Select the SQL below to copy manually.",
                    );
                  }
                }}
              >
                Copy
              </button>
            )}
          </div>
          {query ? (
            <pre tabIndex={0} aria-label="Submitted SQL snapshot">
              <code>{query}</code>
            </pre>
          ) : (
            <p className="tiny muted">
              SQL snapshot is unavailable for this submission.
            </p>
          )}
          <small className="muted">
            Submission snapshot · {submission.database || "Database unavailable"} ·
            Read-only
          </small>
          <p role="status" className="tiny">
            {copy}
          </p>
        </section>
        <section className="instructor-evaluation">
          <h3>Instructor comments</h3>
          <p className="tiny muted">
            {submission.feedback ||
              "No instructor comments yet. The final score remains pending."}
          </p>
        </section>
      </div>
      <footer className="submission-detail-footer">
        <small className="muted">
          Read-only submission · your problem draft is preserved.
        </small>
        <Link className="button primary" to={"/workspace/" + p.id}>
          Open problem
        </Link>
      </footer>
    </Dialog>
  );
}
