import { useState } from "react";
import { Link } from "react-router-dom";
import { problems, type Submission } from "../data/mockData";
import { Dialog, Status } from "./ui";
export function SubmissionDetails({
  submission,
  onClose,
}: {
  submission: Submission;
  onClose: () => void;
}) {
  const [copy, setCopy] = useState("");
  const p = problems.find((p) => p.id === submission.problemId)!;
  // Read the immutable attempt snapshot, never the current draft.
  const query = submission.query;
  return (
    <Dialog
      className="submission-drawer"
      title="Submission details"
      onClose={onClose}
    >
      <div className="submission-detail-content">
        <p className="tiny muted">#{submission.id} · Read-only</p>
        <h1>
          {p.number}. {p.title}
        </h1>
        <p className="tiny muted">
          {new Date(submission.submittedAt).toLocaleString("en-GB", {
            timeZone: "Asia/Ho_Chi_Minh",
          })}{" "}
          ICT
        </p>
        <p className="tiny">
          {submission.source} · {submission.context}
        </p>
        <section className="submission-verdict">
          <Status value={submission.result} />
          <h3>Auto score {submission.score}/100</h3>
          <p className="tiny muted">
            Mock evaluation result. No hidden test cases or answer SQL are
            shown.
          </p>
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
              SQL snapshot is unavailable for this seeded demo record. New
              submissions preserve their SQL.
            </p>
          )}
          <small className="muted">
            Submission snapshot · {submission.database || "Demo database"} ·
            Read-only
          </small>
          <p role="status" className="tiny">
            {copy}
          </p>
        </section>
        <section className="instructor-evaluation">
          <h3>
            Instructor evaluation
            {submission.evaluatedScore !== undefined && (
              <span className="evaluation-score">
                {submission.evaluatedScore}/100
              </span>
            )}
          </h3>
          <p className="tiny muted">
            {submission.feedback ||
              "Not evaluated yet. The auto score remains separate from any future instructor score."}
          </p>
        </section>
      </div>
      <footer className="submission-detail-footer">
        <small className="muted">
          Opening the problem preserves your draft.
        </small>
        <Link className="button primary" to={"/workspace/" + p.id}>
          Open problem
        </Link>
      </footer>
    </Dialog>
  );
}
